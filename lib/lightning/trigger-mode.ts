/**
 * dispatchTrigger — fonction pure de routage des pay-outs (REQ-3).
 *
 * 3 modes SPEC :
 *   - `instant`      : pay-out immédiat (default)
 *   - `daily-review` : tout pay-out part en queue, validation parent batch
 *   - `hybrid`       : instant tant que cumul < 100 sats/jour, sinon queue
 *
 * Le seuil hybrid est STRICT (`<`, exclusif) : à 100 cumulés on bascule
 * déjà en queue. SPEC #3 acceptance : "hybrid jusqu'à 100 instant puis
 * bascule en queue".
 *
 * Note : `satsAmount` est ignoré aujourd'hui (toujours 100 sats par tâche
 * en MVP). Param conservé dans la signature pour permettre des règles
 * futures (ex : pay-outs > seuil unique = queue obligatoire).
 */

export const HYBRID_THRESHOLD_SATS = 100;

export type TriggerMode = 'instant' | 'daily-review' | 'hybrid';
export type TriggerDispatch = 'instant' | 'queue';

export function dispatchTrigger(
  cumulSatsToday: number,
  mode: TriggerMode,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  satsAmount: number,
): TriggerDispatch {
  if (mode === 'instant') return 'instant';
  if (mode === 'daily-review') return 'queue';
  // mode === 'hybrid'
  return cumulSatsToday < HYBRID_THRESHOLD_SATS ? 'instant' : 'queue';
}
