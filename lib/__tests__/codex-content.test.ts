// lib/__tests__/codex-content.test.ts — Tests d'intégrité Phase 16 (CODEX-01..05)
//
// Garantit que CODEX_CONTENT reste aligné avec les constantes engine et les
// fichiers i18n (aucun drift possible entre le codex et la réalité du moteur).

import {
  CODEX_CONTENT,
  getCropStats,
  getAnimalStats,
  getBuildingStats,
  getCraftStats,
  getTechStats,
  getCompanionStats,
  getSagaStats,
  getQuestStats,
  getSeasonalStats,
} from '../codex/content';
import type {
  CropEntry,
  AnimalEntry,
  BuildingEntry,
  CraftEntry,
  TechEntry,
  CompanionEntry,
  SagaEntry,
  QuestEntry,
  SeasonalEntry,
} from '../codex/types';
import frCodex from '../../locales/fr/codex.json';
import enCodex from '../../locales/en/codex.json';

function hasNestedKey(obj: unknown, dottedPath: string): boolean {
  return (
    dottedPath.split('.').reduce<unknown>((o, k) => {
      if (o == null || typeof o !== 'object') return undefined;
      return (o as Record<string, unknown>)[k];
    }, obj) !== undefined
  );
}

describe('CODEX-01/02 — couverture des 11 catégories', () => {
  it('contient les 11 CodexKind distincts', () => {
    const kinds = new Set(CODEX_CONTENT.map((e) => e.kind));
    const expected = [
      'crop',
      'animal',
      'building',
      'craft',
      'tech',
      'companion',
      'loot',
      'seasonal',
      'saga',
      'quest',
      'adventure',
    ];
    expected.forEach((k) => expect(kinds.has(k as never)).toBe(true));
    expect(kinds.size).toBe(11);
  });

  it('contient au moins 100 entrées totales', () => {
    expect(CODEX_CONTENT.length).toBeGreaterThanOrEqual(100);
  });
});

describe('CODEX-01 — intégrité sourceId ↔ engine (anti-drift)', () => {
  it.each(CODEX_CONTENT.filter((e) => e.kind === 'crop') as CropEntry[])(
    'crop $sourceId existe dans CROP_CATALOG',
    (entry) => {
      expect(getCropStats(entry)).toBeDefined();
    },
  );
  it.each(CODEX_CONTENT.filter((e) => e.kind === 'animal') as AnimalEntry[])(
    'animal $sourceId existe dans INHABITANTS',
    (entry) => {
      // Certains animaux "saga only" peuvent ne pas être dans INHABITANTS
      // (sagaExclusive drop-only) — mais animals.ts dérive depuis INHABITANTS,
      // donc tous les AnimalEntry actuels doivent être résolubles.
      expect(getAnimalStats(entry)).toBeDefined();
    },
  );
  it.each(
    CODEX_CONTENT.filter((e) => e.kind === 'building') as BuildingEntry[],
  )('building $sourceId existe dans BUILDING_CATALOG', (entry) => {
    expect(getBuildingStats(entry)).toBeDefined();
  });
  it.each(CODEX_CONTENT.filter((e) => e.kind === 'craft') as CraftEntry[])(
    'craft $sourceId existe dans CRAFT_RECIPES',
    (entry) => {
      expect(getCraftStats(entry)).toBeDefined();
    },
  );
  it.each(CODEX_CONTENT.filter((e) => e.kind === 'tech') as TechEntry[])(
    'tech $sourceId existe dans TECH_TREE',
    (entry) => {
      expect(getTechStats(entry)).toBeDefined();
    },
  );
  it.each(
    CODEX_CONTENT.filter((e) => e.kind === 'companion') as CompanionEntry[],
  )('companion $sourceId existe dans COMPANION_SPECIES_CATALOG', (entry) => {
    expect(getCompanionStats(entry)).toBeDefined();
  });
  it.each(CODEX_CONTENT.filter((e) => e.kind === 'saga') as SagaEntry[])(
    'saga $sourceId existe dans SAGAS',
    (entry) => {
      expect(getSagaStats(entry)).toBeDefined();
    },
  );
  it.each(CODEX_CONTENT.filter((e) => e.kind === 'quest') as QuestEntry[])(
    'quest $sourceId existe dans ADVENTURES',
    (entry) => {
      expect(getQuestStats(entry)).toBeDefined();
    },
  );
  it.each(
    CODEX_CONTENT.filter((e) => e.kind === 'seasonal') as SeasonalEntry[],
  )('seasonal $sourceId existe dans SEASONAL_EVENT_DIALOGUES', (entry) => {
    expect(getSeasonalStats(entry)).toBeDefined();
  });
});

describe('D-18/D-20 — parité i18n FR/EN', () => {
  it.each(CODEX_CONTENT)('entry $id a nameKey et loreKey FR+EN', (entry) => {
    const nameKey = entry.nameKey.replace(/^codex\./, '');
    const loreKey = entry.loreKey.replace(/^codex\./, '');
    expect(hasNestedKey(frCodex, nameKey)).toBe(true);
    expect(hasNestedKey(enCodex, nameKey)).toBe(true);
    expect(hasNestedKey(frCodex, loreKey)).toBe(true);
    expect(hasNestedKey(enCodex, loreKey)).toBe(true);
  });
});

describe('CODEX-05 — dropOnly crops', () => {
  const expectedDropOnly = ['orchidee', 'rose_doree', 'truffe', 'fruit_dragon'];

  it.each(expectedDropOnly)(
    'crop %s est marqué dropOnly dans l\'engine',
    (sourceId) => {
      const entry = (
        CODEX_CONTENT.filter((e) => e.kind === 'crop') as CropEntry[]
      ).find((e) => e.sourceId === sourceId);
      expect(entry).toBeDefined();
      const stats = getCropStats(entry!);
      expect(stats?.dropOnly).toBe(true);
    },
  );

  it('les 4 crops dropOnly attendus sont présents dans le codex', () => {
    const dropOnlyInCodex = (
      CODEX_CONTENT.filter((e) => e.kind === 'crop') as CropEntry[]
    )
      .filter((e) => getCropStats(e)?.dropOnly === true)
      .map((e) => e.sourceId)
      .sort();
    expect(dropOnlyInCodex).toEqual([...expectedDropOnly].sort());
  });
});

describe('D-15 — animaux sagaExclusive → dropOnly', () => {
  it('chaque AnimalEntry avec dropOnly=true a sagaExclusive=true côté engine', () => {
    const entries = (
      CODEX_CONTENT.filter((e) => e.kind === 'animal') as AnimalEntry[]
    ).filter((e) => e.dropOnly);
    expect(entries.length).toBeGreaterThan(0);
    entries.forEach((entry) => {
      const stats = getAnimalStats(entry);
      expect(stats?.sagaExclusive).toBe(true);
    });
  });
});
