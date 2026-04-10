// lib/museum/engine.ts
// Moteur de persistance du Musée des effets sémantiques (MUSEUM-01, MUSEUM-03).
// Phase 23 — mus-e-des-effets-seed-002-lite.
//
// Module pur : zéro import hook/context (per D-03c).
// Seule fonction async : appendMuseumEntryToVault (isolée, import VaultManager uniquement).
//
// Format de ligne musée dans gami-{id}.md :
//   - YYYY-MM-DDTHH:mm:ss | categoryId | icon label

import { format, formatDistanceToNow, isYesterday, isToday, type Locale } from 'date-fns';
import { fr as dateFnsFr, enUS } from 'date-fns/locale';
import { getWeekStart } from '../semantic/caps';
import type { CategoryId } from '../semantic/categories';
import type { VaultManager } from '../vault';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Une entrée dans le Musée des effets sémantiques. */
export interface MuseumEntry {
  date: Date;
  categoryId: CategoryId;
  icon: string;
  label: string;
}

// ---------------------------------------------------------------------------
// Helpers internes
// ---------------------------------------------------------------------------

/** Retourne la locale date-fns selon la langue préférée de l'environnement. */
function getDateLocale(): Locale {
  try {
    // Tente de lire la locale i18n de manière synchrone sans importer le hook
    const { I18nManager } = require('react-native');
    const lang = I18nManager?.getConstants?.()?.localeIdentifier ?? '';
    if (lang.startsWith('en')) return enUS;
  } catch { /* silencieux */ }
  return dateFnsFr;
}

/** Section header musée. */
const MUSEUM_HEADER = '## Musée';

// ---------------------------------------------------------------------------
// parseMuseumEntries
// ---------------------------------------------------------------------------

/**
 * Parse la section `## Musée` d'un fichier gami-{id}.md et retourne les entrées.
 * Retourne [] si la section est absente ou si aucune ligne n'est valide.
 * Lignes malformées ignorées silencieusement (MUSEUM-03).
 */
export function parseMuseumEntries(content: string): MuseumEntry[] {
  const lines = content.split('\n');
  const entries: MuseumEntry[] = [];

  let inMuseum = false;
  for (const line of lines) {
    if (line.startsWith('## ')) {
      if (line.trim() === MUSEUM_HEADER) {
        inMuseum = true;
        continue;
      } else if (inMuseum) {
        // Fin de la section musée (section suivante)
        break;
      }
    }

    if (!inMuseum) continue;
    if (!line.startsWith('- ')) continue;

    // Format : - YYYY-MM-DDTHH:mm:ss | categoryId | icon label
    const parts = line.slice(2).split(' | ');
    if (parts.length < 3) continue;

    const [rawDate, categoryId, iconAndLabel] = parts;
    if (!rawDate || !categoryId || !iconAndLabel) continue;

    // Le timestamp est sans Z (heure locale, Pitfall 4 de RESEARCH.md)
    const parsedDate = new Date(rawDate.trim() + 'Z');
    if (isNaN(parsedDate.getTime())) continue;

    // Séparer l'icône du label (premier segment séparé par espace)
    const spaceIdx = iconAndLabel.trim().indexOf(' ');
    let icon: string;
    let label: string;
    if (spaceIdx === -1) {
      icon = iconAndLabel.trim();
      label = '';
    } else {
      icon = iconAndLabel.trim().slice(0, spaceIdx);
      label = iconAndLabel.trim().slice(spaceIdx + 1);
    }

    entries.push({
      date: parsedDate,
      categoryId: categoryId.trim() as CategoryId,
      icon,
      label,
    });
  }

  return entries;
}

// ---------------------------------------------------------------------------
// extractMuseumSection
// ---------------------------------------------------------------------------

/**
 * Extrait la section `## Musée` complète (header + lignes) depuis un contenu gami-{id}.md.
 * Retourne '' si la section est absente.
 * Utilisée par serializeGamification pour la préserver lors des réécritures.
 */
export function extractMuseumSection(content: string): string {
  const lines = content.split('\n');
  let inMuseum = false;
  const museumLines: string[] = [];

  for (const line of lines) {
    if (line.startsWith('## ')) {
      if (line.trim() === MUSEUM_HEADER) {
        inMuseum = true;
        museumLines.push(line);
        continue;
      } else if (inMuseum) {
        // Fin de la section musée
        break;
      }
    }

    if (inMuseum) {
      museumLines.push(line);
    }
  }

  if (museumLines.length === 0) return '';

  // Supprimer les lignes vides de fin
  while (museumLines.length > 1 && museumLines[museumLines.length - 1].trim() === '') {
    museumLines.pop();
  }

  return museumLines.join('\n');
}

// ---------------------------------------------------------------------------
// appendMuseumEntry
// ---------------------------------------------------------------------------

/**
 * Ajoute une entrée à la section `## Musée` dans le contenu gami-{id}.md.
 * Si la section n'existe pas, la crée.
 *
 * ATTENTION Pitfall 5 (RESEARCH.md) : si `## Musée` n'est PAS la dernière section,
 * insérer la nouvelle ligne AVANT la section suivante `## `.
 * Sinon, appender en fin de fichier.
 */
