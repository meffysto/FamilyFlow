/**
 * lib/lovenotes/reveal-engine.ts — Presets reveal pure JS + helper localIso
 * Phase 36 Plan 01. Fonctions pures testables (now injectable).
 * Format LoveNote.revealAt : 'YYYY-MM-DDTHH:mm:ss' heure locale sans Z (cf. types.ts:585).
 */

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

/** Convertit une Date en ISO local sans Z (heure de l'appareil). */
export function localIso(d: Date): string {
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
  );
}

/** Demain matin 08:00. */
export function presetTomorrowMorning(now: Date = new Date()): { date: string; time: string } {
  const d = new Date(now);
  d.setDate(d.getDate() + 1);
  d.setHours(8, 0, 0, 0);
  return { date: localIso(d).slice(0, 10), time: '08:00' };
}

/** Prochain dimanche 19:00 (si on est dimanche → dimanche suivant). */
export function presetNextSundayEvening(now: Date = new Date()): { date: string; time: string } {
  const d = new Date(now);
  const day = d.getDay();                    // 0=Sun..6=Sat
  const daysUntilSun = (7 - day) % 7 || 7;   // toujours futur
  d.setDate(d.getDate() + daysUntilSun);
  d.setHours(19, 0, 0, 0);
  return { date: localIso(d).slice(0, 10), time: '19:00' };
}

/** Aujourd'hui +1 mois 09:00 (Date.setMonth gère overflow). */
export function presetInOneMonth(now: Date = new Date()): { date: string; time: string } {
  const d = new Date(now);
  d.setMonth(d.getMonth() + 1);
  d.setHours(9, 0, 0, 0);
  return { date: localIso(d).slice(0, 10), time: '09:00' };
}
