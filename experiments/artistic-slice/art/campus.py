"""Build an original brick campus in Blender 4.3 and export the Y-up web scene.

blender -b -t 2 --python-exit-code 1 --python campus.py
"""
from collections import OrderedDict
from math import cos, floor, pi, sin, sqrt
import os
from pathlib import Path
from random import Random
import struct
from tempfile import TemporaryDirectory
import zlib

import bpy
import numpy as np


ASSETS = Path(__file__).resolve().parents[1] / "public" / "assets"
ASSETS.mkdir(parents=True, exist_ok=True)


def linear(channel):
    return ((channel + 0.055) / 1.055) ** 2.4 if channel > 0.04045 else channel / 12.92


def color(code):
    code = code.lstrip("#")
    return tuple(linear(int(code[n:n + 2], 16) / 255) for n in (0, 2, 4)) + (1.0,)


def png(path, pixels):
    """Write deterministic RGB PNG pixels without any external image libraries."""
    height, width, _ = pixels.shape

    def chunk(kind, payload):
        return struct.pack(">I", len(payload)) + kind + payload + struct.pack(">I", zlib.crc32(kind + payload))

    rows = b"".join(b"\x00" + row.tobytes() for row in pixels)
    path.write_bytes(
        b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", struct.pack(">IIBBBBB", width, height, 8, 2, 0, 0, 0))
        + chunk(b"IDAT", zlib.compress(rows, 9))
        + chunk(b"IEND", b"")
    )


def texture_material(key, roughness, maps, tile, metalness=0):
    mat = bpy.data.materials.new(key)
    mat.use_nodes = True
    shader = mat.node_tree.nodes.get("Principled BSDF")
    shader.inputs["Roughness"].default_value = roughness
    shader.inputs["Metallic"].default_value = metalness
    base, normal = maps
    albedo = mat.node_tree.nodes.new("ShaderNodeTexImage")
    albedo.label = "Couleur originale"
    # Preserve the lossless normals. A high-quality JPEG suffices for the albedo.
    albedo_draft = bpy.data.images.load(str(base))
    albedo_path = base.with_suffix(".jpg")
    albedo_draft.file_format = "JPEG"
    albedo_draft.save(filepath=str(albedo_path), quality=94)
    bpy.data.images.remove(albedo_draft)
    albedo.image = bpy.data.images.load(str(albedo_path))
    albedo.image.pack()
    mat.node_tree.links.new(albedo.outputs["Color"], shader.inputs["Base Color"])
    mat.diffuse_color = tuple(float(c) for c in albedo.image.pixels[0:4])

    detail = mat.node_tree.nodes.new("ShaderNodeTexImage")
    detail.label = "Relief de surface"
    detail.image = bpy.data.images.load(str(normal))
    detail.image.colorspace_settings.name = "Non-Color"
    detail.image.pack()
    tangent_normal = mat.node_tree.nodes.new("ShaderNodeNormalMap")
    tangent_normal.inputs["Strength"].default_value = 0.80
    mat.node_tree.links.new(detail.outputs["Color"], tangent_normal.inputs["Color"])
    mat.node_tree.links.new(tangent_normal.outputs["Normal"], shader.inputs["Normal"])
    return mat, tile


def plain(key, tint, roughness=0.82, metalness=0.0, emission=0.0):
    mat = bpy.data.materials.new(key)
    mat.use_nodes = True
    mat.diffuse_color = color(tint)
    shader = mat.node_tree.nodes.get("Principled BSDF")
    shader.inputs["Base Color"].default_value = mat.diffuse_color
    shader.inputs["Roughness"].default_value = roughness
    shader.inputs["Metallic"].default_value = metalness
    shader.inputs["Emission Color"].default_value = mat.diffuse_color
    shader.inputs["Emission Strength"].default_value = emission
    return mat, (1.0, 1.0)


