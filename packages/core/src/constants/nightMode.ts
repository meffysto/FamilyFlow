/**
 * nightMode.ts — Palette OLED-friendly pour le mode nuit bébé
 *
 * Couleurs ambrées tamisées pour éviter d'éblouir dans le noir.
 */

export const NightColors = {
  bg: '#000000',           // OLED noir pur
  card: '#0A0A0A',         // cartes quasi-noires
  text: '#8B7355',         // texte ambré tamisé
  textSub: '#6B5A42',      // encore plus tamisé
  accent: '#5C4A2E',       // accent warm
  accentBright: '#B8860B', // éléments actifs (timer)
  timer: '#C4A265',        // affichage chrono
  border: '#1A1A1A',       // bordures subtiles
  buttonBg: '#141414',     // fond boutons
  success: '#2D5A27',      // indicateur sauvegardé
} as const;
