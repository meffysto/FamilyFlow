/**
 * Gate biométrique pour les opérations sensibles (pay-out).
 *
 * Spike feat/lightning-farm (004) — voir .planning/spikes/004-family-multi-wallet/README.md
 *
 * Utilise expo-local-authentication (FaceID/TouchID). Si la biométrie n'est
 * pas disponible (simulateur, appareil sans capteur), `authenticatePayOut()`
 * fail-fast — on n'autorise pas un fallback PIN par défaut, parce qu'on ne
 * veut pas qu'un mineur qui connaîtrait le PIN parent puisse vider le wallet.
 *
 * Override possible via paramètre `allowDevicePasscode: true` si le parent
 * accepte explicitement (à exposer en option future).
 */

import * as LocalAuthentication from 'expo-local-authentication';

export interface AuthGateOptions {
  /** Texte affiché dans le prompt système */
  reason: string;
  /** Autorise le fallback passcode si pas de biométrie (default false) */
  allowDevicePasscode?: boolean;
}

export interface AuthGateResult {
  success: boolean;
  /** Code d'erreur si !success, pour log */
  error?: 'unavailable' | 'user_cancel' | 'biometry_failed' | 'unknown';
}

export async function authenticatePayOut(opts: AuthGateOptions): Promise<AuthGateResult> {
  try {
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    const isEnrolled = await LocalAuthentication.isEnrolledAsync();
    if (!hasHardware || !isEnrolled) {
      if (__DEV__) {
        console.warn('[lightning] biometric unavailable — hasHardware=', hasHardware, 'enrolled=', isEnrolled);
      }
      // Dev/simulateur : on accepte pour pouvoir tester. Prod : refus.
      if (__DEV__) return { success: true };
      return { success: false, error: 'unavailable' };
    }

    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: opts.reason,
      cancelLabel: 'Annuler',
      disableDeviceFallback: !opts.allowDevicePasscode,
    });

    if (result.success) return { success: true };

    const reason = 'error' in result ? result.error : 'unknown';
    if (reason === 'user_cancel' || reason === 'system_cancel' || reason === 'app_cancel') {
      return { success: false, error: 'user_cancel' };
    }
    return { success: false, error: 'biometry_failed' };
  } catch (err) {
    if (__DEV__) console.warn('[lightning] biometric error:', err);
    return { success: false, error: 'unknown' };
  }
}
