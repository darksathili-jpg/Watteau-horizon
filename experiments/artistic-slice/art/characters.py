"""Build the two animated Watteau Horizon characters with Blender 4.3.

blender -b -t 4 --python experiments/artistic-slice/art/characters.py -- --previews /tmp/watteau-characters
"""
from __future__ import annotations

import argparse
import collections
import gzip
import hashlib
import math
from pathlib import Path
import random
import struct
import sys
import tempfile
import zlib

import bpy
from mathutils import Euler, Quaternion, Vector
from mathutils.bvhtree import BVHTree

HERE = Path(__file__).resolve().parent
DATA = HERE / 'makehuman-cc0'
ASSETS = HERE.parent / 'public' / 'assets'
TAU = 2 * math.pi
FRONT = Vector((0, -1, 0))
UP = Vector((0, 0, 1))
SOURCE_HASHES = {
    'base.obj': '8e761e6624b8f54536409135d1636da63b32486a90d4897f84e121d144f6fb4c',
    'african-male-young': '05ed84d6df36e788cdfa8da0be15376850524b960cf2f17f3e592b9cf7d21c85',
    'asian-male-young': '0928ed8b9f08f60afb9884cf9e9f33a939ed3a85d7f136de9ccc88a76981d6d7',
    'caucasian-male-young': 'ffe69537e53148edff2776204ba48cf3bf1f3cbc72966592c8a562ab80b07333',
    'head-oval': '057eea7c5535c325493b9107228052b03c78fac1bcb24905313fae6351179cb8',
    'head-square': '94b484ae145970e5368706d4f42711f50e18fcbf7d9f1ee800572c3fa69f855a',
    'nose-point-width-incr': 'bf5f782b014675be57aba4c840261308cc0d408660ecdfd22a42d47a756a016c',
}

PERSONAS = {
    'avatar': {
        'height': 1.706, 'build': 1.012, 'seed': 729,
        'targets': (('caucasian-male-young', .70), ('asian-male-young', .19),
                    ('african-male-young', .11), ('head-oval', .31)),
        'skin': 'bd896c', 'iris': '574232', 'hair': '3c261e', 'curl': 1.0,
        'jacket': '642638', 'jacket_shade': '512032', 'rib': '40202c', 'thread': 'a87374',
        'hood': 'b6b4b0', 'hood_shade': '929394', 'shirt': 'd7d1c2',
        'pants': '34353a', 'pocket': '424248', 'zip': 'a78256', 'bag': '242d3a',
        'shoe': '464651', 'lace': 'bfb6a3',
    },
    'antoine': {
        'height': 1.724, 'build': .974, 'seed': 437,
        'targets': (('caucasian-male-young', .53), ('asian-male-young', .20),
                    ('african-male-young', .27), ('head-square', .25),
                    ('nose-point-width-incr', .21)),
        'skin': 'c58f72', 'iris': '564730', 'hair': '4b3123', 'curl': .78,
        'jacket': '28364d', 'jacket_shade': '263046', 'rib': '242c3b', 'thread': '697690',
        'hood': '929398', 'hood_shade': '737781', 'shirt': 'bab4aa',
        'pants': '897252', 'pocket': '9a805c', 'zip': '9e784d', 'bag': '2c3240',
        'shoe': '35465d', 'lace': 'd9d0bd',
    },
}


def rgb(code):
    return tuple(int(code[i:i + 2], 16) for i in (0, 2, 4))


def slinear(value):
    value /= 255
    return value / 12.92 if value <= .04045 else ((value + .055) / 1.055) ** 2.4


def blend(a, b, strength):
    return tuple(x + (y - x) * strength for x, y in zip(a, b))


def smooth(edge0, edge1, value):
    t = min(1, max(0, (value - edge0) / (edge1 - edge0)))
    return t * t * (3 - 2 * t)


def write_png(path, side, pixels):
    def chunk(name, content):
        return struct.pack('>I', len(content)) + name + content + struct.pack(
            '>I', zlib.crc32(name + content)
        )
    stride = side * 3
    lines = (b'\0' + pixels[i * stride:(i + 1) * stride] for i in reversed(range(side)))
    path.write_bytes(
        b'\x89PNG\r\n\x1a\n'
        + chunk(b'IHDR', struct.pack('>IIBBBBB', side, side, 8, 2, 0, 0, 0))
        + chunk(b'IDAT', zlib.compress(b''.join(lines), 9))
        + chunk(b'IEND', b'')
    )


def image_material(name, color, kind, roughness, path, rng, skin_pixels=None):
    side = 768 if skin_pixels is not None else 128
    if skin_pixels is None:
        pixels = bytearray()
        for y in range(side):
            for x in range(side):
                large = math.sin(.043 * x + .061 * y) + math.cos(.071 * x - .098 * y)
                weave = math.sin(TAU * x / 4) * math.cos(TAU * y / 4)
                detail = .65 * rng.gauss(0, 1) + (1.7 * weave if kind == 'fabric' else .25 * weave)
                if kind == 'hair':
                    detail = math.sin(x * .75 + .22 * math.sin(.21 * y)) * 2.4
                val = large * (2.8 if kind == 'fabric' else 1.4) + detail
                pixels.extend(round(max(0, min(255, c + val))) for c in color)
    else:
        pixels = skin_pixels
    file = path / f'{name}.png'
    write_png(file, side, bytes(pixels))
    texture = bpy.data.images.load(str(file), check_existing=False)
    texture.pack()
    material = bpy.data.materials.new(name)
    material.diffuse_color = tuple(slinear(c) for c in color) + (1,)
    material.use_nodes = True
    nodes = material.node_tree.nodes
    bsdf = nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value = material.diffuse_color
    bsdf.inputs['Roughness'].default_value = roughness
    if kind == 'metal':
        bsdf.inputs['Metallic'].default_value = .49
    if kind == 'skin':
        bsdf.inputs['Subsurface Weight'].default_value = .015
    if kind == 'hair':
        bsdf.inputs['Specular IOR Level'].default_value = .24
    image = nodes.new('ShaderNodeTexImage')
    image.image = texture
    material.node_tree.links.new(image.outputs['Color'], bsdf.inputs['Base Color'])
    return material


def normal_map(path):
    side = 64
    pixels = bytearray()
    for y in range(side):
        for x in range(side):
            pixels.extend((
                round(128 + 12 * math.cos(TAU * x / 4) * math.sin(TAU * y / 4)),
                round(128 + 12 * math.sin(TAU * x / 4) * math.cos(TAU * y / 4)),
                254,
            ))
    file = path / 'tissage-normal.png'
    write_png(file, side, pixels)
    texture = bpy.data.images.load(str(file), check_existing=False)
    texture.colorspace_settings.name = 'Non-Color'
    texture.pack()
    return texture


def use_normals(material, texture):
    tree = material.node_tree
    image = tree.nodes.new('ShaderNodeTexImage')
    image.image = texture
    normal = tree.nodes.new('ShaderNodeNormalMap')
    normal.inputs['Strength'].default_value = .36
    tree.links.new(image.outputs['Color'], normal.inputs['Color'])
    tree.links.new(normal.outputs['Normal'], tree.nodes.get('Principled BSDF').inputs['Normal'])


def read_base():
    raw = gzip.decompress((DATA / 'base.obj.gz').read_bytes())
    assert hashlib.sha256(raw).hexdigest() == SOURCE_HASHES['base.obj']
    vertices, uvs = [], []
    groups = collections.defaultdict(list)
    group = ''
    for line in raw.decode('utf-8').splitlines():
        if line.startswith('v '):
            vertices.append(Vector(tuple(map(float, line.split()[1:4]))))
        elif line.startswith('vt '):
            uvs.append(tuple(map(float, line.split()[1:3])))
        elif line.startswith('g '):
            group = line.split()[1]
        elif line.startswith('f '):
            pairs = [p.split('/') for p in line.split()[1:]]
            groups[group].append(tuple((int(p[0]) - 1, int(p[1]) - 1) for p in pairs))
    return vertices, uvs, groups


