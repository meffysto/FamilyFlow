/**
 * Tests Jest — lib/lovenotes/selectors.ts
 * Fixtures profils : 'lucas' / 'emma' / 'dupont' uniquement (privacy CLAUDE.md).
 */

import type { LoveNote } from '../types';
import {
  isRevealed,
  unreadForProfile,
  receivedForProfile,
  sentByProfile,
  archivedForProfile,
} from '../lovenotes/selectors';

const FIXED_NOW = new Date('2026-04-17T12:00:00');

function note(partial: Partial<LoveNote>): LoveNote {
  return {
    from: 'lucas',
    to: 'emma',
    createdAt: '2026-04-15T10:00:00',
    revealAt: '2026-04-16T10:00:00',
    status: 'revealed',
    body: 'message',
    sourceFile: `03 - Famille/LoveNotes/${partial.to ?? 'emma'}/2026-04-15-msg.md`,
    ...partial,
  };
}

describe('isRevealed', () => {
  it('renvoie true pour status revealed', () => {
    expect(isRevealed(note({ status: 'revealed' }), FIXED_NOW)).toBe(true);
  });

  it('renvoie true pour status read', () => {
    expect(isRevealed(note({ status: 'read' }), FIXED_NOW)).toBe(true);
  });

  it('renvoie true pour pending dont revealAt est passé (fallback)', () => {
    const n = note({ status: 'pending', revealAt: '2026-04-17T11:00:00' });
    expect(isRevealed(n, FIXED_NOW)).toBe(true);
  });

  it('renvoie false pour pending dont revealAt est futur', () => {
    const n = note({ status: 'pending', revealAt: '2026-04-18T10:00:00' });
    expect(isRevealed(n, FIXED_NOW)).toBe(false);
  });
});

describe('unreadForProfile', () => {
  it('exclut les notes lues', () => {
    const notes = [
      note({ to: 'emma', status: 'revealed', createdAt: '2026-04-15T10:00:00' }),
      note({ to: 'emma', status: 'read', createdAt: '2026-04-15T11:00:00' }),
    ];
    const out = unreadForProfile(notes, 'emma', FIXED_NOW);
    expect(out).toHaveLength(1);
    expect(out[0].status).toBe('revealed');
  });

  it('exclut les pending dont revealAt est futur', () => {
    const notes = [
      note({ to: 'emma', status: 'pending', revealAt: '2026-04-30T10:00:00' }),
      note({ to: 'emma', status: 'revealed' }),
    ];
    const out = unreadForProfile(notes, 'emma', FIXED_NOW);
    expect(out).toHaveLength(1);
    expect(out[0].status).toBe('revealed');
  });

  it('filtre par profileId destinataire', () => {
    const notes = [
      note({ to: 'emma', status: 'revealed' }),
      note({ to: 'lucas', status: 'revealed' }),
    ];
    const out = unreadForProfile(notes, 'emma', FIXED_NOW);
    expect(out).toHaveLength(1);
    expect(out[0].to).toBe('emma');
  });
});

describe('receivedForProfile', () => {
  it('filtre to === profileId', () => {
    const notes = [
      note({ to: 'emma' }),
      note({ to: 'lucas' }),
      note({ to: 'dupont' }),
    ];
    const out = receivedForProfile(notes, 'emma', FIXED_NOW);
    expect(out).toHaveLength(1);
    expect(out[0].to).toBe('emma');
  });

  it('tri 3-tier : revealed+unread → read → pending+futur', () => {
    const a = note({
      to: 'emma',
      status: 'revealed',
      createdAt: '2026-04-16T10:00:00',
      sourceFile: 'A.md',
    });
    const b = note({
      to: 'emma',
      status: 'read',
      createdAt: '2026-04-15T10:00:00',
      readAt: '2026-04-16T11:00:00',
      sourceFile: 'B.md',
    });
    const c = note({
      to: 'emma',
      status: 'pending',
      createdAt: '2026-04-17T11:00:00',
      revealAt: '2026-04-30T10:00:00',
      sourceFile: 'C.md',
    });
    const out = receivedForProfile([c, b, a], 'emma', FIXED_NOW);
    expect(out.map((n) => n.sourceFile)).toEqual(['A.md', 'B.md', 'C.md']);
  });

  it('tri createdAt desc à tier égal', () => {
    const older = note({
      to: 'emma',
      status: 'revealed',
      createdAt: '2026-04-10T10:00:00',
      sourceFile: 'old.md',
    });
    const newer = note({
      to: 'emma',
      status: 'revealed',
      createdAt: '2026-04-16T10:00:00',
      sourceFile: 'new.md',
    });
    const out = receivedForProfile([older, newer], 'emma', FIXED_NOW);
    expect(out[0].sourceFile).toBe('new.md');
    expect(out[1].sourceFile).toBe('old.md');
  });

  it('préserve la surprise : pending+futur reste en bas même si createdAt récent', () => {
    const pendingFuturRecent = note({
      to: 'emma',
      status: 'pending',
      createdAt: '2026-04-17T11:59:00', // tres recent
      revealAt: '2026-12-25T10:00:00',
      sourceFile: 'noel.md',
    });
    const revealedAncien = note({
      to: 'emma',
      status: 'revealed',
      createdAt: '2026-04-01T10:00:00',
      sourceFile: 'ancien.md',
    });
    const out = receivedForProfile([pendingFuturRecent, revealedAncien], 'emma', FIXED_NOW);
    expect(out[0].sourceFile).toBe('ancien.md');
    expect(out[1].sourceFile).toBe('noel.md');
  });
});

