// lib/__tests__/village-parser.test.ts
// Tests unitaires du module village — parser bidirectionnel, grille, templates.
// Phase 25-02 — fondation-donnees-village (v1.4).
//
// Couvre : parseGardenFile, serializeGardenFile, appendContribution,
//          VILLAGE_GRID, OBJECTIVE_TEMPLATES, BASE_TARGET, computeWeekTarget.

import {
  parseGardenFile,
  serializeGardenFile,
  appendContribution,
  appendBuilding,
  VILLAGE_FILE,
  VILLAGE_GRID,
  OBJECTIVE_TEMPLATES,
  BASE_TARGET,
  computeWeekTarget,
  BUILDINGS_CATALOG,
  computeBuildingsToUnlock,
} from '../village';
import type { VillageData, VillageContribution, UnlockedBuilding } from '../village';

// ── Fixtures ─────────────────────────────────────────────────────────────────

/** Fichier jardin-familial.md complet avec frontmatter + 2 contributions + 1 historique */
const FULL_GARDEN_FILE = `---
version: 1
created: 2026-04-01
current_week_start: 2026-04-07
current_theme_index: 2
reward_claimed: false
---

## Contributions
- 2026-04-10T14:32:00 | profile-abc | harvest | 1
- 2026-04-10T15:10:00 | profile-xyz | task | 1

## Historique
- 2026-03-31 | cible:45 | total:52 | claimed:true
`;

/** VillageData correspondant au FULL_GARDEN_FILE */
const FULL_GARDEN_DATA: VillageData = {
  version: 1,
  createdAt: '2026-04-01',
  currentWeekStart: '2026-04-07',
  currentThemeIndex: 2,
  rewardClaimed: false,
  contributions: [
    { timestamp: '2026-04-10T14:32:00', profileId: 'profile-abc', type: 'harvest', amount: 1 },
    { timestamp: '2026-04-10T15:10:00', profileId: 'profile-xyz', type: 'task',    amount: 1 },
  ],
  pastWeeks: [
    { weekStart: '2026-03-31', target: 45, total: 52, claimed: true },
  ],
  unlockedBuildings: [],
};

/** Contribution de test */
const TEST_CONTRIBUTION: VillageContribution = {
  timestamp: '2026-04-11T09:00:00',
  profileId: 'profile-abc',
  type: 'task',
  amount: 1,
};

// ── parseGardenFile ───────────────────────────────────────────────────────────

describe('parseGardenFile', () => {
  it("retourne un VillageData par defaut valide quand content est vide ('')", () => {
    const result = parseGardenFile('');
    expect(result).toEqual({
      version: 1,
      createdAt: '',
      currentWeekStart: '',
      currentThemeIndex: 0,
      rewardClaimed: false,
      contributions: [],
      pastWeeks: [],
      unlockedBuildings: [],
    });
  });

  it('parse un fichier complet correctement (frontmatter + 2 contributions + 1 historique)', () => {
    const result = parseGardenFile(FULL_GARDEN_FILE);
    expect(result).toEqual(FULL_GARDEN_DATA);
  });

  it('ignore les lignes de contribution avec type invalide (ex: "invalid")', () => {
    const content = `---
version: 1
created: 2026-04-01
current_week_start: 2026-04-07
current_theme_index: 0
reward_claimed: false
---

## Contributions
- 2026-04-10T14:32:00 | profile-abc | invalid | 1
- 2026-04-10T15:10:00 | profile-xyz | harvest | 1

## Historique
`;
    const result = parseGardenFile(content);
    expect(result.contributions).toHaveLength(1);
    expect(result.contributions[0].type).toBe('harvest');
  });

  it('ignore les lignes de contribution avec amount NaN (ex: "abc")', () => {
    const content = `---
version: 1
created: 2026-04-01
current_week_start: 2026-04-07
current_theme_index: 0
reward_claimed: false
---

## Contributions
- 2026-04-10T14:32:00 | profile-abc | harvest | abc
- 2026-04-10T15:10:00 | profile-xyz | task | 1

## Historique
`;
    const result = parseGardenFile(content);
    expect(result.contributions).toHaveLength(1);
    expect(result.contributions[0].profileId).toBe('profile-xyz');
  });

  it('ignore les lignes malformees (moins de 4 parties separees par |)', () => {
    const content = `---
version: 1
created: 2026-04-01
current_week_start: 2026-04-07
current_theme_index: 0
reward_claimed: false
---

## Contributions
- malformed line without pipes
- 2026-04-10T14:32:00 | profile-abc | harvest
- 2026-04-10T15:10:00 | profile-xyz | task | 1

## Historique
`;
    const result = parseGardenFile(content);
    expect(result.contributions).toHaveLength(1);
    expect(result.contributions[0].profileId).toBe('profile-xyz');
  });
});