def group_indices(faces):
    return set(vertex for face in faces for vertex, _ in face)


def average(points):
    return sum(points, Vector((0, 0, 0))) / len(points)


def load_persona(base, spec):
    base_verts, uvs, groups = base
    verts = [v.copy() for v in base_verts]
    for target, strength in spec['targets']:
        raw = (DATA / f'{target}.target.gz').read_bytes()
        assert hashlib.sha256(raw).hexdigest() == SOURCE_HASHES[target]
        for line in gzip.decompress(raw).decode('utf-8').splitlines():
            fields = line.split()
            if len(fields) == 4 and fields[0].isdigit():
                vertex, x, y, z = fields
                verts[int(vertex)] += strength * Vector((float(x), float(y), float(z)))
    body = group_indices(groups['body'])
    floor = min(verts[i].y for i in body)
    scale = spec['height'] / (max(verts[i].y for i in body) - floor)
    verts = [Vector((p.x * scale * spec['build'], -p.z * scale, (p.y - floor) * scale)) for p in verts]
    points = {
        key.removeprefix('joint-'): average([verts[i] for i in group_indices(faces)])
        for key, faces in groups.items() if key.startswith('joint-')
    }
    return verts, uvs, groups, points


class Geometry:
    def __init__(self):
        self.vertices = []
        self.faces = []
        self.uvs = []
        self.materials = []
        self.weights = []

    def add(self, vertices, faces, uvs, weight, material):
        offset = len(self.vertices)
        for point in vertices:
            p = Vector(point)
            self.vertices.append(p)
            self.weights.append({weight: 1} if isinstance(weight, str) else weight(p))
        for face, tex in zip(faces, uvs):
            self.faces.append(tuple(v + offset for v in face))
            self.uvs.append(tex)
            self.materials.append(material)

    def source(self, verts, uvs, faces, shape, weight, material):
        subset = sorted(group_indices(faces))
        lookup = {index: i for i, index in enumerate(subset)}
        self.add(
            [shape(verts[i]) for i in subset],
            [tuple(lookup[v] for v, _ in face) for face in faces],
            [tuple(uvs[t] for _, t in face) for face in faces],
            weight, material,
        )

    def rings(self, rings, weight, material, closed=True, caps=False):
        n = len(rings[0])
        sections = n if closed else n - 1
        total = len(rings)
        vertices = [p for ring in rings for p in ring]
        faces = []
        tex = []
        for step in range(total - 1):
            for s in range(sections):
                t = (s + 1) % n
                faces.append((step * n + s, step * n + t, (step + 1) * n + t, (step + 1) * n + s))
                t0, t1 = step / (total - 1), (step + 1) / (total - 1)
                s0, s1 = s / sections, (s + 1) / sections
                tex.append(((s0, t0), (s1, t0), (s1, t1), (s0, t1)))
        if caps and closed:
            for first in (True, False):
                start = 0 if first else (total - 1) * n
                tip = len(vertices)
                vertices.append(average(rings[0 if first else -1]))
                for i in range(n):
                    indices = (tip, start + i, start + (i + 1) % n)
                    uv = ((.5, .5), (.5 + .5 * math.cos(TAU * i / n), .5 + .5 * math.sin(TAU * i / n)),
                          (.5 + .5 * math.cos(TAU * (i + 1) / n), .5 + .5 * math.sin(TAU * (i + 1) / n)))
                    faces.append(tuple(reversed(indices)) if first else indices)
                    tex.append(tuple(reversed(uv)) if first else uv)
        self.add(vertices, faces, tex, weight, material)

    def tube(self, path, radius, weight, material, sides=7, aspect=1, axis=None):
        rings = []
        for i, p in enumerate(path):
            direction = (path[min(i + 1, len(path) - 1)] - path[max(i - 1, 0)]).normalized()
            reference = axis if axis is not None else FRONT
            if abs(reference.dot(direction)) > .96:
                reference = UP if abs(direction.z) < .96 else Vector((1, 0, 0))
            u = direction.cross(reference).normalized()
            v = direction.cross(u).normalized()
            a = radius if isinstance(radius, (float, int)) else radius[i]
            rings.append([
                p + u * (math.cos(TAU * j / sides) * a) + v * (math.sin(TAU * j / sides) * a * aspect)
                for j in range(sides)
            ])
        self.rings(rings, weight, material, caps=True)

    def oval(self, center, radii, weight, material, sides=16, steps=10, power=1):
        rings = []
        for i in range(1, steps):
            phi = math.pi * (i / steps - .5)
            z = math.sin(phi)
            row = []
            for j in range(sides):
                theta = TAU * j / sides
                c, s = math.cos(theta), math.sin(theta)
                x = math.copysign(abs(c) ** power, c) * math.cos(phi)
                y = math.copysign(abs(s) ** power, s) * math.cos(phi)
                row.append(Vector(center) + Vector((x * radii[0], y * radii[1], z * radii[2])))
            rings.append(row)
        self.rings(rings, weight, material, caps=True)

    def object(self, name, materials):
        mesh = bpy.data.meshes.new(f'{name} · UV mesh')
        mesh.from_pydata(self.vertices, [], self.faces)
        mesh.update()
        for material in materials.values():
            mesh.materials.append(material)
        material_indices = {key: i for i, key in enumerate(materials)}
        uv = mesh.uv_layers.new(name='UVMap')
        for poly, tex, color in zip(mesh.polygons, self.uvs, self.materials):
            poly.use_smooth = True
            poly.material_index = material_indices[color]
            for loop, coordinate in zip(poly.loop_indices, tex):
                uv.data[loop].uv = coordinate
        obj = bpy.data.objects.new(name, mesh)
        bpy.context.collection.objects.link(obj)
        joints = set(joint for weights in self.weights for joint in weights)
        groups = {joint: obj.vertex_groups.new(name=joint) for joint in sorted(joints)}
        for i, weights in enumerate(self.weights):
            total = sum(weights.values())
            assert total > .999, f'{name} has vertex with weight {weights}'
            for joint, weight in weights.items():
                if weight > 0:
                    groups[joint].add([i], weight / total, 'REPLACE')
        return obj


def skin_shading(p, color, points, seed):
    left_eye = points['l-eye']
    mouth_center = points['head'].z - .024
    cheek = math.exp(-((abs(p.x) - .044) / .020) ** 2 - ((p.z - (left_eye.z - .036)) / .022) ** 2)
    front = smooth(-.105, -.155, p.y)
    lipcurve = mouth_center + .003 * math.cos(min(1, abs(p.x) / .036) * math.pi)
    lips = math.exp(-((p.z - lipcurve) / .0054) ** 2 - (p.x / .021) ** 4)
    ear = smooth(.066, .086, abs(p.x)) * math.exp(-((p.z - (left_eye.z - .015)) / .038) ** 2)
    blush = blend(color, (172, 77, 62), cheek * front * .20 + ear * .16)
    peach = blend(blush, (142, 65, 61), lips * front * .58)
    tint = math.sin(145 * p.x + seed) * math.cos(192 * p.z) * .6
    return tuple(c + tint for c in peach)


