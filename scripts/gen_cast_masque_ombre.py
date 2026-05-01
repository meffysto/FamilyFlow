#!/usr/bin/env python3
"""Génère l'animation cast (4 frames) pour masque_ombre via PixelLab API."""

import base64, json, os, subprocess, sys
import io
from PIL import Image

API_KEY = os.environ.get('PIXELLAB_API_KEY', '')
if not API_KEY:
    print('PIXELLAB_API_KEY manquant')
    sys.exit(1)

ASSET_DIR = 'assets/garden/animals/masque_ombre'
REF_IMG   = f'{ASSET_DIR}/idle_1.png'
OUT_DIR   = ASSET_DIR

# 1. Charger idle_1 et upscaler à 64x64
img = Image.open(REF_IMG)
img_64 = img.resize((64, 64), Image.NEAREST)
buf = io.BytesIO()
img_64.save(buf, format='PNG')
raw_b64 = base64.b64encode(buf.getvalue()).decode()

payload = {
    "description": (
        "a mysterious carnival mask character, dark hooded cloak with deep purple and black tones, "
        "ornate golden carnival mask with swirling patterns, side view, pixel art style"
    ),
    "action": (
        "raising both arms wide, dark shadow energy swirling around the body, "
        "casting a shadow spell, dramatic pose with cloak billowing"
    ),
    "image_size": {"width": 64, "height": 64},
    "n_frames": 4,
    "view": "side",
    "direction": "south",
    "reference_image": {"type": "base64", "base64": raw_b64},
    "init_image_strength": 450,
    "text_guidance_scale": 9.0,
    "image_guidance_scale": 2.5,
}

print("Appel API PixelLab animate-with-text…")
result = subprocess.run(
    ['curl', '-sL', 'https://api.pixellab.ai/v1/animate-with-text',
     '-H', f'Authorization: Bearer {API_KEY}',
     '-H', 'Content-Type: application/json',
     '-d', json.dumps(payload)],
    capture_output=True, text=True
)

if result.returncode != 0:
    print(f'Erreur curl: {result.stderr}')
    sys.exit(1)

try:
    d = json.loads(result.stdout)
except json.JSONDecodeError:
    print(f'Réponse invalide: {result.stdout[:500]}')
    sys.exit(1)

if 'images' not in d:
    print(f'Erreur API: {json.dumps(d, indent=2)}')
    sys.exit(1)

print(f'{len(d["images"])} frames reçues')
for i, img_data in enumerate(d['images']):
    b64 = img_data['base64']
    data = base64.b64decode(b64)
    img_out = Image.open(io.BytesIO(data)).resize((48, 48), Image.NEAREST)
    path = f'{OUT_DIR}/cast_{i+1}.png'
    img_out.save(path)
    print(f'  → {path}')

print('Done.')
