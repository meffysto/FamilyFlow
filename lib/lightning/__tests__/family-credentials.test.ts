/**
 * Tests family-credentials (Phase 53) — backward-compat children→members,
 * defaults triggerMode/dailyCapPerMember, clamp 100-10000, normalisation save.
 *
 * Le mock global expo-secure-store (jest.config.js moduleNameMapper) est
 * partagé entre tests — beforeEach nettoie la clé pour garantir l'isolation.
 */

import * as SecureStore from 'expo-secure-store';
import {
  loadFamilyConfig,
  saveFamilyConfig,
  clearFamilyConfig,
} from '../family-credentials';
import type { FamilyLightningConfig } from '../types';

const FAMILY_KEY = 'lightning_family_config_v1';

beforeEach(async () => {
  await SecureStore.deleteItemAsync(FAMILY_KEY);
});

describe('loadFamilyConfig — backward-compat REQ-12', () => {
  it('lit un JSON contenant `children` (legacy) et retourne `members` normalisés', async () => {
    const legacy = {
      baseUrl: 'https://demo.lnbits.com',
      family: { name: 'Famille', invoiceKey: 'fam-inv', adminKey: 'fam-admin' },
      children: [
        { profileId: 'lucas', displayName: 'Lucas', invoiceKey: 'lucas-inv' },
        { profileId: 'emma', displayName: 'Emma', invoiceKey: 'emma-inv' },
      ],
    };
    await SecureStore.setItemAsync(FAMILY_KEY, JSON.stringify(legacy));

    const cfg = await loadFamilyConfig();
    expect(cfg).not.toBeNull();
    expect(cfg!.members).toHaveLength(2);
    expect(cfg!.members[0]).toEqual({
      profileId: 'lucas',
      displayName: 'Lucas',
      invoiceKey: 'lucas-inv',
      adminKey: undefined,
    });
    expect(cfg!.members[1].profileId).toBe('emma');
  });

  it('lit un JSON contenant `members` (nouveau format) sans modification', async () => {
    const fresh = {
      baseUrl: 'https://demo.lnbits.com',
      family: { name: 'Famille', invoiceKey: 'fam-inv', adminKey: 'fam-admin' },
      members: [
        { profileId: 'lucas', displayName: 'Lucas', invoiceKey: 'lucas-inv', adminKey: 'lucas-admin' },
      ],
      triggerMode: 'hybrid',
      dailyCapPerMember: 500,
    };
    await SecureStore.setItemAsync(FAMILY_KEY, JSON.stringify(fresh));

    const cfg = await loadFamilyConfig();
    expect(cfg).not.toBeNull();
    expect(cfg!.members[0].adminKey).toBe('lucas-admin');
    expect(cfg!.triggerMode).toBe('hybrid');
    expect(cfg!.dailyCapPerMember).toBe(500);
  });

  it('préfère `members` quand les deux champs sont présents', async () => {
    const mixed = {
      baseUrl: 'https://demo.lnbits.com',
      family: { name: 'F', invoiceKey: 'i', adminKey: 'a' },
      members: [{ profileId: 'new', displayName: 'New', invoiceKey: 'k' }],
      children: [{ profileId: 'old', displayName: 'Old', invoiceKey: 'k2' }],
    };
    await SecureStore.setItemAsync(FAMILY_KEY, JSON.stringify(mixed));

    const cfg = await loadFamilyConfig();
    expect(cfg!.members).toHaveLength(1);
    expect(cfg!.members[0].profileId).toBe('new');
  });

  it('triggerMode default `instant` si absent', async () => {
    const noMode = {
      baseUrl: 'https://x',
      family: { name: 'F', invoiceKey: 'i', adminKey: 'a' },
      members: [],
    };
    await SecureStore.setItemAsync(FAMILY_KEY, JSON.stringify(noMode));
    const cfg = await loadFamilyConfig();
    expect(cfg!.triggerMode).toBe('instant');
  });

  it('triggerMode default `instant` si valeur invalide', async () => {
    const badMode = {
      baseUrl: 'https://x',
      family: { name: 'F', invoiceKey: 'i', adminKey: 'a' },
      members: [],
      triggerMode: 'something-else',
    };
    await SecureStore.setItemAsync(FAMILY_KEY, JSON.stringify(badMode));
    const cfg = await loadFamilyConfig();
    expect(cfg!.triggerMode).toBe('instant');
  });

  it('dailyCapPerMember default 1000 si absent', async () => {
    const noCap = {
      baseUrl: 'https://x',
      family: { name: 'F', invoiceKey: 'i', adminKey: 'a' },
      members: [],
    };
    await SecureStore.setItemAsync(FAMILY_KEY, JSON.stringify(noCap));
    const cfg = await loadFamilyConfig();
    expect(cfg!.dailyCapPerMember).toBe(1000);
  });

  it('dailyCapPerMember clampé à 100 (min)', async () => {
    const lowCap = {
      baseUrl: 'https://x',
      family: { name: 'F', invoiceKey: 'i', adminKey: 'a' },
      members: [],
      dailyCapPerMember: 50,
    };
    await SecureStore.setItemAsync(FAMILY_KEY, JSON.stringify(lowCap));
    const cfg = await loadFamilyConfig();
    expect(cfg!.dailyCapPerMember).toBe(100);
  });

  it('dailyCapPerMember clampé à 10000 (max)', async () => {
    const hiCap = {
      baseUrl: 'https://x',
      family: { name: 'F', invoiceKey: 'i', adminKey: 'a' },
      members: [],
      dailyCapPerMember: 50000,
    };
    await SecureStore.setItemAsync(FAMILY_KEY, JSON.stringify(hiCap));
    const cfg = await loadFamilyConfig();
    expect(cfg!.dailyCapPerMember).toBe(10000);
  });

  it('dailyCapPerMember default 1000 si non numérique', async () => {
    const badCap = {
      baseUrl: 'https://x',
      family: { name: 'F', invoiceKey: 'i', adminKey: 'a' },
      members: [],
      dailyCapPerMember: 'oops',
    };
    await SecureStore.setItemAsync(FAMILY_KEY, JSON.stringify(badCap));
    const cfg = await loadFamilyConfig();
    expect(cfg!.dailyCapPerMember).toBe(1000);
  });

  it('retourne null si shape de base invalide', async () => {
    await SecureStore.setItemAsync(FAMILY_KEY, JSON.stringify({ baseUrl: 'x' }));
    expect(await loadFamilyConfig()).toBeNull();
  });

  it('retourne null pour JSON corrompu', async () => {
    await SecureStore.setItemAsync(FAMILY_KEY, '{not json');
    expect(await loadFamilyConfig()).toBeNull();
  });

  it('retourne null si clé absente', async () => {
    expect(await loadFamilyConfig()).toBeNull();
  });

  it('filtre les members avec shape invalide', async () => {
    const cfg = {
      baseUrl: 'https://x',
      family: { name: 'F', invoiceKey: 'i', adminKey: 'a' },
      members: [
        { profileId: 'ok', displayName: 'OK', invoiceKey: 'k' },
        { profileId: 'bad' }, // shape incomplète
        null,
      ],
    };
    await SecureStore.setItemAsync(FAMILY_KEY, JSON.stringify(cfg));
    const loaded = await loadFamilyConfig();
    expect(loaded!.members).toHaveLength(1);
    expect(loaded!.members[0].profileId).toBe('ok');
  });
});