def paint_skin(verts, tex_coords, faces, points, color, seed):
    size = 768
    rng = random.Random(seed)
    pixels = bytearray()
    for _ in range(size * size):
        noise = rng.gauss(0, 1) * .72
        pixels.extend(round(max(0, min(255, c + noise))) for c in color)
    shade = {v: skin_shading(verts[v], color, points, seed) for v in group_indices(faces)}
    for face in faces:
        for i in range(1, len(face) - 1):
            triangle = [face[k] for k in (0, i, i + 1)]
            coords = [(tex_coords[t][0] * (size - 1), tex_coords[t][1] * (size - 1)) for _, t in triangle]
            (ax, ay), (bx, by), (cx, cy) = coords
            det = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy)
            if abs(det) < 1e-6:
                continue
            values = [shade[v] for v, _ in triangle]
            for y in range(max(0, math.floor(min(ay, by, cy))), min(size, math.ceil(max(ay, by, cy)) + 1)):
                for x in range(max(0, math.floor(min(ax, bx, cx))), min(size, math.ceil(max(ax, bx, cx)) + 1)):
                    a = ((by - cy) * (x - cx) + (cx - bx) * (y - cy)) / det
                    b = ((cy - ay) * (x - cx) + (ax - cx) * (y - cy)) / det
                    c = 1 - a - b
                    if min(a, b, c) < -.035:
                        continue
                    noise = rng.random() * 1.1 - .55
                    off = (y * size + x) * 3
                    for j in range(3):
                        pixels[off + j] = round(max(0, min(255, values[0][j] * a + values[1][j] * b + values[2][j] * c + noise)))
    return pixels


def style_materials(key, spec, workspace, skin_pixels):
    rng = random.Random(spec['seed'])
    wool = normal_map(workspace)
    materials = {}
    kinds = {
        'skin': ('skin', .55), 'iris': ('solid', .37), 'hair': ('hair', .71),
        'jacket': ('fabric', .74), 'jacket_shade': ('fabric', .80),
        'rib': ('fabric', .86), 'thread': ('fabric', .69),
        'hood': ('fabric', .82), 'hood_shade': ('fabric', .79), 'shirt': ('fabric', .88),
        'pants': ('fabric', .87), 'pocket': ('fabric', .76), 'zip': ('metal', .46),
        'bag': ('fabric', .83), 'shoe': ('solid', .68), 'lace': ('fabric', .82),
    }
    extra = {
        'eye': ('e2dad0', 'solid', .27), 'pupil': ('221a18', 'solid', .26),
        'hair_light': ('543b2e' if key == 'avatar' else '604332', 'hair', .73),
        'hair_dark': ('29201b' if key == 'avatar' else '37291f', 'hair', .74),
        'bag_panel': ('303742' if key == 'avatar' else '38404c', 'fabric', .84),
        'outsole': ('b1aa9b', 'solid', .78), 'rubber': ('4b4544', 'solid', .78),
        'strap': ('393735' if key == 'avatar' else '302d2a', 'fabric', .81),
    }
    palette = {name: (spec[name], kind, roughness) for name, (kind, roughness) in kinds.items()}
    palette.update(extra)
    for name, (code, kind, roughness) in palette.items():
        material = image_material(f'{key}-{name}', rgb(code), kind, roughness, workspace, rng,
                                  skin_pixels if name == 'skin' else None)
        if name in {'jacket', 'hood', 'pants', 'rib', 'bag', 'pocket', 'jacket_shade'}:
            use_normals(material, wool)
        materials[name] = material
    return materials


def vector_mix(a, b, weight):
    return a.lerp(b, weight)


def rig_points(points):
    neck = points['neck']
    bones = {
        'Hips': (points['pelvis'], points['spine-3'], None),
        'Spine': (points['spine-3'], points['spine-1'], 'Hips'),
        'Chest': (points['spine-1'], neck, 'Spine'),
        'Neck': (neck, points['head'], 'Chest'),
        'Head': (points['head'], points['head'] + Vector((0, 0, .13)), 'Neck'),
    }
    for side, sign in (('L', 1), ('R', -1)):
        src = side.lower()
        shoulder = points[f'{src}-shoulder'].copy()
        orig_elbow = points[f'{src}-elbow']
        orig_wrist = points[f'{src}-hand']
        upper_len = (orig_elbow - shoulder).length
        lower_len = (orig_wrist - orig_elbow).length
        down = Vector((.270 * sign, -.025, -.962)).normalized()
        elbow = shoulder + down * upper_len
        wrist = elbow + Vector((.095 * sign, -.18, -.976)).normalized() * lower_len
        hand_end = wrist + (wrist - elbow).normalized() * .096
        hip = points[f'{src}-upper-leg'].copy()
        knee = points[f'{src}-knee'].copy()
        ankle = points[f'{src}-ankle'].copy()
        knee.x *= .83
        ankle.x *= .70
        ankle.z = .092
        toe = ankle + Vector((.008 * sign, -.15, -.048))
        bones.update({
            f'Clavicle.{side}': (points[f'{src}-clavicle'], shoulder, 'Chest'),
            f'UpperArm.{side}': (shoulder, elbow, f'Clavicle.{side}'),
            f'Forearm.{side}': (elbow, wrist, f'UpperArm.{side}'),
            f'Hand.{side}': (wrist, hand_end, f'Forearm.{side}'),
            f'UpperLeg.{side}': (hip, knee, 'Hips'),
            f'Shin.{side}': (knee, ankle, f'UpperLeg.{side}'),
            f'Foot.{side}': (ankle, toe, f'Shin.{side}'),
        })
    return bones


def chest_weights(p):
    chest = smooth(1.13, 1.33, p.z)
    hips = 1 - smooth(1.01, 1.16, p.z)
    return {'Chest': chest, 'Spine': 1 - chest - hips, 'Hips': hips}


def linked_weights(third, connection, factor):
    weights = dict(third)
    for joint in weights:
        weights[joint] *= 1 - factor
    weights[connection] = weights.get(connection, 0) + factor
    return weights


def face_topology(verts, body):
    return [face for face in body if (
        min(verts[i].z for i, _ in face) > 1.387
        and max(abs(verts[i].x) for i, _ in face) < .109
    )]


def add_head(geom, persona, spec, bones):
    verts, uvs, groups, points = persona
    head = face_topology(verts, groups['body'])

    def neck_weights(p):
        factor = smooth(points['neck'].z - .018, points['head'].z - .058, p.z)
        return {'Head': factor, 'Neck': 1 - factor}

    geom.source(verts, uvs, head, lambda p: p, neck_weights, 'skin')
    for side in ('l', 'r'):
        geom.source(verts, uvs, groups[f'helper-{side}-eye'], lambda p: p + Vector((0, -.0012, 0)),
                    'Head', 'eye')
        eye = points[f'{side}-eye']
        center = eye + Vector((0, -.01585, -.0018))
        geom.oval(center, (.0052, .0016, .0053), 'Head', 'iris', 16, 8)
        geom.oval(center + Vector((0, -.00134, 0)), (.00265, .00072, .00278), 'Head', 'pupil', 14, 7)
        sign = 1 if side == 'l' else -1
        brow = [
            eye + Vector((sign * x, y, z))
            for x, y, z in (
                (-.017, -.0252, .0143), (-.0115, -.0267, .0165),
                (-.0045, -.0263, .0179), (.004, -.0258, .0171),
                (.0127, -.022, .0147), (.0200, -.0159, .0100),
            )
        ]
        geom.tube(brow, [.0015, .0023, .0024, .00205, .0015, .0007],
                  'Head', 'hair_dark', 7, .71, axis=UP)
        lashes = groups[f'helper-{side}-eyelashes-2']
        geom.source(verts, uvs, lashes, lambda p: p + Vector((0, -.0004, 0)), 'Head', 'hair_dark')

    for side in ('L', 'R'):
        s = side.lower()
        old_wrist = points[f'{s}-hand']
        old_elbow = points[f'{s}-elbow']
        old_direction = (old_wrist - old_elbow).normalized()
        new_wrist = bones[f'Hand.{side}'][0]
        new_direction = (new_wrist - bones[f'Forearm.{side}'][0]).normalized()
        rotation = old_direction.rotation_difference(new_direction)
        skin = [
            face for face in groups['body']
            if all((verts[i] - old_wrist).dot(old_direction) > -.013 for i, _ in face)
            and all((verts[i].x * (1 if side == 'L' else -1)) > .37 for i, _ in face)
        ]
        geom.source(verts, uvs, skin, lambda p: new_wrist + rotation @ (p - old_wrist),
                    f'Hand.{side}', 'skin')
        head.extend(skin)
    return head


