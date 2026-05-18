/**
 * dispatchTrigger — fonction pure de routage des pay-outs (REQ-3).
 *
 * 3 modes SPEC :
 *   - `instant`      : pay-out immédiat (default)
 *   - `daily-review` : tout pay-out part en queue, validation parent batch
 *   - `hybrid`       : instant tant que cumul < `thresholdSats`/jour, sinon queue
 *
 * Le seuil hybrid est STRICT (`<`, exclusif) : à `thresholdSats` cumulés on
 * bascule déjà en queue.
 *
 * Le seuil est configurable par famille (`config.hybridThresholdSats`,
 * défaut `DEFAULT_HYBRID_THRESHOLD_SATS = 500`). L'ancien hard-code à 100
 * équivalait à "1 tâche instant puis tout en queue" — inutilisable en
 * pratique (cf. demande utilisateur Phase 53 post-mortem).
 *
 * Note : `satsAmount` est ignoré aujourd'hui (toujours 100 sats par tâche
 * en MVP). Param conservé dans la signature pour permettre des règles
 * futures (ex : pay-outs > seuil unique = queue obligatoire).
 */

export const DEFAULT_HYBRID_THRESHOLD_SATS = 500;
export const HYBRID_THRESHOLD_MIN_SATS = 100;
/** @deprecated Garde-fou rétro-compat — utilise `DEFAULT_HYBRID_THRESHOLD_SATS`. */
export const HYBRID_THRESHOLD_SATS = DEFAULT_HYBRID_THRESHOLD_SATS;

export type TriggerMode = 'instant' | 'daily-review' | 'hybrid';
export type TriggerDispatch = 'instant' | 'queue';

export function dispatchTrigger(
  cumulSatsToday: number,
  mode: TriggerMode,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  satsAmount: number,
  thresholdSats: number = DEFAULT_HYBRID_THRESHOLD_SATS,
): TriggerDispatch {
  if (mode === 'instant') return 'instant';
  if (mode === 'daily-review') return 'queue';
  // mode === 'hybrid'
  return cumulSatsToday < thresholdSats ? 'instant' : 'queue';
}