def make_texture(directory, label, tile_color, joints, rows, columns, stagger, seed):
    """Seamless, staggered masonry. Build normal vectors from the same joints."""
    side = 256
    rng = np.random.default_rng(seed)
    x, y = np.meshgrid(np.arange(side) / side, np.arange(side) / side)
    row = np.floor(y * rows).astype(int)
    column_pos = x * columns + (row % 2) * stagger
    column = np.floor(column_pos).astype(int) % columns
    dx = column_pos % 1.0
    dy = y * rows % 1.0
    edge = np.minimum(dx, 1 - dx)
    vertical_edge = np.minimum(dy, 1 - dy)
    warp = .009 * np.sin(78 * x + 32 * y) + .006 * np.cos(110 * x - 54 * y)
    inset_x = np.clip((edge + warp - .031) / .035, 0, 1)
    inset_y = np.clip((vertical_edge + warp - .038) / .055, 0, 1)
    surface = inset_x * inset_y
    tone = rng.uniform(-1, 1, (rows, columns))[row, column]
    freckles = rng.normal(0, 1.0, (side, side))
    grit = 2.8 * np.sin(x * 317 + y * 109) + 1.7 * np.cos(y * 196 - x * 71) + 2.6 * freckles
    warm = tone[:, :, None] * np.array([15., 11., 8.])
    brick = np.array(tile_color) + warm + grit[:, :, None] + 4 * np.sin(15 * x - 27 * y)[:, :, None]
    mortar = np.array(joints) + (2.7 * freckles)[:, :, None]
    albedo = surface[:, :, None] * brick + (1 - surface[:, :, None]) * mortar
    albedo += (3.5 * np.clip((dy - .85) * 6, 0, 1) * surface)[:, :, None]
    relief = np.round(surface * 18 + grit * .08, 1)
    slope_x = (np.roll(relief, -1, 1) - np.roll(relief, 1, 1)) * .028
    slope_y = (np.roll(relief, -1, 0) - np.roll(relief, 1, 0)) * .028
    normal = np.stack((-slope_x, slope_y, np.ones_like(relief)), axis=-1)
    normal /= np.linalg.norm(normal, axis=-1, keepdims=True)
    normal = np.rint(normal * 127.5 + 127.5)
    base_path = directory / f"{label}-couleur.png"
    normal_path = directory / f"{label}-relief.png"
    png(base_path, np.clip(albedo, 0, 255).astype(np.uint8))
    png(normal_path, np.clip(normal, 0, 255).astype(np.uint8))
    return base_path, normal_path


def bark_texture(directory):
    """Draw vertically long fissures and shallower secondary grain."""
    side = 128
    rng = np.random.default_rng(50462)
    x, y = np.meshgrid(np.arange(side) / side, np.arange(side) / side)
    bend = .021 * np.sin(2 * pi * y) + .008 * np.cos(6 * pi * y)
    shaped_x = x + bend
    hewn = np.sin(2 * pi * (shaped_x * 12 + .17 * np.cos(2 * pi * y)))
    fineline = np.sin(2 * pi * (shaped_x * 27 + .47 * np.cos(4 * pi * y)))
    fleck = rng.uniform(-2.2, 2.2, (side, side))
    fissure = np.clip((hewn - .56) * 48, 0, 19)
    height = 9 - fissure + 2 * fineline + fleck
    tint = (height - 7) * .98 + 6 * hewn + fleck * .8
    albedo = np.array([101., 82., 65.])[None, None, :] + tint[:, :, None]
    slope_x = (np.roll(height, -1, 1) - np.roll(height, 1, 1)) * .035
    slope_y = (np.roll(height, -1, 0) - np.roll(height, 1, 0)) * .035
    normal = np.stack((-slope_x, slope_y, np.ones_like(height)), axis=-1)
    normal /= np.linalg.norm(normal, axis=-1, keepdims=True)
    normal = np.rint(normal * 127.5 + 127.5)
    albedo_path = directory / "ecorce-couleur.png"
    normal_path = directory / "ecorce-relief.png"
    png(albedo_path, np.clip(albedo, 0, 255).astype(np.uint8))
    png(normal_path, np.clip(normal, 0, 255).astype(np.uint8))
    return albedo_path, normal_path


def materials(directory):
    def masonry(key, swatch, mortar, rows, columns, stagger, seed, tile, roughness, metalness=0):
        maps = make_texture(directory, key.lower(), swatch, mortar, rows, columns, stagger, seed)
        return texture_material(key, roughness, maps, tile, metalness)

    values = {
        "brick": masonry("Briques", (147, 90, 69), (118, 109, 98), 16, 8, .5, 5, (1.84, 1.52), .85),
        "slate": masonry("Ardoises", (60, 70, 87), (47, 56, 69), 8, 7, .5, 9, (1.66, 1.22), .58),
        "paving": masonry("Pavés", (105, 109, 115), (60, 62, 66), 8, 8, .5, 12, (1.92, 1.18), .48, .025),
        "stone": plain("Calcaire patiné", "#b5a085", .87),
        "stone_light": plain("Calcaire d’arête", "#c9b599", .76),
        "stone_dark": plain("Soubassement", "#827769", .9),
        "mortar": plain("Joints de pierre", "#8c7e6c", .86),
        "flashing": plain("Zinc et ferronnerie", "#3f4854", .47, .42),
        "glazing": plain("Vitrage bleu", "#57728a", .29, .19),
        "glazing_light": plain("Vitrage clair", "#7995a7", .25, .22),
        "glazing_dark": plain("Vitrage dans l’ombre", "#334b5a", .28, .28),
        "glazing_warm": plain("Vitrage d’entrée chaud", "#635a45", .34, .14, .13),
        "cream": plain("Menuiserie claire", "#d8c4a3", .69),
        "door": plain("Menuiserie d’entrée", "#263b48", .49, .25),
        "passage": plain("Ombre du porche", "#263238", .83),
        "lamp": plain("Lanterne ambrée", "#ffd09a", .36, .09, .72),
        "soil": plain("Terre des massifs", "#493a2c", .97),
        "wood": plain("Lames de chêne huilé", "#7d553a", .79),
        "wood_light": plain("Chêne sur le fil", "#997153", .72),
        "iron": plain("Fonte", "#354247", .59, .27),
        "bark": texture_material("Écorce rugueuse", .95, bark_texture(directory), (1.0, 1.0)),
        "green1": plain("Feuillage sous-bois", "#566032", .9),
        "green2": plain("Feuillage olive", "#717544", .87),
        "green3": plain("Feuillage verge d’or", "#91924e", .83),
        "yellow": plain("Feuilles dorées", "#be7b29", .82),
        "gold": plain("Feuilles jaune clair", "#df9327", .82),
        "orange": plain("Feuilles orangées", "#b85822", .84),
        "red": plain("Feuilles rousses", "#934427", .87),
        "red_dark": plain("Feuilles rouges en ombre", "#783b27", .87),
        "flower1": plain("Chrysanthèmes mauves", "#a76679", .81),
        "flower2": plain("Chrysanthèmes cuivre", "#c07c45", .81),
        "flower3": plain("Chrysanthèmes crème", "#d8c491", .78),
    }
    for key in ["green1", "green2", "green3", "yellow", "gold", "orange", "red", "red_dark",
                "flower1", "flower2", "flower3"]:
        values[key][0].use_backface_culling = False
    return values


