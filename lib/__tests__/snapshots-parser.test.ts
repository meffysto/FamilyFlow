// Phase 39 Plan 01 — Tests trio snapshots (parseSnapshots / appendSnapshot / pruneSnapshots)
// Fonctions pures sur la section ## Snapshots du jardin-familial.md.

import {
  parseSnapshots,
  appendSnapshot,
  pruneSnapshots,
  type FamilySnapshot,
} from '../village/parser';

describe('parseSnapshots', () => {
  it('Test 1 : contenu vide → {} (objet vide)', () => {
    expect(parseSnapshots('')).toEqual({});
  });

  it('Test 2 : contenu sans ## Snapshots → {} (absence != throw)', () => {
    const content = `---\nversion: 1\n---\n\n## Contributions\n- 2026-04-10 | lucas_adulte | harvest | 1\n`;
    expect(parseSnapshots(content)).toEqual({});
  });

  it('Test 3 : 3 lignes YYYY-MM-DD:pending:ids → dictionnaire clé=date', () => {
    const content = `## Snapshots\n2026-04-16:5:lucas_adulte|emma_adulte\n2026-04-17:3:lucas_adulte\n2026-04-18:7:lucas_adulte|emma_adulte|papa_adulte\n`;
    const parsed = parseSnapshots(content);
    expect(Object.keys(parsed)).toHaveLength(3);
    expect(parsed['2026-04-16']).toEqual({
      date: '2026-04-16',
      pending: 5,
      activeProfileIds: ['lucas_adulte', 'emma_adulte'],
    });
    expect(parsed['2026-04-18'].activeProfileIds).toEqual(['lucas_adulte', 'emma_adulte', 'papa_adulte']);
  });

  it('Test 4 : ignore lignes mal formées silencieusement', () => {
    const content = `## Snapshots\n2026-04-16:abc:ids\nincomplete\n## Snapshots\n2026-04-17:3:lucas_adulte\n`;
    const parsed = parseSnapshots(content);
    // Seule la ligne 2026-04-17 est valide
    expect(Object.keys(parsed)).toEqual(['2026-04-17']);
  });

  it('Test 10 : activeProfileIds vide → ligne YYYY-MM-DD:5: → tableau []', () => {
    const content = `## Snapshots\n2026-04-18:5:\n`;
    const parsed = parseSnapshots(content);
    expect(parsed['2026-04-18']).toEqual({
      date: '2026-04-18',
      pending: 5,
      activeProfileIds: [],
    });
  });
});

describe('appendSnapshot', () => {
  const snap = (date: string, pending: number, ids: string[] = []): FamilySnapshot => ({
    date,
    pending,
    activeProfileIds: ids,
  });

  it('Test 5 : content sans ## Snapshots → crée section AVANT ## Historique', () => {
    const content = `---\nversion: 1\n---\n\n## Contributions\n- foo\n\n## Historique\n- bar\n`;
    const updated = appendSnapshot(content, snap('2026-04-18', 5, ['lucas_adulte']));
    expect(updated).toContain('## Snapshots');
    expect(updated).toContain('2026-04-18:5:lucas_adulte');
    const snapIdx = updated.indexOf('## Snapshots');
    const histIdx = updated.indexOf('## Historique');
    expect(snapIdx).toBeLessThan(histIdx);
  });

  it('Test 5bis : content sans ## Snapshots ni ## Historique → créé en fin', () => {
    const content = `---\nversion: 1\n---\n\n## Contributions\n- foo\n`;
    const updated = appendSnapshot(content, snap('2026-04-18', 5, ['lucas_adulte']));
    expect(updated).toContain('## Snapshots');
    expect(updated.indexOf('## Snapshots')).toBeGreaterThan(updated.indexOf('## Contributions'));
  });

  it('Test 6 : idempotent — même date 2× = une seule ligne (remplacement, pas duplication)', () => {
    const content = `## Snapshots\n2026-04-18:5:lucas_adulte\n`;
    const updated = appendSnapshot(content, snap('2026-04-18', 8, ['lucas_adulte', 'emma_adulte']));
    const parsed = parseSnapshots(updated);
    expect(Object.keys(parsed)).toHaveLength(1);
    expect(parsed['2026-04-18'].pending).toBe(8);
    expect(parsed['2026-04-18'].activeProfileIds).toEqual(['lucas_adulte', 'emma_adulte']);
  });

  it('Test 7 : section ## Snapshots existante + autre après → insère AVANT la prochaine (Pitfall 4)', () => {
    const content = `## Snapshots\n2026-04-16:3:lucas_adulte\n\n## Historique\n- keep me\n`;
    const updated = appendSnapshot(content, snap('2026-04-17', 7, ['emma_adulte']));
    const snapIdx = updated.indexOf('2026-04-17:7:emma_adulte');
    const histIdx = updated.indexOf('## Historique');
    expect(snapIdx).toBeGreaterThan(0);
    expect(snapIdx).toBeLessThan(histIdx);
    // Historique doit être préservée intégralement
    expect(updated).toContain('- keep me');
  });
});

describe('pruneSnapshots', () => {
  it('Test 8 : maxDays=14 conserve les 14 plus récentes, supprime les plus anciennes', () => {
    const snaps: Record<string, FamilySnapshot> = {};
    // 20 jours de snapshots, 2026-04-01 → 2026-04-20
    for (let d = 1; d <= 20; d++) {
      const date = `2026-04-${String(d).padStart(2, '0')}`;
      snaps[date] = { date, pending: d, activeProfileIds: [] };
    }
    const pruned = pruneSnapshots(snaps, '2026-04-20', 14);
    expect(Object.keys(pruned)).toHaveLength(14);
    // Cutoff : today - (14-1) = 2026-04-07
    expect(pruned['2026-04-07']).toBeDefined();
    expect(pruned['2026-04-06']).toBeUndefined();
    expect(pruned['2026-04-20']).toBeDefined();
  });

  it('Test 8bis : immutabilité — ne mute pas l\'entrée', () => {
    const snaps: Record<string, FamilySnapshot> = {
      '2026-04-01': { date: '2026-04-01', pending: 1, activeProfileIds: [] },
      '2026-04-18': { date: '2026-04-18', pending: 5, activeProfileIds: [] },
    };
    const pruned = pruneSnapshots(snaps, '2026-04-18', 14);
    expect(Object.keys(snaps)).toHaveLength(2); // entrée intacte
    expect(pruned).not.toBe(snaps);
  });
});

describe('round-trip', () => {
  it('Test 9 : appendSnapshot → parseSnapshots restitue le même objet', () => {
    const original: FamilySnapshot = {
      date: '2026-04-18',
      pending: 5,
      activeProfileIds: ['lucas_adulte', 'emma_adulte'],
    };
    const content = '';
    const updated = appendSnapshot(content, original);
    const parsed = parseSnapshots(updated);
    expect(parsed['2026-04-18']).toEqual(original);
  });

  it('round-trip avec activeProfileIds vide', () => {
    const original: FamilySnapshot = {
      date: '2026-04-18',
      pending: 3,
      activeProfileIds: [],
    };
    const updated = appendSnapshot('', original);
    const parsed = parseSnapshots(updated);
    expect(parsed['2026-04-18']).toEqual(original);
  });
});
