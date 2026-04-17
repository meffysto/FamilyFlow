// lib/__tests__/parser-lovenotes.test.ts
// Tests unitaires du parser LoveNote — parse/serialize roundtrip, helpers path,
// listing par destinataire. Phase 34-02 — fondation-donnees-hook-domaine (v1.6).
//
// Couvre : parseLoveNote, serializeLoveNote, round-trip fidelity, loveNoteFileName
//          (collision-safe a la ms), loveNotePath (classement par destinataire),
//          listing/filtrage par recipient et tri createdAt desc (LOVE-17).

import {
  parseLoveNote,
  serializeLoveNote,
  loveNoteFileName,
  loveNotePath,
  LOVENOTES_DIR,
} from '../parser';
import type { LoveNote } from '../types';

// ── Fixtures ─────────────────────────────────────────────────────────────────

/** Fichier love note complet valide (status=pending, pas de readAt) */
const FULL_LOVENOTE_FILE = `---
from: "lucas"
to: "emma"
createdAt: "2026-04-16T14:32:17"
revealAt: "2026-04-20T08:00:00"
status: "pending"
---

Joyeux anniversaire ma cherie, je t'aime.
`;

/** Donnees correspondant a FULL_LOVENOTE_FILE (sans sourceFile) */
const FULL_LOVENOTE_DATA: Omit<LoveNote, 'sourceFile'> = {
  from: 'lucas',
  to: 'emma',
  createdAt: '2026-04-16T14:32:17',
  revealAt: '2026-04-20T08:00:00',
  status: 'pending',
  body: "Joyeux anniversaire ma cherie, je t'aime.",
};

/** Love note lue (status=read avec readAt present) */
const READ_LOVENOTE_DATA: Omit<LoveNote, 'sourceFile'> = {
  from: 'emma',
  to: 'lucas',
  createdAt: '2026-04-16T14:32:17',
  revealAt: '2026-04-16T14:32:17',
  status: 'read',
  readAt: '2026-04-16T15:00:00',
  body: 'Merci mon amour.',
};

/** Chemin relatif d'exemple (utilise en round-trip) */
const SAMPLE_RELATIVE_PATH = '03 - Famille/LoveNotes/emma/2026-04-16-abc.md';

// ── parseLoveNote ────────────────────────────────────────────────────────────

describe('parseLoveNote', () => {
  it('parse un fichier complet valide (status=pending)', () => {
    const result = parseLoveNote(SAMPLE_RELATIVE_PATH, FULL_LOVENOTE_FILE);
    expect(result).not.toBeNull();
    expect(result?.from).toBe('lucas');
    expect(result?.to).toBe('emma');
    expect(result?.createdAt).toBe('2026-04-16T14:32:17');
    expect(result?.revealAt).toBe('2026-04-20T08:00:00');
    expect(result?.status).toBe('pending');
    expect(result?.readAt).toBeUndefined();
    expect(result?.body).toBe("Joyeux anniversaire ma cherie, je t'aime.");
    expect(result?.sourceFile).toBe(SAMPLE_RELATIVE_PATH);
  });

  it('parse un fichier valide avec status=read et readAt present', () => {
    const content = `---
from: "emma"
to: "lucas"
createdAt: "2026-04-16T14:32:17"
revealAt: "2026-04-16T14:32:17"
status: "read"
readAt: "2026-04-16T15:00:00"
---

Merci mon amour.
`;
    const result = parseLoveNote(SAMPLE_RELATIVE_PATH, content);
    expect(result).not.toBeNull();
    expect(result?.status).toBe('read');
    // readAt doit etre lu comme string (pas comme Date)
    expect(typeof result?.readAt).toBe('string');
    expect(result?.readAt).toBe('2026-04-16T15:00:00');
  });

  it('retourne null si le frontmatter manque le champ from', () => {
    const content = `---
to: "emma"
createdAt: "2026-04-16T14:32:17"
revealAt: "2026-04-20T08:00:00"
status: "pending"
---

Body.
`;
    expect(parseLoveNote(SAMPLE_RELATIVE_PATH, content)).toBeNull();
  });

  it('retourne null si le status est invalide (hors enum)', () => {
    const content = `---
from: "lucas"
to: "emma"
createdAt: "2026-04-16T14:32:17"
revealAt: "2026-04-20T08:00:00"
status: "unknown"
---

Body.
`;
    expect(parseLoveNote(SAMPLE_RELATIVE_PATH, content)).toBeNull();
  });

  it('accepte un body vide (frontmatter seul)', () => {
    const content = `---
from: "lucas"
to: "emma"
createdAt: "2026-04-16T14:32:17"
revealAt: "2026-04-20T08:00:00"
status: "pending"
---

`;
    const result = parseLoveNote(SAMPLE_RELATIVE_PATH, content);
    expect(result).not.toBeNull();
    expect(result?.body).toBe('');
  });

  it('trim le body (whitespace leading/trailing supprime)', () => {
    const content = `---
from: "lucas"
to: "emma"
createdAt: "2026-04-16T14:32:17"
revealAt: "2026-04-20T08:00:00"
status: "pending"
---


   Message avec espaces autour.


`;
    const result = parseLoveNote(SAMPLE_RELATIVE_PATH, content);
    expect(result).not.toBeNull();
    expect(result?.body).toBe('Message avec espaces autour.');
  });
});

