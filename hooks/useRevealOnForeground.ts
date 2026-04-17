/**
 * useRevealOnForeground.ts — Bascule auto pending → revealed (Phase 36 Plan 01)
 *
 * Au mount + a chaque retour app foreground, scanne loveNotes :
 * pour chaque note `pending` dont revealAt est passe (filet de securite
 * complementaire a la notif), appelle updateStatus(sourceFile, 'revealed').
 *
 * Idempotent : updateLoveNoteStatus relit le fichier avant patch (Phase 34).
 * Brancher UNIQUEMENT dans app/(tabs)/lovenotes.tsx (per RESEARCH Open Q 3).
 */

import { useEffect, useCallback } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import type { LoveNote, LoveNoteStatus } from '../lib/types';
import { isRevealed } from '../lib/lovenotes/selectors';

export function useRevealOnForeground(
  loveNotes: LoveNote[],
  updateStatus: (sourceFile: string, status: LoveNoteStatus, readAt?: string) => Promise<void>,
): void {
  const reveal = useCallback(async () => {
    const now = new Date();
    for (const n of loveNotes) {
      if (n.status === 'pending' && isRevealed(n, now)) {
        try {
          await updateStatus(n.sourceFile, 'revealed');
        } catch (e) {
          if (__DEV__) console.warn('[useRevealOnForeground]', e);
        }
      }
    }
  }, [loveNotes, updateStatus]);

  useEffect(() => {
    // Mount : reveal immediat
    reveal();
    // Foreground : reveal au retour
    const sub = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state === 'active') reveal();
    });
    return () => sub.remove();
  }, [reveal]);
}
