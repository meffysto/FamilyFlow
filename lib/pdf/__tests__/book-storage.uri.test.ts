// lib/pdf/__tests__/book-storage.uri.test.ts
// Tests pour buildVaultPdfUri (Phase 51-02 — refactor public).
//
// Couverture :
//   - URI valide reconstruit depuis vaultPath + entry.chemin
//   - Path traversal (".." dans chemin) → throw
//   - Trailing slash sur vaultPath → pas de double slash

import type { VaultManager } from '../../vault';
import type { BookManifestEntry } from '../types';
import { buildVaultPdfUri } from '../book-storage';

const baseEntry: BookManifestEntry = {
  id: 'voyage-de-lucas',
  hash: 'abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789',
  date: '2026-05-04',
  format: 'Lulu 21×21',
  chemin: '12 - Impressions/PDFs/voyage-de-lucas-2026-05-04.pdf',
};

describe('buildVaultPdfUri', () => {
  it('reconstruit un URI file:// valide depuis vaultPath et entry.chemin', () => {
    const fakeVault = { vaultPath: '/tmp/vault' } as VaultManager;
    const uri = buildVaultPdfUri(fakeVault, baseEntry);
    expect(uri).toBe(
      'file:///tmp/vault/12 - Impressions/PDFs/voyage-de-lucas-2026-05-04.pdf',
    );
  });

  it('throw quand entry.chemin contient un path traversal (..)', () => {
    const fakeVault = { vaultPath: '/tmp/vault' } as VaultManager;
    expect(() =>
      buildVaultPdfUri(fakeVault, { ...baseEntry, chemin: '../etc/passwd' }),
    ).toThrow();
  });

  it("ne produit pas de double slash quand vaultPath se termine par '/'", () => {
    const fakeVault = { vaultPath: '/tmp/vault/' } as VaultManager;
    const uri = buildVaultPdfUri(fakeVault, baseEntry);
    expect(uri).not.toMatch(/\/\/12/);
    expect(uri).toBe(
      'file:///tmp/vault/12 - Impressions/PDFs/voyage-de-lucas-2026-05-04.pdf',
    );
  });
});
