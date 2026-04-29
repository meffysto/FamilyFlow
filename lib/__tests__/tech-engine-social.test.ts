import { canUnlockTech, getTechBonuses, TECH_TREE } from '../mascot/tech-engine';

describe('tech-engine — branche social (Phase 44)', () => {
  describe('TECH_TREE structure', () => {
    it('contient les 3 nœuds social-1/2/3', () => {
      const ids = TECH_TREE.map(n => n.id);
      expect(ids).toContain('social-1');
      expect(ids).toContain('social-2');
      expect(ids).toContain('social-3');
    });

    it('chaîne de prereqs : social-2 → social-1, social-3 → social-2', () => {
      const s1 = TECH_TREE.find(n => n.id === 'social-1')!;
      const s2 = TECH_TREE.find(n => n.id === 'social-2')!;
      const s3 = TECH_TREE.find(n => n.id === 'social-3')!;
      expect(s1.requires).toBeNull();
      expect(s2.requires).toBe('social-1');
      expect(s3.requires).toBe('social-2');
    });

    it('coûts : 300 / 1500 / 4000', () => {
      expect(TECH_TREE.find(n => n.id === 'social-1')!.cost).toBe(300);
      expect(TECH_TREE.find(n => n.id === 'social-2')!.cost).toBe(1500);
      expect(TECH_TREE.find(n => n.id === 'social-3')!.cost).toBe(4000);
    });

    it('tous les nœuds social-* ont branch="social" et order 1/2/3', () => {
      const s1 = TECH_TREE.find(n => n.id === 'social-1')!;
      const s2 = TECH_TREE.find(n => n.id === 'social-2')!;
      const s3 = TECH_TREE.find(n => n.id === 'social-3')!;
      expect(s1.branch).toBe('social');
      expect(s2.branch).toBe('social');
      expect(s3.branch).toBe('social');
      expect(s1.order).toBe(1);
      expect(s2.order).toBe(2);
      expect(s3.order).toBe(3);
    });
  });

  describe('canUnlockTech — gating', () => {
    it("social-1 débloquable d'emblée avec 300 feuilles", () => {
      expect(canUnlockTech('social-1', [], 300).canUnlock).toBe(true);
    });

    it('social-2 bloqué tant que social-1 non débloqué', () => {
      expect(canUnlockTech('social-2', [], 5000).canUnlock).toBe(false);
    });

    it('social-3 bloqué si social-2 manquant (même avec social-1)', () => {
      expect(canUnlockTech('social-3', ['social-1'], 5000).canUnlock).toBe(false);
    });

    it('social-3 débloquable après social-1 + social-2 + 4000 feuilles', () => {
      expect(canUnlockTech('social-3', ['social-1', 'social-2'], 4000).canUnlock).toBe(true);
    });

    it('social-1 bloqué si feuilles insuffisantes (< 300)', () => {
      expect(canUnlockTech('social-1', [], 299).canUnlock).toBe(false);
    });
  });

  describe('getTechBonuses — agrégation', () => {
    it('defaults : aubergeMaxActiveBonus=0, aubergeRewardMultiplier=1.0', () => {
      const b = getTechBonuses([]);
      expect(b.aubergeMaxActiveBonus).toBe(0);
      expect(b.aubergeRewardMultiplier).toBe(1.0);
    });

    it('social-1 seul → defaults inchangés (gating pur)', () => {
      const b = getTechBonuses(['social-1']);
      expect(b.aubergeMaxActiveBonus).toBe(0);
      expect(b.aubergeRewardMultiplier).toBe(1.0);
    });

    it('social-2 → aubergeMaxActiveBonus=1', () => {
      const b = getTechBonuses(['social-2']);
      expect(b.aubergeMaxActiveBonus).toBe(1);
      expect(b.aubergeRewardMultiplier).toBe(1.0);
    });

    it('social-3 → aubergeRewardMultiplier=1.2', () => {
      const b = getTechBonuses(['social-3']);
      expect(b.aubergeMaxActiveBonus).toBe(0);
      expect(b.aubergeRewardMultiplier).toBe(1.2);
    });

    it('social-1 + social-2 + social-3 → +1 cap, x1.2 reward', () => {
      const b = getTechBonuses(['social-1', 'social-2', 'social-3']);
      expect(b.aubergeMaxActiveBonus).toBe(1);
      expect(b.aubergeRewardMultiplier).toBe(1.2);
    });

    it('non-régression : techs non-social ne touchent pas aux champs auberge', () => {
      const b = getTechBonuses(['culture-1', 'elevage-2', 'expansion-1']);
      expect(b.aubergeMaxActiveBonus).toBe(0);
      expect(b.aubergeRewardMultiplier).toBe(1.0);
      // sanity-check des bonus historiques
      expect(b.tasksPerStageReduction).toBe(1);
      expect(b.buildingCapacityMultiplier).toBe(2);
      expect(b.extraBuildingCells).toBe(1);
    });
  });
});
