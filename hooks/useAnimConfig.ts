/**
 * useAnimConfig.ts — Hook d'accessibilité pour les animations
 *
 * Respecte le réglage système "Réduire les animations" (iOS/Android).
 * Utilise useReducedMotion() de react-native-reanimated.
 *
 * Usage :
 *   const { reduceMotion } = useAnimConfig();
 *   scale.value = reduceMotion ? 1 : withSpring(1, { damping: 15 });
 */

import { useReducedMotion } from 'react-native-reanimated';

export function useAnimConfig() {
  const reduceMotion = useReducedMotion();

  return {
    /** true si l'utilisateur a activé "Réduire les animations" dans les réglages système */
    reduceMotion,
    /** Durée standard ou 0 si réduit */
    duration: reduceMotion ? 0 : undefined,
    /** Spring config : instantanée ou normale */
    springConfig: reduceMotion ? { duration: 0 } : undefined,
    /** Retourne la durée adaptée au réglage */
    timing: (normalDuration: number) => (reduceMotion ? 0 : normalDuration),
  };
}