// ── serializeLoveNote ────────────────────────────────────────────────────────

describe('serializeLoveNote', () => {
  it('produit un frontmatter YAML valide avec delimitateurs ---', () => {
    const result = serializeLoveNote(FULL_LOVENOTE_DATA);
    expect(result).toMatch(/^---\n/);
    // Doit contenir un second --- avant le body
    expect(result).toContain('\n---\n');
  });

  it('inclut tous les champs requis avec guillemets', () => {
    const result = serializeLoveNote(FULL_LOVENOTE_DATA);
    expect(result).toContain('from: "lucas"');
    expect(result).toContain('to: "emma"');
    expect(result).toContain('createdAt: "2026-04-16T14:32:17"');
    expect(result).toContain('revealAt: "2026-04-20T08:00:00"');
    expect(result).toContain('status: "pending"');
  });

  it("n'inclut PAS readAt si non defini (pas de literal 'undefined')", () => {
    const result = serializeLoveNote(FULL_LOVENOTE_DATA);
    // Pitfall 7 : jamais de 'readAt: "undefined"' ou 'readAt:' dans la sortie
    expect(result).not.toContain('readAt');
    expect(result).not.toContain('undefined');
  });

  it('preserve le body markdown intact (accents FR, newlines, caracteres speciaux)', () => {
    const data: Omit<LoveNote, 'sourceFile'> = {
      from: 'lucas',
      to: 'emma',
      createdAt: '2026-04-16T14:32:17',
      revealAt: '2026-04-20T08:00:00',
      status: 'pending',
      body: 'Ligne 1 avec accents: été à côté.\nLigne 2 — tiret cadratin.\n**Gras** et *italique*.',
    };
    const result = serializeLoveNote(data);
    expect(result).toContain('Ligne 1 avec accents: été à côté.');
    expect(result).toContain('Ligne 2 — tiret cadratin.');
    expect(result).toContain('**Gras** et *italique*.');
  });
});

// ── Round-trip parseLoveNote(serializeLoveNote(data)) ────────────────────────

describe('round-trip parseLoveNote(serializeLoveNote(data))', () => {
  it('preserve une note complete (status=read avec readAt) — loss-less', () => {
    const serialized = serializeLoveNote(READ_LOVENOTE_DATA);
    const parsed = parseLoveNote(SAMPLE_RELATIVE_PATH, serialized);
    expect(parsed).toEqual({
      ...READ_LOVENOTE_DATA,
      sourceFile: SAMPLE_RELATIVE_PATH,
    });
  });

  it('preserve une note pending sans readAt (readAt reste undefined)', () => {
    const serialized = serializeLoveNote(FULL_LOVENOTE_DATA);
    const parsed = parseLoveNote(SAMPLE_RELATIVE_PATH, serialized);
    expect(parsed).not.toBeNull();
    expect(parsed?.readAt).toBeUndefined();
    expect(parsed).toEqual({
      ...FULL_LOVENOTE_DATA,
      sourceFile: SAMPLE_RELATIVE_PATH,
    });
  });
});