def add_hair(geom, persona, spec):
    verts, _, groups, points = persona
    rng = random.Random(spec['seed'] + 91)
    skull = Vector((0, points['head'].y + .001, spec['height'] - .101))
    width = .078 * spec['build']
    depth = .105
    height = .117
    curl = spec['curl']
    head = face_topology(verts, groups['body'])
    skull_mesh = BVHTree.FromPolygons(verts, [tuple(i for i, _ in face) for face in head])

    def hairline(theta):
        return 1.53 + .32 * math.sin(theta) + .075 * math.sin(theta * 4 + .6)

    def cap(theta, phi):
        direction = Vector((width * math.cos(theta) * math.sin(phi),
                            depth * math.sin(theta) * math.sin(phi),
                            height * math.cos(phi))).normalized()
        surface, _, _, _ = skull_mesh.ray_cast(skull, direction, .160)
        if surface is None:
            surface = skull + .10 * direction
        ripple = .0016 * math.sin(9 * theta + 7 * phi) + .0013 * math.sin(13 * theta - 5 * phi)
        return surface + direction * (.0053 + ripple)

    # Start at the hairline and end on the crown to keep the outward winding.
    rings = []
    for step in range(14, 0, -1):
        t = step / 14
        rings.append([cap(TAU * i / 48, hairline(TAU * i / 48) * t) for i in range(48)])
    rings.append([cap(TAU * i / 48, .021) for i in range(48)])
    geom.rings(rings, 'Head', 'hair_dark')

    for i in range(94):
        theta = rng.uniform(0, TAU)
        phi = hairline(theta) * rng.uniform(.19, .97)
        root = cap(theta, phi)
        drift = rng.uniform(.20, .52) * (1 if i % 5 else -1)
        front = max(0, -math.sin(theta))
        length = rng.uniform(.17, .37) * (1.15 if front > .55 else .86)
        lift = rng.uniform(.004, .013) * (1.22 if front > .55 else 1)
        phase = rng.uniform(-math.pi, math.pi)
        thickness = rng.uniform(.0037, .0071) * (1.10 if phi < 1 else .85)
        path = []
        radii = []
        for k in range(12):
            t = k / 11
            angle = theta + drift * t + math.sin(t * TAU * 1.10 + phase) * curl * .080 * math.sin(math.pi * t)
            lat = phi + length * t + math.sin(t * TAU * 1.10 + phase + math.pi / 2) * curl * .065 * math.sin(math.pi * t)
            p = cap(angle, lat)
            normal = (p - skull).normalized()
            p += normal * ((.0045 + lift * math.sin(math.pi * t)) * math.sin(math.pi * t * .94))
            if front > .55:
                p += FRONT * (.006 * t ** 2)
            path.append(p)
            radii.append(thickness * (.72 + .27 * math.sin(math.pi * t)) * (1 - .94 * t ** 3))
        color = 'hair_light' if i % 13 == 0 else ('hair_dark' if i % 4 == 0 else 'hair')
        geom.tube(path, radii, 'Head', color, sides=7, aspect=.76, axis=(root - skull).normalized())

    # Asymmetrical front fringe forms defined loose waves over the forehead.
    for i in range(8):
        theta = -math.pi / 2 + (i - 3.5) * .154 + rng.uniform(-.03, .035)
        phi = .81 + .095 * (i % 3)
        path = []
        radii = []
        for k in range(16):
            t = k / 15
            angle = theta + .33 * t + .105 * curl * math.sin(TAU * t)
            tilt = phi + .59 * t - .04 * math.sin(TAU * t)
            p = cap(angle, tilt)
            p += (p - skull).normalized() * (.003 + .020 * math.sin(math.pi * t) + .008 * t)
            path.append(p)
            radii.append((.0102 - .0036 * t) * (.70 + .32 * math.sin(math.pi * t)) * (1 - .92 * t ** 4))
        geom.tube(path, radii, 'Head', 'hair' if i % 4 else 'hair_light', sides=9, aspect=.82)


def shell(geom, rows, weights, material, sides=36, caps=False, detail=.0015, power=1):
    rings = []
    for z, cx, cy, rx, ry, gap in rows:
        ring = []
        for i in range(sides + 1 if gap else sides):
            t = i / sides
            a = -math.pi / 2 + gap + (TAU - 2 * gap) * t
            wave = detail * (math.sin(8 * a + 42 * z) + .60 * math.sin(17 * a - 27 * z))
            c, s = math.cos(a), math.sin(a)
            ring.append(Vector((cx + (rx + wave) * math.copysign(abs(c) ** power, c),
                                cy + (ry + wave) * math.copysign(abs(s) ** power, s), z)))
        rings.append(ring)
    geom.rings(rings, weights, material, closed=not bool(rows[0][-1]), caps=caps)
    return rings


