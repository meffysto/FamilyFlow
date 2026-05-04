// lib/__tests__/pdf-manifest-parser.test.ts
// Tests parser bidirectionnel du manifeste impressions Lulu Direct.

import {
  parseManifeste,
  serializeManifeste,
  MANIFESTE_FILE,
  type BookManifestEntry,
} from '../pdf';

const SAMPLE_THREE: BookManifestEntry[] = [
  {
    id: 'story_foret_2026',
    hash: 'a3f7c4d2e1b8f9a0c3d5e7b1f4a6c8d2e9b3f5a7c1d4e6b8f2a9c0d3e5b7f1a4',
    date: '2026-05-04',
    format: 'Lulu 21×21',
    chemin: '12 - Impressions/PDFs/foret-2026.pdf',
  },
  {
    id: 'story_pirates_2026',
    hash: '8e2b1f4a6c8d2e9b3f5a7c1d4e6b8f2a9c0d3e5b7f1a4a3f7c4d2e1b8f9a0c3d',
    date: '2026-05-10',
    format: 'Lulu 21×21',
    chemin: '12 - Impressions/PDFs/pirates-2026.pdf',
  },
  {
    id: 'story_dragons_2026',
    hash: 'cd91e8f2a4b6c0d3e5b7f1a4a3f7c4d2e1b8f9a0c3d5e7b1f4a6c8d2e9b3f5a7',
    date: '2026-05-12',
    format: 'Lulu 21×21',
    chemin: '12 - Impressions/PDFs/dragons-2026.pdf',
  },
];

describe('MANIFESTE_FILE', () => {
  it('pointe vers 12 - Impressions/manifeste.md', () => {
    expect(MANIFESTE_FILE).toBe('12 - Impressions/manifeste.md');
  });
});

describe('parseManifeste', () => {
  it('contenu vide → []', () => {
    expect(parseManifeste('')).toEqual([]);
    expect(parseManifeste('   \n\n  ')).toEqual([]);
  });

  it('frontmatter sans table → []', () => {
    const content = `---\nversion: 1\n---\n\n# Manifeste\n\nPas encore d'export.\n`;
    expect(parseManifeste(content)).toEqual([]);
  });

  it('parse 3 entrées depuis la table sérialisée', () => {
    const content = serializeManifeste(SAMPLE_THREE);
    const parsed = parseManifeste(content);
    expect(parsed).toHaveLength(3);
    expect(parsed[0].id).toBe('story_foret_2026');
    expect(parsed[2].chemin).toBe('12 - Impressions/PDFs/dragons-2026.pdf');
  });

  it('ignore silencieusement les lignes id vide ou header/separator', () => {
    const malformed = [
      '---',
      'version: 1',
      '---',
      '',
      '| ID histoire | Hash | Date | Format | Chemin |',
      '|-------------|------|------|--------|--------|',
      '|  |  |  |  |  |',
      '| story_ok | h1 | 2026-05-04 | Lulu 21×21 | a.pdf |',
    ].join('\n');
    const parsed = parseManifeste(malformed);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].id).toBe('story_ok');
  });
});

describe('serializeManifeste', () => {
  it('liste vide → frontmatter + header + table headers (pas de data)', () => {
    const out = serializeManifeste([]);
    expect(out).toContain('version: 1');
    expect(out).toContain('# Manifeste impressions');
    expect(out).toContain('| ID histoire | Hash | Date | Format | Chemin |');
    // Pas de ligne data : aucune ligne table autre que header/separator
    const dataRows = out
      .split('\n')
      .filter((l) => l.startsWith('|') && !l.includes('---') && !l.includes('ID histoire'));
    expect(dataRows).toHaveLength(0);
  });

  it('inclut le frontmatter version: 1 (migrations futures)', () => {
    const out = serializeManifeste(SAMPLE_THREE);
    expect(out.startsWith('---\n')).toBe(true);
    expect(out).toMatch(/version:\s*1/);
  });
});

describe('round-trip parse → serialize → parse (PDF-04)', () => {
  it('Test critique : 3 entrées identiques après round-trip (strict equality)', () => {
    const original: BookManifestEntry[] = SAMPLE_THREE;
    const serialized = serializeManifeste(original);
    const reparsed = parseManifeste(serialized);
    expect(reparsed).toEqual(original);
  });

  it('round-trip 1 seule entrée', () => {
    const single: BookManifestEntry[] = [SAMPLE_THREE[0]];
    expect(parseManifeste(serializeManifeste(single))).toEqual(single);
  });

  it('round-trip liste vide', () => {
    expect(parseManifeste(serializeManifeste([]))).toEqual([]);
  });
});