// ── loveNoteFileName ─────────────────────────────────────────────────────────

describe('loveNoteFileName', () => {
  it('genere un nom .md deterministe depuis createdAt (format YYYY-MM-DD-{suffix}.md)', () => {
    const name1 = loveNoteFileName('2026-04-16T14:32:17');
    const name2 = loveNoteFileName('2026-04-16T14:32:17');
    // Meme input -> meme output
    expect(name1).toBe(name2);
    // Format attendu
    expect(name1).toMatch(/^2026-04-16-[a-z0-9]+\.md$/);
  });

  it("genere deux filenames distincts pour deux createdAt differant d'1ms (collision-safe)", () => {
    // Pitfall 3 : collision-safe a la milliseconde pres
    const name1 = loveNoteFileName('2026-04-16T14:32:17.123');
    const name2 = loveNoteFileName('2026-04-16T14:32:17.124');
    expect(name1).not.toEqual(name2);
  });
});

// ── loveNotePath ─────────────────────────────────────────────────────────────

describe('loveNotePath', () => {
  it("construit le chemin '03 - Famille/LoveNotes/{to}/{slug}.md' avec LOVENOTES_DIR prefix", () => {
    const path = loveNotePath('emma', '2026-04-16T14:32:17');
    expect(path).toMatch(/^03 - Famille\/LoveNotes\/emma\/2026-04-16-.+\.md$/);
    expect(path.startsWith(LOVENOTES_DIR)).toBe(true);
  });

  it('respecte le toProfileId (destinataires differents -> dossiers differents)', () => {
    const t = '2026-04-16T14:32:17';
    const pathEmma = loveNotePath('emma', t);
    const pathLucas = loveNotePath('lucas', t);
    expect(pathEmma).not.toEqual(pathLucas);
    expect(pathEmma).toContain('/emma/');
    expect(pathLucas).toContain('/lucas/');
  });
});

// ── Listing par destinataire (LOVE-17) ────────────────────────────────────────

describe('listing par destinataire (LOVE-17)', () => {
  /** Trois notes vers deux destinataires — fixture de listing */
  const notes: LoveNote[] = [
    {
      from: 'lucas',
      to: 'emma',
      createdAt: '2026-04-16T14:32:17',
      revealAt: '2026-04-20T08:00:00',
      status: 'pending',
      body: 'Note 1 pour emma.',
      sourceFile: '03 - Famille/LoveNotes/emma/2026-04-16-a.md',
    },
    {
      from: 'emma',
      to: 'lucas',
      createdAt: '2026-04-15T10:00:00',
      revealAt: '2026-04-18T09:00:00',
      status: 'revealed',
      body: 'Note pour lucas.',
      sourceFile: '03 - Famille/LoveNotes/lucas/2026-04-15-b.md',
    },
    {
      from: 'lucas',
      to: 'emma',
      createdAt: '2026-04-17T09:15:00',
      revealAt: '2026-04-25T08:00:00',
      status: 'pending',
      body: 'Note 2 pour emma.',
      sourceFile: '03 - Famille/LoveNotes/emma/2026-04-17-c.md',
    },
  ];

  it('filter by recipient — retourne uniquement les notes pour un destinataire donne', () => {
    const forEmma = notes.filter((n) => n.to === 'emma');
    expect(forEmma).toHaveLength(2);
    expect(forEmma.every((n) => n.to === 'emma')).toBe(true);

    const forLucas = notes.filter((n) => n.to === 'lucas');
    expect(forLucas).toHaveLength(1);
    expect(forLucas[0].from).toBe('emma');
  });

  it('tri par createdAt desc — la plus recente en premier (pattern consomme par Plan 03)', () => {
    const sorted = [...notes].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    expect(sorted[0].createdAt).toBe('2026-04-17T09:15:00');
    expect(sorted[1].createdAt).toBe('2026-04-16T14:32:17');
    expect(sorted[2].createdAt).toBe('2026-04-15T10:00:00');
  });
});
