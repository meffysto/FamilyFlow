#!/usr/bin/env python3
from __future__ import annotations

import argparse
import os
import shutil
import subprocess
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[3]
WORK_DIR = ROOT / ".planning" / "quick" / "260617-maison-assets-styles"
RAW_DIR = WORK_DIR / "raw"
META_DIR = WORK_DIR / "meta"
OUT_DIR = ROOT / "assets" / "companion-house"
CHROMA_HELPER = Path(os.environ.get("CODEX_HOME", Path.home() / ".codex")) / "skills" / ".system" / "imagegen" / "scripts" / "remove_chroma_key.py"
GENERATED_DIR = Path(os.environ.get("CODEX_HOME", Path.home() / ".codex")) / "generated_images"


def latest_generated_png(marker: Path) -> Path:
    marker_time = marker.stat().st_mtime
    candidates = [
        path
        for path in GENERATED_DIR.glob("**/*.png")
        if path.is_file() and path.stat().st_mtime >= marker_time
    ]
    if not candidates:
        raise SystemExit(f"Aucun PNG genere apres {marker}")
    return max(candidates, key=lambda path: path.stat().st_mtime)


def force_border_transparent(image: Image.Image) -> Image.Image:
    px = image.load()
    width, height = image.size
    for x in range(width):
        px[x, 0] = (0, 0, 0, 0)
        px[x, height - 1] = (0, 0, 0, 0)
    for y in range(height):
        px[0, y] = (0, 0, 0, 0)
        px[width - 1, y] = (0, 0, 0, 0)
    return image


def ensure_512_with_alpha(path: Path) -> dict[str, object]:
    image = Image.open(path).convert("RGBA")
    if image.size != (512, 512):
        image = image.resize((512, 512), Image.Resampling.LANCZOS)
    image = force_border_transparent(image)
    image.save(path)

    alpha = image.getchannel("A")
    corners = [alpha.getpixel((0, 0)), alpha.getpixel((511, 0)), alpha.getpixel((0, 511)), alpha.getpixel((511, 511))]
    opaque = sum(1 for value in alpha.getdata() if value > 8)
    coverage = opaque / (512 * 512)
    if max(corners) > 8:
        raise SystemExit(f"Coins non transparents pour {path}: {corners}")
    if coverage < 0.01 or coverage > 0.95:
        raise SystemExit(f"Couverture alpha suspecte pour {path}: {coverage:.3f}")

    return {
        "size": image.size,
        "corner_alpha": corners,
        "opaque_coverage": round(coverage, 4),
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--id", required=True)
    parser.add_argument("--marker", required=True, type=Path)
    parser.add_argument("--edge-contract", type=str, default="0")
    args = parser.parse_args()

    RAW_DIR.mkdir(parents=True, exist_ok=True)
    META_DIR.mkdir(parents=True, exist_ok=True)
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    source = latest_generated_png(args.marker)
    raw = RAW_DIR / f"{args.id}-raw.png"
    final = OUT_DIR / f"{args.id}.png"
    shutil.copy2(source, raw)

    command = [
        "python3",
        str(CHROMA_HELPER),
        "--input",
        str(raw),
        "--out",
        str(final),
        "--auto-key",
        "border",
        "--soft-matte",
        "--transparent-threshold",
        "12",
        "--opaque-threshold",
        "220",
        "--despill",
        "--force",
    ]
    if args.edge_contract != "0":
        command += ["--edge-contract", args.edge_contract]

    subprocess.run(command, check=True)
    metadata = ensure_512_with_alpha(final)
    (META_DIR / f"{args.id}.txt").write_text(
        "\n".join(
            [
                f"id={args.id}",
                f"source={source}",
                f"raw={raw}",
                f"final={final}",
                f"size={metadata['size'][0]}x{metadata['size'][1]}",
                f"corner_alpha={metadata['corner_alpha']}",
                f"opaque_coverage={metadata['opaque_coverage']}",
            ]
        )
        + "\n",
        encoding="utf-8",
    )
    print(final)


if __name__ == "__main__":
    main()
