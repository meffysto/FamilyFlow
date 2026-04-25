#!/usr/bin/env node
/**
 * generate-ambience-library.mjs
 *
 * Outil dev one-shot : lit `assets/stories/ambience/manifest.json` et génère
 * un MP3 par univers via l'API ElevenLabs Sound Generation (modèle v2, loop:true).
 *
 * Coût estimé : 9 univers × 22s × 40 crédits = ~7 920 crédits (one-shot, amortis
 * à vie car bundlés dans l'app).
 *
 * Usage :
 *   ELEVENLABS_API_KEY=xxx node scripts/generate-ambience-library.mjs
 *   ELEVENLABS_API_KEY=xxx node scripts/generate-ambience-library.mjs --only foret
 *
 * Après exécution, décommente les `require()` dans `lib/ambience.ts`.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const MANIFEST = path.join(ROOT, 'assets/stories/ambience/manifest.json');
const OUT_DIR = path.join(ROOT, 'assets/stories/ambience');

const API_URL = 'https://api.elevenlabs.io/v1/sound-generation';

async function main() {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    console.error('❌ ELEVENLABS_API_KEY manquante dans l\'environnement.');
    process.exit(1);
  }

  const args = process.argv.slice(2);
  const onlyIdx = args.indexOf('--only');
  const only = onlyIdx !== -1 ? args[onlyIdx + 1] : null;

  const manifest = JSON.parse(await fs.readFile(MANIFEST, 'utf8'));
  const entries = only
    ? manifest.entries.filter(e => e.universId === only)
    : manifest.entries;

  if (entries.length === 0) {
    console.error(`❌ Aucun univers trouvé${only ? ` pour --only ${only}` : ''}.`);
    process.exit(1);
  }

  console.log(`🎧 Génération de ${entries.length} ambiance(s) via ElevenLabs (modèle ${manifest.model}, ${manifest.duration_seconds}s).\n`);

  for (const entry of entries) {
    const outPath = path.join(OUT_DIR, entry.file);
    try {
      await fs.access(outPath);
      console.log(`⏭  ${entry.file} existe déjà, skip (supprime-le pour régénérer).`);
      continue;
    } catch { /* fichier absent, on génère */ }

    process.stdout.write(`🎵 ${entry.universId.padEnd(14)} → ${entry.file} ... `);

    const body = {
      text: entry.prompt,
      model_id: manifest.model,
      duration_seconds: manifest.duration_seconds,
      loop: manifest.loop,
      prompt_influence: manifest.prompt_influence,
    };

    try {
      const res = await fetch(API_URL, {
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
        console.log(`❌\n   ${res.status} ${err.slice(0, 200)}`);
        continue;
      }

      const buf = Buffer.from(await res.arrayBuffer());
      await fs.writeFile(outPath, buf);
      console.log(`✅ (${(buf.byteLength / 1024).toFixed(1)} KB)`);
    } catch (e) {
      console.log(`❌ ${e.message}`);
    }
  }

  console.log(`\n✨ Terminé. N'oublie pas de décommenter les require() dans lib/ambience.ts.`);
}

main().catch(e => { console.error(e); process.exit(1); });
