// lib/pdf/ornaments.ts — Bibliothèque centralisée d'ornements SVG inline pour le mode B fallback.
// Toutes les fonctions retournent des strings SVG directement injectables dans le HTML
// (contrainte WKWebView : pas de référence externe, tout inline).
// Palette terracotta (#B8593F) / sauge (#7A8F6B) — CONTEXT.md §117-125.

const TERRACOTTA = '#B8593F';
const SAGE = '#7A8F6B';

export interface OrnamentOpts {
  color?: string;
  size?: number;
}

/** Cartouche feuillagé encadrant la drop cap (frame fougère + ramure terracotta). */
export function dropCapFrame({ color = TERRACOTTA, size = 96 }: OrnamentOpts = {}): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="${size}" height="${size}" aria-hidden="true">
    <path d="M 8 50 Q 8 8, 50 8 Q 92 8, 92 50 Q 92 92, 50 92 Q 8 92, 8 50 Z" fill="none" stroke="${color}" stroke-width="1.2" opacity="0.55"/>
    <path d="M 50 6 q -4 6 0 12 q 4 -6 0 -12" fill="${color}" opacity="0.7"/>
    <path d="M 50 94 q -4 -6 0 -12 q 4 6 0 12" fill="${color}" opacity="0.7"/>
    <path d="M 6 50 q 6 -4 12 0 q -6 4 -12 0" fill="${color}" opacity="0.7"/>
    <path d="M 94 50 q -6 -4 -12 0 q 6 4 12 0" fill="${color}" opacity="0.7"/>
    <circle cx="20" cy="20" r="1.6" fill="${color}"/>
    <circle cx="80" cy="20" r="1.6" fill="${color}"/>
    <circle cx="20" cy="80" r="1.6" fill="${color}"/>
    <circle cx="80" cy="80" r="1.6" fill="${color}"/>
  </svg>`;
}

/** Bordure marge externe — silhouette fougère verticale (sauge, basse opacité). */
export function borderFern({ color = SAGE, size = 64 }: OrnamentOpts = {}): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 200" width="${size}" height="${size * 5}" aria-hidden="true" preserveAspectRatio="xMidYMid meet">
    <path d="M 20 200 L 20 10" stroke="${color}" stroke-width="1.2" opacity="0.5" fill="none"/>
    <path d="M 20 30 q -10 -4 -14 -14" stroke="${color}" stroke-width="1" fill="none" opacity="0.5"/>
    <path d="M 20 30 q 10 -4 14 -14" stroke="${color}" stroke-width="1" fill="none" opacity="0.5"/>
    <path d="M 20 60 q -12 -4 -16 -16" stroke="${color}" stroke-width="1" fill="none" opacity="0.45"/>
    <path d="M 20 60 q 12 -4 16 -16" stroke="${color}" stroke-width="1" fill="none" opacity="0.45"/>
    <path d="M 20 95 q -14 -4 -18 -18" stroke="${color}" stroke-width="1" fill="none" opacity="0.4"/>
    <path d="M 20 95 q 14 -4 18 -18" stroke="${color}" stroke-width="1" fill="none" opacity="0.4"/>
    <path d="M 20 130 q -12 -4 -16 -16" stroke="${color}" stroke-width="1" fill="none" opacity="0.4"/>
    <path d="M 20 130 q 12 -4 16 -16" stroke="${color}" stroke-width="1" fill="none" opacity="0.4"/>
    <path d="M 20 165 q -10 -4 -14 -14" stroke="${color}" stroke-width="1" fill="none" opacity="0.35"/>
    <path d="M 20 165 q 10 -4 14 -14" stroke="${color}" stroke-width="1" fill="none" opacity="0.35"/>
    <circle cx="20" cy="10" r="2" fill="${color}" opacity="0.6"/>
  </svg>`;
}

