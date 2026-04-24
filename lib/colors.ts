/**
 * colors.ts — Helpers couleur (alpha, parsing)
 *
 * Évite les concaténations fragiles `accentColor + '15'` qui ne fonctionnent
 * qu'avec les hex 6 caractères. `withAlpha` accepte n'importe quel format.
 */

/**
 * Applique un alpha (0–1) à une couleur hex (`#RGB`, `#RRGGBB`, `#RRGGBBAA`)
 * ou rgb()/rgba(). Retourne un `rgba(r, g, b, a)`.
 *
 * Si la couleur n'est pas reconnue, retourne la couleur d'origine inchangée
 * (fail-safe — évite de casser le rendu).
 */
export function withAlpha(color: string, alpha: number): string {
  const a = Math.max(0, Math.min(1, alpha));

  if (!color || typeof color !== 'string') return color;

  // Format hex
  if (color.startsWith('#')) {
    let hex = color.slice(1);
    // #RGB → #RRGGBB
    if (hex.length === 3) {
      hex = hex.split('').map((c) => c + c).join('');
    }
    // #RRGGBBAA → on ignore l'alpha existant
    if (hex.length === 8) {
      hex = hex.slice(0, 6);
    }
    if (hex.length !== 6) return color;
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) return color;
    return `rgba(${r}, ${g}, ${b}, ${a})`;
  }

  // Format rgb() / rgba()
  const rgbMatch = color.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
  if (rgbMatch) {
    return `rgba(${rgbMatch[1]}, ${rgbMatch[2]}, ${rgbMatch[3]}, ${a})`;
  }

  return color;
}
