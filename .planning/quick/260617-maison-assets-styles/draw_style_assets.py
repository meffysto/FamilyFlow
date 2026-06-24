#!/usr/bin/env python3
from __future__ import annotations

from math import cos, pi, sin
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter


ROOT = Path(__file__).resolve().parents[3]
OUT = ROOT / "assets" / "companion-house"
S = 3
SIZE = 512
CANVAS = SIZE * S


def hex_to_rgba(value: str, alpha: int = 255) -> tuple[int, int, int, int]:
    value = value.lstrip("#")
    return tuple(int(value[i : i + 2], 16) for i in (0, 2, 4)) + (alpha,)


def canvas() -> tuple[Image.Image, ImageDraw.ImageDraw]:
    image = Image.new("RGBA", (CANVAS, CANVAS), (0, 0, 0, 0))
    return image, ImageDraw.Draw(image)


def box(b: tuple[int, int, int, int]) -> tuple[int, int, int, int]:
    return tuple(v * S for v in b)


def points(items: list[tuple[int, int]]) -> list[tuple[int, int]]:
    return [(x * S, y * S) for x, y in items]


def shadow(image: Image.Image, b: tuple[int, int, int, int], alpha: int = 52) -> None:
    layer = Image.new("RGBA", image.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    d.ellipse(box(b), fill=(67, 44, 34, alpha))
    image.alpha_composite(layer.filter(ImageFilter.GaussianBlur(10 * S)))


def glow(image: Image.Image, b: tuple[int, int, int, int], color: str, alpha: int = 46) -> None:
    layer = Image.new("RGBA", image.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    d.ellipse(box(b), fill=hex_to_rgba(color, alpha))
    image.alpha_composite(layer.filter(ImageFilter.GaussianBlur(18 * S)))


def save(image: Image.Image, name: str) -> None:
    image = image.resize((SIZE, SIZE), Image.Resampling.LANCZOS)
    image.save(OUT / f"{name}.png")


def star(cx: int, cy: int, outer: int, inner: int, n: int = 5) -> list[tuple[int, int]]:
    result = []
    for i in range(n * 2):
        r = outer if i % 2 == 0 else inner
        a = -pi / 2 + i * pi / n
        result.append((int(cx + cos(a) * r), int(cy + sin(a) * r)))
    return result


def draw_rug(name: str, modern: bool) -> None:
    im, d = canvas()
    shadow(im, (74, 354, 438, 424), 38)
    if modern:
        d.rounded_rectangle(box((72, 116, 440, 382)), radius=10 * S, fill=hex_to_rgba("#d8d9d4"), outline=hex_to_rgba("#4e4a4e"), width=4 * S)
        d.polygon(points([(94, 138), (256, 138), (160, 252), (94, 252)]), fill=hex_to_rgba("#e7e8e3"))
        d.polygon(points([(258, 138), (420, 138), (350, 250), (190, 250)]), fill=hex_to_rgba("#9aa58f"))
        d.polygon(points([(94, 268), (204, 268), (150, 360), (94, 360)]), fill=hex_to_rgba("#b6bab7"))
        d.polygon(points([(218, 268), (420, 268), (420, 360), (164, 360)]), fill=hex_to_rgba("#f2f1ec"))
        d.rectangle(box((92, 114, 420, 123)), fill=hex_to_rgba("#f2f1ec", 180))
    else:
        d.rounded_rectangle(box((72, 120, 440, 376)), radius=8 * S, fill=hex_to_rgba("#caa778"), outline=hex_to_rgba("#654326"), width=5 * S)
        for y, col in [(146, "#ece0c7"), (188, "#8aa077"), (230, "#d8c29a"), (272, "#ece0c7"), (314, "#8aa077")]:
            d.rectangle(box((92, y, 420, y + 22)), fill=hex_to_rgba(col))
        for x in range(90, 426, 18):
            d.line(points([(x, 122), (x - 28, 376)]), fill=hex_to_rgba("#8a6a43", 80), width=2 * S)
    save(im, name)


def draw_coussin_moderne() -> None:
    im, d = canvas()
    shadow(im, (128, 324, 384, 424), 58)
    d.rounded_rectangle(box((140, 134, 372, 370)), radius=36 * S, fill=hex_to_rgba("#cfd2d2"), outline=hex_to_rgba("#4e4a4e"), width=5 * S)
    d.rounded_rectangle(box((162, 156, 350, 348)), radius=28 * S, outline=hex_to_rgba("#f2f1ec", 150), width=4 * S)
    d.line(points([(256, 148), (256, 356)]), fill=hex_to_rgba("#9a9f9c", 100), width=3 * S)
    d.line(points([(154, 256), (358, 256)]), fill=hex_to_rgba("#9a9f9c", 100), width=3 * S)
    save(im, "coussin_moderne")


def draw_pouf_ferme() -> None:
    im, d = canvas()
    shadow(im, (118, 330, 394, 424), 60)
    d.ellipse(box((130, 116, 382, 370)), fill=hex_to_rgba("#eadfc8"), outline=hex_to_rgba("#654326"), width=5 * S)
    for i in range(10):
        x = 158 + i * 22
        d.arc(box((x - 44, 130, x + 80, 360)), 75, 288, fill=hex_to_rgba("#c9b38e", 145), width=5 * S)
    d.ellipse(box((194, 178, 318, 300)), outline=hex_to_rgba("#fff5df", 130), width=6 * S)
    save(im, "pouf_ferme")


def draw_modern_table() -> None:
    im, d = canvas()
    shadow(im, (118, 324, 398, 402), 56)
    d.polygon(points([(128, 174), (390, 174), (350, 290), (168, 290)]), fill=hex_to_rgba("#d9bd8f"), outline=hex_to_rgba("#4e4a4e"))
    d.polygon(points([(168, 290), (350, 290), (334, 314), (182, 314)]), fill=hex_to_rgba("#a88455"), outline=hex_to_rgba("#4e4a4e"))
    for x in [178, 334]:
        d.line(points([(x, 302), (x - 20, 382)]), fill=hex_to_rgba("#303036"), width=8 * S)
    for x in [218, 374]:
        d.line(points([(x, 294), (x + 16, 372)]), fill=hex_to_rgba("#303036"), width=7 * S)
    d.line(points([(148, 196), (372, 196)]), fill=hex_to_rgba("#f0d5a4", 150), width=3 * S)
    save(im, "table_basse_moderne")


def draw_farm_table() -> None:
    im, d = canvas()
    shadow(im, (106, 326, 408, 418), 62)
    d.polygon(points([(108, 164), (406, 164), (360, 292), (150, 292)]), fill=hex_to_rgba("#9b6437"), outline=hex_to_rgba("#442434"))
    d.polygon(points([(150, 292), (360, 292), (344, 324), (166, 324)]), fill=hex_to_rgba("#6f4328"), outline=hex_to_rgba("#442434"))
    for y in [190, 226, 260]:
        d.line(points([(122, y), (386, y)]), fill=hex_to_rgba("#d09a56", 120), width=4 * S)
    for x in [172, 330]:
        d.rounded_rectangle(box((x - 13, 294, x + 11, 392)), radius=8 * S, fill=hex_to_rgba("#7a4b2d"), outline=hex_to_rgba("#442434"), width=3 * S)
    save(im, "table_ferme")


def draw_armchair(name: str, modern: bool) -> None:
    im, d = canvas()
    shadow(im, (126, 348, 386, 430), 62)
    if modern:
        d.rounded_rectangle(box((140, 150, 372, 344)), radius=36 * S, fill=hex_to_rgba("#cfd2d2"), outline=hex_to_rgba("#4e4a4e"), width=5 * S)
        d.rounded_rectangle(box((178, 186, 334, 330)), radius=24 * S, fill=hex_to_rgba("#e4e5e1"), outline=hex_to_rgba("#9a9f9c"), width=3 * S)
        d.rectangle(box((150, 322, 362, 354)), fill=hex_to_rgba("#a7abaa"), outline=hex_to_rgba("#4e4a4e"))
        for x in [178, 334]:
            d.line(points([(x, 350), (x - 18, 406)]), fill=hex_to_rgba("#8a6a43"), width=8 * S)
    else:
        d.arc(box((122, 112, 390, 360)), 182, 358, fill=hex_to_rgba("#7a4b2d"), width=14 * S)
        d.line(points([(164, 166), (164, 384)]), fill=hex_to_rgba("#7a4b2d"), width=12 * S)
        d.line(points([(348, 166), (348, 384)]), fill=hex_to_rgba("#7a4b2d"), width=12 * S)
        d.rounded_rectangle(box((176, 214, 336, 336)), radius=22 * S, fill=hex_to_rgba("#eadfc8"), outline=hex_to_rgba("#654326"), width=4 * S)
        for x in range(188, 332, 28):
            d.line(points([(x, 218), (x, 334)]), fill=hex_to_rgba("#8aa077", 135), width=3 * S)
        for y in range(236, 326, 28):
            d.line(points([(180, y), (334, y)]), fill=hex_to_rgba("#b45f4c", 130), width=3 * S)
        d.arc(box((126, 314, 386, 456)), 196, 344, fill=hex_to_rgba("#7a4b2d"), width=10 * S)
    save(im, name)


def draw_shelf_modern() -> None:
    im, d = canvas()
    shadow(im, (118, 380, 392, 436), 50)
    d.rounded_rectangle(box((132, 98, 382, 394)), radius=12 * S, fill=hex_to_rgba("#eef0ed"), outline=hex_to_rgba("#4e4a4e"), width=4 * S)
    for y in [172, 250, 328]:
        d.rectangle(box((150, y, 364, y + 14)), fill=hex_to_rgba("#d9bd8f"), outline=hex_to_rgba("#9a7a4d"))
    for x, y, c in [(170, 134, "#d04648"), (192, 134, "#8595a1"), (214, 134, "#dad45e"), (176, 212, "#597dce"), (198, 212, "#d2aa99")]:
        d.rectangle(box((x, y, x + 16, y + 38)), fill=hex_to_rgba(c), outline=hex_to_rgba("#4e4a4e"))
    d.ellipse(box((282, 206, 330, 248)), fill=hex_to_rgba("#8aa077"), outline=hex_to_rgba("#346524"))
    d.rectangle(box((292, 242, 320, 264)), fill=hex_to_rgba("#e7e8e3"), outline=hex_to_rgba("#4e4a4e"))
    d.rectangle(box((176, 286, 238, 328)), fill=hex_to_rgba("#cfd2d2"), outline=hex_to_rgba("#4e4a4e"))
    save(im, "etagere_moderne")


def draw_lamp_modern() -> None:
    im, d = canvas()
    shadow(im, (168, 386, 362, 438), 56)
    glow(im, (236, 88, 420, 244), "#dad45e", 52)
    d.arc(box((148, 98, 338, 394)), 262, 354, fill=hex_to_rgba("#303036"), width=8 * S)
    d.ellipse(box((148, 390, 238, 430)), fill=hex_to_rgba("#303036"), outline=hex_to_rgba("#140c1c"), width=3 * S)
    d.pieslice(box((308, 108, 430, 208)), 0, 180, fill=hex_to_rgba("#eef0ed"), outline=hex_to_rgba("#4e4a4e"), width=4 * S)
    d.rectangle(box((308, 158, 430, 202)), fill=hex_to_rgba("#d7d8d4"), outline=hex_to_rgba("#4e4a4e"), width=3 * S)
    save(im, "lampe_moderne")


def draw_lantern_farm() -> None:
    im, d = canvas()
    shadow(im, (168, 374, 344, 434), 58)
    glow(im, (164, 142, 348, 380), "#dad45e", 56)
    d.arc(box((206, 66, 306, 154)), 190, 350, fill=hex_to_rgba("#303036"), width=8 * S)
    d.rounded_rectangle(box((174, 142, 338, 386)), radius=24 * S, fill=hex_to_rgba("#303036"), outline=hex_to_rgba("#140c1c"), width=4 * S)
    d.rounded_rectangle(box((202, 176, 310, 334)), radius=14 * S, fill=hex_to_rgba("#dad45e", 118), outline=hex_to_rgba("#757161"), width=4 * S)
    d.rectangle(box((218, 320, 294, 356)), fill=hex_to_rgba("#854c30"), outline=hex_to_rgba("#140c1c"), width=3 * S)
    d.polygon(points([(256, 214), (282, 292), (230, 292)]), fill=hex_to_rgba("#d27d2c", 205), outline=hex_to_rgba("#854c30"))
    for x in [190, 322]:
        d.line(points([(x, 154), (x, 374)]), fill=hex_to_rgba("#140c1c"), width=5 * S)
    save(im, "lanterne_ferme")


def draw_plant(name: str, modern: bool) -> None:
    im, d = canvas()
    shadow(im, (166, 378, 346, 436), 52)
    if modern:
        d.rounded_rectangle(box((198, 318, 314, 420)), radius=20 * S, fill=hex_to_rgba("#eef0ed"), outline=hex_to_rgba("#4e4a4e"), width=4 * S)
        leaves = [(256, 118, 232, 328), (240, 138, 214, 328), (274, 134, 302, 328), (224, 174, 190, 330), (292, 176, 326, 330)]
        for x, y, bx, by in leaves:
            d.ellipse(box((min(x, bx), y, max(x, bx), by)), fill=hex_to_rgba("#7e9969"), outline=hex_to_rgba("#346524"), width=3 * S)
            d.line(points([(x, y + 20), (bx, by - 16)]), fill=hex_to_rgba("#deeed6", 120), width=2 * S)
    else:
        d.polygon(points([(184, 302), (328, 302), (306, 420), (206, 420)]), fill=hex_to_rgba("#8595a1"), outline=hex_to_rgba("#4e4a4e"))
        d.rectangle(box((172, 292, 340, 318)), fill=hex_to_rgba("#aeb6b8"), outline=hex_to_rgba("#4e4a4e"))
        for x, y, w, h in [(206, 188, 62, 112), (260, 172, 72, 126), (236, 138, 56, 150), (178, 226, 64, 86), (292, 222, 66, 96)]:
            d.ellipse(box((x, y, x + w, y + h)), fill=hex_to_rgba("#6f8f52"), outline=hex_to_rgba("#346524"), width=3 * S)
        for x in [218, 252, 282]:
            d.line(points([(256, 304), (x, 210)]), fill=hex_to_rgba("#346524"), width=4 * S)
    save(im, name)


def draw_frame(name: str, modern: bool) -> None:
    im, d = canvas()
    shadow(im, (146, 366, 366, 418), 34)
    if modern:
        d.rectangle(box((150, 104, 362, 370)), fill=hex_to_rgba("#f1f1ee"), outline=hex_to_rgba("#24242a"), width=6 * S)
        d.rectangle(box((176, 132, 336, 340)), fill=hex_to_rgba("#e2e3df"), outline=hex_to_rgba("#9a9f9c"), width=2 * S)
        d.polygon(points([(190, 290), (270, 166), (318, 290)]), fill=hex_to_rgba("#9aa58f"))
        d.ellipse(box((210, 160, 268, 218)), fill=hex_to_rgba("#d0b98c"))
        d.line(points([(192, 300), (324, 180)]), fill=hex_to_rgba("#303036"), width=5 * S)
    else:
        d.rectangle(box((136, 96, 376, 378)), fill=hex_to_rgba("#e8dfca"), outline=hex_to_rgba("#654326"), width=6 * S)
        d.rectangle(box((162, 124, 350, 350)), fill=hex_to_rgba("#fff4dc"), outline=hex_to_rgba("#b79a72"), width=3 * S)
        for b in [(132, 92, 380, 112), (132, 362, 380, 382), (132, 92, 154, 382), (358, 92, 380, 382)]:
            d.rectangle(box(b), fill=hex_to_rgba("#f3ead6"), outline=hex_to_rgba("#8a6a43"))
        d.line(points([(254, 304), (254, 164)]), fill=hex_to_rgba("#6f8f52"), width=5 * S)
        d.ellipse(box((212, 146, 258, 210)), fill=hex_to_rgba("#d2aa99"), outline=hex_to_rgba("#8a6a43"))
        d.ellipse(box((252, 176, 304, 240)), fill=hex_to_rgba("#d2aa99"), outline=hex_to_rgba("#8a6a43"))
        d.ellipse(box((206, 228, 282, 302)), fill=hex_to_rgba("#d2aa99"), outline=hex_to_rgba("#8a6a43"))
    save(im, name)


def draw_chest_farm() -> None:
    im, d = canvas()
    shadow(im, (96, 324, 416, 422), 62)
    d.rounded_rectangle(box((104, 160, 408, 340)), radius=14 * S, fill=hex_to_rgba("#8f5a32"), outline=hex_to_rgba("#442434"), width=5 * S)
    d.rectangle(box((112, 242, 400, 354)), fill=hex_to_rgba("#754729"), outline=hex_to_rgba("#442434"), width=4 * S)
    for y in [188, 224, 274, 314]:
        d.line(points([(116, y), (396, y)]), fill=hex_to_rgba("#c18445", 125), width=4 * S)
    for x in [146, 366]:
        d.rectangle(box((x, 154, x + 18, 356)), fill=hex_to_rgba("#24242a"), outline=hex_to_rgba("#140c1c"))
    d.rectangle(box((236, 244, 276, 288)), fill=hex_to_rgba("#24242a"), outline=hex_to_rgba("#140c1c"))
    save(im, "coffre_ferme")


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    draw_rug("tapis_moderne", modern=True)
    draw_coussin_moderne()
    draw_modern_table()
    draw_armchair("fauteuil_moderne", modern=True)
    draw_shelf_modern()
    draw_lamp_modern()
    draw_plant("plante_moderne", modern=True)
    draw_frame("cadre_moderne", modern=True)

    draw_rug("tapis_ferme", modern=False)
    draw_pouf_ferme()
    draw_farm_table()
    draw_armchair("fauteuil_ferme", modern=False)
    draw_chest_farm()
    draw_lantern_farm()
    draw_plant("plante_ferme", modern=False)
    draw_frame("cadre_ferme", modern=False)


if __name__ == "__main__":
    main()
