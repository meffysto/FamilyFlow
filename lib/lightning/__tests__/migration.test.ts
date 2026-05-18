/**
 * Tests migration single → family — REQ-11, Pitfall #9 (Phase 53).
 *
 * 4 cas couverts :
 *   A. Single seul → migration crée family, supprime single, return 'migrated'
 *   B. Family seule (single absent) → no-op family, supprime single (déjà absent), return 'family_exists'
 *   C. Single + family présents → family inchangée, supprime single, return 'family_exists' (Pitfall #9)
 *   D. Ni single ni family → no-op, return 'no_single'
 *
 * Idempotence : appeler migrateSingleToFamily() 2 fois d'affilée doit
 * produire le même état final.
 */

import * as SecureStore from 'expo-secure-store';
import { migrateSingleToFamily } from '../migration';
import { loadFamilyConfig, saveFamilyConfig } from '../family-credentials';
import { saveLnbitsConfig, loadLnbitsConfig } from '../credentials';
import type { FamilyLightningConfig } from '../types';

const SINGLE_KEY = 'lightning_lnbits_config_v1';
const FAMILY_KEY = 'lightning_family_config_v1';

beforeEach(async () => {
  await SecureStore.deleteItemAsync(SINGLE_KEY);
  await SecureStore.deleteItemAsync(FAMILY_KEY);
});

function familyFixture(overrides: Partial<FamilyLightningConfig> = {}): FamilyLightningConfig {
  return {
    baseUrl: 'https://family.lnbits.example',
    family: { name: 'Famille', invoiceKey: 'fam-inv', adminKey: 'fam-admin' },
    members: [
      { profileId: 'lucas', displayName: 'Lucas', invoiceKey: 'lucas-key' },
    ],
    triggerMode: 'instant',
    dailyCapPerMember: 1000,
    ...overrides,
  };
}

describe('migrateSingleToFamily — Cas A : single seul', () => {
  it('crée family minimale, supprime single, retourne migrated', async () => {
    await saveLnbitsConfig({ baseUrl: 'https://single.example', invoiceKey: 'single-inv' });

    const result = await migrateSingleToFamily();

    expect(result.migrated).toBe(true);
    expect(result.reason).toBe('migrated');

    const family = await loadFamilyConfig();
    expect(family).not.toBeNull();
    expect(family!.baseUrl).toBe('https://single.example');
    expect(family!.family.invoiceKey).toBe('single-inv');
    expect(family!.family.adminKey).toBe('');
    expect(family!.members).toEqual([]);
    expect(family!.triggerMode).toBe('instant');
    expect(family!.dailyCapPerMember).toBe(1000);

    expect(await loadLnbitsConfig()).toBeNull();
  });
});

describe('migrateSingleToFamily — Cas B : family seule', () => {
  it("retourne 'family_exists' et n'écrit pas la family", async () => {
    const original = familyFixture();
    await saveFamilyConfig(original);

    const result = await migrateSingleToFamily();

    expect(result.migrated).toBe(false);
    expect(result.reason).toBe('family_exists');

    const family = await loadFamilyConfig();
    expect(family!.members).toHaveLength(1);
    expect(family!.members[0].profileId).toBe('lucas');
    expect(family!.baseUrl).toBe(original.baseUrl);
  });
});

describe('migrateSingleToFamily — Cas C : single + family (Pitfall #9)', () => {
  it("conserve family intacte, supprime single, retourne 'family_exists'", async () => {
    const original = familyFixture({ baseUrl: 'https://kept.example' });
    await saveFamilyConfig(original);
    await saveLnbitsConfig({ baseUrl: 'https://attacker.example', invoiceKey: 'rogue-inv' });

    const result = await migrateSingleToFamily();

    expect(result.migrated).toBe(false);
    expect(result.reason).toBe('family_exists');

    const family = await loadFamilyConfig();
    // Family doit être 100% intacte — surtout la liste members.
    expect(family!.baseUrl).toBe('https://kept.example');
    expect(family!.members).toHaveLength(1);
    expect(family!.members[0].profileId).toBe('lucas');

    // Single supprimé (cleanup).
    expect(await loadLnbitsConfig()).toBeNull();
  });
});

describe('migrateSingleToFamily — Cas D : ni single ni family', () => {
  it("retourne 'no_single' sans rien écrire", async () => {
    const result = await migrateSingleToFamily();

    expect(result.migrated).toBe(false);
    expect(result.reason).toBe('no_single');

    expect(await loadFamilyConfig()).toBeNull();
    expect(await loadLnbitsConfig()).toBeNull();
  });
});

describe('migrateSingleToFamily — idempotence', () => {
  it('Cas A puis 2ᵉ appel → family_exists au 2ᵉ tour, single bien parti', async () => {
    await saveLnbitsConfig({ baseUrl: 'https://x', invoiceKey: 'k' });

    const r1 = await migrateSingleToFamily();
    expect(r1.reason).toBe('migrated');

    const r2 = await migrateSingleToFamily();
    expect(r2.reason).toBe('family_exists');

    const family = await loadFamilyConfig();
    expect(family).not.toBeNull();
    expect(family!.family.invoiceKey).toBe('k');
  });

  it('Cas B puis 2ᵉ appel → toujours family_exists', async () => {
    await saveFamilyConfig(familyFixture());
    const r1 = await migrateSingleToFamily();
    const r2 = await migrateSingleToFamily();
    expect(r1.reason).toBe('family_exists');
    expect(r2.reason).toBe('family_exists');
  });
});
