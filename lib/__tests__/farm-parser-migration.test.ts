/**
 * Phase 53 — Tests de migration plotIndex positionnel → stable (FAM-22).
 *
 * Pré-Phase 53 : plot_levels = Array(getUnlockedPlotCount(treeStage) + 10).fill(1)
 * → length toujours rembourrée à baseCount + 10 (3,5,7,9,12 → 13,15,17,19,22).
 *
 * Bug FAM-22 : l'heuristique précédente (length - expCount - hasMega) inférait
 * un mauvais baseCount pour les arbres < legendaire avec mega + expansions
 * upgradés, déplaçant niveau et plants de la mega vers un slot d'expansion
 * et reset le slot stable mega 20 à 1.
 */
import { parseFarmProfile, serializeFarmProfile } from '../parser';
import { FIRST_EXPANSION_STABLE_INDEX, MEGA_STABLE_INDEX } from '../mascot/world-grid';

const farmTechExp5Mega = 'expansion-2,expansion-3'; // expCount=5, hasMega=true

describe('Phase 53 migration — heuristique baseCount (FAM-22)', () => {
  it('arbre (baseCount=7) + 5 expansions + mega niv 5 : mega remappée à index 20, slots base préservés', () => {
    // Layout pré-Phase 53 (positionnel) : [base0..base6, exp0..exp4, mega, padding×4] = length 17
    // base[0]=3 (upgradé), mega=5
    const plot_levels_raw = '3,1,1,1,1,1,1,1,1,1,1,1,5,1,1,1,1';
    const content = `# Farm — Lucas

farm_tech: ${farmTechExp5Mega}
plot_levels: ${plot_levels_raw}
`;
    const parsed = parseFarmProfile(content);
    expect(parsed.plotLevels).toBeDefined();
    const levels = parsed.plotLevels!;
    // Mega doit être au slot stable 20, niv 5
    expect(levels[MEGA_STABLE_INDEX]).toBe(5);
    // base[0] reste niv 3
    expect(levels[0]).toBe(3);
    // Slots base[7..11] doivent être 1 (pas de débordement d'expansion)
    for (let i = 7; i <= 11; i++) {
      expect(levels[i] ?? 1).toBe(1);
    }
    // Slots expansion stables (15..19) doivent être 1 (aucune expansion upgradée dans ce scénario)
    for (let i = FIRST_EXPANSION_STABLE_INDEX; i < FIRST_EXPANSION_STABLE_INDEX + 5; i++) {
      expect(levels[i] ?? 1).toBe(1);
    }
  });

  it('majestueux (baseCount=9) + 5 expansions + mega : layout length 19', () => {
    // [base0..base8, exp0..exp4, mega, padding×4] = length 19
    // mega upgradée niv 4 (index 14 positionnel)
    const arr = new Array(19).fill(1);
    arr[14] = 4; // mega
    arr[2] = 2;  // base[2] niv 2
    const content = `# Farm — Lucas

farm_tech: ${farmTechExp5Mega}
plot_levels: ${arr.join(',')}
`;
    const parsed = parseFarmProfile(content);
    const levels = parsed.plotLevels!;
    expect(levels[MEGA_STABLE_INDEX]).toBe(4);
    expect(levels[2]).toBe(2);
    // Slots base[9..11] (encore base si arbre non legendaire) — préservés à 1
    for (let i = 9; i <= 11; i++) {
      expect(levels[i] ?? 1).toBe(1);
    }
  });

  it('legendaire (baseCount=12) + 5 expansions + mega : layout length 22, no-op de base', () => {
    // [base0..base11, exp0..exp4, mega, padding×4] = length 22
    // base[5]=3, exp[2]=2 (positional index 14), mega=5 (positional index 17)
    const arr = new Array(22).fill(1);
    arr[5] = 3;
    arr[14] = 2; // exp[2] positionnel
    arr[17] = 5; // mega positionnel
    const content = `# Farm — Lucas

farm_tech: ${farmTechExp5Mega}
plot_levels: ${arr.join(',')}
`;
    const parsed = parseFarmProfile(content);
    const levels = parsed.plotLevels!;
    expect(levels[5]).toBe(3);
    expect(levels[FIRST_EXPANSION_STABLE_INDEX + 2]).toBe(2);
    expect(levels[MEGA_STABLE_INDEX]).toBe(5);
  });

  it('arbuste (baseCount=5) sans expansions + mega absente : layout length 15', () => {
    // [base0..base4, padding×10] = length 15
    const arr = new Array(15).fill(1);
    arr[3] = 4;
    const content = `# Farm — Lucas

plot_levels: ${arr.join(',')}
`;
    const parsed = parseFarmProfile(content);
    const levels = parsed.plotLevels!;
    expect(levels[3]).toBe(4);
    // Pas d'expansion ni mega → tous les slots ≥ 5 sont 1
    for (let i = 5; i < levels.length; i++) {
      expect(levels[i] ?? 1).toBe(1);
    }
  });

  it('migration crops : plotIndex positionnel mega → stable 20 (FAM-22 plants dans la mega)', () => {
    // arbre (baseCount=7) + 5 exp + mega ; un plant à plotIndex=12 (mega positionnel)
    const arr = new Array(17).fill(1);
    arr[12] = 5; // mega niv 5
    const content = `# Farm — Lucas

farm_tech: ${farmTechExp5Mega}
plot_levels: ${arr.join(',')}
farm_crops: 12:tomato:2:0:2026-05-08:
`;
    const parsed = parseFarmProfile(content);
    // Le plant doit avoir migré de plotIndex 12 → MEGA_STABLE_INDEX (20)
    expect(parsed.farmCrops).toContain(`${MEGA_STABLE_INDEX}:tomato`);
    expect(parsed.farmCrops).not.toMatch(/^12:tomato/);
  });

  it('migration crops : plotIndex positionnel d\'expansion → stable 15+offset', () => {
    // arbre (baseCount=7) + 5 exp + mega ; plant à plotIndex=9 (= exp[2] positionnel)
    const arr = new Array(17).fill(1);
    arr[12] = 1; // mega non upgradée pour ne pas biaiser maxNonOne
    arr[9] = 3;  // exp[2] niv 3
    const content = `# Farm — Lucas

farm_tech: ${farmTechExp5Mega}
plot_levels: ${arr.join(',')}
farm_crops: 9:carrot:1:0:2026-05-08:
`;
    const parsed = parseFarmProfile(content);
    // plotIndex 9 → offset 9 - 7 = 2 → FIRST_EXPANSION_STABLE_INDEX + 2 = 17
    expect(parsed.farmCrops).toContain(`${FIRST_EXPANSION_STABLE_INDEX + 2}:carrot`);
  });

  it('idempotence : un fichier déjà migré (farm_data_v: 2) ne re-migre pas', () => {
    // Données post-Phase 53 : mega au slot 20, base au slot 0
    const arr = new Array(21).fill(1);
    arr[0] = 3;
    arr[MEGA_STABLE_INDEX] = 5;
    const content = `# Farm — Lucas

farm_tech: ${farmTechExp5Mega}
farm_data_v: 2
plot_levels: ${arr.join(',')}
`;
    const parsed = parseFarmProfile(content);
    expect(parsed.plotLevels![0]).toBe(3);
    expect(parsed.plotLevels![MEGA_STABLE_INDEX]).toBe(5);
  });

  it('tableau vide / undefined : pas de crash, pas de plotLevels', () => {
    const content = '# Farm — Lucas\n\nfarm_tech: expansion-2,expansion-3\n';
    const parsed = parseFarmProfile(content);
    expect(parsed.plotLevels).toBeUndefined();
  });

  it('round-trip : sérialiser puis re-parser un profil migré conserve les niveaux', () => {
    const arr = new Array(17).fill(1);
    arr[0] = 3;
    arr[12] = 5; // mega positionnel
    const content = `# Farm — Lucas

farm_tech: ${farmTechExp5Mega}
plot_levels: ${arr.join(',')}
`;
    const migrated = parseFarmProfile(content);
    const reSerialized = serializeFarmProfile('Lucas', migrated);
    const reParsed = parseFarmProfile(reSerialized);
    expect(reParsed.plotLevels![0]).toBe(3);
    expect(reParsed.plotLevels![MEGA_STABLE_INDEX]).toBe(5);
  });
});
