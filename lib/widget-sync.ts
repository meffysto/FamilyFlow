/**
 * widget-sync.ts -- Synchronise les feedings du widget iOS vers le vault markdown
 *
 * Lit le JSON journal-bebe-widget.json depuis l'App Group,
 * insère les entrées dans les fichiers journal markdown correspondants,
 * puis vide les feedings du widget.
 */

import { Platform } from 'react-native';
import { VaultManager } from './vault';
import {
  journalPathForDate,
  generateJournalTemplate,
  insertAlimentationRow,
} from './parser';
import {
  readJournalWidgetData,
  clearJournalWidgetFeedings,
} from '../modules/vault-access/src';

interface WidgetFeedingEntry {
  type: string;       // "biberon" ou "tétée"
  child: string;
  timestamp: string;  // ISO8601
  side?: string;      // "gauche" ou "droite"
  durationSeconds?: number;
  volumeMl?: number;
}

interface WidgetJournalData {
  childName: string;
  feedings: WidgetFeedingEntry[];
  activeFeeding?: unknown;
  lastSide?: string;
}

/**
 * Synchronise les feedings enregistrés par le widget vers le vault markdown.
 * Fire-and-forget, ne bloque jamais l'app.
 */
export async function syncWidgetFeedingsToVault(vault: VaultManager): Promise<void> {
  if (Platform.OS !== 'ios') return;

  // 1. Lire le JSON du widget
  const rawJson = await readJournalWidgetData();
  if (!rawJson) return;

  let widgetData: WidgetJournalData;
  try {
    widgetData = JSON.parse(rawJson);
  } catch {
    return;
  }

  const feedings = widgetData.feedings;
  if (!feedings || feedings.length === 0) return;

  // Ne pas sync si une tétée est en cours (on attend qu'elle soit terminée)
  if (widgetData.activeFeeding) return;

  // 2. Grouper les feedings par (enfant, date)
  const grouped = new Map<string, WidgetFeedingEntry[]>();

  for (const entry of feedings) {
    const date = parseISODate(entry.timestamp);
    if (!date) continue;

    const dateStr = formatDateYYYYMMDD(date);
    const child = entry.child || widgetData.childName || 'Lucas';
    const key = `${child}::${dateStr}`;

    if (!grouped.has(key)) {
      grouped.set(key, []);
    }
    grouped.get(key)!.push(entry);
  }

  // 3. Pour chaque groupe, lire/créer le fichier journal et insérer les lignes
  for (const [key, entries] of grouped) {
    const [child, dateStr] = key.split('::');
    const journalPath = journalPathForDate(child, dateStr);

    let content: string;
    try {
      content = await vault.readFile(journalPath);
    } catch {
      // Fichier absent, créer depuis le template
      content = generateJournalTemplate(child);
    }

    // Lire les heures existantes pour éviter les doublons
    const existingHours = extractExistingHours(content);

    let modified = false;
    for (const entry of entries) {
      const entryDate = parseISODate(entry.timestamp);
      if (!entryDate) continue;

      const heure = formatHHMM(entryDate);

      // Vérifier doublon (même heure +/- 1 min)
      if (isDuplicate(heure, existingHours)) continue;

      const type = entry.type === 'biberon' ? 'Biberon' as const : 'Tétée' as const;

      let detail = '';
      if (type === 'Tétée') {
        const side = entry.side ? entry.side.charAt(0).toUpperCase() + entry.side.slice(1) : '';
        const durationMin = entry.durationSeconds ? Math.round(entry.durationSeconds / 60) : 0;
        if (side && durationMin > 0) {
          detail = `${side} — ${durationMin} min`;
        } else if (side) {
          detail = side;
        } else if (durationMin > 0) {
          detail = `${durationMin} min`;
        }
      } else {
        // Biberon
        if (entry.volumeMl) {
          detail = `${entry.volumeMl} ml`;
        }
      }

      content = insertAlimentationRow(content, heure, type, detail, '');
      existingHours.push(heure); // Pour éviter les doublons dans le même batch
      modified = true;
    }

    if (modified) {
      await vault.writeFile(journalPath, content);
    }
  }

  // 4. Vider les feedings du widget (garder childName et lastSide)
  await clearJournalWidgetFeedings();
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function parseISODate(timestamp: string): Date | null {
  const date = new Date(timestamp);
  return isNaN(date.getTime()) ? null : date;
}

function formatDateYYYYMMDD(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function formatHHMM(date: Date): string {
  const h = String(date.getHours()).padStart(2, '0');
  const m = String(date.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

/** Extraire les heures existantes de la section Alimentation */
function extractExistingHours(content: string): string[] {
  const lines = content.split('\n');
  const hours: string[] = [];
  let inAlimentation = false;

  for (const line of lines) {
    if (line.startsWith('## Alimentation')) { inAlimentation = true; continue; }
    if (line.startsWith('## ') && inAlimentation) break;
    if (!inAlimentation || !line.startsWith('|')) continue;

    const cells = line.split('|').slice(1, -1).map(c => c.trim());
    if (cells.length < 2) continue;
    if (cells[0] === 'Heure' || cells[0].startsWith('---')) continue;

    hours.push(cells[0]);
  }

  return hours;
}

/** Vérifie si une heure est un doublon (+/- 1 minute) */
function isDuplicate(heure: string, existingHours: string[]): boolean {
  const [h, m] = heure.split(':').map(Number);
  if (isNaN(h) || isNaN(m)) return false;

  const totalMinutes = h * 60 + m;

  for (const existing of existingHours) {
    const [eh, em] = existing.split(':').map(Number);
    if (isNaN(eh) || isNaN(em)) continue;

    const existingTotal = eh * 60 + em;
    if (Math.abs(totalMinutes - existingTotal) <= 1) return true;
  }

  return false;
}
