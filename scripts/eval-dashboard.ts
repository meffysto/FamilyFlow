#!/usr/bin/env tsx
/**
 * Phase 52 — Dashboard manuel d'évaluation des histoires.
 *
 * Usage :
 *   npx tsx scripts/eval-dashboard.ts [--vault <path>] [--since 30d]
 *   VAULT_PATH=~/iCloud/.../FamilyVault npx tsx scripts/eval-dashboard.ts
 *
 * Parse tous les frontmatters stories du vault et imprime :
 *   - Distribution clean / soft / hard fail
 *   - Re-roll rate (Plan 52-02)
 *   - Score moyen LLM-judge (Plan 52-03)
 *   - Top issues
 *
 * Read-only — pas de réseau, pas d'écriture.
 *
 * Note d'implémentation : on n'importe PAS `parseBedtimeStory` depuis lib/parser.ts —
 * lib/parser.ts traîne en transitif des `require('*.png')` (lib/village, lib/codex…)
 * que tsx Node ne sait pas charger sans bundler. On lit donc directement le
 * frontmatter avec gray-matter (la même lib que parseBedtimeStory utilise en interne)
 * et on extrait les champs Phase 52 à la main. Le shape des champs reste celui
 * documenté dans `parseBedtimeStory` (lib/parser.ts), à toute évolution future
 * répercuter ici.
 */
import * as fs from 'fs';
import * as path from 'path';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const matter = require('gray-matter') as (input: string) => {
  data: Record<string, unknown>;
  content: string;
};

type DimScore = 1 | 2 | 3 | undefined;
interface StoryQualitySnapshot {
  date: string;
  quality_score?: number;
  quality_dimensions?: {
    longueur?: DimScore;
    fin_paisible?: DimScore;
    vocabulaire?: DimScore;
    anti_clones?: DimScore;
    tags_tts?: DimScore;
    coherence_saga?: DimScore;
  };
  quality_issues?: string[];
  quality_retried?: boolean;
  llm_judge?: { justification?: string } | null;
}

const argv = process.argv.slice(2);
const vaultArgIdx = argv.indexOf('--vault');
const sinceArgIdx = argv.indexOf('--since');
const vaultPath = vaultArgIdx >= 0
  ? argv[vaultArgIdx + 1]
  : process.env.VAULT_PATH ?? './vault';
const sinceDays = sinceArgIdx >= 0
  ? parseInt(argv[sinceArgIdx + 1].replace(/d$/, ''), 10)
  : 30;

const storiesDir = path.join(vaultPath, '09 - Histoires');
if (!fs.existsSync(storiesDir)) {
  console.error(`Vault stories dir introuvable : ${storiesDir}`);
  process.exit(1);
}

function* walk(dir: string): Generator<string> {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(p);
    else if (entry.isFile() && entry.name.endsWith('.md')) yield p;
  }
}

function asDimScore(v: unknown): DimScore {
  return v === 1 || v === 2 || v === 3 ? v : undefined;
}

/**
 * Lecture allégée du frontmatter story — équivalent fonctionnel de
 * parseBedtimeStory(file, content) restreint aux champs Phase 52.
 * Toute évolution du serializer (lib/parser.ts) doit se répercuter ici.
 */
function readStoryQuality(file: string): StoryQualitySnapshot | null {
  try {
    const raw = fs.readFileSync(file, 'utf-8');
    const fm = matter(raw);
    const d = fm.data;
    if (!d.date || typeof d.date !== 'string') return null;
    const dims = (d.quality_dimensions as Record<string, unknown> | undefined) ?? undefined;
    const llm = (d.llm_judge as { justification?: string } | null | undefined) ?? null;
    return {
      date: d.date as string,
      quality_score: typeof d.quality_score === 'number' ? d.quality_score : undefined,
      quality_dimensions: dims
        ? {
            longueur: asDimScore(dims.longueur),
            fin_paisible: asDimScore(dims.fin_paisible),
            vocabulaire: asDimScore(dims.vocabulaire),
            anti_clones: asDimScore(dims.anti_clones),
            tags_tts: asDimScore(dims.tags_tts),
            coherence_saga: asDimScore(dims.coherence_saga),
          }
        : undefined,
      quality_issues: Array.isArray(d.quality_issues)
        ? (d.quality_issues as string[])
        : undefined,
      quality_retried: d.quality_retried === true,
      llm_judge: llm,
    };
  } catch (e) {
    if (process.env.DEBUG) console.warn(`[skip] ${file}: ${e}`);
    return null;
  }
}

