// lib/village/parser.ts
// Parseur bidirectionnel pour jardin-familial.md — Village Jardin Familial.
// Phase 25 — fondation-donnees-village (v1.4).
//
// Format fichier jardin-familial.md :
//   ---
//   version: 1
//   created: 2026-04-10
//   current_week_start: 2026-04-07
//   current_theme_index: 0
//   reward_claimed: false
//   ---
//
//   ## Contributions
//   - 2026-04-10T14:32:00 | profileId | harvest | 1
//
//   ## Historique
//   - 2026-03-31 | cible:45 | total:52 | claimed:true
//
// Module pur : zéro import hook/context (per D-03c).

import type { VillageData, VillageContribution, VillageWeekRecord, UnlockedBuilding } from './types';
import type { VaultManager } from '../vault';

/** Chemin du fichier village dans le vault Obsidian */
export const VILLAGE_FILE = '04 - Gamification/jardin-familial.md';

// ---------------------------------------------------------------------------
// parseGardenFile
// ---------------------------------------------------------------------------

/**
 * Parse le contenu de jardin-familial.md et retourne un VillageData.
 * Si content est vide (''), retourne un VillageData par defaut.
 * Lignes malformees ignorees silencieusement.
 */
export function parseGardenFile(content: string): VillageData {
  if (!content || content.trim() === '') {
    return {
      version: 1,
      createdAt: '',
      currentWeekStart: '',
      currentThemeIndex: 0,
      rewardClaimed: false,
      contributions: [],
      pastWeeks: [],
      unlockedBuildings: [],
    };
  }

  // Parser le frontmatter YAML manuellement — gray-matter utilise Buffer (Node.js)
  // qui n'existe pas dans le runtime React Native (crash Property 'Buffer' doesn't exist)
  let body = content;
  const fm: Record<string, string> = {};

  const fmMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (fmMatch) {
    body = content.slice(fmMatch[0].length);
    for (const line of fmMatch[1].split('\n')) {
      const idx = line.indexOf(':');
      if (idx === -1) continue;
      const key = line.slice(0, idx).trim();
      const val = line.slice(idx + 1).trim();
      if (key) fm[key] = val;
    }
  }

  const version = fm.version ? parseInt(fm.version, 10) : 1;
  const createdAt = fm.created ?? '';
  const currentWeekStart = fm.current_week_start ?? '';
  const currentThemeIndex = fm.current_theme_index ? parseInt(fm.current_theme_index, 10) : 0;
  const rewardClaimed = fm.reward_claimed === 'true';

  const contributions: VillageContribution[] = [];
  const pastWeeks: VillageWeekRecord[] = [];
  const unlockedBuildings: UnlockedBuilding[] = [];

  const lines = body.split('\n');
  let section: 'none' | 'contributions' | 'historique' | 'constructions' = 'none';

  for (const line of lines) {
    if (line.startsWith('## ')) {
      const header = line.trim().toLowerCase();
      if (header === '## contributions') {
        section = 'contributions';
      } else if (header === '## historique') {
        section = 'historique';
      } else {
        section = 'none';
      }
      continue;
    }

    if (!line.startsWith('- ')) continue;

    const raw = line.slice(2); // supprimer le '- '

    if (section === 'contributions') {
      // Format : timestamp | profileId | type | amount
      const parts = raw.split(' | ');
      if (parts.length < 4) continue;

      const [timestamp, profileId, rawType, rawAmount] = parts;
      if (!timestamp || !profileId || !rawType || !rawAmount) continue;

      const type = rawType.trim();
      if (type !== 'harvest' && type !== 'task') continue;

      const amount = parseInt(rawAmount.trim(), 10);
      if (isNaN(amount)) continue;

      contributions.push({
        timestamp: timestamp.trim(),
        profileId: profileId.trim(),
        type: type as 'harvest' | 'task',
        amount,
      });
    } else if (section === 'historique') {
      // Format : weekStart | cible:N | total:N | claimed:bool | members:id1=N,id2=N (optionnel)
      const parts = raw.split(' | ');
      if (parts.length < 4) continue;

      const [weekStart, rawTarget, rawTotal, rawClaimed, ...rest] = parts;
      if (!weekStart || !rawTarget || !rawTotal || !rawClaimed) continue;

      const targetMatch = rawTarget.trim().match(/^cible:(\d+)$/);
      const totalMatch = rawTotal.trim().match(/^total:(\d+)$/);
      const claimedMatch = rawClaimed.trim().match(/^claimed:(true|false)$/);

      if (!targetMatch || !totalMatch || !claimedMatch) continue;

      // Parser contributionsByMember optionnel (HIST-02)
      let contributionsByMember: Record<string, number> | undefined;
      const membersField = rest.find(r => r.trim().startsWith('members:'));
      if (membersField) {
        const membersRaw = membersField.trim().slice('members:'.length);
        contributionsByMember = {};
        for (const pair of membersRaw.split(',')) {
          const [id, val] = pair.split('=');
          if (id && val) contributionsByMember[id.trim()] = parseInt(val.trim(), 10);
        }
      }

      pastWeeks.push({
        weekStart: weekStart.trim(),
        target: parseInt(targetMatch[1], 10),
        total: parseInt(totalMatch[1], 10),
        claimed: claimedMatch[1] === 'true',
        contributionsByMember,
      });
    }
  }

  return {
    version,
    createdAt,
    currentWeekStart,
    currentThemeIndex,
    rewardClaimed,
    contributions,
    pastWeeks,
    unlockedBuildings,
  };
}

