/**
 * nav-pill-bus.ts — Event bus module pour l'état "at top" de la pillule de navigation.
 *
 * Pourquoi un bus JS plutôt qu'un SharedValue de Reanimated partagé via contexte :
 * sur Reanimated 4.1, partager un SharedValue cross-component (écrit depuis un
 * useAnimatedScrollHandler dans un écran, lu depuis un useAnimatedReaction dans
 * un autre composant) plante l'app en natif sur iOS.
 *
 * Pattern :
 *   - chaque écran appelle setNavPillAtTop UNIQUEMENT au franchissement du seuil
 *     (via runOnJS dans un scroll handler worklet, gardé par un SharedValue local)
 *   - la pillule consomme via useSyncExternalStore — re-render uniquement au changement
 */

type Listener = () => void;

let atTop = true;
const listeners = new Set<Listener>();

export function setNavPillAtTop(value: boolean): void {
  if (value === atTop) return;
  atTop = value;
  listeners.forEach((l) => l());
}

export function getNavPillAtTop(): boolean {
  return atTop;
}

export function subscribeNavPill(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
