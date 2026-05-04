// lib/pdf/types.ts — Types domaine export PDF (Lulu Direct)

import type { BOOK_PALETTE, FONT_SLOTS } from './constants';

/**
 * Spécifications de génération d'un livre PDF Lulu.
 * Les champs trimCm/bleedCm/pageCount sont figés au moment de l'export pour
 * audit (un livre déjà imprimé doit pouvoir être reproduit même si
 * TRIM_SIZE_CM évolue plus tard).
 */
export interface BookExportSpec {
  storyId: string;
  format: 'Lulu 21×21';
  trimCm: number; // = TRIM_SIZE_CM (figé pour audit)
  bleedCm: number; // = BLEED_CM
  pageCount: number; // = PAGE_COUNT
  palette: BookPalette;
}

/**
 * Une entrée du registre `12 - Impressions/manifeste.md`.
 * Contrainte format markdown table : aucun champ ne doit contenir le
 * caractère `|` (Pitfall 5 RESEARCH.md) — le hash SHA-256 est hex, les
 * chemins vault n'ont pas de pipe, c'est satisfait par construction.
 */
export interface BookManifestEntry {
  id: string; // storyId (clé unique par export)
  hash: string; // SHA-256 hex du PDF (intégrité, généré Phase 49)
  date: string; // YYYY-MM-DD de l'export
  format: string; // ex: 'Lulu 21×21' — string pour futur-proof autres formats
  chemin: string; // chemin relatif vault vers le PDF
}

/** Type dérivé de la palette (préserve les clés littérales). */
export type BookPalette = typeof BOOK_PALETTE;

/** Clé de slot police (body | bodyBold | display | whisper). */
export type FontSlot = keyof typeof FONT_SLOTS;