// ── serializeGardenFile ───────────────────────────────────────────────────────

describe('serializeGardenFile', () => {
  it('produit un frontmatter YAML valide (contient `---` en debut et fin)', () => {
    const result = serializeGardenFile(FULL_GARDEN_DATA);
    expect(result.startsWith('---\n')).toBe(true);
    // Le frontmatter se termine par ---
    const lines = result.split('\n');
    const closingDashIdx = lines.indexOf('---', 1);
    expect(closingDashIdx).toBeGreaterThan(1);
  });

  it('inclut toujours les sections `## Contributions` et `## Historique` meme vides', () => {
    const emptyData: VillageData = {
      version: 1,
      createdAt: '',
      currentWeekStart: '',
      currentThemeIndex: 0,
      rewardClaimed: false,
      contributions: [],
      pastWeeks: [],
      unlockedBuildings: [],
    };
    const result = serializeGardenFile(emptyData);
    expect(result).toContain('## Contributions');
    expect(result).toContain('## Historique');
  });

  it('formate les contributions en `- timestamp | profileId | type | amount`', () => {
    const result = serializeGardenFile(FULL_GARDEN_DATA);
    expect(result).toContain('- 2026-04-10T14:32:00 | profile-abc | harvest | 1');
    expect(result).toContain('- 2026-04-10T15:10:00 | profile-xyz | task | 1');
  });

  it("formate l'historique en `- weekStart | cible:N | total:N | claimed:bool`", () => {
    const result = serializeGardenFile(FULL_GARDEN_DATA);
    expect(result).toContain('- 2026-03-31 | cible:45 | total:52 | claimed:true');
  });
});

// ── round-trip ────────────────────────────────────────────────────────────────

describe('round-trip', () => {
  it('parseGardenFile(serializeGardenFile(data)) est egal a data', () => {
    const serialized = serializeGardenFile(FULL_GARDEN_DATA);
    const parsed = parseGardenFile(serialized);
    expect(parsed).toEqual(FULL_GARDEN_DATA);
  });
});

// ── appendContribution ────────────────────────────────────────────────────────

describe('appendContribution', () => {
  it('insere la ligne AVANT `## Historique` (pas en fin de fichier)', () => {
    const result = appendContribution(FULL_GARDEN_FILE, TEST_CONTRIBUTION);
    const lines = result.split('\n');
    const insertedIdx = lines.findIndex(l => l.includes('2026-04-11T09:00:00'));
    const historiqueIdx = lines.findIndex(l => l.trim().toLowerCase() === '## historique');
    expect(insertedIdx).toBeGreaterThan(-1);
    expect(historiqueIdx).toBeGreaterThan(-1);
    expect(insertedIdx).toBeLessThan(historiqueIdx);
  });

  it('cree la section `## Contributions` si elle est absente', () => {
    const contentWithoutContrib = `---
version: 1
created: 2026-04-01
current_week_start: 2026-04-07
current_theme_index: 0
reward_claimed: false
---

## Historique
- 2026-03-31 | cible:45 | total:52 | claimed:true
`;
    const result = appendContribution(contentWithoutContrib, TEST_CONTRIBUTION);
    expect(result).toContain('## Contributions');
    expect(result).toContain('2026-04-11T09:00:00');
  });

  it('preserve le contenu existant de la section Contributions', () => {
    const result = appendContribution(FULL_GARDEN_FILE, TEST_CONTRIBUTION);
    // Les 2 contributions existantes doivent toujours etre presentes
    expect(result).toContain('2026-04-10T14:32:00 | profile-abc | harvest | 1');
    expect(result).toContain('2026-04-10T15:10:00 | profile-xyz | task | 1');
    // La nouvelle contribution est aussi presente
    expect(result).toContain('2026-04-11T09:00:00 | profile-abc | task | 1');
  });
});

// ── VILLAGE_GRID ──────────────────────────────────────────────────────────────

