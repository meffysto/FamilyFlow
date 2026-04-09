// ─────────────────────────────────────────────
// Mascotte Arbre — Patterns haptics enrichis
// ─────────────────────────────────────────────

import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

const isWeb = Platform.OS === 'web';

/** Petit tap — caresser l'arbre */
export function hapticsTreeTap() {
  if (isWeb) return;
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
}

/** Changement d'espèce */
export function hapticsSpeciesChange() {
  if (isWeb) return;
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
}

/** Achat en boutique — crescendo léger */
export async function hapticsShopBuy() {
  if (isWeb) return;
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  await delay(80);
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  await delay(80);
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
}

/** Achat échoué (pas assez de points) */
export function hapticsShopError() {
  if (isWeb) return;
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
}

/** Évolution de stade — pattern épique crescendo */
export async function hapticsEvolution() {
  if (isWeb) return;
  // Roulement crescendo
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  await delay(120);
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  await delay(100);
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  await delay(100);
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  await delay(80);
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
  await delay(150);
  // Climax
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
}

/** Ouverture loot box — suspense puis résultat */
export async function hapticsLootOpen() {
  if (isWeb) return;
  // Suspense : 3 taps rapides
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  await delay(100);
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  await delay(100);
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  // Pause dramatique
  await delay(400);
  // Révélation
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
}

/** Résultat loot box selon rareté */
export async function hapticsLootResult(rarity: string) {
  if (isWeb) return;
  switch (rarity) {
    case 'mythique':
    case 'légendaire':
      // Double burst pour les raretés élevées
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await delay(200);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      break;
    case 'épique':
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      break;
    case 'rare':
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      break;
    default:
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }
}

/** Navigation dans le carrousel des stades */
export function hapticsStageScroll() {
  if (isWeb) return;
  Haptics.selectionAsync();
}

/** Effet léger — ménage quotidien et hebdomadaire */
export function hapticsEffectLight() {
  if (isWeb) return;
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
}

/** Effet modéré — courses, routines enfants, devoirs, budget */
export async function hapticsEffectMedium() {
  if (isWeb) return;
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  await delay(80);
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
}

/** Effet chaleureux — cuisine, gratitude */
export async function hapticsEffectStrong() {
  if (isWeb) return;
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  await delay(100);
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  await delay(80);
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
}

/** Effet épique — soins bébé, rendez-vous (mirrors hapticsEvolution cadence) */
export async function hapticsEffectGolden() {
  if (isWeb) return;
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  await delay(100);
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  await delay(80);
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
  await delay(150);
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
}

// ── Utilitaire ───────────────────────────────

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
