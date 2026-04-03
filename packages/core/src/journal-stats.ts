/**
 * journal-stats.ts — Real-time journal statistics
 *
 * Parses baby journal markdown content and calculates stats:
 * - Feeding: bottle count, total ml, breastfeeding count
 * - Diapers: total count by type
 * - Sleep: total duration, night vs day breakdown
 *
 * All calculations are done in-memory — no file writes needed.
 */

export interface SleepEntry {
  debut: string;
  fin: string;
  duree: string | null;
  isNight: boolean;
}

export interface CouchesDetail {
  total: number;
  pipi: number;
  selle: number;
  mixte: number;
}

export interface MedicationEntry {
  heure: string;
  medicament: string;
  dose: string;
}

export interface JournalStats {
  biberons: number;
  totalMl: number;
  tetees: number;
  couches: number;
  couchesDetail: CouchesDetail;
  siestes: SleepEntry[];
  sommeilTotal: string;
  sommeilNuit: string;
  sommeilJour: string;
  medications: MedicationEntry[];
  observations: string[];
}

const EMPTY_COUCHES: CouchesDetail = { total: 0, pipi: 0, selle: 0, mixte: 0 };

const EMPTY_STATS: JournalStats = {
  biberons: 0,
  totalMl: 0,
  tetees: 0,
  couches: 0,
  medications: [],
  observations: [],
  couchesDetail: { ...EMPTY_COUCHES },
  siestes: [],
  sommeilTotal: '',
  sommeilNuit: '',
  sommeilJour: '',
};

/**
 * Parse "HH:MM", "HHhMM", or "HHh" → minutes since midnight.
 * Returns null if not parseable.
 */
export function parseHeure(s: string): number | null {
  if (!s) return null;
  const clean = s.trim();

  // HH:MM
  let m = clean.match(/^(\d{1,2}):(\d{2})$/);
  if (m) return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);

  // HHhMM
  m = clean.match(/^(\d{1,2})h(\d{2})$/);
  if (m) return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);

  // HHh (no minutes)
  m = clean.match(/^(\d{1,2})h$/);
  if (m) return parseInt(m[1], 10) * 60;

  return null;
}

/**
 * Calculate duration between start and end times.
 * Handles midnight crossing (e.g., 19:30 → 7:00 = 11h30).
 * Returns formatted string like "11h30", "2h", "45min", or null if invalid.
 */
