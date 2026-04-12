/**
 * personal-voice.ts — Détection des voix iOS Enhanced/Premium via expo-speech.
 * Inclut :
 *  - Voix système Premium/Enhanced (Audrey, Thomas, Aurélie en FR ; Ava, Samantha en EN)
 *  - iOS Personal Voice (Réglages > Accessibilité > Voix personnelle)
 * Ces voix sont offline une fois téléchargées dans Réglages iOS.
 */
import * as Speech from 'expo-speech';

/**
 * Retourne la liste des voix Enhanced/Premium disponibles, filtrée par langue
 * si `language` est fourni (`'fr'` → voix `fr-*`, `'en'` → voix `en-*`).
 * Triée par nom alphabétique. Retourne [] en cas d'erreur (usage non-critique).
 */
export async function getPersonalVoices(
  language?: 'fr' | 'en',
): Promise<Speech.Voice[]> {
  try {
    const allVoices = await Speech.getAvailableVoicesAsync();
    // 'Premium' non présent dans l'enum expo-speech mais retourné par iOS au runtime
    const qualitesHautes = new Set<string>([Speech.VoiceQuality.Enhanced, 'Premium']);
    const langPrefix = language === 'en' ? 'en' : language === 'fr' ? 'fr' : null;

    const filtered = allVoices.filter(voice => {
      if (!qualitesHautes.has(voice.quality as string)) return false;
      if (langPrefix && !voice.language.toLowerCase().startsWith(langPrefix)) return false;
      return true;
    });

    return filtered.sort((a, b) => a.name.localeCompare(b.name));
  } catch (error) {
    if (__DEV__) console.warn('[personal-voice] Erreur getAvailableVoicesAsync:', error);
    return [];
  }
}