describe('VILLAGE_GRID', () => {
  it('a exactement 19 elements (4 Phase 25 + 7 Phase 29 + 8 Phase 30)', () => {
    expect(VILLAGE_GRID).toHaveLength(19);
  });

  it("tous les IDs commencent par 'village_'", () => {
    const allPrefixed = VILLAGE_GRID.every(c => c.id.startsWith('village_'));
    expect(allPrefixed).toBe(true);
  });

  it('contient exactement 1 fountain, 2 stalls, 1 board', () => {
    const fountains = VILLAGE_GRID.filter(c => c.role === 'fountain');
    const stalls    = VILLAGE_GRID.filter(c => c.role === 'stall');
    const boards    = VILLAGE_GRID.filter(c => c.role === 'board');
    expect(fountains).toHaveLength(1);
    expect(stalls).toHaveLength(2);
    expect(boards).toHaveLength(1);
  });

  it('x et y sont entre 0 et 1 (inclus) pour tous les elements', () => {
    const allInBounds = VILLAGE_GRID.every(c => c.x >= 0 && c.x <= 1 && c.y >= 0 && c.y <= 1);
    expect(allInBounds).toBe(true);
  });
});

// ── templates ────────────────────────────────────────────────────────────────

describe('templates', () => {
  it('OBJECTIVE_TEMPLATES a 7 elements', () => {
    expect(OBJECTIVE_TEMPLATES).toHaveLength(7);
  });

  it('chaque template a id, name, icon, description non-vides', () => {
    for (const t of OBJECTIVE_TEMPLATES) {
      expect(t.id.length).toBeGreaterThan(0);
      expect(t.name.length).toBeGreaterThan(0);
      expect(t.icon.length).toBeGreaterThan(0);
      expect(t.description.length).toBeGreaterThan(0);
    }
  });

  it('BASE_TARGET vaut 15', () => {
    expect(BASE_TARGET).toBe(15);
  });

  it('computeWeekTarget(0) retourne 15 (min 1 profil effectif)', () => {
    expect(computeWeekTarget(0)).toBe(15);
  });

  it('computeWeekTarget(1) retourne 15', () => {
    expect(computeWeekTarget(1)).toBe(15);
  });

  it('computeWeekTarget(3) retourne 45', () => {
    expect(computeWeekTarget(3)).toBe(45);
  });

  // VILLAGE_FILE reference (smoke test)
  it('VILLAGE_FILE est une string non-vide', () => {
    expect(typeof VILLAGE_FILE).toBe('string');
    expect(VILLAGE_FILE.length).toBeGreaterThan(0);
  });
});

// ── BUILDINGS_CATALOG (Phase 30) ──────────────────────────────────────────────

describe('BUILDINGS_CATALOG (Phase 30)', () => {
  it('contient exactement 8 entrées', () => {
    expect(BUILDINGS_CATALOG).toHaveLength(8);
  });

  it('contient les ids attendus dans l ordre narratif', () => {
    expect(BUILDINGS_CATALOG.map(b => b.id)).toEqual([
      'puits', 'boulangerie', 'marche', 'cafe', 'forge', 'moulin', 'port', 'bibliotheque'
    ]);
  });

  it('contient les paliers exacts 100/300/700/1500/3000/6000/12000/25000', () => {
    expect(BUILDINGS_CATALOG.map(b => b.palier)).toEqual([
      100, 300, 700, 1500, 3000, 6000, 12000, 25000
    ]);
  });

  it('chaque entrée a un sprite défini (require résolu)', () => {
    // Note: en Jest le mock file-asset retourne 0 (falsy), donc on vérifie seulement
    // que la propriété existe et que le require n'a pas planté à l'import.
    for (const entry of BUILDINGS_CATALOG) {
      expect(entry).toHaveProperty('sprite');
      expect(entry.sprite).toBeDefined();
    }
  });
});

describe('computeBuildingsToUnlock (Phase 30)', () => {
  it('retourne [] si familyLifetimeLeaves < 100', () => {
    expect(computeBuildingsToUnlock(0, [])).toEqual([]);
    expect(computeBuildingsToUnlock(99, [])).toEqual([]);
  });

  it('retourne puits seul à 100 feuilles', () => {
    const result = computeBuildingsToUnlock(100, []);
    expect(result.map(r => r.id)).toEqual(['puits']);
  });

  it('retourne les 4 premiers à 1500 feuilles', () => {
    const result = computeBuildingsToUnlock(1500, []);
    expect(result.map(r => r.id)).toEqual(['puits', 'boulangerie', 'marche', 'cafe']);
  });

  it('retourne tous les 8 à 25000+ feuilles', () => {
    const result = computeBuildingsToUnlock(25000, []);
    expect(result).toHaveLength(8);
  });

  it('idempotence — skip les ids déjà débloqués', () => {
    const already = [
      { timestamp: '2026-04-12T00:00:00', buildingId: 'puits', palier: 100 },
      { timestamp: '2026-04-12T00:00:00', buildingId: 'boulangerie', palier: 300 },
    ];
    const result = computeBuildingsToUnlock(1500, already);
    expect(result.map(r => r.id)).toEqual(['marche', 'cafe']);
  });

  it('idempotence complète — tout débloqué → []', () => {
    const all = BUILDINGS_CATALOG.map(e => ({
      timestamp: '2026-04-12T00:00:00', buildingId: e.id, palier: e.palier
    }));
    expect(computeBuildingsToUnlock(99999, all)).toEqual([]);
  });
});

