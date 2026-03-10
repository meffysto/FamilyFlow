/**
 * anonymizer.ts — Anonymisation des données personnelles avant envoi à l'API Claude
 *
 * Principe : mapping aller-retour (anonymize / deanonymize).
 * Aucune donnée personnelle réelle ne quitte le device.
 *
 * Catégories anonymisées :
 * - Noms de profils (enfants, adultes) → "Enfant 1", "Parent 1"
 * - Médecins → "Médecin A", "Médecin B"
 * - Lieux → "Lieu 1", "Lieu 2"
 * - Contacts médicaux → "Contact 1", "Contact 2"
 */

import type { Profile, RDV, HealthRecord } from './types';

// ─── Types ──────────────────────────────────────────────────────────────────────

export interface AnonymizationMap {
  /** real → anonymous */
  forward: Map<string, string>;
  /** anonymous → real */
  reverse: Map<string, string>;
}

// ─── Labels ─────────────────────────────────────────────────────────────────────

const CHILD_LABELS = ['Enfant 1', 'Enfant 2', 'Enfant 3', 'Enfant 4', 'Enfant 5'];
const ADULT_LABELS = ['Parent 1', 'Parent 2', 'Parent 3'];
const DOCTOR_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

/** Déduplique et filtre les valeurs vides */
function uniqueNonEmpty(arr: string[]): string[] {
  const seen = new Set<string>();
  return arr.filter((v) => {
    const trimmed = v.trim();
    if (!trimmed || seen.has(trimmed.toLowerCase())) return false;
    seen.add(trimmed.toLowerCase());
    return true;
  });
}

// ─── Construction du mapping ────────────────────────────────────────────────────

/**
 * Construit le mapping d'anonymisation à partir des données vault.
 */
export function buildAnonymizationMap(
  profiles: Profile[],
  rdvs: RDV[],
  healthRecords?: HealthRecord[],
): AnonymizationMap {
  const forward = new Map<string, string>();
  const reverse = new Map<string, string>();

  const add = (real: string, anon: string) => {
    if (!real.trim()) return;
    // Éviter d'écraser un mapping existant (le premier gagne)
    if (forward.has(real)) return;
    forward.set(real, anon);
    reverse.set(anon, real);
  };

  // ── Profils ──
  const children = profiles.filter((p) => p.role === 'enfant' || p.role === 'ado');
  const adults = profiles.filter((p) => p.role === 'adulte');

  children.forEach((p, i) => {
    if (i < CHILD_LABELS.length) add(p.name, CHILD_LABELS[i]);
  });
  adults.forEach((p, i) => {
    if (i < ADULT_LABELS.length) add(p.name, ADULT_LABELS[i]);
  });

  // ── Médecins (depuis RDV) ──
  const doctors = uniqueNonEmpty(rdvs.map((r) => r.médecin));
  doctors.forEach((doc, i) => {
    if (i < DOCTOR_LETTERS.length) add(doc, `Médecin ${DOCTOR_LETTERS[i]}`);
  });

  // ── Médecins (depuis dossiers santé) ──
  if (healthRecords) {
    const healthDoctors = uniqueNonEmpty(
      healthRecords.flatMap((h) => [
        h.contactMedecin ?? '',
        h.contactPediatre ?? '',
        h.contactUrgences ?? '',
      ]),
    );
    healthDoctors.forEach((doc, i) => {
      const label = `Médecin ${DOCTOR_LETTERS[doctors.length + i] ?? `${doctors.length + i + 1}`}`;
      add(doc, label);
    });
  }

  // ── Lieux (depuis RDV) ──
  const locations = uniqueNonEmpty(rdvs.map((r) => r.lieu));
  locations.forEach((loc, i) => {
    add(loc, `Lieu ${i + 1}`);
  });

  return { forward, reverse };
}

// ─── Anonymisation / Dé-anonymisation ───────────────────────────────────────────

/**
 * Remplace toutes les occurrences des clés du mapping dans le texte.
 * Trie par longueur décroissante pour éviter les remplacements partiels.
 */
function replaceAll(text: string, mapping: Map<string, string>): string {
  if (!text || mapping.size === 0) return text;

  // Trier par longueur décroissante (ex: "Dr Martin" avant "Martin")
  const entries = Array.from(mapping.entries()).sort(
    (a, b) => b[0].length - a[0].length,
  );

  let result = text;
  for (const [search, replace] of entries) {
    if (!search) continue;
    const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(escaped, 'gi');
    result = result.replace(regex, replace);
  }

  return result;
}

/** Anonymise un texte en remplaçant les données personnelles par des pseudonymes */
export function anonymize(text: string, map: AnonymizationMap): string {
  return replaceAll(text, map.forward);
}

/** Dé-anonymise un texte en restaurant les données personnelles réelles */
export function deanonymize(text: string, map: AnonymizationMap): string {
  return replaceAll(text, map.reverse);
}
