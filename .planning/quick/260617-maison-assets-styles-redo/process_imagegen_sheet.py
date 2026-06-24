#!/usr/bin/env python3
from __future__ import annotations

import subprocess
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[3]
WORK = ROOT / ".planning" / "quick" / "260617-maison-assets-styles-redo"
RAW = WORK / "raw" / "styles_4x4-imagegen.png"
CELLS = WORK / "processed" / "cells"
CLEAN = WORK / "processed" / "clean"
OUT = ROOT / "assets" / "companion-house"
CHROMA = Path.home() / ".codex" / "skills" / ".system" / "imagegen" / "scripts" / "remove_chroma_key.py"

IDS = [
    "tapis_moderne",
    "coussin_moderne",
    "table_basse_moderne",
    "fauteuil_moderne",
    "etagere_moderne",
    "lampe_moderne",
    "plante_moderne",
    "cadre_moderne",
    "tapis_ferme",
    "pouf_ferme",
    "table_ferme",
    "fauteuil_ferme",
    "coffre_ferme",
    "lanterne_ferme",
    "plante_ferme",
    "cadre_ferme",
]

RUG_IDS = {"tapis_moderne", "tapis_ferme"}


def bounds_for_grid(size: int, parts: int) -> list[int]:
    return [round(size * i / parts) for i in range(parts + 1)]


def clear_border(image: Image.Image, margin: int = 1) -> Image.Image:
    image = image.convert("RGBA")
    px = image.load()
    width, height = image.size
    for x in range(width):
        for y in range(margin):
            px[x, y] = (0, 0, 0, 0)
            px[x, height - 1 - y] = (0, 0, 0, 0)
    for y in range(height):
        for x in range(margin):
            px[x, y] = (0, 0, 0, 0)
            px[width - 1 - x, y] = (0, 0, 0, 0)
    return image


def fit_to_canvas(image: Image.Image, size: int = 512, padding: int = 42) -> Image.Image:
    image = image.convert("RGBA")
    bbox = image.getchannel("A").getbbox()
    if bbox is None:
        return Image.new("RGBA", (size, size), (0, 0, 0, 0))

    content = image.crop(bbox)
    max_side = size - padding * 2
    scale = min(max_side / content.width, max_side / content.height)
    new_size = (max(1, round(content.width * scale)), max(1, round(content.height * scale)))
    content = content.resize(new_size, Image.Resampling.NEAREST)

    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    canvas.alpha_composite(content, ((size - new_size[0]) // 2, (size - new_size[1]) // 2))
    return canvas


def main() -> None:
    CELLS.mkdir(parents=True, exist_ok=True)
    CLEAN.mkdir(parents=True, exist_ok=True)
    OUT.mkdir(parents=True, exist_ok=True)

    sheet = Image.open(RAW).convert("RGBA")
    xs = bounds_for_grid(sheet.width, 4)
    ys = bounds_for_grid(sheet.height, 4)

    for index, asset_id in enumerate(IDS):
        row, col = divmod(index, 4)
        inset = 0 if asset_id in RUG_IDS else 10
        crop = sheet.crop((xs[col] + inset, ys[row] + inset, xs[col + 1] - inset, ys[row + 1] - inset))
        raw_cell = CELLS / f"{asset_id}-cell.png"
        clean_cell = CLEAN / f"{asset_id}-clean.png"
        final = OUT / f"{asset_id}.png"
        crop.save(raw_cell)

        subprocess.run(
            [
                "python3",
                str(CHROMA),
                "--input",
                str(raw_cell),
                "--out",
                str(clean_cell),
                "--auto-key",
                "border",
                "--soft-matte",
                "--transparent-threshold",
                "18",
                "--opaque-threshold",
                "180",
                "--despill",
                "--edge-contract",
                "1",
                "--force",
            ],
            check=True,
        )

        image = Image.open(clean_cell).convert("RGBA")
        if asset_id in RUG_IDS:
            image = fit_to_canvas(image)
        else:
            image = clear_border(image)
            image = image.resize((512, 512), Image.Resampling.NEAREST)
            image = clear_border(image, margin=28)
        image.save(final)
        print(final)


if __name__ == "__main__":
    main()
