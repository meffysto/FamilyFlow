/**
 * anonymizer.ts — Anonymisation des données personnelles avant envoi à l'API Claude
 *
 * Principe : mapping aller-retour (anonymize / deanonymize).
 * Aucune donnée personnelle réelle ne quitte le device.
 *
 * Catégories anonymisées :
 * - Noms de profils (enfants, adultes) → "Enfant 1", "Parent 1"
 * - Médecins → "Médecin A", "Médecin B"
 * - Lieux (RDV + texte libre souvenirs/tâches) → "Lieu 1", "Lieu 2"
 * - Contacts médicaux → "Contact 1", "Contact 2"
 * - Allergies → "Allergie 1", "Allergie 2"
 * - Médicaments → "Médicament 1", "Médicament 2"
 * - Antécédents médicaux → "Antécédent 1", "Antécédent 2"
 */

import type { Profile, RDV, HealthRecord, Memory, Task } from './types';

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
 *
 * Sources de lieux : champs `lieu` des RDV + titres/descriptions de souvenirs
 * et texte de tâches contenant des noms de lieux détectés par heuristique.
 *
 * Sources médicales : allergies, médicaments et antécédents des dossiers santé.
 */
export function buildAnonymizationMap(
  profiles: Profile[],
  rdvs: RDV[],
  healthRecords?: HealthRecord[],
  memories?: Memory[],
  tasks?: Task[],
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
  const rdvLocations = uniqueNonEmpty(rdvs.map((r) => r.lieu));
  const allLocationStrings = [...rdvLocations];

  // ── Lieux (depuis texte libre : souvenirs + tâches) ──
  // Extraire les noms de lieux potentiels via patterns courants
  const freeTexts: string[] = [];
  if (memories) {
    for (const m of memories) {
      if (m.title) freeTexts.push(m.title);
      if (m.description) freeTexts.push(m.description);
    }
  }
  if (tasks) {
    for (const t of tasks) {
      if (t.text) freeTexts.push(t.text);
    }
  }

  const extractedLocations = extractLocationsFromText(freeTexts);
  allLocationStrings.push(...extractedLocations);

  const locations = uniqueNonEmpty(allLocationStrings);
  locations.forEach((loc, i) => {
    add(loc, `Lieu ${i + 1}`);
  });

  // ── Données médicales (depuis dossiers santé) ──
  if (healthRecords) {
    const allergies = uniqueNonEmpty(healthRecords.flatMap((h) => h.allergies));
    allergies.forEach((a, i) => {
      add(a, `Allergie ${i + 1}`);
    });

    const medicaments = uniqueNonEmpty(healthRecords.flatMap((h) => h.medicamentsEnCours));
    medicaments.forEach((m, i) => {
      add(m, `Médicament ${i + 1}`);
    });

    const antecedents = uniqueNonEmpty(healthRecords.flatMap((h) => h.antecedents));
    antecedents.forEach((a, i) => {
      add(a, `Antécédent ${i + 1}`);
    });
  }

  return { forward, reverse };
}

// ─── Extraction de lieux depuis le texte libre ──────────────────────────────────

/**
 * Patterns courants pour détecter des noms de lieux dans du texte français libre.
 * Chaque regex capture le nom du lieu (group 1).
 */
const LOCATION_PATTERNS = [
  // "à l'école Saint-Joseph", "à la crèche Les Petits Loups"
  /(?:à l[a'']|au|aux|chez)\s+(?:école|crèche|garderie|maternelle|collège|lycée|centre|cabinet|clinique|hôpital|pharmacie|mairie|parc|piscine|bibliothèque|médiathèque)\s+([A-ZÀ-Ü][\w\s-]+)/gi,
  // "école Saint-Joseph", "crèche Les Petits"
  /(?:école|crèche|garderie|maternelle|collège|lycée|centre|cabinet|clinique|hôpital|pharmacie)\s+([A-ZÀ-Ü][\w\s-]{2,})/gi,
  // "chez Mamie", "chez Nounou", "chez Dr Martin"
  /chez\s+([A-ZÀ-Ü][\w-]+(?:\s+[A-ZÀ-Ü][\w-]+)?)/gi,
  // Adresses : "12 rue de la Paix", "3 avenue Victor Hugo"
  /\d+\s+(?:rue|avenue|boulevard|allée|impasse|chemin|place|passage|cours)\s+[^\n,]{3,40}/gi,
];

function extractLocationsFromText(texts: string[]): string[] {
  const found: string[] = [];
  const joined = texts.join('\n');

  for (const pattern of LOCATION_PATTERNS) {
    // Reset lastIndex pour les regex globales
    pattern.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(joined)) !== null) {
      // Prendre le groupe capturé ou le match entier (pour les adresses)
      const loc = (match[1] ?? match[0]).trim();
      if (loc.length >= 3) found.push(loc);
    }
  }

  return found;
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
