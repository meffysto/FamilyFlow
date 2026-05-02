#!/usr/bin/env node
/**
 * Test direct ElevenLabs TTS — reproduit exactement la requête de l'app
 * pour itérer sur les voice_settings sans cramer une histoire entière.
 *
 * Usage :
 *   ELEVEN_LABS_KEY=sk_xxx VOICE_ID=M3Z2Szrj4L070AIxRTfX \
 *   node scripts/test-elevenlabs-tags.mjs
 *
 * Variables d'env optionnelles :
 *   MODEL=eleven_multilingual_v2  (défaut)
 *   STABILITY=0.5
 *   SIMILARITY_BOOST=0.75
 *   STYLE=0.4
 *   USE_SPEAKER_BOOST=true
 *   TEXT="<custom text avec tags>"
 *   OUT=test.mp3
 *
 * Le script POST /v1/text-to-speech/{voice_id}, écrit le MP3 dans OUT
 * et l'ouvre automatiquement (macOS).
 */

import fs from 'node:fs/promises';
import { exec } from 'node:child_process';
import path from 'node:path';

// Charge .env si présent (racine du repo)
try {
  const envPath = path.resolve(new URL('..', import.meta.url).pathname, '.env');
  const raw = await fs.readFile(envPath, 'utf8');
  for (const line of raw.split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.+)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
  }
} catch { /* pas de .env, on continue */ }

const apiKey = process.env.ELEVEN_LABS_KEY ?? process.env.ELEVENLABS_API_KEY;
const voiceId = process.env.VOICE_ID;
if (!apiKey || !voiceId) {
  console.error('❌ Manque ELEVEN_LABS_KEY ou VOICE_ID en env.');
  process.exit(1);
}

const model = process.env.MODEL ?? 'eleven_multilingual_v2';
const stability = parseFloat(process.env.STABILITY ?? '0.5');
const similarityBoost = parseFloat(process.env.SIMILARITY_BOOST ?? '0.75');
const style = parseFloat(process.env.STYLE ?? '0.4');
const useSpeakerBoost = (process.env.USE_SPEAKER_BOOST ?? 'true') === 'true';
const out = process.env.OUT ?? `test-${model}-style${style}-stab${stability}-sim${similarityBoost}.mp3`;

const defaultText =
  "Lucas serre son caillou dans ses bras. [whispers] Il rentre chez lui sur le chemin fleuri. Ses petits pieds sont fatigués. [chuckles] Il pose sa tête sur l'oreiller doux.";
const text = process.env.TEXT ?? defaultText;

const body = {
  text,
  model_id: model,
  voice_settings: {
    stability,
    similarity_boost: similarityBoost,
    style,
    use_speaker_boost: useSpeakerBoost,
  },
};

console.log('→ POST /v1/text-to-speech/' + voiceId);
console.log('  model:', model);
console.log('  voice_settings:', body.voice_settings);
console.log('  text:', text.length, 'chars');
console.log('  out:', out);

const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
  method: 'POST',
  headers: {
    'Accept': 'audio/mpeg',
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

const buf = Buffer.from(await res.arrayBuffer());
await fs.writeFile(out, buf);
console.log(`✅ MP3 écrit: ${out} (${Math.round(buf.length / 1024)} KB)`);

if (process.platform === 'darwin') {
  exec(`open "${out}"`);
}
