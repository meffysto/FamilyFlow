// components/pdf/__tests__/BookExportModal.state.test.ts
// Tests unitaires du reducer pur de la state machine d'export PDF (Phase 51-01).

import {
  exportPhaseReducer,
  INITIAL_PHASE,
  type ExportPhase,
} from '../exportPhase';
import type { BookManifestEntry } from '../../../lib/pdf';

const FIXTURE_ENTRY: BookManifestEntry = {
  id: 'voyage-de-lucas',
  hash: 'abc123def456',
  date: '2026-05-05',
  format: 'Lulu 21×21',
  chemin: '12 - Impressions/PDFs/voyage-de-lucas-2026-05-05.pdf',
};

describe('exportPhaseReducer', () => {
  it('select + START_GENERATION → generating { step: assets }', () => {
    const next = exportPhaseReducer(INITIAL_PHASE, { type: 'START_GENERATION' });
    expect(next).toEqual({ kind: 'generating', step: 'assets' });
  });

  it('generating + STEP_ADVANCE { render } → generating { step: render }', () => {
    const state: ExportPhase = { kind: 'generating', step: 'assets' };
    const next = exportPhaseReducer(state, {
      type: 'STEP_ADVANCE',
      step: 'render',
    });
    expect(next).toEqual({ kind: 'generating', step: 'render' });
  });

  it('generating + GENERATION_DONE → ready avec uri/perfMs/entry', () => {
    const state: ExportPhase = { kind: 'generating', step: 'print' };
    const next = exportPhaseReducer(state, {
      type: 'GENERATION_DONE',
      uri: 'file:///cache/book.pdf',
      perfMs: 4200,
      entry: FIXTURE_ENTRY,
    });
    expect(next).toEqual({
      kind: 'ready',
      uri: 'file:///cache/book.pdf',
      perfMs: 4200,
      entry: FIXTURE_ENTRY,
    });
  });

  it('ready + GO_POST_EXPORT → post-export', () => {
    const state: ExportPhase = {
      kind: 'ready',
      uri: 'file:///cache/book.pdf',
      perfMs: 4200,
      entry: FIXTURE_ENTRY,
    };
    const next = exportPhaseReducer(state, {
      type: 'GO_POST_EXPORT',
      uri: 'file:///cache/book.pdf',
      storyTitle: 'Le voyage de Lucas',
    });
    expect(next).toEqual({
      kind: 'post-export',
      uri: 'file:///cache/book.pdf',
      storyTitle: 'Le voyage de Lucas',
    });
  });

  it('post-export + RESET → select', () => {
    const state: ExportPhase = {
      kind: 'post-export',
      uri: 'file:///cache/book.pdf',
      storyTitle: 'Le voyage de Lucas',
    };
    const next = exportPhaseReducer(state, { type: 'RESET' });
    expect(next).toEqual({ kind: 'select' });
  });

  it('select + STEP_ADVANCE → état inchangé (transition invalide)', () => {
    const next = exportPhaseReducer(INITIAL_PHASE, {
      type: 'STEP_ADVANCE',
      step: 'render',
    });
    expect(next).toBe(INITIAL_PHASE);
  });

  it('generating + GENERATION_ERROR → retour à select', () => {
    const state: ExportPhase = { kind: 'generating', step: 'render' };
    const next = exportPhaseReducer(state, { type: 'GENERATION_ERROR' });
    expect(next).toEqual({ kind: 'select' });
  });

  it('reducer ne mute pas l\'état entrant', () => {
    const state: ExportPhase = { kind: 'generating', step: 'assets' };
    const snapshot = JSON.parse(JSON.stringify(state));
    exportPhaseReducer(state, { type: 'STEP_ADVANCE', step: 'render' });
    expect(state).toEqual(snapshot);
  });
});
