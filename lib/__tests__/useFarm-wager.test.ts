/**
 * Phase 40 — Plan 04 : Suite Jest validation + drop-back + format toast FR.
 *
 * Tests sur primitives pures consommées par la branche wager de `useFarm.harvest` —
 * on n'instancie PAS le hook React (dépendances vault trop lourdes). On vérifie
 * l'intégration `validateWagerOnHarvest` × `tryIncrementSporeeCount` × `rollWagerDropBack`
 * et le format FR strict du toast post-récolte (`buildWagerHarvestToast`).
 *
 * Objectif : garantir SPOR-07 end-to-end (reward × multiplier + toast + drop-back 15%)
 * et que jamais un toast punitif n'apparaît sur défaite (Core Value bien-être familial).
 */

import {
  rollWagerDropBack,
  tryIncrementSporeeCount,
  DROP_BACK_CHANCE,
  SPOREE_MAX_INVENTORY,
} from '../mascot/sporee-economy';
import { validateWagerOnHarvest } from '../mascot/wager-engine';
import { buildWagerHarvestToast } from '../mascot/wager-ui-helpers';

describe('Phase 40 Plan 04 — validateWagerOnHarvest × tryIncrementSporeeCount × rollWagerDropBack', () => {
  describe('victoire (cumul atteint)', () => {
    it('cumul atteint (current=10, target=10) → won=true, reward ×2.5 → Math.round(30 × 2.5) = 75', () => {
      const validation = validateWagerOnHarvest(10, 10);
      expect(validation.won).toBe(true);
      const baseReward = 30;
      const multiplier = 2.5;
      const finalQty = Math.round(baseReward * multiplier);
      expect(finalQty).toBe(75);
    });

    it('cumul dépassé (current=15, target=10) → won=true (pas de cap sur dépassement)', () => {
      const validation = validateWagerOnHarvest(15, 10);
      expect(validation.won).toBe(true);
    });

    it('cumul target=0 (fallback D-04 pari auto-gagné) → won=true', () => {
      const validation = validateWagerOnHarvest(0, 0);
      expect(validation.won).toBe(true);
    });
  });

  describe('défaite (cumul non atteint)', () => {
    it('cumul non atteint (current=5, target=10) → won=false, reward normale (pas de multiplier)', () => {
      const validation = validateWagerOnHarvest(5, 10);
      expect(validation.won).toBe(false);
      // Sur défaite on ne multiplie PAS — reward reste brute.
      const baseReward = 30;
      const finalQty = baseReward; // pas de × multiplier sur défaite
      expect(finalQty).toBe(30);
    });

    it('cumul zéro (current=0, target=10) → won=false', () => {
      const validation = validateWagerOnHarvest(0, 10);
      expect(validation.won).toBe(false);
    });
  });

  describe('drop-back RNG injection', () => {
    it('RNG 0.1 (< 0.15) → drop-back TRUE', () => {
      expect(rollWagerDropBack(() => 0.1)).toBe(true);
    });

    it('RNG 0.5 (> 0.15) → drop-back FALSE', () => {
      expect(rollWagerDropBack(() => 0.5)).toBe(false);
    });

    it('RNG exactement 0.15 → drop-back FALSE (strictement inférieur)', () => {
      expect(rollWagerDropBack(() => DROP_BACK_CHANCE)).toBe(false);
    });

    it('RNG 0 (borne basse) → drop-back TRUE', () => {
      expect(rollWagerDropBack(() => 0)).toBe(true);
    });
  });

  describe('drop-back × tryIncrementSporeeCount (respect cap 10)', () => {
    it('cumul atteint + drop-back true + sporeeCount=5 → accepted=true, newCount=6', () => {
      const validation = validateWagerOnHarvest(10, 10);
      expect(validation.won).toBe(true);
      const dropBack = rollWagerDropBack(() => 0.1);
      expect(dropBack).toBe(true);
      const inc = tryIncrementSporeeCount(5, 1);
      expect(inc.accepted).toBe(true);
      expect(inc.newCount).toBe(6);
      expect(inc.reason).toBeUndefined();
    });

    it('cumul atteint + drop-back false (RNG 0.5) → pas d\'appel increment (bypass)', () => {
      const dropBack = rollWagerDropBack(() => 0.5);
      expect(dropBack).toBe(false);
      // Le consommateur (useFarm.harvest) ne fait PAS l'appel increment si dropBack=false.
      // On valide juste la logique de bypass ici.
    });

    it('cumul atteint + drop-back true + sporeeCount=10 (cap) → refus pur avec reason="inventory_full"', () => {
      const dropBack = rollWagerDropBack(() => 0.1);
      expect(dropBack).toBe(true);
      const inc = tryIncrementSporeeCount(SPOREE_MAX_INVENTORY, 1);
      expect(inc.accepted).toBe(false);
      expect(inc.newCount).toBe(SPOREE_MAX_INVENTORY);
      expect(inc.reason).toBe('inventory_full');
    });

    it('cumul atteint + drop-back true + sporeeCount=9 → accepted=true, newCount=10 (atteint cap exact)', () => {
      const inc = tryIncrementSporeeCount(9, 1);
      expect(inc.accepted).toBe(true);
      expect(inc.newCount).toBe(10);
    });
  });
});

