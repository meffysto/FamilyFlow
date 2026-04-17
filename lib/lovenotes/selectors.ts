/**
 * lib/lovenotes/selectors.ts — Sélecteurs dérivés purs sur loveNotes[]
 *
 * Fonctions pures testables (now injectable) consommées par l'écran
 * Boîte aux lettres et la carte enveloppe dashboard. Pattern aligné
 * sur getCompanionMood (Phase 10) — paramètre `now` optionnel pour
 * tests déterministes.
 *
 * Format dates : ISO 'YYYY-MM-DDTHH:mm:ss' (sans Z), cf. lib/types.ts:589.
 */

import type { LoveNote } from '../types';

/**
 * Indique si une note doit être considérée comme révélée à `now`.
 * - status `revealed` ou `read` → toujours true.
 * - status `pending` → true si revealAt est passé (filet de sécurité
 *   contre les pending non promus par la logique reveal de Phase 36).
 */
export function isRevealed(note: LoveNote, now: Date = new Date()): boolean {
  if (note.status === 'revealed' || note.status === 'read') return true;
  // Fallback Pitfall 5 : pending dont revealAt est dans le passé (heure locale).
  // LoveNote.revealAt est stocké en heure locale (ISO sans Z, cf. types.ts:585) —
  // on doit donc comparer à un now local, pas à toISOString() qui shift en UTC.
  const pad = (n: number) => String(n).padStart(2, '0');
  const nowLocalIso =
    `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}` +
    `T${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
  return note.revealAt <= nowLocalIso;
}

/**
 * Notes reçues, révélées et non lues — tri createdAt desc.
 * Utilisé pour le badge unread et la carte enveloppe pinned.
 */
export function unreadForProfile(
  notes: LoveNote[],
  profileId: string,
  now: Date = new Date(),
): LoveNote[] {
  return notes
    .filter((n) => n.to === profileId && n.status !== 'read' && isRevealed(n, now))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/**
 * Toutes les notes reçues par le profil — tri 3-tier (Open Question 5) :
 *   tier 1 (top)    : révélées + non-lues (à découvrir)
 *   tier 2 (middle) : déjà lues
 *   tier 3 (bottom) : pending programmées dans le futur (préserve la surprise)
 * À tier égal : createdAt desc.
 */
export function receivedForProfile(
  notes: LoveNote[],
  profileId: string,
  now: Date = new Date(),
): LoveNote[] {
  const tier = (n: LoveNote): number => {
    if (isRevealed(n, now) && n.status !== 'read') return 1;
    if (n.status === 'read') return 2;
    return 3;
  };
  return notes
    .filter((n) => n.to === profileId)
    .sort((a, b) => {
      const ta = tier(a);
      const tb = tier(b);
      if (ta !== tb) return ta - tb;
      return b.createdAt.localeCompare(a.createdAt);
    });
}

/**
 * Notes envoyées par le profil — tri createdAt desc.
 */
export function sentByProfile(notes: LoveNote[], profileId: string): LoveNote[] {
  return notes
    .filter((n) => n.from === profileId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/**
 * Archive : notes lues impliquant le profil (reçues OU envoyées).
 * Tri par readAt desc (fallback createdAt).
 */
export function archivedForProfile(notes: LoveNote[], profileId: string): LoveNote[] {
  return notes
    .filter(
      (n) =>
        n.status === 'read' && (n.to === profileId || n.from === profileId),
    )
    .sort((a, b) => {
      const ka = a.readAt ?? a.createdAt;
      const kb = b.readAt ?? b.createdAt;
      return kb.localeCompare(ka);
    });
}