class Batch:
    """Collect opaque and double-sided faces into a small number of draw groups."""

    def __init__(self, name, surfaces, origin=(0, 0), angle=0):
        self.name = name
        self.surfaces = surfaces
        self.origin = origin
        self.cosine = cos(angle)
        self.sine = sin(angle)
        self.vertices = []
        self.faces = []
        self.uv = []
        self.face_materials = []
        self.used = OrderedDict()

    def point(self, p):
        x, y, z = p
        return (self.origin[0] + x * self.cosine + z * self.sine,
                y, self.origin[1] - x * self.sine + z * self.cosine)

    def face(self, points, mat, uv=None):
        indices = range(len(self.vertices), len(self.vertices) + len(points))
        self.faces.append(tuple(indices))
        self.vertices.extend((x, -z, y) for x, y, z in map(self.point, points))
        if mat not in self.used:
            self.used[mat] = len(self.used)
        self.face_materials.append(self.used[mat])
        if uv is not None:
            self.uv.extend(uv)
            return
        a, b, c = (np.array(p) for p in points[:3])
        delta = np.abs(np.cross(b - a, c - a))
        u_axis, v_axis = [(2, 1), (0, 2), (0, 1)][int(np.argmax(delta))]
        ut, vt = self.surfaces[mat][1]
        self.uv.extend((p[u_axis] / ut, p[v_axis] / vt) for p in points)

    def box(self, center, dimensions, mat, omit=()):
        x, y, z = center
        width, height, depth = (v / 2 for v in dimensions)
        v = [(x - width, y - height, z - depth), (x + width, y - height, z - depth),
             (x + width, y + height, z - depth), (x - width, y + height, z - depth),
             (x - width, y - height, z + depth), (x + width, y - height, z + depth),
             (x + width, y + height, z + depth), (x - width, y + height, z + depth)]
        faces = ((4, 5, 6, 7), (1, 0, 3, 2), (5, 1, 2, 6),
                 (0, 4, 7, 3), (7, 6, 2, 3), (0, 1, 5, 4))
        for idx, face in enumerate(faces):
            if idx not in omit:
                self.face([v[i] for i in face], mat)

    def polywall(self, shape, front, back, mat):
        """Extrude a convex outline listed counterclockwise in the elevation."""
        self.face([(x, y, front) for x, y in shape], mat)
        self.face([(x, y, back) for x, y in reversed(shape)], mat)
        for i, (x, y) in enumerate(shape):
            x2, y2 = shape[(i + 1) % len(shape)]
            self.face([(x, y, back), (x2, y2, back), (x2, y2, front), (x, y, front)], mat)

    def finish(self):
        mesh = bpy.data.meshes.new(self.name)
        mesh.from_pydata(self.vertices, [], self.faces)
        mesh.update()
        uv = mesh.uv_layers.new(name="UVMap")
        uv.data.foreach_set("uv", [v for pair in self.uv for v in pair])
        for mat in self.used:
            mesh.materials.append(self.surfaces[mat][0])
        mesh.polygons.foreach_set("material_index", self.face_materials)
        obj = bpy.data.objects.new(self.name, mesh)
        bpy.context.collection.objects.link(obj)
        return obj