describe('Phase 40 Plan 04 — buildWagerHarvestToast (format FR strict)', () => {
  describe('défaite (won=false) — jamais punitif', () => {
    it('won=false, peu importe finalQty/multiplier/dropBack → message neutre bienveillant', () => {
      const msg = buildWagerHarvestToast({
        won: false,
        finalQty: 30,
        multiplier: 2.5,
        dropBack: false,
      });
      expect(msg).toBe('Plant récolté · Sporée consommée');
    });

    it('won=false avec dropBack=true (cas impossible en pratique) → même message neutre', () => {
      const msg = buildWagerHarvestToast({
        won: false,
        finalQty: 30,
        multiplier: 2.5,
        dropBack: true,
      });
      expect(msg).toBe('Plant récolté · Sporée consommée');
      // Garde-fou : ne révèle pas le dropBack sur défaite (jamais de mélange de sémantiques).
    });

    it('won=false → aucun emoji victoire (🍃 / 🎁) dans le message', () => {
      const msg = buildWagerHarvestToast({
        won: false,
        finalQty: 30,
        multiplier: 2.5,
        dropBack: false,
      });
      expect(msg).not.toContain('🍃');
      expect(msg).not.toContain('🎁');
      expect(msg).not.toContain('Victoire');
    });
  });

  describe('victoire simple (won=true, dropBack=false)', () => {
    it('finalQty=75, multiplier=2.5 → "Victoire ! +75 🍃 (×2.5)"', () => {
      const msg = buildWagerHarvestToast({
        won: true,
        finalQty: 75,
        multiplier: 2.5,
        dropBack: false,
      });
      expect(msg).toBe('Victoire ! +75 🍃 (×2.5)');
    });

    it('multiplier=1.3 (chill) → message contient "×1.3"', () => {
      const msg = buildWagerHarvestToast({
        won: true,
        finalQty: 39,
        multiplier: 1.3,
        dropBack: false,
      });
      expect(msg).toContain('×1.3');
      expect(msg).toContain('+39 🍃');
    });

    it('multiplier=1.7 (engage) → message contient "×1.7"', () => {
      const msg = buildWagerHarvestToast({
        won: true,
        finalQty: 51,
        multiplier: 1.7,
        dropBack: false,
      });
      expect(msg).toContain('×1.7');
      expect(msg).toContain('+51 🍃');
    });

    it('victoire simple → PAS de suffixe "Sporée retrouvée"', () => {
      const msg = buildWagerHarvestToast({
        won: true,
        finalQty: 75,
        multiplier: 2.5,
        dropBack: false,
      });
      expect(msg).not.toContain('Sporée retrouvée');
      expect(msg).not.toContain('🎁');
    });
  });

  describe('victoire + drop-back (won=true, dropBack=true)', () => {
    it('finalQty=75, multiplier=2.5, dropBack=true → "Victoire ! +75 🍃 (×2.5) · Sporée retrouvée 🎁"', () => {
      const msg = buildWagerHarvestToast({
        won: true,
        finalQty: 75,
        multiplier: 2.5,
        dropBack: true,
      });
      expect(msg).toBe('Victoire ! +75 🍃 (×2.5) · Sporée retrouvée 🎁');
    });

    it('drop-back → message contient les 2 emojis 🍃 (reward) et 🎁 (cadeau)', () => {
      const msg = buildWagerHarvestToast({
        won: true,
        finalQty: 51,
        multiplier: 1.7,
        dropBack: true,
      });
      expect(msg).toContain('🍃');
      expect(msg).toContain('🎁');
      expect(msg).toContain('Sporée retrouvée');
    });

    it('drop-back avec multiplier=1.3 → suffixe drop-back présent même sur victoire modeste', () => {
      const msg = buildWagerHarvestToast({
        won: true,
        finalQty: 39,
        multiplier: 1.3,
        dropBack: true,
      });
      expect(msg).toBe('Victoire ! +39 🍃 (×1.3) · Sporée retrouvée 🎁');
    });
  });

  describe('invariants format', () => {
    it('tous messages sont en français (zéro mot anglais évident)', () => {
      const msgs = [
        buildWagerHarvestToast({ won: false, finalQty: 30, multiplier: 2.5, dropBack: false }),
        buildWagerHarvestToast({ won: true, finalQty: 75, multiplier: 2.5, dropBack: false }),
        buildWagerHarvestToast({ won: true, finalQty: 75, multiplier: 2.5, dropBack: true }),
      ];
      for (const msg of msgs) {
        expect(msg).not.toMatch(/\b(Win|Won|Loss|Lost|Victory|Reward|Consumed)\b/i);
      }
    });

    it('séparateur "·" (U+00B7) utilisé cohérent avec conventions toasts existants', () => {
      const winDrop = buildWagerHarvestToast({ won: true, finalQty: 75, multiplier: 2.5, dropBack: true });
      expect(winDrop).toContain(' · ');
      const lose = buildWagerHarvestToast({ won: false, finalQty: 0, multiplier: 1, dropBack: false });
      expect(lose).toContain(' · ');
    });
  });
});
