/**
 * allergen-banner.test.ts
 *
 * P0 SAFETY enforcement (PREF-11) — tests statiques TypeScript.
 *
 * Ces tests vérifient statiquement que AllergenBannerProps n'expose jamais
 * de prop dismiss. Si onDismiss / onClose / dismissible est ajouté au type,
 * le fichier ne compile plus (tsc --noEmit échoue) et le test Jest échoue.
 *
 * Engagement : toute PR ajoutant une API dismiss doit être rejetée.
 */
import type { AllergenBannerProps } from '../../components/dietary/AllergenBanner';

describe('AllergenBanner P0 SAFETY (PREF-11)', () => {
  it("AllergenBannerProps n'expose pas de prop 'onDismiss'", () => {
    type HasDismiss = 'onDismiss' extends keyof AllergenBannerProps ? true : false;
    // Si ce literal ne compile pas (erreur TS2322), onDismiss a été ajouté — REJECTER la PR.
    const check: HasDismiss = false;
    expect(check).toBe(false);
  });

  it("AllergenBannerProps n'expose pas de prop 'onClose'", () => {
    type HasClose = 'onClose' extends keyof AllergenBannerProps ? true : false;
    const check: HasClose = false;
    expect(check).toBe(false);
  });

  it("AllergenBannerProps n'expose pas de prop 'dismissible'", () => {
    type HasDismissible = 'dismissible' extends keyof AllergenBannerProps ? true : false;
    const check: HasDismissible = false;
    expect(check).toBe(false);
  });
});
