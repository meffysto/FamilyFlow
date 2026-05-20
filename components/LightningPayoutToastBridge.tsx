/**
 * LightningPayoutToastBridge — Phase 53
 *
 * Branche le bus `onPayoutSuccess` au ToastProvider global. Monté une fois
 * au niveau racine (dans `_layout.tsx`, sous ToastProvider) pour que le
 * toast "+N sats ⚡" s'affiche peu importe l'écran actif au moment du
 * pay-out (tâche validée depuis tasks.tsx, dashboard, routines, etc.).
 *
 * Le pulse du bouton HUD ⚡ reste piloté localement dans `app/(tabs)/tree.tsx`
 * via `hudLightningRef.current.triggerPulse()` — cette responsabilité ne peut
 * pas remonter ici car la ref vit dans la ferme. Les deux subscribers
 * coexistent sur le même bus (Set<Listener>, fire-and-forget).
 */

import { useEffect } from 'react';
import { useToast } from '../contexts/ToastContext';
import { onPayoutSuccess } from '../lib/lightning';

export function LightningPayoutToastBridge() {
  const { showToast } = useToast();

  useEffect(() => {
    const unsub = onPayoutSuccess((evt) => {
      showToast(
        `+${evt.sats} sats ⚡`,
        'success',
        undefined,
        { icon: '⚡', subtitle: evt.profileName },
      );
    });
    return unsub;
  }, [showToast]);

  return null;
}
