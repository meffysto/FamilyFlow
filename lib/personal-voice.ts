/**
 * personal-voice.ts — Détection des voix iOS Personal Voice via expo-speech.
 * iOS Personal Voice (créée par l'utilisateur dans Réglages > Accessibilité > Voix personnelle)
 * est exposée par expo-speech avec quality === 'Enhanced' ou 'Premium'.
 * Ce module ne fait que lister ces voix — l'activation se fait ailleurs via Speech.speak().
 */
import * as Speech from 'expo-speech';

/**
 * Retourne la liste des voix iOS Enhanced/Premium disponibles sur l'appareil,
 * triées par nom alphabétique.
 * Ces voix incluent iOS Personal Voice (Accessibilité) et les voix premium Siri.
 * En cas d'erreur, retourne un tableau vide (usage non-critique).
 */
export async function getPersonalVoices(): Promise<Speech.Voice[]> {
  try {
    const allVoices = await Speech.getAvailableVoicesAsync();
    // Filtre sur quality Enhanced/Premium — inclut iOS Personal Voice et voix premium
    // 'Premium' non présent dans l'enum expo-speech actuel mais retourné par iOS au runtime
    const qualitesHautes = new Set<string>([Speech.VoiceQuality.Enhanced, 'Premium']);
    const highQualityVoices = allVoices.filter(voice =>
      qualitesHautes.has(voice.quality as string)
    );
    // Tri alphabétique pour un ordre prévisible dans l'UI
    return highQualityVoices.sort((a, b) => a.name.localeCompare(b.name));
  } catch (error) {
    if (__DEV__) console.warn('[personal-voice] Erreur getAvailableVoicesAsync:', error);
    return [];
  }
}