/** Bordure marge externe — ramures fines (sauge). */
export function borderRamage({ color = SAGE, size = 64 }: OrnamentOpts = {}): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 200" width="${size}" height="${size * 5}" aria-hidden="true" preserveAspectRatio="xMidYMid meet">
    <path d="M 20 200 q -2 -50 4 -100 q 6 -50 -2 -100" stroke="${color}" stroke-width="1.1" fill="none" opacity="0.5"/>
    <path d="M 22 150 q 8 -6 12 -16" stroke="${color}" stroke-width="0.8" fill="none" opacity="0.45"/>
    <path d="M 24 110 q -8 -6 -12 -16" stroke="${color}" stroke-width="0.8" fill="none" opacity="0.45"/>
    <path d="M 22 70 q 8 -6 12 -16" stroke="${color}" stroke-width="0.8" fill="none" opacity="0.4"/>
    <path d="M 22 30 q -8 -6 -12 -16" stroke="${color}" stroke-width="0.8" fill="none" opacity="0.4"/>
    <circle cx="34" cy="134" r="1.4" fill="${color}" opacity="0.55"/>
    <circle cx="12" cy="94" r="1.4" fill="${color}" opacity="0.55"/>
    <circle cx="34" cy="54" r="1.4" fill="${color}" opacity="0.55"/>
  </svg>`;
}

/** Bordure marge externe — lichen / herbes hautes (sauge). */
export function borderLichen({ color = SAGE, size = 64 }: OrnamentOpts = {}): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 200" width="${size}" height="${size * 5}" aria-hidden="true" preserveAspectRatio="xMidYMid meet">
    <path d="M 8 200 L 8 130" stroke="${color}" stroke-width="0.9" opacity="0.5"/>
    <path d="M 14 200 L 14 110" stroke="${color}" stroke-width="0.9" opacity="0.5"/>
    <path d="M 20 200 L 20 90" stroke="${color}" stroke-width="0.9" opacity="0.5"/>
    <path d="M 26 200 L 26 120" stroke="${color}" stroke-width="0.9" opacity="0.5"/>
    <path d="M 32 200 L 32 140" stroke="${color}" stroke-width="0.9" opacity="0.5"/>
    <circle cx="14" cy="106" r="1.6" fill="${color}" opacity="0.55"/>
    <circle cx="20" cy="86" r="1.6" fill="${color}" opacity="0.55"/>
    <circle cx="26" cy="116" r="1.6" fill="${color}" opacity="0.55"/>
    <circle cx="14" cy="60" r="2.2" fill="${color}" opacity="0.4"/>
    <circle cx="22" cy="40" r="2.2" fill="${color}" opacity="0.4"/>
    <circle cx="30" cy="55" r="2.2" fill="${color}" opacity="0.4"/>
  </svg>`;
}

/** Vignette haut de page : lune croissante + 3 étoiles (terracotta). */
export function vignetteCrescent({ color = TERRACOTTA, size = 48 }: OrnamentOpts = {}): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 60" width="${size * 2}" height="${size}" aria-hidden="true">
    <path d="M 50 12 a 18 18 0 1 0 0 36 a 14 14 0 1 1 0 -36 z" fill="${color}" opacity="0.85"/>
    <path d="M 22 18 l 1.5 4 l 4 1.5 l -4 1.5 l -1.5 4 l -1.5 -4 l -4 -1.5 l 4 -1.5 z" fill="${color}"/>
    <path d="M 78 22 l 1 3 l 3 1 l -3 1 l -1 3 l -1 -3 l -3 -1 l 3 -1 z" fill="${color}"/>
    <path d="M 84 42 l 1 3 l 3 1 l -3 1 l -1 3 l -1 -3 l -3 -1 l 3 -1 z" fill="${color}"/>
  </svg>`;
}

/** Vignette : silhouette forêt — 4 sapins minimalistes (sauge). */
export function vignetteForest({ color = SAGE, size = 48 }: OrnamentOpts = {}): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 60" width="${size * 2}" height="${size}" aria-hidden="true">
    <polygon points="20,50 14,38 18,38 13,28 18,28 12,18 26,18 22,28 26,28 22,38 26,38" fill="${color}" opacity="0.75"/>
    <polygon points="40,50 32,36 38,36 31,22 38,22 30,8 50,8 44,22 50,22 44,36 50,36" fill="${color}" opacity="0.85"/>
    <polygon points="62,50 56,38 60,38 55,28 60,28 54,18 68,18 64,28 68,28 64,38 68,38" fill="${color}" opacity="0.75"/>
    <polygon points="82,50 76,40 80,40 75,32 80,32 75,24 86,24 83,32 87,32 84,40 88,40" fill="${color}" opacity="0.7"/>
    <line x1="0" y1="52" x2="100" y2="52" stroke="${color}" stroke-width="0.8" opacity="0.5"/>
  </svg>`;
}