def add_torso(geom, rig, spec):
    scale = spec['build']
    waist = .984
    rows = [
        (waist - .018, 0, -.026, .162 * scale, .140, .015),
        (waist + .022, 0, -.027, .163 * scale, .140, .015),
        (1.055, 0, -.023, .166 * scale, .132, .014),
        (1.140, 0, -.020, .172 * scale, .136, .022),
        (1.228, 0, -.019, .184 * scale, .145, .032),
        (1.300, 0, -.017, .191 * scale, .140, .057),
        (1.365, 0, -.013, .174 * scale, .109, .087),
        (1.415, 0, -.018, .126 * scale, .074, .105),
        (1.438, 0, -.024, .066 * scale, .054, .117),
    ]
    hoodie_rows = [(z - .006, cx, cy - .001, rx * .927, ry * .992, 0) for z, cx, cy, rx, ry, _ in rows]
    shell(geom, hoodie_rows, chest_weights, 'hood', detail=.0014)
    shell(geom, [(.950, 0, -.024, .147 * scale, .116, 0), (.969, 0, -.024, .153 * scale, .122, 0)],
          'Hips', 'shirt', detail=.0005, power=.94)
    # A narrower bomber opening near the waist reveals the hoodie up to its collar.
    open_rows = [(z, cx, cy, rx, ry, .22 + gap * 2.4) for z, cx, cy, rx, ry, gap in rows]
    edges = shell(geom, open_rows, chest_weights, 'jacket', sides=40, detail=.0020, power=.91)
    for edge in (0, -1):
        path = [ring[edge] + Vector((0, -.0010, 0)) for ring in edges]
        geom.tube(path, .0033, chest_weights, 'jacket_shade', sides=7, aspect=.72)
        inner = [point + Vector((-.008 if edge == 0 else .008, -.0008, .001)) for point in path[:7]]
        geom.tube(inner, .00105, chest_weights, 'zip', sides=5, aspect=.75)
    for s in (-1, 1):
        for b in range(18):
            t = (b + .55) / 19
            hi = (len(edges) - 3) * t
            k = int(hi)
            edge = 0 if s > 0 else -1
            center = edges[k][edge].lerp(edges[k + 1][edge], hi - k)
            geom.oval(center + Vector((-.0038 * s, -.0026, .000),),
                      (.0021, .0013, .0018), chest_weights, 'zip', 6, 4)
    # Bomber sitting rib, contrast rows and two welt pockets.
    hems = [
        (.970, 0, -.025, .162 * scale, .141, .23),
        (.993, 0, -.027, .165 * scale, .142, .24),
        (1.014, 0, -.028, .165 * scale, .143, .26),
    ]
    shell(geom, hems, chest_weights, 'rib', detail=.00075)
    for z in (.976, .983):
        shell(geom, [(z, 0, -.026, .164 * scale, .143, .235),
                     (z + .0026, 0, -.026, .164 * scale, .144, .235)],
              chest_weights, 'thread', detail=.0004)
    for s in (-1, 1):
        pocket = [Vector((s * x * scale, y, z)) for x, y, z in (
            (.069, -.151, 1.071), (.092, -.144, 1.088), (.118, -.130, 1.112), (.127, -.123, 1.123)
        )]
        geom.tube(pocket, .0045, chest_weights, 'jacket_shade', sides=7, aspect=.55)
        geom.tube([p + Vector((s * .004, -.002, .002)) for p in pocket],
                  .00105, chest_weights, 'thread', sides=5, aspect=.8)
    # The hood is folded around the nape, with the opening extending down the chest.
    hood = [
        Vector((-.073, -.066, 1.365)), Vector((-.095, -.027, 1.402)),
        Vector((-.093, .025, 1.444)), Vector((-.061, .066, 1.474)),
        Vector((-.017, .080, 1.488)), Vector((.034, .078, 1.483)),
        Vector((.071, .063, 1.469)), Vector((.096, .024, 1.443)),
        Vector((.092, -.029, 1.405)), Vector((.068, -.065, 1.366)),
    ]
    geom.tube(hood, [.019, .026, .034, .037, .037, .036, .034, .033, .025, .018],
              'Chest', 'hood', sides=14, aspect=.70, axis=Vector((0, 1, 0)))
    geom.tube([p + Vector((0, .008, .005)) for p in hood],
              .010, 'Chest', 'hood_shade', sides=11, aspect=.83)
    geom.oval((0, .096, 1.422), (.105, .047, .029), 'Chest', 'hood_shade', 24, 10, .84)
    for s in (-1, 1):
        cord = [Vector((s * x, y, z)) for x, y, z in (
            (.038, -.113, 1.374), (.043, -.135, 1.343), (.044, -.152, 1.309),
            (.051, -.160, 1.271), (.052, -.163, 1.227 - .013 * s),
        )]
        geom.tube(cord, .00165, 'Chest', 'lace', sides=6)
        geom.tube(cord[-2:], [.00165, .0022], 'Chest', 'thread', sides=6)
    hoodie_zip = [Vector((.0025, y, z)) for y, z in (
        (-.157, .981), (-.161, 1.047), (-.159, 1.139), (-.166, 1.220),
        (-.162, 1.281), (-.145, 1.333), (-.111, 1.384),
    )]
    geom.tube(hoodie_zip, .0019, chest_weights, 'hood_shade', sides=6, aspect=.7)
    geom.oval((.0025, -.166, 1.286), (.0037, .0020, .008), 'Chest', 'zip', 10, 7)


def interpolate_profile(profile):
    smooth_profile = []
    for i in range(len(profile) - 1):
        before, left, right, after = (profile[max(0, i - 1)], profile[i], profile[i + 1], profile[min(i + 2, len(profile) - 1)])
        for t in (0, .5):
            a = 2 * t ** 3 - 3 * t ** 2 + 1
            b = t ** 3 - 2 * t ** 2 + t
            c = -2 * t ** 3 + 3 * t ** 2
            d = t ** 3 - t ** 2
            sample = tuple(a * p + b * (q - o) * .5 + c * q + d * (r - p) * .5
                           for o, p, q, r in zip(before, left, right, after))
            smooth_profile.append(sample)
    return [*smooth_profile, profile[-1]]


def add_sleeves(geom, bones, spec):
    for side, sign in (('L', 1), ('R', -1)):
        shoulder, elbow, _ = bones[f'UpperArm.{side}']
        _, wrist, _ = bones[f'Forearm.{side}']
        up_axis = (elbow - shoulder).normalized()
        fore_axis = (wrist - elbow).normalized()
        span = (elbow - shoulder).length
        lower_span = (wrist - elbow).length

        def weights(point):
            t1 = (point - shoulder).dot(up_axis) / span
            t2 = (point - elbow).dot(fore_axis) / lower_span
            shoulder_share = 1 - smooth(.03, .35, t1)
            elbow_share = smooth(-.18, .27, t2)
            return {
                f'Clavicle.{side}': shoulder_share,
                f'UpperArm.{side}': (1 - shoulder_share) * (1 - elbow_share),
                f'Forearm.{side}': (1 - shoulder_share) * elbow_share,
            }

        profile = [
            (shoulder - up_axis * .045 + Vector((-.036 * sign, .006, 0)), .037),
            (shoulder - up_axis * .021 + Vector((-.014 * sign, .004, 0)), .061),
            (shoulder.lerp(elbow, .10), .074),
            (shoulder.lerp(elbow, .30), .062),
            (shoulder.lerp(elbow, .57), .059),
            (shoulder.lerp(elbow, .79), .055),
            (shoulder.lerp(elbow, .95) + Vector((.006 * sign, .002, 0)), .056),
            (elbow.lerp(wrist, .09) + Vector((-.003 * sign, -.006, 0)), .054),
            (elbow.lerp(wrist, .25), .054),
            (elbow.lerp(wrist, .45), .047),
            (elbow.lerp(wrist, .66) + Vector((.004 * sign, -.002, 0)), .044),
            (elbow.lerp(wrist, .81), .038),
            (elbow.lerp(wrist, .89) + Vector((.002 * sign, .002, 0)), .037),
            (elbow.lerp(wrist, .96), .030),
        ]
        softened = interpolate_profile(profile)
        geom.tube([c for c, _ in softened], [a * spec['build'] for _, a in softened],
                  weights, 'jacket', sides=24, aspect=.95)
        arm_seam = [p + Vector((r * .91 * sign, r * .16, 0)) for p, r in profile[2:-1]]
        geom.tube(arm_seam, .00125, weights, 'jacket_shade', sides=5)
        cuff = [elbow.lerp(wrist, a) for a in (.915, .95, 1.042)]
        geom.tube(cuff, [.031, .030, .0261], f'Forearm.{side}', 'rib', sides=22, aspect=.86)
        for t in (.941, .964):
            geom.tube([elbow.lerp(wrist, t), elbow.lerp(wrist, t + .009)], .030,
                      f'Forearm.{side}', 'thread', sides=22, aspect=.86)