describe('saveFamilyConfig — toujours écrire `members` (REQ-12)', () => {
  it("écrit `members` dans le JSON SecureStore (jamais `children`)", async () => {
    const cfg: FamilyLightningConfig = {
      baseUrl: 'https://demo.lnbits.com',
      family: { name: 'Famille', invoiceKey: 'i', adminKey: 'a' },
      members: [{ profileId: 'lucas', displayName: 'Lucas', invoiceKey: 'k' }],
      triggerMode: 'instant',
      dailyCapPerMember: 1000,
    };
    await saveFamilyConfig(cfg);
    const raw = await SecureStore.getItemAsync(FAMILY_KEY);
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw!);
    expect(parsed.members).toBeDefined();
    expect(parsed.children).toBeUndefined();
  });

  it('normalise baseUrl (trim + retire trailing slash)', async () => {
    const cfg: FamilyLightningConfig = {
      baseUrl: '  https://x/  ',
      family: { name: '  Famille  ', invoiceKey: '  i  ', adminKey: '  a  ' },
      members: [],
      triggerMode: 'instant',
      dailyCapPerMember: 1000,
    };
    await saveFamilyConfig(cfg);
    const parsed = JSON.parse((await SecureStore.getItemAsync(FAMILY_KEY))!);
    expect(parsed.baseUrl).toBe('https://x');
    expect(parsed.family.name).toBe('Famille');
    expect(parsed.family.invoiceKey).toBe('i');
  });

  it('migration silencieuse : load legacy → save → relire en `members`', async () => {
    const legacy = {
      baseUrl: 'https://x',
      family: { name: 'F', invoiceKey: 'i', adminKey: 'a' },
      children: [{ profileId: 'lucas', displayName: 'Lucas', invoiceKey: 'k' }],
    };
    await SecureStore.setItemAsync(FAMILY_KEY, JSON.stringify(legacy));

    const cfg = await loadFamilyConfig();
    await saveFamilyConfig(cfg!);

    const reread = JSON.parse((await SecureStore.getItemAsync(FAMILY_KEY))!);
    expect(reread.members).toHaveLength(1);
    expect(reread.children).toBeUndefined();
  });

  it('omet adminKey si chaîne vide ou absente (REQ-10)', async () => {
    const cfg: FamilyLightningConfig = {
      baseUrl: 'https://x',
      family: { name: 'F', invoiceKey: 'i', adminKey: 'a' },
      members: [
        { profileId: 'l', displayName: 'L', invoiceKey: 'k', adminKey: '   ' },
        { profileId: 'e', displayName: 'E', invoiceKey: 'k2' },
      ],
      triggerMode: 'instant',
      dailyCapPerMember: 1000,
    };
    await saveFamilyConfig(cfg);
    const parsed = JSON.parse((await SecureStore.getItemAsync(FAMILY_KEY))!);
    expect(parsed.members[0].adminKey).toBeUndefined();
    expect(parsed.members[1].adminKey).toBeUndefined();
  });
});

describe('clearFamilyConfig', () => {
  it('supprime la clé SecureStore', async () => {
    await SecureStore.setItemAsync(FAMILY_KEY, '{"baseUrl":"x"}');
    await clearFamilyConfig();
    expect(await SecureStore.getItemAsync(FAMILY_KEY)).toBeNull();
  });
});
