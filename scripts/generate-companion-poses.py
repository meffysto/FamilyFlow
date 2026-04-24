#!/usr/bin/env python3
"""
Genere les poses manquantes (sleeping/eating/celebrating) pour chaque
compagnon × stade via l'API pixellab bitforge en utilisant idle_1.png
comme reference de style.

Usage:
    export PIXELLAB_API_KEY="..."
    python3 scripts/generate-companion-poses.py --test     # 3 PNG (chat/jeune)
    python3 scripts/generate-companion-poses.py            # 45 PNG full batch
    python3 scripts/generate-companion-poses.py --force    # reecrit les existants
"""
import os
import sys
import json
import base64
import time
import subprocess
import tempfile
import struct
from pathlib import Path


def png_dimensions(path: Path) -> tuple[int, int]:
    """Lit width/height d'un PNG depuis le header (bytes 16-24)."""
    with open(path, "rb") as f:
        head = f.read(24)
    return struct.unpack(">II", head[16:24])

API_KEY = os.environ.get("PIXELLAB_API_KEY")
if not API_KEY:
    sys.exit("ERREUR: PIXELLAB_API_KEY absente du shell (source ~/.zshrc)")

ASSETS = Path(__file__).resolve().parent.parent / "assets" / "garden" / "animals"

SPECIES_FR_EN = {
    "chat": "cat",
    "chien": "dog",
    "lapin": "rabbit",
    "renard": "fox",
    "herisson": "hedgehog",
}
STAGES_FR_EN = {"bebe": "baby", "jeune": "young", "adulte": "adult"}
POSE_PROMPTS = {
    "sleeping": "curled up sleeping peacefully, eyes closed, small zzz above head",
    "eating": "eating from a small food bowl, head down, happy and content",
    "celebrating": "jumping with joy, paws up, sparkles around, celebrating",
}

ENDPOINT = "https://api.pixellab.ai/v1/generate-image-bitforge"


def generate(species_fr: str, stage_fr: str, pose: str, force: bool) -> str:
    style_path = ASSETS / species_fr / stage_fr / "idle_1.png"
    out_path = ASSETS / species_fr / stage_fr / f"{pose}.png"

    if not style_path.exists():
        return "skip-no-style"
    if out_path.exists() and not force:
        return "skip-exists"

    species_en = SPECIES_FR_EN[species_fr]
    stage_en = STAGES_FR_EN[stage_fr]
    style_b64 = base64.b64encode(style_path.read_bytes()).decode()
    src_w, src_h = png_dimensions(style_path)

    body = {
        "description": f"cute {stage_en} {species_en}, {POSE_PROMPTS[pose]}",
        "image_size": {"width": src_w, "height": src_h},
        "no_background": True,
        "view": "low top-down",
        "outline": "single color black outline",
        "shading": "basic shading",
        "detail": "low detail",
        "style_image": {"type": "base64", "base64": style_b64},
    }

    for attempt in (1, 2):
        with tempfile.NamedTemporaryFile("w", suffix=".json", delete=False) as bf:
            json.dump(body, bf)
            body_path = bf.name
        resp_path = body_path + ".resp"
        try:
            result = subprocess.run(
                [
                    "curl", "-sS", "--max-time", "180",
                    "-o", resp_path,
                    "-w", "%{http_code}",
                    "-X", "POST", ENDPOINT,
                    "-H", f"Authorization: Bearer {API_KEY}",
                    "-H", "Content-Type: application/json",
                    "--data-binary", f"@{body_path}",
                ],
                capture_output=True, text=True, timeout=200,
            )
            http_code = result.stdout.strip()
            if http_code == "200":
                with open(resp_path) as f:
                    data = json.load(f)
                out_path.write_bytes(base64.b64decode(data["image"]["base64"]))
                return "ok"
            if attempt == 2:
                return f"error-http-{http_code}"
            time.sleep(3)
        except Exception as e:
            if attempt == 2:
                return f"error-{type(e).__name__}"
            time.sleep(3)
        finally:
            for p in (body_path, resp_path):
                try: os.unlink(p)
                except FileNotFoundError: pass
    return "error-unknown"


def main():
    test_mode = "--test" in sys.argv
    force = "--force" in sys.argv

    species_list = ["chat"] if test_mode else list(SPECIES_FR_EN)
    stages_list = ["jeune"] if test_mode else list(STAGES_FR_EN)
    poses_list = list(POSE_PROMPTS)

    total = len(species_list) * len(stages_list) * len(poses_list)
    print(f"→ {total} sprites (test={test_mode}, force={force})")

    results = {"ok": 0, "skip-exists": 0, "skip-no-style": 0, "error": 0}
    i = 0
    for species in species_list:
        for stage in stages_list:
            for pose in poses_list:
                i += 1
                res = generate(species, stage, pose, force)
                status_key = "error" if res.startswith("error") else res
                results[status_key] = results.get(status_key, 0) + 1
                marker = "✓" if res == "ok" else ("·" if res.startswith("skip") else "✗")
                print(f"[{i:3d}/{total}] {marker} {species}/{stage}/{pose}.png → {res}")

    print("\n--- Bilan ---")
    for k, v in results.items():
        print(f"  {k}: {v}")


if __name__ == "__main__":
    main()