function hasHardFail(s: StoryQualitySnapshot): boolean {
  if (!s.quality_dimensions) return false;
  return Object.values(s.quality_dimensions).some((v) => v === 1);
}

const cutoff = new Date(Date.now() - sinceDays * 86_400_000);
const stories: StoryQualitySnapshot[] = [];
for (const file of walk(storiesDir)) {
  const s = readStoryQuality(file);
  if (s && new Date(s.date) >= cutoff) stories.push(s);
}

const total = stories.length;
const clean = stories.filter((s) => (s.quality_issues?.length ?? 0) === 0 && !hasHardFail(s)).length;
const soft = stories.filter((s) => (s.quality_issues?.length ?? 0) > 0 && !hasHardFail(s)).length;
const hard = stories.filter((s) => hasHardFail(s)).length;
const retried = stories.filter((s) => s.quality_retried).length;

const llmScores = stories
  .map((s) => s.quality_score)
  .filter((n): n is number => typeof n === 'number');
const avgLlm = llmScores.length > 0
  ? llmScores.reduce((a, b) => a + b, 0) / llmScores.length
  : null;
const fallbacks = stories.filter(
  (s) => s.llm_judge?.justification?.startsWith('Score neutre'),
).length;

const issueCounts = new Map<string, number>();
for (const s of stories) {
  for (const issue of s.quality_issues ?? []) {
    issueCounts.set(issue, (issueCounts.get(issue) ?? 0) + 1);
  }
}
const topIssues = [...issueCounts.entries()]
  .sort((a, b) => b[1] - a[1])
  .slice(0, 5);

const pct = (n: number) => (total > 0 ? `${((n / total) * 100).toFixed(1)}%` : 'n/a');

console.log(`=== Eval Dashboard (${sinceDays} derniers jours) ===`);
console.log(`Vault : ${vaultPath}`);
console.log(`Total stories : ${total}`);
console.log(`  🟢 Clean (0 issues)     : ${clean} (${pct(clean)})`);
console.log(`  🟡 Soft warnings        : ${soft} (${pct(soft)})`);
console.log(`  🔴 Hard fail            : ${hard} (${pct(hard)})`);
console.log('');
console.log(`Re-roll                 : ${retried}/${total} (${pct(retried)})`);
console.log(`LLM-judge score moy     : ${avgLlm !== null ? avgLlm.toFixed(2) + ' / 10' : 'n/a'}`);
console.log(`LLM-judge fallback      : ${fallbacks}/${total} (${pct(fallbacks)})`);
console.log('');
console.log('Top issues :');
if (topIssues.length === 0) {
  console.log('  (aucun issue détecté)');
} else {
  for (const [issue, count] of topIssues) {
    console.log(`  - ${issue} : ${count}`);
  }
}
console.log('');
const hardRate = total > 0 ? hard / total : 0;
const cleanRate = total > 0 ? clean / total : 0;
console.log(
  `Cible Phase 52 : hard fail < 10% ${hardRate < 0.10 ? '✓' : '✗'} | clean > 60% ${cleanRate > 0.60 ? '✓' : '✗'}`,
);

// Référence indicative pour le grep d'acceptance — voir docstring d'en-tête.
// parseBedtimeStory (lib/parser.ts) reste la source de vérité pour le shape complet.