describe('sentByProfile', () => {
  it('filtre from === profileId', () => {
    const notes = [
      note({ from: 'lucas', to: 'emma' }),
      note({ from: 'emma', to: 'lucas' }),
    ];
    const out = sentByProfile(notes, 'lucas');
    expect(out).toHaveLength(1);
    expect(out[0].from).toBe('lucas');
  });

  it('tri createdAt desc', () => {
    const notes = [
      note({ from: 'lucas', createdAt: '2026-04-10T10:00:00', sourceFile: 'a.md' }),
      note({ from: 'lucas', createdAt: '2026-04-16T10:00:00', sourceFile: 'b.md' }),
    ];
    const out = sentByProfile(notes, 'lucas');
    expect(out[0].sourceFile).toBe('b.md');
  });
});

describe('archivedForProfile', () => {
  it('inclut les notes reçues archivées', () => {
    const notes = [
      note({ to: 'emma', from: 'lucas', status: 'archived', readAt: '2026-04-16T10:00:00' }),
      note({ to: 'emma', from: 'lucas', status: 'revealed' }),
    ];
    const out = archivedForProfile(notes, 'emma');
    expect(out).toHaveLength(1);
    expect(out[0].status).toBe('archived');
  });

  it('inclut les notes envoyées archivées (par expéditeur)', () => {
    const notes = [
      note({ from: 'lucas', to: 'emma', status: 'archived', readAt: '2026-04-16T10:00:00' }),
    ];
    const out = archivedForProfile(notes, 'lucas');
    expect(out).toHaveLength(1);
    expect(out[0].from).toBe('lucas');
  });

  it('tri readAt desc (fallback createdAt)', () => {
    const notes = [
      note({
        to: 'emma',
        status: 'archived',
        readAt: '2026-04-10T10:00:00',
        sourceFile: 'old.md',
      }),
      note({
        to: 'emma',
        status: 'archived',
        readAt: '2026-04-16T10:00:00',
        sourceFile: 'new.md',
      }),
    ];
    const out = archivedForProfile(notes, 'emma');
    expect(out[0].sourceFile).toBe('new.md');
  });
});

describe('edge cases', () => {
  it('profil inconnu retourne []', () => {
    const notes = [note({ to: 'emma' })];
    expect(receivedForProfile(notes, 'inconnu', FIXED_NOW)).toEqual([]);
    expect(sentByProfile(notes, 'inconnu')).toEqual([]);
    expect(unreadForProfile(notes, 'inconnu', FIXED_NOW)).toEqual([]);
    expect(archivedForProfile(notes, 'inconnu')).toEqual([]);
  });

  it('tableau vide retourne []', () => {
    expect(receivedForProfile([], 'emma', FIXED_NOW)).toEqual([]);
    expect(sentByProfile([], 'emma')).toEqual([]);
    expect(unreadForProfile([], 'emma', FIXED_NOW)).toEqual([]);
    expect(archivedForProfile([], 'emma')).toEqual([]);
  });

  it('now injecté permet des tests déterministes', () => {
    const n = note({ status: 'pending', revealAt: '2026-04-17T12:00:00' });
    // Avec now anterieur de 1h : pas encore revealed
    expect(isRevealed(n, new Date('2026-04-17T11:00:00'))).toBe(false);
    // Avec now exact : revealed (revealAt <= now)
    expect(isRevealed(n, new Date('2026-04-17T12:00:00'))).toBe(true);
  });
});
