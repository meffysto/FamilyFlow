#!/usr/bin/env python3
from __future__ import annotations

from pathlib import Path
from math import cos, sin, pi

from PIL import Image, ImageDraw, ImageFilter


ROOT = Path(__file__).resolve().parents[3]
OUT = ROOT / "assets" / "companion-house"
S = 3
SIZE = 512
CANVAS = SIZE * S


def rgba(hex_color: str, alpha: int = 255) -> tuple[int, int, int, int]:
    value = hex_color.lstrip("#")
    return tuple(int(value[i : i + 2], 16) for i in (0, 2, 4)) + (alpha,)


def new_canvas() -> tuple[Image.Image, ImageDraw.ImageDraw]:
    image = Image.new("RGBA", (CANVAS, CANVAS), (0, 0, 0, 0))
    return image, ImageDraw.Draw(image)


def scale_points(points: list[tuple[float, float]]) -> list[tuple[int, int]]:
    return [(int(x * S), int(y * S)) for x, y in points]


def ellipse_shadow(image: Image.Image, box: tuple[int, int, int, int], alpha: int = 62) -> None:
    shadow = Image.new("RGBA", image.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(shadow)
    draw.ellipse(tuple(v * S for v in box), fill=(83, 48, 32, alpha))
    image.alpha_composite(shadow.filter(ImageFilter.GaussianBlur(10 * S)))


def save(image: Image.Image, name: str) -> None:
    image = image.resize((SIZE, SIZE), Image.Resampling.LANCZOS)
    image.save(OUT / f"{name}.png")


def star(cx: float, cy: float, outer: float, inner: float, points: int = 5) -> list[tuple[float, float]]:
    result = []
    for i in range(points * 2):
        radius = outer if i % 2 == 0 else inner
        angle = -pi / 2 + i * pi / points
        result.append((cx + cos(angle) * radius, cy + sin(angle) * radius))
    return result


def draw_sapin_mini() -> None:
    img, d = new_canvas()
    ellipse_shadow(img, (166, 390, 346, 444), 72)
    trunk = scale_points([(238, 345), (274, 345), (286, 418), (226, 418)])
    d.polygon(trunk, fill=rgba("#854c30"), outline=rgba("#442434"))
    layers = [
        [(256, 62), (153, 205), (208, 194), (137, 300), (213, 285), (154, 376), (358, 376), (299, 285), (375, 300), (304, 194), (359, 205)],
        [(256, 80), (171, 202), (213, 191), (154, 287), (219, 276), (173, 352), (339, 352), (293, 276), (358, 287), (299, 191), (341, 202)],
    ]
    d.polygon(scale_points(layers[0]), fill=rgba("#346524"), outline=rgba("#442434"))
    d.polygon(scale_points(layers[1]), fill=rgba("#5f8f3a"), outline=rgba("#346524"))
    d.line(scale_points([(210, 170), (185, 205), (218, 199), (184, 250), (231, 238), (198, 294)]), fill=rgba("#deeed6", 140), width=4 * S)
    for x, y, color in [(222, 205, "#d04648"), (294, 220, "#dad45e"), (245, 285, "#d2aa99"), (310, 315, "#d04648"), (214, 334, "#dad45e")]:
        d.ellipse((x*S-10*S, y*S-10*S, x*S+10*S, y*S+10*S), fill=rgba(color), outline=rgba("#442434"))
    d.polygon(scale_points(star(256, 58, 28, 12)), fill=rgba("#dad45e"), outline=rgba("#854c30"))
    save(img, "sapin_mini")


def draw_coussin_etoile() -> None:
    img, d = new_canvas()
    ellipse_shadow(img, (124, 326, 388, 425), 64)
    glow = Image.new("RGBA", img.size, (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow)
    gd.ellipse((104*S, 152*S, 408*S, 418*S), fill=rgba("#dad45e", 42))
    img.alpha_composite(glow.filter(ImageFilter.GaussianBlur(18 * S)))
    pts = star(256, 264, 148, 82)
    d.polygon(scale_points(pts), fill=rgba("#d2aa99"), outline=rgba("#442434"))
    d.polygon(scale_points(star(248, 248, 116, 64)), fill=rgba("#deeed6", 68))
    for x, y in [(215, 226), (294, 222), (250, 302), (310, 318), (193, 311)]:
        d.polygon(scale_points(star(x, y, 14, 6)), fill=rgba("#dad45e"), outline=rgba("#854c30"))
    d.arc((145*S, 178*S, 360*S, 374*S), 205, 335, fill=rgba("#854c30", 130), width=4*S)
    save(img, "coussin_etoile")


def draw_lanterne_magique() -> None:
    img, d = new_canvas()
    ellipse_shadow(img, (170, 374, 342, 434), 66)
    glow = Image.new("RGBA", img.size, (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow)
    gd.ellipse((126*S, 108*S, 386*S, 420*S), fill=rgba("#6dc2ca", 46))
    gd.ellipse((168*S, 152*S, 344*S, 376*S), fill=rgba("#dad45e", 54))
    img.alpha_composite(glow.filter(ImageFilter.GaussianBlur(18 * S)))
    d.arc((204*S, 58*S, 308*S, 156*S), 190, 350, fill=rgba("#854c30"), width=9*S)
    d.rounded_rectangle((180*S, 142*S, 332*S, 388*S), radius=40*S, fill=rgba("#d27d2c"), outline=rgba("#442434"), width=5*S)
    d.rounded_rectangle((207*S, 176*S, 305*S, 338*S), radius=28*S, fill=rgba("#6dc2ca", 138), outline=rgba("#854c30"), width=4*S)
    d.polygon(scale_points([(256, 192), (286, 278), (256, 326), (226, 278)]), fill=rgba("#dad45e", 190), outline=rgba("#d27d2c"))
    d.ellipse((225*S, 376*S, 287*S, 424*S), fill=rgba("#854c30"), outline=rgba("#442434"), width=4*S)
    d.line((197*S, 162*S, 223*S, 199*S), fill=rgba("#deeed6", 150), width=5*S)
    save(img, "lanterne_magique")


def draw_statue_licorne() -> None:
    img, d = new_canvas()
    ellipse_shadow(img, (136, 364, 382, 438), 70)
    d.ellipse((155*S, 348*S, 357*S, 430*S), fill=rgba("#d2aa99"), outline=rgba("#442434"), width=5*S)
    body = scale_points([(154, 294), (206, 235), (306, 240), (356, 300), (322, 360), (196, 360)])
    d.polygon(body, fill=rgba("#deeed6"), outline=rgba("#442434"))
    d.ellipse((190*S, 176*S, 286*S, 268*S), fill=rgba("#deeed6"), outline=rgba("#442434"), width=5*S)
    d.polygon(scale_points([(246, 176), (262, 96), (282, 176)]), fill=rgba("#dad45e"), outline=rgba("#854c30"))
    d.polygon(scale_points([(214, 184), (194, 136), (237, 169)]), fill=rgba("#d2aa99"), outline=rgba("#442434"))
    d.polygon(scale_points([(276, 184), (318, 145), (298, 196)]), fill=rgba("#d2aa99"), outline=rgba("#442434"))
    d.line(scale_points([(286, 238), (340, 194), (372, 210), (336, 252)]), fill=rgba("#d2aa99"), width=16*S)
    d.line(scale_points([(210, 360), (198, 416), (222, 416), (234, 362)]), fill=rgba("#deeed6"), width=12*S)
    d.line(scale_points([(302, 360), (314, 416), (338, 416), (326, 360)]), fill=rgba("#deeed6"), width=12*S)
    d.arc((152*S, 188*S, 296*S, 312*S), 202, 305, fill=rgba("#d2aa99"), width=11*S)
    d.ellipse((247*S, 211*S, 258*S, 222*S), fill=rgba("#442434"))
    d.line(scale_points([(224, 198), (202, 220), (220, 236)]), fill=rgba("#d2aa99"), width=7*S)
    save(img, "statue_licorne")


if __name__ == "__main__":
    OUT.mkdir(parents=True, exist_ok=True)
    draw_sapin_mini()
    draw_coussin_etoile()
    draw_lanterne_magique()
    draw_statue_licorne()
