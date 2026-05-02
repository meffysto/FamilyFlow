#!/usr/bin/env node
/**
 * Test Voice Remix ElevenLabs — POST /v1/text-to-voice/{voice_id}/remix
 *
 * Génère 1+ previews remixés depuis une voix existante (PVC ou IVC).
 * Réponse : tableau `previews` avec `audio_base_64` + `generated_voice_id`.
 *
 * Usage :
 *   VOICE_ID=M3Z2Szrj4L070AIxRTfX node scripts/test-voice-remix.mjs
 *
 * Variables d'env optionnelles :
 *   PROMPT="<voice description>"   défaut : narrateur expressif FR
 *   PROMPT_STRENGTH=0.3            (0..1 — bas = préserve identité)
 *   TEXT="<test script 100-1000 chars>"  laissé vide = auto-generate
 *   GUIDANCE_SCALE=2
 *   SEED=42                        (reproductible)
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { exec } from 'node:child_process';

try {
  const envPath = path.resolve(new URL('..', import.meta.url).pathname, '.env');
  const raw = await fs.readFile(envPath, 'utf8');
  for (const line of raw.split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.+)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
  }
} catch { /* */ }

const apiKey = process.env.ELEVEN_LABS_KEY ?? process.env.ELEVENLABS_API_KEY;
const voiceId = process.env.VOICE_ID;
if (!apiKey || !voiceId) {
  console.error('❌ Manque ELEVENLABS_API_KEY ou VOICE_ID');
  process.exit(1);
}

const prompt = process.env.PROMPT
  ?? "Conteur d'histoires du soir chaleureux. Débit naturel, palette émotionnelle riche, expressif mais doux. Préserve le timbre et l'identité d'origine.";
const promptStrength = process.env.PROMPT_STRENGTH ? parseFloat(process.env.PROMPT_STRENGTH) : 0.3;
const guidanceScale = process.env.GUIDANCE_SCALE ? parseFloat(process.env.GUIDANCE_SCALE) : 2;
const seed = process.env.SEED ? parseInt(process.env.SEED, 10) : null;

// Test script avec tags v3 pour valider que la voix remixée les interprète bien.
// Doit faire entre 100 et 1000 chars.
const defaultText =
  "Bonjour mon enfant. [whispers] J'ai un secret pour toi, écoute bien. [chuckles] Tu vas adorer cette histoire merveilleuse. [excited] Aventure ! Surprise ! [sighs] Voilà, dors bien maintenant.";
const text = process.env.TEXT ?? defaultText;

if (text.length < 100 || text.length > 1000) {
  console.error(`❌ TEXT doit faire entre 100 et 1000 chars, reçu ${text.length}.`);
  process.exit(1);
}

const body = {
  voice_description: prompt,
  text,
  auto_generate_text: false,
  prompt_strength: promptStrength,
  guidance_scale: guidanceScale,
};
if (seed !== null) body.seed = seed;

console.log('→ POST /v1/text-to-voice/' + voiceId + '/remix');
console.log('  prompt:', prompt);
console.log('  prompt_strength:', promptStrength);
console.log('  text:', text.length, 'chars');

const res = await fetch(`https://api.elevenlabs.io/v1/text-to-voice/${voiceId}/remix`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'xi-api-key': apiKey,
  },
  body: JSON.stringify(body),
});

if (!res.ok) {
  const err = await res.text();
  console.error(`❌ ${res.status}:`, err);
  process.exit(2);
}

const data = await res.json();
console.log(`✅ ${data.previews?.length ?? 0} preview(s) reçue(s)`);

const outFiles = [];
for (let i = 0; i < (data.previews?.length ?? 0); i++) {
  const p = data.previews[i];
  const buf = Buffer.from(p.audio_base_64, 'base64');
  const out = `remix-preview-${i + 1}.mp3`;
  await fs.writeFile(out, buf);
  outFiles.push(out);
  console.log(`  [${i + 1}] ${out} (${Math.round(buf.length / 1024)} KB) · generated_voice_id: ${p.generated_voice_id}`);
}

if (process.platform === 'darwin' && outFiles.length > 0) {
  exec(`open ${outFiles.map(f => `"${f}"`).join(' ')}`);
}
