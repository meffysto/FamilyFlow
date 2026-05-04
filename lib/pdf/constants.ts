// lib/pdf/constants.ts — Constantes Lulu Direct (specs immuables)

/** Trim size carré 21×21 cm (Lulu Direct standard saddle-stitch) */
export const TRIM_SIZE_CM = 21;

/** Bleed Lulu Direct : 3.2 mm tous bords */
export const BLEED_CM = 0.32;

/** Saddle-stitch impose multiple de 4 pages ; livre cible 16 pages */
export const PAGE_COUNT = 16;

/** Label affichable du format (audit trail manifeste) */
export const LULU_FORMAT_LABEL = 'Lulu 21×21';

/**
 * Palette couleurs livre (placeholder Phase 48 — finalisée Phase 49).
 * L'API est figée (clés ivory/terracotta/sage/ink/paperShadow), seules les
 * valeurs hex peuvent évoluer en Phase 49 sans casser les imports.
 */
export const BOOK_PALETTE = {
  ivory: '#FAF6EE',
  terracotta: '#C97D5F',
  sage: '#8FA68E',
  ink: '#2B2A28',
  paperShadow: '#E8E0D0',
} as const;

/**
 * Slots de polices disponibles pour le rendu PDF (Phase 49+).
 * Les valeurs DOIVENT correspondre aux alias déclarés dans
 * `app/_layout.tsx` via useFonts() — sinon expo-print ne trouvera pas la
 * police au moment du rendu HTML→PDF (Pitfall 2 RESEARCH.md).
 */
export const FONT_SLOTS = {
  body: 'Andika-Regular',
  bodyBold: 'Andika-Bold',
  display: 'DMSerifDisplay_400Regular',
  whisper: 'Caveat_600SemiBold',
} as const;