export function calculerDuree(debut: string, fin: string): string | null {
  const startMin = parseHeure(debut);
  const endMin = parseHeure(fin);
  if (startMin === null || endMin === null) return null;

  let delta = endMin - startMin;
  if (delta <= 0) delta += 24 * 60; // midnight crossing
  if (delta > 24 * 60) return null; // invalid

  const hours = Math.floor(delta / 60);
  const minutes = delta % 60;

  if (hours === 0) return `${minutes}min`;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h${minutes.toString().padStart(2, '0')}`;
}

/**
 * Parse a duration string like "11h30", "2h", "45min" → total minutes.
 */
export function parseDureeToMinutes(s: string): number {
  if (!s) return 0;
  const clean = s.trim();

  // Xh or XhYY
  let m = clean.match(/^(\d+)h(\d+)?$/);
  if (m) return parseInt(m[1], 10) * 60 + (m[2] ? parseInt(m[2], 10) : 0);

  // Xmin
  m = clean.match(/^(\d+)min$/);
  if (m) return parseInt(m[1], 10);

  return 0;
}

/** Format minutes → "Xh" or "XhYY" or "Xmin" */
export function formatMinutes(totalMin: number): string {
  if (totalMin <= 0) return '';
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h === 0) return `${m}min`;
  if (m === 0) return `${h}h`;
  return `${h}h${m.toString().padStart(2, '0')}`;
}

/**
 * Determine if a sleep entry is "night sleep" vs "day nap".
 * Night sleep: start ≥ 19h or start < 7h or crosses midnight.
 */
function isNightSleep(debut: string, fin: string): boolean {
  const startMin = parseHeure(debut);
  const endMin = parseHeure(fin);
  if (startMin === null) return false;

  // Start after 19h or before 7h
  if (startMin >= 19 * 60 || startMin < 7 * 60) return true;

  // Crosses midnight (end < start)
  if (endMin !== null && endMin < startMin) return true;

  return false;
}

/**
 * Parse all stats from a journal's markdown content.
 */
export function parseJournalStats(content: string): JournalStats {
  if (!content) return { ...EMPTY_STATS };

  const lines = content.split('\n');
  const stats: JournalStats = { ...EMPTY_STATS, couchesDetail: { ...EMPTY_COUCHES }, siestes: [], medications: [], observations: [] };

  let currentSection = '';

  for (const line of lines) {
    const trimmed = line.trim();

    // Track sections
    if (trimmed.startsWith('## ')) {
      currentSection = trimmed.replace('## ', '').toLowerCase();
      continue;
    }

    // Observations/Humeur — texte libre (pas de table)
    if ((currentSection.includes('humeur') || currentSection.includes('observation')) && trimmed.length > 0 && !trimmed.startsWith('|')) {
      stats.observations.push(trimmed);
      continue;
    }

    // Skip non-table rows
    if (!trimmed.startsWith('|') || trimmed.includes('---')) continue;

    // Parse table cells — keep empty cells to preserve column positions
    const rawCells = trimmed.split('|');
    // Remove first and last empty entries from leading/trailing |
    const cells = rawCells.slice(1, rawCells.length - 1).map((c) => c.trim());

    if (cells.length < 2) continue;

    // Skip header rows
    if (cells[0].toLowerCase() === 'heure' || cells[0].toLowerCase() === 'début') continue;

    // Alimentation section
    if (currentSection.includes('alimentation')) {
      const [heure, type, detail] = cells;
      // Ignorer les lignes sans heure (cohérent avec couches/sommeil)
      if (!heure) continue;

      const typeLower = (type || '').toLowerCase();
      if (typeLower.includes('biberon')) {
        stats.biberons++;
        // Extract ml from detail
        const mlMatch = (detail || '').match(/(\d+)\s*(ml)?/i);
        if (mlMatch) stats.totalMl += parseInt(mlMatch[1], 10);
      } else if (typeLower.includes('tétée') || typeLower.includes('tetee')) {
        stats.tetees++;
      }
    }

    // Couches section
    if (currentSection.includes('couche')) {
      const [heure, type] = cells;
      if (!heure) continue; // ignorer les lignes sans heure
      stats.couches++;
      stats.couchesDetail.total++;
      const typeLower = (type || '').toLowerCase().trim();
      if (typeLower.includes('mixte') || (typeLower.includes('pipi') && typeLower.includes('selle'))) {
        stats.couchesDetail.mixte++;
      } else if (typeLower.includes('selle') || typeLower.includes('caca')) {
        stats.couchesDetail.selle++;
      } else if (typeLower.includes('pipi') || typeLower.includes('urine')) {
        stats.couchesDetail.pipi++;
      } else {
        // Type non reconnu → compter comme total seulement
        stats.couchesDetail.pipi++;
      }
    }

    // Médicaments section
    if (currentSection.includes('dicament') || currentSection.includes('soins')) {
      const [heure, medicament, dose] = cells;
      if (!heure) continue;
      if (medicament) {
        stats.medications.push({ heure, medicament: medicament.trim(), dose: (dose || '').trim() });
      }
    }

    // Sommeil section
    if (currentSection.includes('sommeil')) {
      const [debut, fin, dureeCell] = cells;
      if (!debut) continue; // ignorer les lignes sans heure de début

      let duree = dureeCell?.trim() || null;

      // Auto-calculate duration if missing
      if (!duree && debut && fin) {
        duree = calculerDuree(debut, fin);
      }

      const night = isNightSleep(debut, fin || '');

      stats.siestes.push({ debut, fin: fin || '', duree, isNight: night });
    }
  }

  // Calculate totals
  let totalNightMin = 0;
  let totalDayMin = 0;

  for (const s of stats.siestes) {
    if (!s.duree) continue;
    const min = parseDureeToMinutes(s.duree);
    if (s.isNight) {
      totalNightMin += min;
    } else {
      totalDayMin += min;
    }
  }

  const totalMin = totalNightMin + totalDayMin;
  stats.sommeilTotal = formatMinutes(totalMin);
  stats.sommeilNuit = formatMinutes(totalNightMin);
  stats.sommeilJour = formatMinutes(totalDayMin);

  return stats;
}