def add_pants(geom, persona, bones, spec):
    verts, uvs, groups, points = persona

    def leg_center(p, transformed):
        side = 'L' if p.x >= 0 else 'R'
        src = side.lower()
        names = (f'{src}-upper-leg', f'{src}-knee', f'{src}-ankle')
        if transformed:
            a, b, c = [bones[f'{joint}.{side}'][0] for joint in ('UpperLeg', 'Shin', 'Foot')]
        else:
            a, b, c = [points[name] for name in names]
        upper = p.z >= b.z
        start, end = (b, a) if upper else (c, b)
        return start.lerp(end, max(0, min(1, (p.z - start.z) / (end.z - start.z))))

    def shape(p):
        before = leg_center(p, False)
        after = leg_center(p, True)
        taper = smooth(.0, .21, p.z)
        loft = .11 + .12 * taper - .12 * smooth(.77, 1.02, p.z)
        roughness = .012 * math.sin(126 * p.z + 18 * p.x) * math.exp(-((p.z - .143) / .090) ** 2)
        roughness += .0047 * math.sin(81 * p.z + 37 * p.x) * math.exp(-((p.z - .509) / .108) ** 2)
        x = before.x + (p.x - before.x) * (1 + loft)
        x += (after.x - before.x) * (1 - smooth(.75, .94, p.z))
        y = before.y + (p.y - before.y) * (1.07 + .07 * taper)
        y += roughness * (1 if p.y > before.y else -1)
        x += roughness * .6 * (1 if x > after.x else -1)
        tucked = smooth(.929, 1.014, p.z)
        x *= 1 - .07 * tucked
        y = -.02 + (y + .02) * (1 - .20 * tucked)
        return Vector((x, y, p.z + .0045 * math.sin(22 * x + 14 * y) * taper))

    def weights(p):
        s = 'L' if p.x >= 0 else 'R'
        knee = bones[f'Shin.{s}'][0].z
        shin = 1 - smooth(knee - .096, knee + .11, p.z)
        hip = smooth(.778, .966, p.z)
        return {'Hips': hip, f'UpperLeg.{s}': (1 - hip) * (1 - shin), f'Shin.{s}': (1 - hip) * shin}

    faces = [face for face in groups['helper-tights'] if all(
        .074 < verts[i].z < 1.022 and abs(verts[i].x) < .295 for i, _ in face
    )]
    geom.source(verts, uvs, faces, shape, weights, 'pants')
    for s in (-1, 1):
        thigh = bones['UpperLeg.L' if s > 0 else 'UpperLeg.R'][0]
        z = .720 + s * .006
        x = thigh.x + s * (.100 if spec['build'] > 1 else .096)
        geom.oval((x, .000, z), (.016, .057, .076), weights, 'pocket', 18, 11, .40)
        geom.oval((x + s * .006, -.003, z + .053), (.013, .058, .025), weights, 'pants', 18, 9, .44)
        seam = [Vector((x + s * .016, y, z + .054)) for y in (-.048, -.020, .021, .044)]
        geom.tube(seam, .00125, weights, 'pocket', sides=6)
        geom.oval((x + s * .018, -.001, z + .048), (.0013, .0034, .0034), weights, 'zip', 8, 6)


def add_shoes(geom, bones, spec):
    for side, sign in (('L', 1), ('R', -1)):
        ankle = bones[f'Foot.{side}'][0]
        x, y = ankle.x, ankle.y
        joint = f'Foot.{side}'
        shoe = [
            (0, x + .008 * sign, y - .066, .060, .126, 0),
            (.010, x + .008 * sign, y - .066, .062, .128, 0),
            (.025, x + .008 * sign, y - .066, .062, .128, 0),
            (.030, x + .008 * sign, y - .066, .059, .125, 0),
        ]
        shell(geom, shoe, joint, 'outsole', sides=26, caps=True, detail=.0005, power=.61)
        shell(geom, [(z, cx, cy, rx * .99, ry * .99, gap) for z, cx, cy, rx, ry, gap in shoe[:2]],
              joint, 'rubber', sides=26, caps=True, detail=.00045, power=.61)
        upper = [
            (.024, x + .008 * sign, y - .063, .058, .122, 0),
            (.037, x + .008 * sign, y - .064, .060, .121, 0),
            (.050, x + .006 * sign, y - .057, .057, .108, 0),
            (.063, x + .003 * sign, y - .041, .050, .094, 0),
            (.073, x, y - .025, .044, .074, 0),
            (.093, x, y - .008, .040, .057, 0),
            (.108, x, y + .001, .040, .047, 0),
        ]
        shell(geom, upper, joint, 'shoe', sides=26, caps=True, detail=.0005, power=.85)
        crest = [Vector((x + sign * dx, y + dy, h)) for dx, dy, h in (
            (.054, -.159, .033), (.058, -.121, .041), (.053, -.080, .053), (.048, -.040, .064)
        )]
        geom.tube(crest, [.0027, .0039, .0037, .0016], joint, 'lace', sides=7, aspect=.67)
        for t in range(5):
            ylace = y - .110 + .016 * t
            z = .073 + .0071 * t
            path = [Vector((x + dx, ylace + dy, z - dz)) for dx, dy, dz in (
                (-.027, 0, .007), (-.012, .001, .001), (.011, .003, -.002), (.029, .004, .005),
            )]
            geom.tube(path, .0019, joint, 'lace', sides=6, aspect=.77)


def add_backpack(geom, spec):
    material = 'bag'
    rows = [
        (1.003, 0, .115, .085, .028, 0),
        (1.026, 0, .139, .121, .046, 0),
        (1.061, 0, .152, .132, .062, 0),
        (1.112, 0, .155, .135, .073, 0),
        (1.188, 0, .160, .139, .074, 0),
        (1.275, 0, .151, .132, .065, 0),
        (1.332, 0, .134, .112, .048, 0),
        (1.368, 0, .112, .065, .022, 0),
    ]
    shell(geom, rows, 'Chest', material, sides=28, caps=True, detail=.0021, power=.63)
    pocket = [
        (1.032, 0, .188, .080, .023, 0),
        (1.061, 0, .206, .107, .029, 0),
        (1.098, 0, .215, .112, .025, 0),
        (1.138, 0, .210, .104, .027, 0),
        (1.154, 0, .202, .085, .018, 0),
    ]
    shell(geom, pocket, 'Chest', 'bag_panel', sides=26, caps=True, detail=.0011, power=.65)
    zip_line = [Vector((x, y, z)) for x, y, z in (
        (-.097, .208, 1.127), (-.082, .226, 1.143), (-.038, .231, 1.147),
        (.010, .233, 1.148), (.067, .226, 1.146), (.095, .217, 1.134),
    )]
    geom.tube(zip_line, .0021, 'Chest', 'zip', sides=7)
    top = [Vector((x, y, z)) for x, y, z in (
        (-.118, .182, 1.191), (-.110, .187, 1.264), (-.084, .184, 1.312),
        (-.046, .185, 1.336), (.003, .183, 1.345), (.052, .181, 1.332),
        (.089, .184, 1.309), (.118, .187, 1.265), (.121, .185, 1.214),
    )]
    geom.tube(top, .0024, 'Chest', 'zip', sides=7)
    for x, y, z in ((.084, .222, 1.124), (-.103, .194, 1.263)):
        geom.oval((x, y, z - .013), (.0056, .0034, .023), 'Chest', 'zip', 10, 8)
    seam = [Vector((x, y, z)) for x, y, z in (
        (-.036, .113, 1.356), (-.030, .105, 1.382), (-.015, .104, 1.391),
        (.019, .104, 1.391), (.033, .104, 1.380), (.038, .114, 1.352),
    )]
    geom.tube(seam, .0075, 'Chest', 'strap', sides=11, aspect=.75)
    geom.oval((0, .223, 1.271), (.026, .004, .011), 'Chest', 'zip', 14, 8)
    for sign in (-1, 1):
        strap = [Vector((sign * x, y, z)) for x, y, z in (
            (.081, .135, 1.336), (.090, .086, 1.391), (.097, .031, 1.426),
            (.099, -.022, 1.429), (.105, -.075, 1.404), (.106, -.112, 1.361),
            (.118, -.137, 1.297), (.125, -.132, 1.230), (.134, -.119, 1.174),
            (.148, -.072, 1.109), (.133, -.013, 1.061), (.124, .083, 1.036),
        )]
        geom.tube(strap, [.013, .016, .017, .019, .019, .019, .018, .017, .013, .011, .010, .011],
                  'Chest', 'strap', sides=12, aspect=.5, axis=UP)
        buckle = Vector((sign * .134, -.125, 1.174))
        geom.oval(buckle, (.015, .0047, .012), 'Chest', 'zip', 12, 8, .45)
        geom.oval(buckle + FRONT * .004, (.0106, .0028, .007), 'Chest', 'strap', 12, 8, .45)


