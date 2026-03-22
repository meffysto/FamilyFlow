import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { getLocales } from 'expo-localization';

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

export default i18n;