def windows(batch, x, bottom, z, width, height, index):
    y = bottom + height / 2
    batch.box((x, y, z + .01), (width + .24, height + .26, .16), "stone")
    batch.box((x, y, z + .104), (width + .045, height + .025, .05), "door", omit=(1,))
    batch.box((x, y, z + .137), (width - .017, height - .045, .018),
              ("glazing", "glazing_light", "glazing_dark")[index % 3], omit=(1, 2, 3, 4, 5))
    for side in (-1, 1):
        batch.box((x + side * width / 2, y, z + .155), (.055, height + .025, .07), "cream")
    for offset in (-.50, -.10, .50):
        batch.box((x, y + offset * height, z + .155), (width + .05, .049, .07), "cream")
    batch.box((x, y, z + .155), (.044, height, .066), "cream")
    batch.box((x, y - height / 2 - .115, z + .118), (width + .44, .109, .30), "stone_light")
    batch.box((x, y + height / 2 + .121, z + .105), (width + .26, .103, .225), "stone_light")
    if height > 1.15:
        batch.box((x, y - .46 * height, z + .241), (width + .03, .052, .036), "iron")
        for offset in (-.42, -.21, 0, .21, .42):
            batch.box((x + offset * width, y - .36 * height, z + .244), (.025, .26, .026), "iron")
        if index % 7 == 1:
            # A dimmed pane suggests an interior blind in a small subset of bays.
            batch.box((x + width * .25, y + height * .14, z + .150),
                      (width * .41, height * .42, .006), "glazing_dark", omit=(1, 2, 3, 4, 5))


def roof(batch, width, depth, top, pitch):
    w, d = width / 2 + .16, depth / 2 + .18
    apex = top + pitch
    batch.face([(-w, top, -d), (-w, apex, 0), (-w, top, d)], "brick")
    batch.face([(w, top, d), (w, apex, 0), (w, top, -d)], "brick")
    batch.face([(-w, top, d), (w, top, d), (w, apex, 0), (-w, apex, 0)], "slate")
    batch.face([(w, top, -d), (-w, top, -d), (-w, apex, 0), (w, apex, 0)], "slate")
    batch.box((0, apex - .017, 0), (2 * w + .04, .08, .17), "flashing")
    for side in (-1, 1):
        batch.box((0, top + .046, side * d), (2 * w + .03, .121, .14), "flashing")
    for x in np.linspace(-w + .30, w - .30, max(2, round(2 * w / 1.35))):
        line = .020
        batch.face([(x - line, top + .035, d), (x + line, top + .035, d),
                    (x + line, apex + .035, 0), (x - line, apex + .035, 0)], "flashing")


def gable(batch, x, z, bottom, width, height):
    lo, hi = x - width / 2, x + width / 2
    batch.polywall([(lo, bottom), (hi, bottom), (x, bottom + height)], z + .14, z - .45, "brick")
    for a, b in [(lo, x), (x, hi)]:
        rise = height if a == lo else -height
        y = bottom if a == lo else bottom + height
        batch.face([(a, y + .07, z + .22), (b, y + rise + .07, z + .22),
                    (b, y + rise + .07, z - .48), (a, y + .07, z - .48)], "slate")
        batch.face([(a, y - .07, z + .22), (b, y + rise - .07, z + .22),
                    (b, y + rise + .075, z + .22), (a, y + .075, z + .22)], "stone_light")
    batch.box((x, bottom, z + .144), (width + .22, .13, .24), "stone")
    windows(batch, x, bottom + .15, z + .147, width * .18, height * .45, 2)


def arch(batch, x, y, z, radius, lower, key, light=False):
    opening = [(x - radius, lower), (x + radius, lower)]
    opening += [(x + cos(pi * i / 24) * radius, y + sin(pi * i / 24) * radius) for i in range(25)]
    batch.polywall(opening, z, z - .055, key)
    if light:
        transom = [(x - radius * .96, y + .025), (x + radius * .96, y + .025)]
        transom += [(x + cos(pi * i / 20) * radius * .96, y + sin(pi * i / 20) * radius * .96)
                    for i in range(1, 20)]
        batch.face([(tx, ty, z + .008) for tx, ty in transom], "glazing_warm")
        for pane in (-1, 1):
            batch.box((x + pane * .38, lower + .77, z + .012), (.34, 1.02, .009),
                      "glazing_warm", omit=(1, 2, 3, 4, 5))

    for direction in (-1, 1):
        batch.box((x + direction * (radius + .186), (y + lower) / 2, z + .10),
                  (.365, y - lower, .43), "stone")
        batch.box((x + direction * (radius + .186), lower + .165, z + .15),
                  (.51, .29, .52), "stone_dark")
        batch.box((x + direction * (radius + .19), y - .07, z + .19),
                  (.47, .16, .59), "stone_light")

    for i in range(19):
        a, b = pi * i / 19 + .010, pi * (i + 1) / 19 - .010
        outer = radius + (.405 if i == 9 else .346)
        inner = radius - .007
        shape = [(x + inner * cos(a), y + inner * sin(a)), (x + outer * cos(a), y + outer * sin(a)),
                 (x + outer * cos(b), y + outer * sin(b)), (x + inner * cos(b), y + inner * sin(b))]
        batch.polywall(shape, z + .27, z - .18, "stone_light" if i % 3 != 1 else "stone")

    batches = 5 if radius > 1 else 3
    for i in range(batches + 1):
        dx = (i / batches * 2 - 1) * radius * .90
        top = y + sqrt(radius ** 2 - dx ** 2)
        batch.box((x + dx, (lower + top) / 2, z + .022), (.034, top - lower, .064), "door", omit=(1,))
    batch.box((x, y - .055, z + .043), (radius * 1.99, .088, .074), "door", omit=(1,))
    batch.box((x, lower + .34, z + .041), (radius * 1.99, .095, .068), "door", omit=(1,))
    if light:
        for handle in (-.092, .092):
            batch.box((x + handle, lower + .92, z + .072), (.035, .26, .04), "stone")