def create_armature(name, bones):
    armature = bpy.data.armatures.new(f'{name} · Humanoid')
    rig = bpy.data.objects.new(f'{name}Rig', armature)
    bpy.context.collection.objects.link(rig)
    rig.show_in_front = True
    bpy.context.view_layer.objects.active = rig
    rig.select_set(True)
    bpy.ops.object.mode_set(mode='EDIT')
    for joint, (head, tail, parent) in bones.items():
        bone = armature.edit_bones.new(joint)
        bone.head = head
        bone.tail = tail
        if parent:
            bone.parent = armature.edit_bones[parent]
    bpy.ops.object.mode_set(mode='OBJECT')
    for bone in rig.pose.bones:
        bone.rotation_mode = 'QUATERNION'
    return rig


def world_rotation(x=0, y=0, z=0):
    return Euler(tuple(math.radians(rate) for rate in (x, y, z)), 'XYZ').to_quaternion()


def local_rotation(bone, rotation):
    basis = bone.bone.matrix_local.to_quaternion()
    return basis.inverted() @ rotation @ basis


def shin_targets(bones, side, hip_offset, ankle, pitch, rotations):
    upper_name, lower_name = f'UpperLeg.{side}', f'Shin.{side}'
    up, mid, _ = bones[upper_name]
    lo, end, _ = bones[lower_name]
    hip = up + hip_offset
    upper_len = (mid - up).length
    lower_len = (end - lo).length
    direction = (ankle - hip).normalized()
    reach = max(.05, min((ankle - hip).length, upper_len + lower_len - .0001))
    ankle = hip + direction * reach
    axis = (FRONT - direction * FRONT.dot(direction)).normalized()
    knee_projection = (reach ** 2 + upper_len ** 2 - lower_len ** 2) / (2 * reach)
    knee = hip + direction * knee_projection + axis * math.sqrt(max(0, upper_len ** 2 - knee_projection ** 2))
    upper = (mid - up).rotation_difference(knee - hip)
    lower = (end - lo).rotation_difference(ankle - knee)
    rotations[upper_name] = upper
    rotations[lower_name] = upper.inverted() @ lower
    rotations[f'Foot.{side}'] = lower.inverted() @ world_rotation(x=pitch)


def foot_target(bones, side, t, gait):
    phase = (t + (0 if side == 'L' else .5)) % 1
    stance, step, rise = (.59, .320, .081) if gait == 'Walk' else (.43, .380, .145)
    ankle = bones[f'Foot.{side}'][0].copy()
    if phase < stance:
        ankle.y += step * (2 * phase / stance - 1)
        return ankle, 0
    swing = (phase - stance) / (1 - stance)
    y = step * (1 - 2 * smooth(0, 1, swing))
    lift = math.sin(math.pi * swing) ** 1.45
    ankle.y += y
    ankle.z += rise * lift
    return ankle, 7 * math.sin(TAU * swing) * lift


def fit_hip_to_steps(bones, hips, targets):
    for side, (ankle, _) in targets.items():
        upper, knee, _ = bones[f'UpperLeg.{side}']
        _, ankle_rest, _ = bones[f'Shin.{side}']
        reach = (knee - upper).length + (ankle_rest - knee).length - .003
        dx = ankle.x - (upper.x + hips.x)
        dy = ankle.y - (upper.y + hips.y)
        clearance = math.sqrt(max(0, reach ** 2 - dx ** 2 - dy ** 2))
        hips.z = min(hips.z, ankle.z + clearance - upper.z)


def pose_at(rig, bones, clip, t, frame, variant):
    rotations = {}
    frame_wave = TAU * t
    hips = Vector((0, 0, -.006))
    if clip in ('Walk', 'Run'):
        run = clip == 'Run'
        hips.z = (-.042 if run else -.028) - (.012 if run else .009) * math.cos(2 * frame_wave)
        hips.x = .014 * math.cos(frame_wave)
        stride = math.cos(frame_wave)
        rotations['Spine'] = world_rotation(x=-6.5 if run else -.8, z=4.2 * stride)
        rotations['Chest'] = world_rotation(x=-3 if run else -.45, z=2.1 * stride)
        rotations['Head'] = world_rotation(x=3.8 if run else .4, z=-4.1 * stride)
        targets = {side: foot_target(bones, side, t, clip) for side in ('L', 'R')}
        fit_hip_to_steps(bones, hips, targets)
        for side, sign in (('L', 1), ('R', -1)):
            shoulder = (33 if run else 15) * stride * sign
            rotations[f'UpperArm.{side}'] = world_rotation(x=shoulder + (-8 if run else -1), y=-5.5 * sign)
            rotations[f'Forearm.{side}'] = world_rotation(x=(-51 if run else -17) + (12 if run else 5) * stride * sign)
            rotations[f'Hand.{side}'] = world_rotation(y=1 + 5 * stride * sign)
            ankle, pitch = targets[side]
            shin_targets(bones, side, hips, ankle, pitch, rotations)
    else:
        gesture = math.sin(math.pi * t) ** 2
        breath = math.sin(frame_wave)
        hips.z += .0035 * breath
        rotations['Chest'] = world_rotation(x=-1.55 * breath, y=.48 * breath)
        rotations['Head'] = world_rotation(x=.8 * breath, z=3 * math.sin(frame_wave + variant))
        for side, sign in (('L', 1), ('R', -1)):
            rotations[f'UpperArm.{side}'] = world_rotation(x=-1 + .8 * breath, y=sign * (1.5 + .7 * breath))
            rotations[f'Forearm.{side}'] = world_rotation(x=-4 - 1.1 * breath)
            ankle = bones[f'Foot.{side}'][0].copy()
            if clip == 'Turn' and side == 'R':
                ankle.y += .047 * gesture
                ankle.x -= .028 * gesture
                ankle.z += .037 * gesture
            shin_targets(bones, side, hips, ankle, 0, rotations)
        if clip == 'Turn':
            rotations['Spine'] = world_rotation(z=16 * gesture)
            rotations['Chest'] = world_rotation(z=10 * gesture, y=-3 * gesture)
            rotations['Head'] = world_rotation(z=21 * gesture)
            rotations['UpperArm.L'] = world_rotation(x=-12 * gesture)
            rotations['UpperArm.R'] = world_rotation(x=8 * gesture)
        elif clip == 'Interact':
            rotations['Chest'] = world_rotation(x=-5 * gesture, z=-6 * gesture)
            rotations['Head'] = world_rotation(x=12 * gesture, z=14 * gesture)
            rotations['Clavicle.R'] = world_rotation(x=-8 * gesture, y=3 * gesture)
            rotations['UpperArm.R'] = world_rotation(x=-52 * gesture, y=-12 * gesture)
            rotations['Forearm.R'] = world_rotation(x=-36 * gesture, z=14 * gesture)
            rotations['Hand.R'] = world_rotation(x=14 * gesture, z=13 * gesture)
        elif clip == 'Dialogue':
            wave = math.sin(frame_wave * 2) * gesture
            rotations['Chest'] = world_rotation(x=-4 * gesture, z=4 * gesture)
            rotations['Head'] = world_rotation(x=5.5 * wave, y=2.4 * gesture, z=-9 * gesture)
            rotations['UpperArm.L'] = world_rotation(x=-29 * gesture, y=-12 * gesture)
            rotations['Forearm.L'] = world_rotation(x=-(34 + 5 * wave) * gesture, y=4 * gesture)
            rotations['Hand.L'] = world_rotation(x=8 * wave, y=18 * gesture, z=-13 * gesture)
    for bone in rig.pose.bones:
        bone.rotation_quaternion = local_rotation(bone, rotations.get(bone.name, Quaternion()))
        bone.keyframe_insert('rotation_quaternion', frame=frame, group=bone.name)
        if bone.name == 'Hips':
            bone.location = bone.bone.matrix_local.to_3x3().inverted() @ hips
            bone.keyframe_insert('location', frame=frame, group=bone.name)


