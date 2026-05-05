// components/pdf/exportPhase.ts
// State machine pure pour BookExportModal (Phase 51-01).
// Aucun import React — fonction pure, testable en isolation.

import type { BookManifestEntry } from '../../lib/pdf';

/** Étapes de la phase `generating` (cf. RESEARCH §7 Approche A). */
export type GeneratingStep = 'assets' | 'render' | 'hash' | 'print';

/** Phase courante du modal d'export. */
export type ExportPhase =
  | { kind: 'select' }
  | { kind: 'generating'; step: GeneratingStep }
  | { kind: 'ready'; uri: string; perfMs: number; entry: BookManifestEntry }
  | { kind: 'post-export'; uri: string; storyTitle: string };

/** Actions du reducer. */
export type ExportAction =
  | { type: 'START_GENERATION' }
  | { type: 'STEP_ADVANCE'; step: GeneratingStep }
  | {
      type: 'GENERATION_DONE';
      uri: string;
      perfMs: number;
      entry: BookManifestEntry;
    }
  | { type: 'GENERATION_ERROR' }
  | { type: 'GO_POST_EXPORT'; uri: string; storyTitle: string }
  | { type: 'RESET' };

/** Phase initiale au mount du modal. */
export const INITIAL_PHASE: ExportPhase = { kind: 'select' };

/**
 * Reducer pur de la state machine d'export PDF.
 * Toute transition invalide retourne l'état inchangé (no-op + warn en __DEV__).
 */
export function exportPhaseReducer(
  state: ExportPhase,
  action: ExportAction,
): ExportPhase {
  // RESET est toujours valide depuis n'importe quel état.
  if (action.type === 'RESET') {
    return { kind: 'select' };
  }

  switch (state.kind) {
    case 'select': {
      if (action.type === 'START_GENERATION') {
        return { kind: 'generating', step: 'assets' };
      }
      break;
    }
    case 'generating': {
      if (action.type === 'STEP_ADVANCE') {
        return { kind: 'generating', step: action.step };
      }
      if (action.type === 'GENERATION_DONE') {
        return {
          kind: 'ready',
          uri: action.uri,
          perfMs: action.perfMs,
          entry: action.entry,
        };
      }
      if (action.type === 'GENERATION_ERROR') {
        return { kind: 'select' };
      }
      break;
    }
    case 'ready': {
      if (action.type === 'GO_POST_EXPORT') {
        return {
          kind: 'post-export',
          uri: action.uri,
          storyTitle: action.storyTitle,
        };
      }
      break;
    }
    case 'post-export': {
      // Seul RESET (déjà géré au-dessus) sort de post-export.
      break;
    }
  }

  if (__DEV__) {
    // eslint-disable-next-line no-console
    console.warn(
      '[BookExportModal] transition invalide',
      state.kind,
      action.type,
    );
  }
  return state;
}
