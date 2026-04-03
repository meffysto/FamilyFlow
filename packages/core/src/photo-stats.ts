/**
 * photo-stats.ts — Calcul de streak et statistiques photo
 *
 * Streak = nombre de jours consécutifs avec photo, en remontant depuis aujourd'hui (ou hier).
 */

export interface PhotoStats {
  /** Jours consécutifs avec photo (termine aujourd'hui ou hier) */
  currentStreak: number;
  /** Meilleur streak all-time */
  longestStreak: number;
  /** Nombre de photos ce mois-ci */
  thisMonthCount: number;
  /** Nombre de jours écoulés ce mois-ci (incluant aujourd'hui) */
  thisMonthTotal: number;
}

/**
 * Calcule les stats photo pour un enfant.
 * @param dates — tableau de dates YYYY-MM-DD triées (ou non)
 * @param todayStr — date du jour YYYY-MM-DD
 */
export function computePhotoStats(dates: string[], todayStr: string): PhotoStats {
  if (dates.length === 0) {
    const day = parseInt(todayStr.slice(8, 10), 10);
    return { currentStreak: 0, longestStreak: 0, thisMonthCount: 0, thisMonthTotal: day };
  }

  const sorted = [...dates].sort();
  const dateSet = new Set(sorted);

  // Stats du mois en cours
  const monthPrefix = todayStr.slice(0, 7); // YYYY-MM
  const day = parseInt(todayStr.slice(8, 10), 10);
  const thisMonthCount = sorted.filter((d) => d.startsWith(monthPrefix)).length;

  // Streak courant : partir d'aujourd'hui (ou hier si pas de photo aujourd'hui)
  let streakStart = todayStr;
  if (!dateSet.has(todayStr)) {
    // Vérifier hier
    const yesterday = addDays(todayStr, -1);
    if (!dateSet.has(yesterday)) {
      // Pas de streak en cours
      return {
        currentStreak: 0,
        longestStreak: computeLongestStreak(sorted),
        thisMonthCount,
        thisMonthTotal: day,
      };
    }
    streakStart = yesterday;
  }

  let currentStreak = 0;
  let d = streakStart;
  while (dateSet.has(d)) {
    currentStreak++;
    d = addDays(d, -1);
  }

  return {
    currentStreak,
    longestStreak: Math.max(currentStreak, computeLongestStreak(sorted)),
    thisMonthCount,
    thisMonthTotal: day,
  };
}

function computeLongestStreak(sortedDates: string[]): number {
  if (sortedDates.length === 0) return 0;

  let longest = 1;
  let current = 1;

  for (let i = 1; i < sortedDates.length; i++) {
    const diff = daysBetween(sortedDates[i - 1], sortedDates[i]);
    if (diff === 1) {
      current++;
      if (current > longest) longest = current;
    } else if (diff > 1) {
      current = 1;
    }
    // diff === 0 (doublon) : on ignore
  }

  return longest;
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T12:00:00');
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function daysBetween(a: string, b: string): number {
  const da = new Date(a + 'T12:00:00').getTime();
  const db = new Date(b + 'T12:00:00').getTime();
  return Math.round((db - da) / 86400000);
}