def animate(rig, bones, key):
    rig.animation_data_create()
    scene = bpy.context.scene
    scene.render.fps = 30
    actions = [
        ('Idle', 91), ('Walk', 31), ('Run', 23),
        ('Turn', 33), ('Interact', 55), ('Dialogue', 79),
    ]
    for name, total in actions:
        action = bpy.data.actions.new(name)
        action.use_fake_user = True
        rig.animation_data.action = action
        for frame in range(1, total + 1, 2):
            pose_at(rig, bones, name, (frame - 1) / (total - 1), frame, .52 if key == 'antoine' else 0)
        for curve in action.fcurves:
            for point in curve.keyframe_points:
                point.interpolation = 'LINEAR'
        rig.animation_data.action = None
        track = rig.animation_data.nla_tracks.new()
        track.name = name
        track.strips.new(name, 1, action)
        track.mute = True
    scene.frame_set(1)
    for bone in rig.pose.bones:
        bone.rotation_quaternion = Quaternion()
        bone.location = Vector((0, 0, 0))


def point_at(obj, target):
    obj.rotation_euler = (Vector(target) - obj.location).to_track_quat('-Z', 'Y').to_euler()


def studio_light(name, position, target, energy, size, color):
    data = bpy.data.lights.new(name, 'AREA')
    data.energy = energy
    data.shape = 'DISK'
    data.size = size
    data.color = color
    light = bpy.data.objects.new(name, data)
    bpy.context.collection.objects.link(light)
    light.location = position
    point_at(light, target)


def studio_render(key, path, angle, portrait=False):
    scene = bpy.context.scene
    scene.render.engine = 'CYCLES'
    scene.cycles.samples = 32
    scene.cycles.use_denoising = False
    scene.render.film_transparent = portrait
    scene.render.image_settings.file_format = 'WEBP' if portrait else 'PNG'
    scene.render.image_settings.color_mode = 'RGBA' if portrait else 'RGB'
    scene.render.image_settings.quality = 89
    scene.render.resolution_x = 500 if portrait else 580
    scene.render.resolution_y = 600 if portrait else 860
    scene.render.resolution_percentage = 100
    scene.world = bpy.data.worlds.new('Atelier · lumière ambiante')
    scene.world.use_nodes = True
    background = scene.world.node_tree.nodes.get('Background')
    background.inputs['Color'].default_value = (.40, .49, .61, 1)
    background.inputs['Strength'].default_value = .31
    scene.view_settings.view_transform = 'AgX'
    for old in tuple(bpy.context.scene.objects):
        if old.type in {'LIGHT', 'CAMERA'}:
            bpy.data.objects.remove(old, do_unlink=True)
    camera = bpy.data.cameras.new('Caméra atelier')
    obj = bpy.data.objects.new('Caméra atelier', camera)
    bpy.context.collection.objects.link(obj)
    scene.camera = obj
    obj.location = angle
    target = (0, -.015, 1.535) if portrait else (0, 0, .91)
    point_at(obj, target)
    camera.type = 'ORTHO'
    camera.ortho_scale = .67 if portrait else 1.96
    studio_light('Fenêtre ouest', (-2.60, -3.21, 4.21), (0, 0, .88), 270, 2.1, (1, .83, .68))
    studio_light('Rebond', (2.38, -2.13, 2.65), (0, 0, 1.33), 155, 2.7, (.73, .82, 1))
    studio_light('Contre-jour', (1.20, 1.30, 2.63), (0, 0, 1.34), 242, 1.6, (1, .84, .66))
    scene.render.filepath = str(path)
    bpy.ops.render.render(write_still=True)


def build(base, key, assets, previews, blend_dir, render_portrait):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    spec = PERSONAS[key]
    persona = load_persona(base, spec)
    verts, uvs, groups, points = persona
    bones = rig_points(points)
    geometry = Geometry()
    skin_faces = add_head(geometry, persona, spec, bones)
    add_hair(geometry, persona, spec)
    add_torso(geometry, bones, spec)
    add_sleeves(geometry, bones, spec)
    add_pants(geometry, persona, bones, spec)
    add_shoes(geometry, bones, spec)
    add_backpack(geometry, spec)
    with tempfile.TemporaryDirectory(prefix=f'watteau-{key}-') as tmp:
        surface = paint_skin(verts, uvs, skin_faces, points, rgb(spec['skin']), spec['seed'])
        materials = style_materials(key, spec, Path(tmp), surface)
        rig = create_armature(key.title(), bones)
        obj = geometry.object(key.title(), materials)
        obj.parent = rig
        armature = obj.modifiers.new('Déformation squelettique', 'ARMATURE')
        armature.object = rig
        armature.use_deform_preserve_volume = True
        animate(rig, bones, key)
        bpy.context.view_layer.objects.active = rig
        rig.select_set(True)
        obj.select_set(True)
        file = assets / f'{key}.glb'
        bpy.ops.export_scene.gltf(
            filepath=str(file), export_format='GLB', use_selection=True,
            export_materials='EXPORT', export_texcoords=True, export_normals=True,
            export_yup=True, export_skins=True, export_animations=True,
            export_animation_mode='NLA_TRACKS', export_force_sampling=True, export_frame_range=False,
            export_image_format='AUTO',
        )
        if blend_dir:
            bpy.ops.wm.save_as_mainfile(filepath=str(blend_dir / f'{key}.blend'))
        mesh = obj.data
        mesh.calc_loop_triangles()
        dimensions = tuple(round(max(p[i] for p in geometry.vertices) - min(p[i] for p in geometry.vertices), 5) for i in range(3))
        print(f'PERSONNAGE {key} {file.stat().st_size} octets {len(mesh.vertices)} sommets source {len(mesh.loop_triangles)} triangles {dimensions} XYZ Blender', flush=True)
        if previews:
            studio_render(key, previews / f'{key}-face.png', (1.63, -4.4, 2.07))
            studio_render(key, previews / f'{key}-dos.png', (1.63, 4.4, 2.07))
        if key == 'antoine' and render_portrait:
            studio_render(key, assets / 'antoine.webp', (.42, -3.5, 1.80), portrait=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--assets', type=Path, default=ASSETS)
    parser.add_argument('--previews', type=Path)
    parser.add_argument('--blend-dir', type=Path)
    parser.add_argument('--only', choices=list(PERSONAS))
    parser.add_argument('--skip-portrait', action='store_true')
    options = parser.parse_args(sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else [])
    for path in (options.assets, options.previews, options.blend_dir):
        if path:
            path.mkdir(parents=True, exist_ok=True)
    base = read_base()
    for key in PERSONAS:
        if options.only is None or key == options.only:
            build(base, key, options.assets, options.previews, options.blend_dir, not options.skip_portrait)


if __name__ == '__main__':
    main()