export function appendMuseumEntry(content: string, entry: MuseumEntry): string {
  // Formater le timestamp sans Z (heure locale, Pitfall 4 de RESEARCH.md)
  const timestamp = entry.date.toISOString().slice(0, 19);
  const newLine = `- ${timestamp} | ${entry.categoryId} | ${entry.icon} ${entry.label}`;

  const lines = content.split('\n');

  // Trouver la section ## Musée
  let museumStart = -1;
  let nextSectionIdx = -1;

  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim() === MUSEUM_HEADER) {
      museumStart = i;
      continue;
    }
    if (museumStart !== -1 && lines[i].startsWith('## ')) {
      nextSectionIdx = i;
      break;
    }
  }

  if (museumStart === -1) {
    // La section n'existe pas — la créer en fin de fichier
    const trimmed = content.trimEnd();
    return `${trimmed}\n\n${MUSEUM_HEADER}\n${newLine}\n`;
  }

  // La section existe
  if (nextSectionIdx !== -1) {
    // Insérer avant la section suivante (Pitfall 5)
    // Trouver la dernière ligne non-vide avant nextSectionIdx
    let insertAt = nextSectionIdx;
    // Remonter pour trouver la fin réelle du contenu musée (avant les lignes vides de séparation)
    while (insertAt > museumStart + 1 && lines[insertAt - 1].trim() === '') {
      insertAt--;
    }
    const before = lines.slice(0, insertAt);
    const after = lines.slice(insertAt);
    return [...before, newLine, ...after].join('\n');
  } else {
    // Musée est la dernière section — appender en fin de fichier
    const trimmed = content.trimEnd();
    return `${trimmed}\n${newLine}\n`;
  }
}

// ---------------------------------------------------------------------------
// groupEntriesByWeek
// ---------------------------------------------------------------------------

/**
 * Groupe les entrées musée par semaine (lundi → dimanche).
 * Tri descendant : semaine la plus récente en premier, puis les entrées dans chaque semaine.
 * Header "Cette semaine" pour la semaine courante, "Semaine du DD/MM/AAAA" sinon.
 */
export function groupEntriesByWeek(
  entries: MuseumEntry[]
): Array<{ weekKey: string; weekLabel: string; data: MuseumEntry[] }> {
  const locale = getDateLocale();
  const thisWeekKey = getWeekStart();

  // Grouper par weekKey (lundi de la semaine)
  const map = new Map<string, MuseumEntry[]>();
  for (const entry of entries) {
    const weekKey = getWeekStart(entry.date);
    if (!map.has(weekKey)) {
      map.set(weekKey, []);
    }
    map.get(weekKey)!.push(entry);
  }

  // Trier les semaines de la plus récente à la plus ancienne
  const sortedKeys = Array.from(map.keys()).sort((a, b) => b.localeCompare(a));

  return sortedKeys.map((weekKey) => {
    const data = map.get(weekKey)!;
    // Trier les entrées dans la semaine : plus récente en premier
    data.sort((a, b) => b.date.getTime() - a.date.getTime());

    let weekLabel: string;
    if (weekKey === thisWeekKey) {
      weekLabel = 'Cette semaine';
    } else {
      const mondayDate = new Date(weekKey + 'T00:00:00');
      weekLabel = `Semaine du ${format(mondayDate, 'dd/MM/yyyy', { locale })}`;
    }

    return { weekKey, weekLabel, data };
  });
}

// ---------------------------------------------------------------------------
// formatRelativeTime
// ---------------------------------------------------------------------------

/**
 * Formate une date en temps relatif :
 * - < 24h : "il y a 2h" (via formatDistanceToNow)
 * - Hier : "Hier HH:mm"
 * - Sinon : "EEE HH:mm"
 */
export function formatRelativeTime(date: Date): string {
  const locale = getDateLocale();
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffH = diffMs / (1000 * 60 * 60);

  if (diffH < 24 && isToday(date)) {
    return formatDistanceToNow(date, { addSuffix: true, locale });
  }

  if (isYesterday(date)) {
    return `Hier ${format(date, 'HH:mm', { locale })}`;
  }

  return format(date, 'EEE HH:mm', { locale });
}

// ---------------------------------------------------------------------------
// appendMuseumEntryToVault
// ---------------------------------------------------------------------------

/**
 * Lit gami-{profileId}.md, ajoute l'entrée musée, réécrit.
 * Seule fonction async et non-pure du module (import VaultManager isolé ici).
 * Utilisée en fire-and-forget depuis completeTask() (MUSEUM-01).
 */
export async function appendMuseumEntryToVault(
  vault: VaultManager,
  profileId: string,
  entry: MuseumEntry,
): Promise<void> {
  const file = `gami-${profileId}.md`;
  const content = await vault.readFile(file).catch(() => '');
  const updated = appendMuseumEntry(content, entry);
  await vault.writeFile(file, updated);
}