/** Vignette : lanterne suspendue (terracotta). */
export function vignetteLantern({ color = TERRACOTTA, size = 48 }: OrnamentOpts = {}): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 80" width="${size}" height="${(size * 80) / 60}" aria-hidden="true">
    <line x1="30" y1="0" x2="30" y2="14" stroke="${color}" stroke-width="1"/>
    <path d="M 22 14 q 8 -6 16 0" fill="none" stroke="${color}" stroke-width="1.2"/>
    <rect x="20" y="18" width="20" height="4" fill="${color}" opacity="0.85"/>
    <path d="M 22 22 L 18 50 L 42 50 L 38 22 Z" fill="${color}" opacity="0.4" stroke="${color}" stroke-width="1.2"/>
    <line x1="26" y1="26" x2="26" y2="46" stroke="${color}" stroke-width="0.6" opacity="0.7"/>
    <line x1="34" y1="26" x2="34" y2="46" stroke="${color}" stroke-width="0.6" opacity="0.7"/>
    <rect x="18" y="50" width="24" height="4" fill="${color}" opacity="0.85"/>
    <line x1="30" y1="54" x2="30" y2="62" stroke="${color}" stroke-width="0.8" opacity="0.7"/>
    <circle cx="30" cy="64" r="2" fill="${color}"/>
  </svg>`;
}

/** Vignette : oiseau perché silhouette (terracotta). */
export function vignetteBird({ color = TERRACOTTA, size = 48 }: OrnamentOpts = {}): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 60" width="${size * 2}" height="${size}" aria-hidden="true">
    <line x1="0" y1="50" x2="100" y2="46" stroke="${color}" stroke-width="0.8" opacity="0.55"/>
    <path d="M 40 46 q 4 -16 16 -16 q 12 0 14 12 q 6 -2 10 -1 q -3 4 -8 5 q -2 6 -10 6 q -10 0 -14 -3 z" fill="${color}" opacity="0.85"/>
    <circle cx="68" cy="34" r="1" fill="#FAF6EE"/>
    <line x1="56" y1="46" x2="56" y2="52" stroke="${color}" stroke-width="0.7"/>
    <line x1="60" y1="46" x2="60" y2="52" stroke="${color}" stroke-width="0.7"/>
    <path d="M 76 30 l 6 -3 l -2 4 z" fill="${color}"/>
  </svg>`;
}

/** Cartouche feuillagé pour numéro de page (cohérent dropCapFrame, plus petit). */
export function cartoucheFrame({ color = TERRACOTTA, size = 36 }: OrnamentOpts = {}): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 40" width="${(size * 60) / 40}" height="${size}" aria-hidden="true">
    <ellipse cx="30" cy="20" rx="24" ry="13" fill="none" stroke="${color}" stroke-width="0.9" opacity="0.6"/>
    <path d="M 4 20 q -3 -2 -3 -6 q 4 0 6 4" fill="${color}" opacity="0.7"/>
    <path d="M 56 20 q 3 -2 3 -6 q -4 0 -6 4" fill="${color}" opacity="0.7"/>
    <path d="M 4 20 q -3 2 -3 6 q 4 0 6 -4" fill="${color}" opacity="0.7"/>
    <path d="M 56 20 q 3 2 3 6 q -4 0 -6 -4" fill="${color}" opacity="0.7"/>
    <circle cx="14" cy="20" r="0.9" fill="${color}"/>
    <circle cx="46" cy="20" r="0.9" fill="${color}"/>
  </svg>`;
}

/** Séparateur ornemental triple : ✦ · ❋ · ✦ (terracotta). */
export function separatorTriple({ color = TERRACOTTA, size = 24 }: OrnamentOpts = {}): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 24" width="${size * 5}" height="${size}" aria-hidden="true">
    <text x="20" y="18" fill="${color}" font-family="serif" font-size="20">✦</text>
    <text x="60" y="18" fill="${color}" font-family="serif" font-size="14">·</text>
    <text x="110" y="18" fill="${color}" font-family="serif" font-size="22">❋</text>
    <text x="170" y="18" fill="${color}" font-family="serif" font-size="14">·</text>
    <text x="210" y="18" fill="${color}" font-family="serif" font-size="20">✦</text>
  </svg>`;
}
