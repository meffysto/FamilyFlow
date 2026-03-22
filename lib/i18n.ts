import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { getLocales } from 'expo-localization';
import * as SecureStore from 'expo-secure-store';

import frCommon from '../locales/fr/common.json';
import frGamification from '../locales/fr/gamification.json';
import frHelp from '../locales/fr/help.json';
import frInsights from '../locales/fr/insights.json';
import frSkills from '../locales/fr/skills.json';

import enCommon from '../locales/en/common.json';
import enGamification from '../locales/en/gamification.json';
import enHelp from '../locales/en/help.json';
import enInsights from '../locales/en/insights.json';
import enSkills from '../locales/en/skills.json';

const LANGUAGE_KEY = 'app_language';

const deviceLocale = getLocales()[0]?.languageCode ?? 'fr';

i18n.use(initReactI18next).init({
  lng: deviceLocale,
  fallbackLng: 'fr',
  ns: ['common', 'gamification', 'help', 'insights', 'skills'],
  defaultNS: 'common',
  resources: {
    fr: {
      common: frCommon,
      gamification: frGamification,
      help: frHelp,
      insights: frInsights,
      skills: frSkills,
    },
    en: {
      common: enCommon,
      gamification: enGamification,
      help: enHelp,
      insights: enInsights,
      skills: enSkills,
    },
  },
  interpolation: {
    escapeValue: false,
  },
});

/** Charge la langue persistée et l'applique (appelé au démarrage) */
export async function loadSavedLanguage(): Promise<void> {
  try {
    const saved = await SecureStore.getItemAsync(LANGUAGE_KEY);
    if (saved && saved !== i18n.language) {
      await i18n.changeLanguage(saved);
    }
  } catch {
    // Pas de langue sauvegardée → on garde celle du device
  }
}

/** Change la langue et la persiste */
export async function setAppLanguage(lng: 'fr' | 'en' | 'auto'): Promise<void> {
  if (lng === 'auto') {
    await SecureStore.deleteItemAsync(LANGUAGE_KEY);
    await i18n.changeLanguage(deviceLocale);
  } else {
    await SecureStore.setItemAsync(LANGUAGE_KEY, lng);
    await i18n.changeLanguage(lng);
  }
}

/** Retourne la préférence de langue sauvegardée (ou 'auto') */
export async function getSavedLanguage(): Promise<'fr' | 'en' | 'auto'> {
  try {
    const saved = await SecureStore.getItemAsync(LANGUAGE_KEY);
    if (saved === 'fr' || saved === 'en') return saved;
  } catch {}
  return 'auto';
}

export default i18n;