// ---------------------------------------------------------------------------
// serializeGardenFile
// ---------------------------------------------------------------------------

/**
 * Serialise un VillageData en markdown compatible Obsidian.
 * NE PAS utiliser matter.stringify() — construction manuelle de la string (Pitfall 5).
 * Sections toujours presentes meme si vides (facilite l'append).
 */
export function serializeGardenFile(data: VillageData): string {
  const lines: string[] = [];

  // Frontmatter YAML
  lines.push('---');
  lines.push(`version: ${data.version}`);
  lines.push(`created: ${data.createdAt}`);
  lines.push(`current_week_start: ${data.currentWeekStart}`);
  lines.push(`current_theme_index: ${data.currentThemeIndex}`);
  lines.push(`reward_claimed: ${data.rewardClaimed}`);
  lines.push('---');
  lines.push('');

  // Section Contributions
  lines.push('## Contributions');
  for (const c of data.contributions) {
    lines.push(`- ${c.timestamp} | ${c.profileId} | ${c.type} | ${c.amount}`);
  }
  lines.push('');

  // Section Historique
  lines.push('## Historique');
  for (const w of data.pastWeeks) {
    let line = `- ${w.weekStart} | cible:${w.target} | total:${w.total} | claimed:${w.claimed}`;
    if (w.contributionsByMember && Object.keys(w.contributionsByMember).length > 0) {
      const pairs = Object.entries(w.contributionsByMember).map(([id, n]) => `${id}=${n}`).join(',');
      line += ` | members:${pairs}`;
    }
    lines.push(line);
  }
  lines.push('');

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// appendContribution
// ---------------------------------------------------------------------------

/**
 * Insere une ligne dans la section `## Contributions` du contenu jardin-familial.md.
 * Pattern identique a appendMuseumEntry (lib/museum/engine.ts).
 *
 * - Trouve la section `## Contributions`
 * - Insere AVANT la prochaine section `## ` (evite d'append en fin de fichier, Pitfall 4)
 * - Si section absente, la creer avant `## Historique` ou en fin de fichier
 */
export function appendContribution(content: string, entry: VillageContribution): string {
  const newLine = `- ${entry.timestamp} | ${entry.profileId} | ${entry.type} | ${entry.amount}`;

  const lines = content.split('\n');

  // Trouver la section ## Contributions
  let contribStart = -1;
  let nextSectionIdx = -1;

  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim().toLowerCase() === '## contributions') {
      contribStart = i;
      continue;
    }
    if (contribStart !== -1 && lines[i].startsWith('## ')) {
      nextSectionIdx = i;
      break;
    }
  }

  if (contribStart === -1) {
    // La section n'existe pas — la creer avant ## Historique ou en fin de fichier
    const historiquelIdx = lines.findIndex(l => l.trim().toLowerCase() === '## historique');
    if (historiquelIdx !== -1) {
      const before = lines.slice(0, historiquelIdx);
      const after = lines.slice(historiquelIdx);
      // Supprimer les lignes vides de fin du bloc "before"
      while (before.length > 0 && before[before.length - 1].trim() === '') {
        before.pop();
      }
      return [...before, '', '## Contributions', newLine, '', ...after].join('\n');
    } else {
      // En fin de fichier
      const trimmed = content.trimEnd();
      return `${trimmed}\n\n## Contributions\n${newLine}\n`;
    }
  }

  // La section existe
  if (nextSectionIdx !== -1) {
    // Inserer avant la section suivante (Pitfall 4 — jamais append en fin de fichier)
    let insertAt = nextSectionIdx;
    // Remonter pour trouver la fin reelle du contenu contributions (avant les lignes vides)
    while (insertAt > contribStart + 1 && lines[insertAt - 1].trim() === '') {
      insertAt--;
    }
    const before = lines.slice(0, insertAt);
    const after = lines.slice(insertAt);
    return [...before, newLine, ...after].join('\n');
  } else {
    // Contributions est la derniere section — appender en fin de fichier
    const trimmed = content.trimEnd();
    return `${trimmed}\n${newLine}\n`;
  }
}

// ---------------------------------------------------------------------------
// appendContributionToVault
// ---------------------------------------------------------------------------

/**
 * Lit jardin-familial.md, ajoute la contribution, reecrit le fichier.
 * Pattern identique a appendMuseumEntryToVault (lib/museum/engine.ts).
 * Seule fonction async et non-pure du module.
 */
export async function appendContributionToVault(
  vault: VaultManager,
  entry: VillageContribution,
): Promise<void> {
  const content = await vault.readFile(VILLAGE_FILE).catch(() => '');
  const updated = appendContribution(content, entry);
  await vault.writeFile(VILLAGE_FILE, updated);
}