def lantern(batch, x, y, z):
    batch.box((x, y - .10, z), (.21, .077, .35), "iron")
    batch.box((x, y + .04, z + .14), (.17, .28, .17), "lamp")
    for dx, dz in [(-.085, -.085), (.085, -.085), (-.085, .085), (.085, .085)]:
        batch.box((x + dx, y + .043, z + .14 + dz), (.024, .32, .025), "iron")
    batch.box((x, y + .202, z + .14), (.24, .07, .24), "iron")
    batch.box((x, y - .11, z + .14), (.21, .062, .21), "flashing")
    batch.box((x, y + .251, z + .14), (.105, .044, .105), "flashing")


def building(batch, width, depth, height, bays, floor_heights, pitch, central=False, gables=()):
    z = depth / 2
    batch.box((0, height / 2, 0), (width, height, depth), "brick", omit=(5,))
    batch.box((0, .25, z + .015), (width + .08, .50, .16), "stone_dark")
    batch.box((0, .55, z + .026), (width + .15, .12, .205), "stone")
    for level in floor_heights[1:]:
        batch.box((0, level - .22, z + .012), (width + .11, .102, .15), "stone")
    batch.box((0, height - .118, z + .055), (width + .27, .225, .29), "stone")
    batch.box((0, height + .007, z + .074), (width + .39, .104, .35), "stone_light")

    for side in (-1, 1):
        for course in range(9):
            post_y = .89 + course * (height - 1.04) / 9.5
            span = .29 if course % 2 else .43
            batch.box((side * (width / 2 - span / 2), post_y, z + .038),
                      (span, .25, .11), "stone", omit=(1,))

    for index, x in enumerate(bays):
        for floor_no, y in enumerate(floor_heights):
            if central and abs(x) < 1.92 and floor_no == 0:
                continue
            pane_index = index * 11 + floor_no * 7 + int(abs(batch.origin[0]) * 7)
            windows(batch, x, y, z, .83 if central else .93,
                    1.35 if floor_no == 0 else 1.25, pane_index)

    roof(batch, width, depth, height, pitch)
    for x in gables:
        gable(batch, x, z + .075, height - .055, 2.82 if central else 2.25, pitch * .81)
    if not central and width < 12:
        for side in (-1, 1):
            x = side * width * .32
            chimney_height = height + pitch + .22 + .15 * side
            batch.box((x, chimney_height - .44, -.86), (.53, .90, .65), "brick", omit=(5,))
            batch.box((x, chimney_height + .031, -.86), (.69, .082, .80), "stone_dark")
            cylinder(batch, (x, chimney_height + .067, -.86), (x, chimney_height + .289, -.86),
                     .127, .107, "flashing", 8)

    if central:
        batch.box((0, .05, z + .26), (3.63, .10, .64), "stone_dark")
        batch.box((0, .107, z + .11), (3.49, .064, .38), "stone")
        arch(batch, 0, 1.95, z + .08, 1.52, .134, "glazing_dark", light=True)
        for side in (-1, 1):
            lantern(batch, side * 2.05, 1.97, z + .116)
        batch.box((0, 3.95, z + .10), (4.27, .11, .22), "stone_light")
        batch.box((0, 3.84, z + .067), (3.97, .073, .16), "stone")