// ── computeBuildingsToUnlock — résilience (Phase 30, Plan 02) ────────────────

describe('computeBuildingsToUnlock — résilience (Phase 30)', () => {
  it('débloque exactement à la frontière du palier (familyLifetimeLeaves === palier)', () => {
    expect(computeBuildingsToUnlock(100, []).map(r => r.id)).toContain('puits');
    expect(computeBuildingsToUnlock(300, []).map(r => r.id)).toContain('boulangerie');
    expect(computeBuildingsToUnlock(25000, []).map(r => r.id)).toContain('bibliotheque');
  });

  it('ne débloque pas à palier - 1', () => {
    expect(computeBuildingsToUnlock(99, []).map(r => r.id)).not.toContain('puits');
    expect(computeBuildingsToUnlock(299, []).map(r => r.id)).not.toContain('boulangerie');
  });

  it('idempotent sur appels consécutifs — pas de double déblocage', () => {
    let unlocked: UnlockedBuilding[] = [];
    // Premier appel à 1500 feuilles — débloque puits, boulangerie, marché, café
    const first = computeBuildingsToUnlock(1500, unlocked);
    unlocked = [
      ...unlocked,
      ...first.map(e => ({
        timestamp: '2026-04-12T00:00:00',
        buildingId: e.id,
        palier: e.palier,
      })),
    ];
    expect(first).toHaveLength(4);

    // Deuxième appel à 1500 feuilles avec les précédents dans alreadyUnlocked
    const second = computeBuildingsToUnlock(1500, unlocked);
    expect(second).toHaveLength(0); // Idempotence stricte
  });

  it('retourne les bâtiments dans l ordre narratif BUILDINGS_CATALOG', () => {
    const result = computeBuildingsToUnlock(25000, []);
    expect(result.map(r => r.id)).toEqual([
      'puits', 'boulangerie', 'marche', 'cafe', 'forge', 'moulin', 'port', 'bibliotheque',
    ]);
  });

  it('gère un profil avec points undefined sans crash (simulation Pitfall 7)', () => {
    // Simulation du reduce dans useGarden avec profile.points undefined
    const profiles: Array<{ points: number | undefined }> = [
      { points: 500 },
      { points: undefined },
      { points: 1000 },
    ];
    const sum = profiles.reduce((acc, p) => acc + (p.points ?? 0), 0);
    expect(sum).toBe(1500);
    const result = computeBuildingsToUnlock(sum, []);
    expect(result.map(r => r.id)).toEqual(['puits', 'boulangerie', 'marche', 'cafe']);
  });
});

// ── parseGardenFile + serializeGardenFile — section Constructions (Phase 30) ──

