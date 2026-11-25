"""Draw the fictional campus and Antoine from original geometric pixel artwork."""

from pathlib import Path
from random import Random

from PIL import Image, ImageDraw, ImageFilter


ART = Path(__file__).resolve().parents[1] / "public" / "art"
ART.mkdir(parents=True, exist_ok=True)
NEAREST = Image.Resampling.NEAREST


def campus():
    """Draw a 480×270 scene and scale each artwork pixel to 2×2."""
    width, height = 480, 270
    rng = Random(91)
    scene = Image.new("RGB", (width, height))
    draw = ImageDraw.Draw(scene)
    glow = Image.new("RGBA", scene.size)
    lights = ImageDraw.Draw(glow)

    def polygon(points, color):
        draw.polygon(points, fill=color)

    def rectangle(box, color):
        draw.rectangle(box, fill=color)

    def line(points, color, width=1):
        draw.line(points, fill=color, width=width)

    def ellipse(box, color):
        draw.ellipse(box, fill=color)

    for y in range(height):
        if y < 90:
            fraction = y / 90
            sky = (int(18 + 24 * fraction), int(23 + 28 * fraction), int(42 + 30 * fraction))
            line([(0, y), (width, y)], sky)
        else:
            fraction = (y - 90) / 180
            stone = (int(24 + 5 * fraction), int(38 + 6 * fraction), int(54 + 12 * fraction))
            line([(0, y), (width, y)], stone)

    # Urban skyline and thin clouds.
    for left, altitude, right in [(5, 33, 39), (43, 28, 76), (79, 34, 104), (109, 22, 126),
                                  (133, 39, 167), (171, 31, 203), (209, 36, 232), (243, 28, 269),
                                  (277, 36, 299), (302, 24, 320), (324, 35, 355), (358, 32, 379),
                                  (385, 36, 416), (423, 29, 451), (458, 20, 476)]:
        rectangle((left, altitude, right, 68), "#29394e")
        line([(left, altitude), (right, altitude)], "#344359")
        for x in range(left + 3, right - 1, 5):
            for y in range(altitude + 5, 51, 6):
                color = rng.choice(["#29394e", "#29394e", "#384559", "#485468", "#69545b"])
                rectangle((x, y, x + 1, y + 1), color)
    for x, y, length in [(9, 13, 45), (19, 17, 20), (69, 12, 21), (132, 8, 41), (175, 17, 32),
                         (234, 12, 27), (281, 17, 23), (340, 9, 60), (383, 13, 20), (421, 7, 32)]:
        line([(x, y), (x + length, y)], rng.choice(["#30394e", "#35364f", "#383852", "#44405a"]))

    # Broad paved courtyard and two intersecting walks.
    polygon([(0, 127), (480, 112), (480, 157), (0, 174)], "#293b50")
    polygon([(0, 176), (480, 121), (480, 151), (0, 211)], "#304458")
    polygon([(142, 104), (179, 104), (349, 269), (267, 269)], "#35495c")
    polygon([(0, 220), (480, 179), (480, 221), (0, 264)], "#304359")
    for x in range(-90, 570, 21):
        line([(x, 105), (x + 109, 269)], "#27374d")
    for y in range(111, 290, 13):
        line([(0, y), (479, y - 34)], "#26374a")
        line([(0, y + 1), (479, y - 33)], "#39495a")
    for _ in range(660):
        x = rng.randrange(width)
        y = rng.randrange(103, height)
        dot = rng.choice(["#3d4b59", "#39495a", "#304157", "#435060", "#29384b"])
        line([(x, y), (x + rng.randrange(1, 4), y)], dot)

    # A low stone curb and roofline keep the walking area visually distinct.
    polygon([(0, 99), (479, 86), (479, 103), (0, 117)], "#253044")
    line([(0, 110), (478, 96)], "#465465", 2)
    line([(0, 114), (478, 100)], "#334258", 2)

    def facade(x, y, w, h, depth, palette, trim, bays, floors):
        roof, side, front = palette
        polygon([(x, y), (x + depth, y - depth // 2), (x + w + depth, y - depth // 2),
                 (x + w, y)], roof)
        polygon([(x + w, y), (x + w + depth, y - depth // 2),
                 (x + w + depth, y + h - depth // 2), (x + w, y + h)], side)
        rectangle((x, y, x + w, y + h), front)
        line([(x, y), (x + w, y), (x + w + depth, y - depth // 2)], trim, 2)
        line([(x + 2, y + h - 5), (x + w, y + h - 5)], "#24394c", 2)
        line([(x + w, y + 2), (x + w, y + h)], "#233145", 2)
        line([(x + 2, y + h), (x + w, y + h), (x + w + depth, y + h - depth // 2)], "#172537")
        for by in range(y + 7, y + h - 3, 8):
            line([(x + 2, by), (x + w - 1, by)], "#394657")
            line([(x + w + 1, by), (x + w + depth - 1, by - depth // 2)], "#293b4e")
        for r in range(floors):
            for c in range(bays):
                wx = x + 7 + c * ((w - 10) // bays)
                wy = y + 10 + r * ((h - 11) // floors)
                ww = max(6, ((w - 10) // bays) - 7)
                wh = min(13, (h - 10) // floors - 4)
                if ww < 4 or wh < 3:
                    continue
                rectangle((wx - 2, wy - 2, wx + ww + 2, wy + wh + 2), "#263747")
                lit = rng.choice([0, 1, 1, 2, 3])
                colors = ["#293a50", "#35506a", "#629ca1", "#d8957d"]
                rectangle((wx, wy, wx + ww, wy + wh), colors[lit])
                line([(wx + ww // 2, wy), (wx + ww // 2, wy + wh)], "#24384c")
                line([(wx, wy + wh // 2), (wx + ww, wy + wh // 2)], "#2e4253")
                line([(wx - 1, wy + wh + 2), (wx + ww + 2, wy + wh + 2)], "#556375")
                if lit >= 2:
                    lights.rectangle((wx, wy, wx + ww, wy + wh),
                                     fill=("#69cbc885" if lit == 2 else "#f8aa7b92"))
        for i in range(3):
            vent_x = x + (w // 4) * (i + 1)
            yy = y - 4
            polygon([(vent_x, yy), (vent_x + 4, yy - 3), (vent_x + 16, yy - 3),
                     (vent_x + 11, yy)], "#5b6270")
            rectangle((vent_x, yy, vent_x + 11, yy + 2), "#25354a")
        line([(x + 2, y + 3), (x + w - 2, y + 3)], "#526174")

    facade(2, 43, 101, 57, 17, ("#3b4b62", "#2b3b52", "#35465b"), "#65727f", 7, 3)
    facade(87, 61, 114, 41, 16, ("#465164", "#293b4f", "#3c485b"), "#76818a", 7, 2)
    facade(204, 32, 123, 72, 22, ("#45536a", "#2a3a50", "#3a465b"), "#78808e", 7, 3)
    facade(323, 48, 92, 51, 15, ("#3a4a61", "#2a3b4c", "#34465b"), "#647581", 5, 2)
    facade(413, 57, 67, 46, 14, ("#405065", "#283a4e", "#37495f"), "#717989", 5, 2)

    # Three entrances give the courtyard an intentional focal rhythm.
    for x, y, left, right, color in [(79, 96, 51, 113, "#69bdba"), (243, 99, 213, 276, "#8bcaca"),
                                      (405, 95, 380, 435, "#dc907f")]:
        polygon([(left, y + 3), (right, y + 3), (right + 8, y + 9), (left - 8, y + 9)], "#526073")
        polygon([(left - 8, y + 9), (right + 8, y + 9), (right + 9, y + 12),
                 (left - 9, y + 12)], "#26374b")
        for riser in range(3):
            line([(left - riser - 2, y + 4 + riser * 2), (right + riser, y + 4 + riser * 2)],
                 "#647184")
        rectangle((x - 10, y - 17, x + 10, y + 2), "#192b3a")
        rectangle((x - 8, y - 15, x + 8, y - 2), "#2a5762")
        line([(x, y - 15), (x, y + 1)], "#172c3c", 2)
        line([(left + 5, y - 21), (right - 4, y - 21)], color, 2)
        line([(left + 5, y - 20), (right - 4, y - 20)], "#a4b6be")
        lights.rectangle((left + 6, y - 22, right - 4, y - 19), fill=f"{color}99")

    def mark_tile(x, y, color):
        polygon([(x - 19, y - 2), (x - 10, y - 9), (x + 12, y - 9), (x + 19, y - 2),
                 (x + 12, y + 7), (x - 10, y + 7)], "#40576a")
        line([(x - 19, y - 2), (x - 10, y - 9), (x + 12, y - 9), (x + 19, y - 2),
              (x + 12, y + 7), (x - 10, y + 7), (x - 19, y - 2)], color)
        line([(x - 10, y + 3), (x + 12, y + 3)], "#536979")

    for x, y, color in [(90, 139, "#567881"), (244, 129.5, "#577981"), (402.5, 185, "#846b77")]:
        mark_tile(round(x), round(y), color)

    def planter(left, top, right, bottom):
        ellipse((left - 1, top + 5, right + 9, bottom + 6), "#1d2b3f")
        polygon([(left + 5, top + 4), (right - 5, top + 4), (right, top + 10),
                 (right, bottom - 4), (right - 7, bottom), (left + 5, bottom),
                 (left, bottom - 5), (left, top + 10)], "#31465b")
        polygon([(left + 5, top), (right - 6, top), (right, top + 7), (right - 5, bottom - 8),
                 (left + 5, bottom - 8), (left, top + 7)], "#577483")
        polygon([(left + 6, top + 3), (right - 9, top + 3), (right - 4, top + 8),
                 (right - 8, bottom - 11), (left + 6, bottom - 11), (left + 4, top + 8)],
                "#263c42")
        line([(left + 5, bottom - 8), (right - 5, bottom - 8)], "#7895a0")
        for _ in range(64):
            x = rng.randrange(left + 7, right - 5)
            y = rng.randrange(top + 5, bottom - 11)
            leaf = rng.choice(["#2b5554", "#386564", "#4c7972", "#39675f", "#6e9283"])
            ellipse((x - 2, y - 2, x + 2, y + 1), leaf)
        for i in range(4):
            x = left + 9 + i * ((right - left - 16) // 4)
            y = top + rng.randrange(6, min(21, bottom - top - 12))
            rectangle((x, y - 1, x + 1, y + 1), "#d49a87")
            rectangle((x - 1, y, x + 2, y), "#996b72")

    planter(135, 162, 189, 197)
    planter(312, 136, 359, 173)

    def lamp(x, y, color):
        polygon([(x - 2, y), (x + 2, y), (x + 8, y + 3), (x - 2, y + 3)], "#1e2c3e")
        line([(x, y), (x, y - 20)], "#1a2d3e", 2)
        line([(x + 1, y), (x + 1, y - 19)], "#647482")
        line([(x - 2, y - 20), (x + 6, y - 20)], "#243748", 3)
        line([(x - 1, y - 20), (x + 5, y - 20)], color)
        lights.ellipse((x - 5, y - 23, x + 9, y - 16), fill=f"{color}aa")
        lights.ellipse((x - 8, y - 5, x + 9, y + 4), fill=f"{color}55")

    for x, y, color in [(5, 149, "#84d2cf"), (15, 195, "#e3ac87"),
                         (466, 134, "#7acac6"), (473, 220, "#eebb91"),
                         (31, 103, "#d89c87"), (191, 107, "#83beba"),
                         (365, 106, "#e5ae8e")]:
        lamp(x, y, color)

    def tree(x, y, scale):
        ellipse((x - scale, y - 2, x + scale + 4, y + 5), "#202c3f")
        line([(x, y), (x, y - scale * 2)], "#413e4b", 3)
        line([(x, y - scale), (x + scale // 2, y - scale * 2)], "#604c56")
        line([(x, y - scale), (x - scale // 2, y - scale * 2)], "#604c56")
        for _ in range(scale * 7):
            dx = rng.randrange(-scale, scale)
            dy = rng.randrange(-scale, scale)
            if dx * dx + dy * dy > scale * scale:
                continue
            base = y - scale * 2
            color = rng.choice(["#1d3b46", "#284b53", "#30545b", "#3b5a63", "#43646b"])
            radius = rng.randrange(2, 6)
            ellipse((x + dx - radius, base + dy - radius, x + dx + radius, base + dy + radius), color)

    for x, y, size in [(4, 119, 9), (469, 119, 11), (4, 236, 13), (477, 252, 14),
                       (18, 267, 10), (453, 270, 11)]:
        tree(x, y, size)

    # Street grates, curbs and litter along the edges.
    for x, y in [(28, 175), (203, 147), (229, 225), (420, 212), (444, 151), (98, 244), (290, 187)]:
        rectangle((x, y, x + 7, y + 3), "#213447")
        for channel in range(1, 7, 2):
            line([(x + channel, y + 1), (x + channel, y + 2)], "#4e5e6d")
    line([(0, 259), (479, 251)], "#495c70")
    line([(0, 260), (479, 252)], "#24344a", 2)
    line([(0, 267), (479, 259)], "#2b3a4e")

    scene = Image.alpha_composite(scene.convert("RGBA"), glow.filter(ImageFilter.GaussianBlur(6)))
    return scene.convert("RGB").resize((960, 540), NEAREST)


OUTLINE = "#202537"
SKIN = "#c98971"
SKIN_LIGHT = "#e3aa87"
SKIN_SHADE = "#a76860"
HAIR = "#372a37"
HAIR_LIGHT = "#5c3c43"
CREAM = "#dedddd"
CREAM_LIGHT = "#f5eeeb"
CREAM_SHADE = "#a8b0bc"
BURGUNDY = "#874559"
BURGUNDY_LIGHT = "#bb6876"
BURGUNDY_SHADE = "#58364f"
PACK = "#4d5062"
PACK_LIGHT = "#767c88"
PANTS = "#42506b"
PANTS_SHADE = "#2e3a55"


def sprite(direction, phase):
    """Draw a sprite on a 20×32 grid with a stable sole baseline."""
    image = Image.new("RGBA", (20, 32))
    draw = ImageDraw.Draw(image)
    bob = (0, -1, 0, -1)[phase]
    offsets = ((0, 0), (-1, 1), (0, -1), (1, -1))[phase]

    def rect(box, color):
        draw.rectangle(box, fill=color)

    def poly(points, color):
        draw.polygon(points, fill=color)

    def upper(box, color):
        x, y, rx, ry = box
        draw.rectangle((x, y + bob, rx, ry + bob), fill=color)

    def head(points, color):
        draw.polygon([(x, y + bob) for x, y in points], fill=color)

    if direction in ("down", "up"):
        for x, foot_offset in [(5, offsets[0]), (11, offsets[1])]:
            rect((x, 22 + bob, x + 4, 29 + min(foot_offset, 0)), OUTLINE)
            rect((x + 1, 23 + bob, x + 3, 28 + min(foot_offset, 0)), PANTS)
            rect((x, 29 + min(foot_offset, 0), x + 4, 31 + min(foot_offset, 0)), OUTLINE)
            rect((x + 1, 30 + min(foot_offset, 0), x + 3, 30 + min(foot_offset, 0)), CREAM)
    else:
        back, front = 8 - offsets[0], 10 - offsets[1]
        for z, shade in [(back, PANTS_SHADE), (front, PANTS)]:
            poly([(7, 22 + bob), (12, 22 + bob), (z + 2, 29), (z - 1, 29)], OUTLINE)
            poly([(8, 23 + bob), (11, 23 + bob), (z + 1, 28), (z, 28)], shade)
            rect((z - 2, 29, z + 2, 31), OUTLINE)
            rect((z - 2, 30, z + 1, 30), CREAM_SHADE if shade == PANTS_SHADE else CREAM)

    if direction in ("down", "up"):
        head([(5, 13), (14, 13), (17, 16), (17, 23), (14, 25), (5, 25), (3, 22),
              (3, 16)], OUTLINE)
        upper((4, 17, 6, 22), CREAM_SHADE)
        upper((14, 17, 16, 22), CREAM_SHADE)
        upper((4, 22, 5, 23), SKIN_SHADE)
        upper((15, 22, 16, 23), SKIN_SHADE)
        upper((6, 14, 13, 23), BURGUNDY_SHADE)
        upper((6, 16, 13, 21), BURGUNDY)
        upper((6, 15, 7, 22), BURGUNDY_LIGHT)
        if direction == "down":
            head([(8, 14), (11, 14), (12, 16), (11, 21), (8, 21), (8, 17)], CREAM)
            upper((9, 15, 10, 16), CREAM_LIGHT)
            upper((12, 15, 12, 20), PACK)
        else:
            upper((6, 15, 13, 20), OUTLINE)
            upper((7, 15, 12, 19), PACK)
            upper((8, 16, 11, 16), PACK_LIGHT)
            upper((8, 19, 11, 19), "#585c70")
    else:
        head([(7, 13), (12, 13), (15, 16), (16, 21), (14, 25), (6, 25), (5, 22),
              (5, 17)], OUTLINE)
        upper((7, 14, 12, 22), BURGUNDY)
        upper((7, 15, 8, 19), BURGUNDY_LIGHT)
        upper((10, 15, 12, 20), CREAM_SHADE)
        upper((10, 21, 11, 22), SKIN)
        upper((13, 16, 15, 22), OUTLINE)
        upper((13, 17, 14, 21), PACK)
        upper((14, 17, 14, 19), PACK_LIGHT)

    if direction == "down":
        head([(7, 3), (12, 3), (15, 5), (16, 10), (13, 14), (7, 14), (4, 11),
              (4, 6)], OUTLINE)
        head([(6, 6), (13, 6), (14, 8), (14, 11), (12, 13), (7, 13), (6, 11)], SKIN)
        upper((7, 8, 12, 10), SKIN_LIGHT)
        upper((7, 9, 7, 9), OUTLINE)
        upper((12, 9, 12, 9), OUTLINE)
        upper((9, 12, 10, 12), SKIN_SHADE)
        upper((5, 8, 5, 11), "#a7a7ae")
        upper((14, 8, 14, 11), "#a7a7ae")
        head([(5, 6), (6, 4), (8, 4), (9, 3), (11, 4), (13, 3), (15, 6),
              (13, 7), (11, 6), (8, 8), (6, 7)], HAIR)
        upper((8, 4, 9, 5), HAIR_LIGHT)
        upper((12, 5, 13, 5), HAIR_LIGHT)
    elif direction == "up":
        head([(7, 3), (12, 3), (15, 5), (16, 10), (14, 13), (11, 14), (7, 13), (4, 11),
              (4, 6)], OUTLINE)
        head([(6, 6), (7, 4), (9, 4), (10, 3), (13, 4), (14, 6), (14, 11), (12, 13),
              (8, 13), (6, 11)], HAIR)
        upper((8, 5, 10, 6), HAIR_LIGHT)
        upper((11, 8, 12, 9), HAIR_LIGHT)
        upper((5, 8, 5, 11), "#a7a7ae")
        upper((14, 8, 14, 11), "#a7a7ae")
        upper((9, 13, 11, 13), SKIN_SHADE)
    else:
        head([(7, 3), (12, 3), (15, 7), (15, 11), (13, 13), (7, 14), (5, 12), (5, 10),
              (4, 9), (5, 5)], OUTLINE)
        head([(6, 6), (12, 5), (14, 7), (13, 11), (11, 13), (7, 13), (6, 11), (5, 9)], SKIN)
        upper((6, 8, 9, 9), SKIN_LIGHT)
        upper((7, 8, 7, 8), OUTLINE)
        upper((6, 11, 7, 11), SKIN_SHADE)
        head([(6, 6), (7, 4), (9, 4), (10, 3), (12, 4), (14, 4), (15, 7),
              (14, 10), (12, 11), (11, 7), (8, 8)], HAIR)
        upper((9, 4, 10, 5), HAIR_LIGHT)
        upper((12, 5, 13, 6), HAIR_LIGHT)
        upper((11, 7, 12, 10), "#b4b1b4")
        upper((12, 7, 12, 7), CREAM)

    if direction == "right":
        image = image.transpose(Image.Transpose.FLIP_LEFT_RIGHT)
    return image.resize((40, 64), NEAREST)


def portrait():
    """Build a separate square dialogue portrait of the fictional character."""
    image = Image.new("RGBA", (56, 56), "#223848")
    draw = ImageDraw.Draw(image)
    draw.polygon([(0, 56), (56, 2), (56, 56)], fill="#2f5961")
    draw.line([(0, 55), (55, 2)], fill="#558481", width=2)
    draw.line([(0, 15), (15, 0)], fill="#435669", width=2)
    draw.line([(43, 55), (55, 43)], fill="#435669", width=2)
    draw.polygon([(5, 55), (9, 44), (15, 39), (22, 36), (35, 37), (43, 40), (49, 45),
                  (52, 55)], fill=OUTLINE)
    draw.polygon([(7, 55), (11, 45), (17, 41), (24, 40), (36, 40), (44, 43), (50, 55)],
                 fill=BURGUNDY)
    draw.polygon([(8, 55), (11, 46), (16, 44), (18, 55)], fill=BURGUNDY_SHADE)
    draw.polygon([(36, 40), (43, 43), (48, 55), (43, 55), (38, 46)], fill=PACK)
    draw.polygon([(13, 43), (19, 40), (23, 40), (19, 47), (18, 55), (15, 55),
                  (15, 48)], fill=PACK)
    draw.polygon([(20, 38), (25, 36), (35, 37), (38, 41), (34, 46), (33, 55), (23, 55),
                  (24, 47), (19, 44)], fill=CREAM_SHADE)
    draw.polygon([(21, 41), (25, 39), (33, 39), (36, 41), (32, 46), (31, 55), (25, 55),
                  (26, 46)], fill=CREAM_LIGHT)
    draw.line([(25, 46), (24, 52)], fill=CREAM_SHADE, width=1)
    draw.line([(32, 46), (33, 52)], fill=CREAM_SHADE, width=1)
    draw.polygon([(17, 16), (20, 11), (30, 10), (39, 14), (43, 23), (40, 32),
                  (36, 39), (29, 43), (23, 40), (16, 34), (13, 27)], fill=OUTLINE)
    draw.polygon([(17, 21), (20, 15), (29, 13), (38, 16), (40, 23), (39, 31), (35, 38),
                  (29, 41), (24, 38), (19, 34), (15, 27)], fill=SKIN)
    draw.polygon([(23, 18), (32, 15), (38, 19), (38, 28), (34, 33), (27, 32),
                  (22, 28)], fill=SKIN_LIGHT)
    draw.polygon([(16, 27), (21, 30), (22, 35), (28, 40), (25, 40), (19, 35)], fill=SKIN_SHADE)
    draw.rectangle((23, 24, 26, 25), fill=HAIR_LIGHT)
    draw.rectangle((33, 23, 35, 24), fill=HAIR_LIGHT)
    draw.rectangle((24, 27, 25, 28), fill=OUTLINE)
    draw.rectangle((34, 26, 35, 27), fill=OUTLINE)
    draw.line([(30, 28), (29, 31), (31, 31)], fill=SKIN_SHADE)
    draw.line([(27, 35), (31, 35), (33, 34)], fill="#84525a")
    draw.polygon([(13, 25), (13, 16), (16, 14), (16, 10), (21, 8), (24, 10), (27, 6),
                  (32, 6), (35, 9), (39, 9), (43, 12), (42, 16), (44, 20), (41, 25),
                  (38, 24), (36, 19), (32, 20), (28, 18), (24, 21), (21, 19), (18, 25)],
                 fill=HAIR)
    for x, y, accent in [(18, 12, "#684651"), (23, 14, "#553947"), (29, 8, "#744b51"),
                          (35, 11, "#674450"), (40, 15, "#684651"), (29, 15, "#563947"),
                          (16, 18, "#674450")]:
        draw.polygon([(x, y + 2), (x + 1, y), (x + 4, y), (x + 4, y + 2), (x + 2, y + 2),
                      (x + 1, y + 4)], fill=accent)
    draw.line([(15, 23), (15, 16), (19, 12)], fill="#9496a5", width=2)
    draw.line([(37, 12), (40, 15), (41, 23)], fill="#9496a5", width=2)
    draw.rounded_rectangle((12, 22, 17, 31), radius=2, fill=OUTLINE)
    draw.rounded_rectangle((13, 23, 16, 29), radius=1, fill="#a9a9b6")
    draw.rounded_rectangle((40, 22, 44, 30), radius=2, fill=OUTLINE)
    draw.rounded_rectangle((41, 23, 43, 28), radius=1, fill="#a9a9b6")
    return image.resize((112, 112), NEAREST)


def main():
    campus().save(ART / "campus.webp", lossless=True, method=6)
    atlas = Image.new("RGBA", (160, 256))
    for row, direction in enumerate(("down", "left", "right", "up")):
        for column in range(4):
            atlas.paste(sprite(direction, column), (column * 40, row * 64))
    atlas.save(ART / "antoine-atlas.png", optimize=True)
    portrait().save(ART / "antoine-portrait.png", optimize=True)


if __name__ == "__main__":
    main()