def cylinder(batch, a, b, radius_a, radius_b, mat, sides=10, grain=False):
    axis = np.asarray(b, dtype=float) - a
    length = np.linalg.norm(axis)
    axis /= length
    helper = (1, 0, 0) if abs(axis[0]) < .9 else (0, 0, 1)
    cross = np.cross(axis, helper)
    cross /= np.linalg.norm(cross)
    perpendicular = np.cross(axis, cross)
    ring_a, ring_b = [], []
    for i in range(sides):
        theta = i * 2 * pi / sides
        wobble = (1.025, .978, 1.048, .985, .971)[i % 5] if grain else 1.0
        direction = wobble * (cos(theta) * cross + sin(theta) * perpendicular)
        ring_a.append(tuple(a + direction * radius_a))
        ring_b.append(tuple(b + direction * radius_b))
    tile_columns = max(1, round(pi * (radius_a + radius_b) / .57))
    bottom, top = a[1], a[1] + length
    for i in range(sides):
        j = (i + 1) % sides
        u, next_u = i * tile_columns / sides, (i + 1) * tile_columns / sides
        uv = ((u, bottom), (next_u, bottom), (next_u, top), (u, top)) if grain else None
        batch.face([ring_a[i], ring_a[j], ring_b[j], ring_b[i]], mat, uv)
    batch.face(ring_b, mat)


def leaf(batch, x, y, z, length, width, yaw, tilt, mat):
    c, s = cos(yaw), sin(yaw)
    twisted = sin(tilt)
    points = [(-.50, 0, 0), (-.22, -.38, -.04), (.10, -.5, 0), (.50, 0, .07),
              (.15, .47, .02), (-.22, .38, -.03)]
    face = []
    for u, v, lift in points:
        horizontal = u * length
        perpendicular = v * width * cos(tilt)
        face.append((x + c * horizontal + s * perpendicular,
                     y + v * width * twisted + lift * length,
                     z - s * horizontal + c * perpendicular))
    batch.face(face, mat)


def canopy(batch, rng, center, spread, count, colors):
    cx, cy, cz = center
    sx, sy, sz = spread
    for _ in range(count):
        theta = rng.uniform(0, 2 * pi)
        v = rng.uniform(-1, 1)
        radius = rng.random() ** .36
        h = sqrt(1 - v * v)
        x = cx + sx * cos(theta) * h * radius
        y = cy + sy * v * radius
        z = cz + sz * sin(theta) * h * radius
        scale = rng.uniform(.65, 1.4)
        leaf(batch, x, y, z, .31 * scale, .245 * scale, theta + .8,
             rng.uniform(-1.4, 1.4), rng.choice(colors))


def make_tree(batch, seed, size, richness):
    rng = Random(seed)
    root = (0, .42, 0)
    fork = (.11 * size, 2.45 * size, -.09 * size)
    fork2 = (.29 * size, 4.15 * size, -.21 * size)
    crown = (.62 * size, 6.1 * size, -.33 * size)
    cylinder(batch, root, fork, .51 * size, .36 * size, "bark", 14, True)
    cylinder(batch, fork, fork2, .39 * size, .23 * size, "bark", 13, True)
    cylinder(batch, fork2, crown, .25 * size, .075 * size, "bark", 12, True)
    for i in range(8):
        theta = i * pi / 4
        tip = (.84 * size * cos(theta), .46, .77 * size * sin(theta))
        start = (.04 * size, .87, -.02 * size)
        cylinder(batch, tip, start, .071 * size, .21 * size, "bark", 6, True)
    foliage = ("orange", "orange", "yellow", "gold", "red", "red_dark", "gold")
    tips = [(1.9, 4.77, -.31), (3.46, 5.32, -.81), (2.75, 6.62, .78),
            (1.20, 6.49, 1.8), (-.8, 6.75, .95), (-1.99, 5.89, .07),
            (-1.22, 6.35, -1.62), (.45, 7.25, -.98), (2.55, 7.05, -1.48),
            (3.35, 6.68, -2.15), (-2.65, 5.17, -1.58), (.52, 6.9, 1.03),
            (3.54, 4.95, 1.85), (4.05, 5.45, -.05)]
    for i, point in enumerate(tips):
        tip = tuple(v * size for v in point)
        join = fork if i in (0, 1, 5, 10, 12) else fork2
        middle = tuple((tip[a] * .56 + join[a] * .44) for a in range(3))
        cylinder(batch, join, middle, (.19 if i < 8 else .14) * size, .084 * size, "bark", 7, True)
        cylinder(batch, middle, tip, .080 * size, .018 * size, "bark", 6, True)
        for j in (-1, 1):
            side = (tip[0] + .55 * j * size, tip[1] + (.32 if j > 0 else -.16) * size,
                    tip[2] + .48 * j * size)
            cylinder(batch, middle, side, .055 * size, .017 * size, "bark", 5, True)
        foliage_center = (tip[0], tip[1] + .22 * size, tip[2])
        spread = ((1.01 + .28 * rng.random()) * size, (.71 + .20 * rng.random()) * size,
                  (1.04 + .24 * rng.random()) * size)
        canopy(batch, rng, foliage_center, spread, richness, foliage)


