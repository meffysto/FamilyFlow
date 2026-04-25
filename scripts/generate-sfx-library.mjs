#!/usr/bin/env node
/**
 * generate-sfx-library.mjs
 *
 * Outil dev one-shot : lit `assets/stories/sfx/manifest.json` et génère
 * un MP3 court par tag SFX via l'API ElevenLabs Sound Generation.
 *
 * Coût estimé : ~58 SFX × ~2s × 40 crédits ≈ 4 600 crédits one-shot, amortis
 * à vie car bundlés dans l'app (zéro coût au runtime).
 *
 * Usage :
 *   ELEVENLABS_API_KEY=xxx node scripts/generate-sfx-library.mjs
 *   ELEVENLABS_API_KEY=xxx node scripts/generate-sfx-library.mjs --only roar_dragon
 *   ELEVENLABS_API_KEY=xxx node scripts/generate-sfx-library.mjs --category animals
 *
 * Après exécution, décommente les require() correspondants dans `lib/sfx.ts`.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const MANIFEST = path.join(ROOT, 'assets/stories/sfx/manifest.json');
const OUT_DIR = path.join(ROOT, 'assets/stories/sfx');

const API_URL = 'https://api.elevenlabs.io/v1/sound-generation';

async function main() {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    console.error('❌ ELEVENLABS_API_KEY manquante.');
    process.exit(1);
  }

  const args = process.argv.slice(2);
  const onlyIdx = args.indexOf('--only');
  const only = onlyIdx !== -1 ? args[onlyIdx + 1] : null;

  const manifest = JSON.parse(await fs.readFile(MANIFEST, 'utf8'));
  const entries = only
    ? manifest.entries.filter(e => e.tag === only)
    : manifest.entries;

  if (entries.length === 0) {
    console.error(`❌ Aucun SFX trouvé${only ? ` pour --only ${only}` : ''}.`);
    process.exit(1);
  }

  console.log(`🔊 Génération de ${entries.length} SFX via ElevenLabs (modèle ${manifest.model}).\n`);

  let success = 0;
  let skipped = 0;
  let failed = 0;

  for (const entry of entries) {
    const file = `${entry.tag}.mp3`;
    const outPath = path.join(OUT_DIR, file);

    try {
      await fs.access(outPath);
      console.log(`⏭  ${entry.tag.padEnd(22)} skip (existe déjà)`);
      skipped++;
      continue;
    } catch { /* fichier absent, on génère */ }

    process.stdout.write(`🎵 ${entry.tag.padEnd(22)} ... `);

    const body = {
      text: entry.prompt,
      model_id: manifest.model,
      duration_seconds: entry.duration ?? manifest.default_duration_seconds,
      loop: manifest.loop ?? false,
      prompt_influence: manifest.prompt_influence ?? 0.5,
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
        console.log(`❌ ${res.status} ${err.slice(0, 120)}`);
        failed++;
        continue;
      }

      const buf = Buffer.from(await res.arrayBuffer());
      await fs.writeFile(outPath, buf);
      console.log(`✅ (${(buf.byteLength / 1024).toFixed(1)} KB)`);
      success++;
    } catch (e) {
      console.log(`❌ ${e.message}`);
      failed++;
    }
  }

  console.log(`\n✨ Terminé : ${success} générés, ${skipped} skip, ${failed} échecs.`);
  console.log(`Décommente les require() correspondants dans lib/sfx.ts puis rebuild.`);
}

main().catch(e => { console.error(e); process.exit(1); });
