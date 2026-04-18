/**
 * Phase 38 (SPOR-13) — Round-trip farm parser avec champs sporee_*.
 * Privacy : noms génériques (Lucas/Emma/parent1).
 */
import { parseFarmProfile, serializeFarmProfile } from '../parser';
import type { FarmProfileData } from '../types';

describe('parseFarmProfile/serializeFarmProfile avec champs Sporée (Phase 38)', () => {
  const baseData: FarmProfileData = {
    mascotDecorations: [],
    mascotInhabitants: [],
    mascotPlacements: {},
  };

  it('parse profil legacy (pré-v1.7) : 4 champs sporee undefined', () => {
    const content = '# Farm — Lucas\n\nfarm_crops: 0:carrot:2:1:2026-04-18:\n';
    const parsed = parseFarmProfile(content);
    expect(parsed.sporeeCount).toBeUndefined();
    expect(parsed.sporeeShopBoughtToday).toBeUndefined();
    expect(parsed.sporeeShopLastResetDate).toBeUndefined();
    expect(parsed.sporeeOnboardingGiftClaimed).toBeUndefined();
  });

  it('parse sporee_count: 3', () => {
    const content = '# Farm — Lucas\n\nsporee_count: 3\n';
    expect(parseFarmProfile(content).sporeeCount).toBe(3);
  });

  it('parse sporee_shop_bought_today: 2', () => {
    const content = '# Farm — Lucas\n\nsporee_shop_bought_today: 2\n';
    expect(parseFarmProfile(content).sporeeShopBoughtToday).toBe(2);
  });

  it('parse sporee_shop_last_reset: 2026-04-18', () => {
    const content = '# Farm — Lucas\n\nsporee_shop_last_reset: 2026-04-18\n';
    expect(parseFarmProfile(content).sporeeShopLastResetDate).toBe('2026-04-18');
  });

  it('parse sporee_onboarding_gift_claimed: true', () => {
    const content = '# Farm — Lucas\n\nsporee_onboarding_gift_claimed: true\n';
    expect(parseFarmProfile(content).sporeeOnboardingGiftClaimed).toBe(true);
  });

  it('serialize sporeeCount=3 inclut ligne sporee_count: 3', () => {
    const content = serializeFarmProfile('Lucas', { ...baseData, sporeeCount: 3 });
    expect(content).toContain('sporee_count: 3');
  });

  it('serialize sporeeCount=0 ou undefined OMET la ligne', () => {
    const content0 = serializeFarmProfile('Lucas', { ...baseData, sporeeCount: 0 });
    expect(content0).not.toContain('sporee_count:');
    const contentU = serializeFarmProfile('Lucas', baseData);
    expect(contentU).not.toContain('sporee_count:');
  });

  it('serialize sporeeOnboardingGiftClaimed=false OMET la ligne (pas de bruit)', () => {
    const content = serializeFarmProfile('Lucas', { ...baseData, sporeeOnboardingGiftClaimed: false as any });
    expect(content).not.toContain('sporee_onboarding_gift_claimed');
  });

  it('serialize sporeeOnboardingGiftClaimed=true écrit la ligne', () => {
    const content = serializeFarmProfile('Lucas', { ...baseData, sporeeOnboardingGiftClaimed: true });
    expect(content).toContain('sporee_onboarding_gift_claimed: true');
  });

  it('round-trip deep-equal des 4 champs sporee', () => {
    const original: FarmProfileData = {
      ...baseData,
      sporeeCount: 7,
      sporeeShopBoughtToday: 1,
      sporeeShopLastResetDate: '2026-04-18',
      sporeeOnboardingGiftClaimed: true,
    };
    const content = serializeFarmProfile('Emma', original);
    const parsed = parseFarmProfile(content);
    expect(parsed.sporeeCount).toBe(7);
    expect(parsed.sporeeShopBoughtToday).toBe(1);
    expect(parsed.sporeeShopLastResetDate).toBe('2026-04-18');
    expect(parsed.sporeeOnboardingGiftClaimed).toBe(true);
  });
});