def bed(batch, width, depth, seed, flowers=False):
    rng = Random(seed)
    batch.box((0, .19, 0), (width, .38, depth), "stone_dark", omit=(5,))
    batch.box((0, .388, 0), (width - .26, .057, depth - .26), "soil", omit=(5,))
    for side in (-1, 1):
        batch.box((0, .386, side * (depth / 2 - .088)), (width, .122, .18), "stone")
        batch.box((side * (width / 2 - .088), .386, 0), (.18, .122, depth - .36), "stone")
    for i in range(max(1, floor(depth / .52))):
        z = -depth / 2 + .34 + i * .50
        for side in (-1, 1):
            batch.box((side * (width / 2 - .077), .449, z), (.185, .008, .019), "mortar", omit=(5,))
    for _ in range(round(width * depth * 4)):
        x = rng.uniform(-width / 2 + .26, width / 2 - .26)
        z = rng.uniform(-depth / 2 + .24, depth / 2 - .24)
        for i in range(5):
            theta = rng.uniform(0, 2 * pi)
            rise = rng.uniform(.10, .30)
            reach = rng.uniform(.06, .20)
            dx, dz = sin(theta) * reach, cos(theta) * reach
            batch.face([(x - .018, .415, z), (x + .018, .415, z),
                        (x + dx, .429 + rise, z + dz)], rng.choice(("green1", "green2", "green3")))
        if flowers and rng.random() > .29:
            dy = rng.uniform(.22, .36)
            tint = rng.choice(("flower1", "flower1", "flower2", "flower3"))
            for petal in range(5):
                theta = petal * 2 * pi / 5
                leaf(batch, x + .049 * cos(theta), .44 + dy, z + .049 * sin(theta),
                     .125, .073, -theta, -.38, tint)
    if flowers:
        for index in (-1, 0, 1):
            cx = .29 * width * index
            tint = ("flower1", "flower3", "flower2")[index + 1]
            for n in range(68):
                x = cx + rng.uniform(-.27, .27)
                z = rng.uniform(-.34, .34)
                y = rng.uniform(.46, .7) + .23 * (1 - abs(z) / .34)
                scale = rng.uniform(.75, 1.40)
                mat = tint if n % 3 == 0 and y > .63 else rng.choice(("green1", "green2", "green3"))
                leaf(batch, x, y, z, .14 * scale, .09 * scale,
                     rng.uniform(0, 2 * pi), rng.uniform(-1.30, 1.30), mat)


def bench(batch, length, stripe):
    for i in range(5):
        batch.box((0, .51, -.217 + i * .092), (length, .061, .083),
                  "wood_light" if i % 2 == 0 else "wood")
    for i in range(3):
        batch.box((0, .68 + i * .088, -.246 - i * .014), (length, .069, .05),
                  "wood_light" if i % 2 == 0 else "wood")
    for side in (-1, 1):
        x = side * (length / 2 - .21)
        cylinder(batch, (x, .27, -.20), (x, .93, -.29), .026, .025, "iron", 7)
        cylinder(batch, (x, .25, .16), (x, .68, .15), .032, .023, "iron", 7)
        cylinder(batch, (x, .68, .15), (x, .70, -.21), .023, .021, "iron", 7)
        batch.box((x, .47, -.035), (.081, .065, .44), "iron")
        for z in (-.17, .16):
            batch.box((x, .267, z), (.12, .034, .115), stripe)


def bollard_lamp(batch, x, z):
    cylinder(batch, (x, .39, z), (x, 2.72, z), .047, .04, "iron", 9)
    cylinder(batch, (x, .39, z), (x, .75, z), .088, .063, "flashing", 9)
    batch.box((x, 2.73, z), (.26, .31, .26), "lamp")
    for dx, dz in [(-.13, -.13), (.13, -.13), (-.13, .13), (.13, .13)]:
        batch.box((x + dx, 2.72, z + dz), (.029, .34, .029), "iron")
    batch.box((x, 2.915, z), (.32, .091, .32), "iron")
    batch.box((x, 2.977, z), (.12, .04, .12), "flashing")


def grounds(surfaces):
    batch = Batch("Sol de la cour • pavés UV, caniveaux, joints et feuilles", surfaces)
    batch.face([(-18.5, -.012, 19), (18.5, -.012, 19), (18.5, -.012, -19), (-18.5, -.012, -19)], "paving")
    for x in (-6.15, 6.15):
        batch.box((x, -.008, 2.9), (.17, .037, 26.1), "stone_dark", omit=(5,))
        batch.box((x - .031, .008, 2.9), (.021, .012, 26.1), "iron", omit=(5,))
    for x in (-13.72, 13.72):
        batch.box((x, -.002, -.47), (.31, .06, 21.9), "stone", omit=(5,))
        for i in range(16):
            batch.box((x, .031, -10.7 + i * 1.35), (.307, .004, .016), "mortar", omit=(5,))
    for x, z in [(-6.15, -.85), (6.15, 6.4), (-6.15, 9.0), (6.15, -5.85)]:
        batch.box((x, .016, z), (.28, .025, .65), "flashing", omit=(5,))
        for i in range(8):
            batch.box((x, .029, z - .275 + i * .075), (.23, .010, .022), "iron", omit=(5,))
    for z in (-11.12, -10.84):
        batch.box((0, .027, z), (3.70, .074, .31), "stone", omit=(5,))
    scatter = Random(78098)
    for _ in range(460):
        side = scatter.choice((-1, -1, -1, 1, 1))
        x = side * scatter.uniform(2.15, 14.0)
        z = scatter.uniform(-10.6, 12.8)
        if scatter.random() < .49:
            x = scatter.uniform(-8.7, -1.8)
            z = scatter.uniform(-2.5, 7.2)
        if (abs(x) < 6.35 and scatter.random() < .49):
            continue
        scale = scatter.uniform(.55, 1.7)
        leaf(batch, x, .023, z, .12 * scale, .088 * scale, scatter.uniform(0, 2 * pi),
             scatter.uniform(-.045, .045), scatter.choice(("orange", "yellow", "gold", "red")))
    batch.finish()