describe('parseGardenFile + serializeGardenFile — section Constructions (Phase 30)', () => {
  it('retourne unlockedBuildings: [] pour contenu vide (backward compat)', () => {
    const data = parseGardenFile('');
    expect(data.unlockedBuildings).toEqual([]);
  });

  it('retourne unlockedBuildings: [] si section absente (vault legacy Phase 25)', () => {
    const content = [
      '---', 'version: 1', 'created: 2026-04-01', 'current_week_start: 2026-04-07',
      'current_theme_index: 0', 'reward_claimed: false', '---', '',
      '## Contributions',
      '- 2026-04-10T14:32:00 | profile-abc | harvest | 1',
      '',
      '## Historique',
      '- 2026-03-31 | cible:45 | total:52 | claimed:true',
      '',
    ].join('\n');
    const data = parseGardenFile(content);
    expect(data.unlockedBuildings).toEqual([]);
  });

  it('parse les lignes ## Constructions format timestamp | id | palier', () => {
    const content = [
      '---', 'version: 1', 'created: 2026-04-01', 'current_week_start: 2026-04-07',
      'current_theme_index: 0', 'reward_claimed: false', '---', '',
      '## Contributions', '',
      '## Constructions',
      '- 2026-04-12T14:32:00 | puits | 100',
      '- 2026-04-15T09:15:00 | boulangerie | 300',
      '',
      '## Historique', '',
    ].join('\n');
    const data = parseGardenFile(content);
    expect(data.unlockedBuildings).toEqual([
      { timestamp: '2026-04-12T14:32:00', buildingId: 'puits', palier: 100 },
      { timestamp: '2026-04-15T09:15:00', buildingId: 'boulangerie', palier: 300 },
    ]);
  });

  it('ignore silencieusement les lignes malformées', () => {
    const content = [
      '## Constructions',
      '- malformed',
      '- 2026-04-12T14:32:00 | puits | 100',
      '- too | few',
      '- 2026-04-13T00:00:00 | cafe | notanumber',
    ].join('\n');
    const data = parseGardenFile(content);
    expect(data.unlockedBuildings).toHaveLength(1);
    expect(data.unlockedBuildings[0].buildingId).toBe('puits');
  });

  it('serializeGardenFile émet section ## Constructions même vide', () => {
    const data: VillageData = {
      version: 1, createdAt: '2026-04-01', currentWeekStart: '2026-04-07',
      currentThemeIndex: 0, rewardClaimed: false,
      contributions: [], pastWeeks: [], unlockedBuildings: [],
    };
    const out = serializeGardenFile(data);
    expect(out).toContain('## Constructions');
    // Ordre : Contributions avant Constructions avant Historique
    expect(out.indexOf('## Contributions')).toBeLessThan(out.indexOf('## Constructions'));
    expect(out.indexOf('## Constructions')).toBeLessThan(out.indexOf('## Historique'));
  });

  it('round-trip fidelity pour unlockedBuildings', () => {
    const data: VillageData = {
      version: 1, createdAt: '2026-04-01', currentWeekStart: '2026-04-07',
      currentThemeIndex: 0, rewardClaimed: false,
      contributions: [], pastWeeks: [],
      unlockedBuildings: [
        { timestamp: '2026-04-12T14:32:00', buildingId: 'puits', palier: 100 },
        { timestamp: '2026-04-15T09:15:00', buildingId: 'boulangerie', palier: 300 },
      ],
    };
    const serialized = serializeGardenFile(data);
    const reparsed = parseGardenFile(serialized);
    expect(reparsed.unlockedBuildings).toEqual(data.unlockedBuildings);
  });
});

describe('appendBuilding (Phase 30)', () => {
  it('crée la section ## Constructions avant ## Historique si absente', () => {
    const content = [
      '## Contributions', '',
      '## Historique',
      '- 2026-03-31 | cible:45 | total:52 | claimed:true',
      '',
    ].join('\n');
    const out = appendBuilding(content, {
      timestamp: '2026-04-12T14:32:00', buildingId: 'puits', palier: 100,
    });
    expect(out).toContain('## Constructions');
    expect(out).toContain('- 2026-04-12T14:32:00 | puits | 100');
    expect(out.indexOf('## Constructions')).toBeLessThan(out.indexOf('## Historique'));
  });

  it('insère AVANT la prochaine section ## (jamais fin de fichier — Pitfall 3/4)', () => {
    const content = [
      '## Constructions',
      '- 2026-04-12T14:32:00 | puits | 100',
      '',
      '## Historique',
      '- 2026-03-31 | cible:45 | total:52 | claimed:true',
    ].join('\n');
    const out = appendBuilding(content, {
      timestamp: '2026-04-15T09:15:00', buildingId: 'boulangerie', palier: 300,
    });
    // La nouvelle ligne doit être APRÈS puits mais AVANT ## Historique
    const idxNew = out.indexOf('boulangerie');
    const idxHist = out.indexOf('## Historique');
    expect(idxNew).toBeGreaterThan(-1);
    expect(idxNew).toBeLessThan(idxHist);
  });

  it('préserve les lignes existantes', () => {
    const content = [
      '## Constructions',
      '- 2026-04-12T14:32:00 | puits | 100',
      '## Historique',
    ].join('\n');
    const out = appendBuilding(content, {
      timestamp: '2026-04-15T00:00:00', buildingId: 'boulangerie', palier: 300,
    });
    expect(out).toContain('- 2026-04-12T14:32:00 | puits | 100');
    expect(out).toContain('- 2026-04-15T00:00:00 | boulangerie | 300');
  });
});
