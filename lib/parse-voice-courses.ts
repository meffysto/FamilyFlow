/**
 * parse-voice-courses.ts — Parseur de transcript vocal vers items de courses
 *
 * Découpe un transcript en items individuels, extrait quantités et noms,
 * et affecte une catégorie via categorizeIngredient.
 */

import { categorizeIngredient } from './cooklang';

export interface VoiceCourseItem {
  text: string;
  name: string;
  quantity: number | null;
  section: string;
}

/** Séparateurs entre items dictés (FR) */
const SEPARATOR_REGEX = /\s+et\s+|,|;|\.\s+|\n+/i;

/** Déterminants à retirer du nom */
const DETERMINANT_REGEX = /^(du|de la|de l'|de l'|des|un|une|le|la|les)\s+/i;

/**
 * Extraction de quantité avec unité optionnelle et nom
 * Ex : "2 paquets de pâtes", "3 tomates", "1 bouteille de lait"
 */
const QTY_WITH_UNIT_REGEX =
  /^(\d+(?:[.,]\d+)?)\s*(?:paquets?|boîtes?|boites?|sachets?|bouteilles?|kg|g|l|ml|cl)?\s*(?:de\s+|d'|d')?(.+)/i;

/** Extraction de quantité simple */
const QTY_SIMPLE_REGEX = /^(\d+(?:[.,]\d+)?)\s+(.+)/i;

/**
 * Normalise un nom pour la déduplication : NFD lowercase
 */
function normalizeForDedup(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

/**
 * Capitalise la première lettre d'une chaîne
 */
function capitalize(str: string): string {
  if (!str) return str;
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Parse un transcript vocal en liste d'items de courses.
 * Retourne un tableau vide si le transcript est vide ou ne contient rien d'exploitable.
 */
export function parseVoiceCourses(transcript: string): VoiceCourseItem[] {
  if (!transcript || !transcript.trim()) return [];

  const segments = transcript.split(SEPARATOR_REGEX);
  const seen = new Set<string>();
  const result: VoiceCourseItem[] = [];

  for (const segment of segments) {
    const trimmed = segment.trim();
    if (trimmed.length < 2) continue;

    let quantity: number | null = null;
    let name: string = trimmed;

    // Tentative extraction quantité avec unité
    const qtyUnitMatch = trimmed.match(QTY_WITH_UNIT_REGEX);
    if (qtyUnitMatch) {
      const rawQty = qtyUnitMatch[1].replace(',', '.');
      quantity = parseFloat(rawQty);
      name = qtyUnitMatch[2].trim();
    } else {
      // Tentative extraction quantité simple
      const qtySimpleMatch = trimmed.match(QTY_SIMPLE_REGEX);
      if (qtySimpleMatch) {
        const rawQty = qtySimpleMatch[1].replace(',', '.');
        quantity = parseFloat(rawQty);
        name = qtySimpleMatch[2].trim();
      }
    }

    // Si pas de quantité numérique, retirer le déterminant éventuel
    if (quantity === null) {
      name = name.replace(DETERMINANT_REGEX, '').trim();
    }

    if (name.length < 2) continue;

    // Déduplication par nom normalisé
    const dedupKey = normalizeForDedup(name);
    if (seen.has(dedupKey)) continue;
    seen.add(dedupKey);

    // Reconstruction du texte propre
    const text = quantity !== null
      ? `${quantity % 1 === 0 ? Math.round(quantity) : quantity} ${name}`
      : capitalize(name);

    const section = categorizeIngredient(name);

    result.push({ text, name, quantity, section });
  }

  return result;
}