def assemble(surfaces):
    grounds(surfaces)
    central = Batch("Façade • hall central à voussoirs et trois pignons", surfaces, (0, -15.35))
    building(central, 9.8, 6.35, 7.53, (-3.49, -1.72, 0, 1.72, 3.49),
             (.82, 4.15, 5.89), 1.75, central=True, gables=(-3.22, 0, 3.22))
    central.finish()

    for side in (-1, 1):
        name = "occidentale" if side == -1 else "orientale"
        wing = Batch(f"Façade • aile {name}", surfaces, (side * 9.81, -15.33))
        building(wing, 10.04, 6.13, 8.36 if side == -1 else 8.67,
                 (-3.96, -2.02, 0, 2.02, 3.96), (.85, 3.24, 5.76), 1.86,
                 gables=(-2.14, 2.14))
        wing.finish()

        return_wing = Batch(f"Cour • retour {name}", surfaces, (side * 15.79, -1.15), -side * pi / 2)
        building(return_wing, 22.4, 3.23, 6.71 if side == -1 else 7.25,
                 (-9.35, -7.08, -4.72, -2.36, 0, 2.36, 4.72, 7.08, 9.35), (.85, 3.30, 5.00),
                 1.16, gables=(-7.1, 0, 7.1))
        return_wing.finish()

    planters = [
        ("massif de l’arbre principal", (-6.60, 2.95), (4.0, 6.10), 221, True),
        ("massif et banc est", (8.80, 1.25), (3.4, 6.7), 270, True),
        ("massif arrière ouest", (-10.525, -8.80), (3.75, 1.8), 320, True),
        ("massif arrière est", (11.675, -8.45), (3.15, 1.90), 456, True),
    ]
    for label, position, (width, depth), seed, flowers in planters:
        batch = Batch(f"Cour • {label}", surfaces, position)
        bed(batch, width, depth, seed, flowers)
        batch.finish()

    for index, (x, z, angle) in enumerate([(-4.96, 1.38, pi / 2), (-4.96, 4.47, pi / 2),
                                           (7.45, .16, -pi / 2), (7.45, 2.62, -pi / 2)]):
        batch = Batch(f"Mobilier • banc {index + 1}", surfaces, (x, z), angle)
        bench(batch, 1.76, "stone_dark")
        batch.finish()
    lamps = Batch("Mobilier • quatre lanternes de cour", surfaces)
    for x, z in [(-7.95, 4.91), (9.59, 3.34), (-11.45, -8.79), (12.36, -8.35)]:
        bollard_lamp(lamps, x, z)
    lamps.finish()

    tree = Batch("Végétation • grand érable d’automne", surfaces, (-6.42, 2.10), .34)
    make_tree(tree, 9180, 1.00, 168)
    tree.finish()
    tree = Batch("Végétation • érable du parterre est", surfaces, (9.35, 1.93), 2.75)
    make_tree(tree, 662, .69, 75)
    tree.finish()


def main():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    output = Path(os.environ.get("WATTEAU_CAMPUS_OUTPUT", ASSETS / "campus.glb"))
    output.parent.mkdir(parents=True, exist_ok=True)
    with TemporaryDirectory(prefix="watteau-campus-maps-") as temporary:
        surfaces = materials(Path(temporary))
        assemble(surfaces)
        bpy.ops.export_scene.gltf(
            filepath=str(output),
            export_format="GLB",
            export_yup=True,
            export_texcoords=True,
            export_normals=True,
            export_materials="EXPORT",
            export_animations=False,
            export_cameras=False,
            export_lights=False,
        )
    scene = bpy.context.scene
    for obj in scene.objects:
        obj.data.calc_loop_triangles()
    print(f"Cour exportée : {len(scene.objects)} modules et " +
          f"{sum(len(obj.data.loop_triangles) for obj in scene.objects):,} triangles.")


if __name__ == "__main__":
    main()
