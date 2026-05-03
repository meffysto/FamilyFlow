---
phase: quick-260503
status: completed
---

# Résumé

Phase B Histoires shippée — le wizard quotidien passe de 5-7 décisions à 3-4
en déplaçant les préférences durables (voix, mode audio, multi-voix, langue,
longueur préférée) vers un nouvel écran Settings par profil enfant.

# Sorties

- **Type** `StoryDefaults` ajouté sur `Profile` (lib/types.ts)
- **Parser/serializer** JSON 1-ligne tolérant dans famille.md (lib/parser.ts)
- **Cache** bumpé v12 → v13 (Profile.storyDefaults cached)
- **Hook** `updateStoryDefaults(profileId, defaults | null)` exposé via `useVault()`
- **Écran** `app/story-settings.tsx` (route hors-tabs, pageSheet, drag-to-dismiss)
  - Sélecteur enfant horizontal en haut
  - Sections : Moteur, Langue, Narrateur (parents adultes / voix ElevenLabs), Mode audio, Multi-voix, Longueur préférée
- **Bouton** ⚙️ dans le header de stories.tsx (à côté du 📖 immersif)
  - Visible sur étapes `choisir_enfant` et `personnaliser`
  - `router.push('/story-settings')`
- **Wizard slim** : suppression de ~460 lignes (Mode audio + Sélecteur voix)
  - Conservé : tranche d'âge, contexte vault, thème + chips suggestions
  - Override longueur visible (chip 1-tap, préselect = settings enfant)
- **Génération** : `buildFinalVoiceConfig(lengthOverride)` lit
  `childProfile.storyDefaults` avec fallback `voiceConfig` global

# Décisions tranchées

- Settings par enfant (pas globaux) — UI = sélecteur en haut de l'écran
- Override longueur = chip visible 1-tap (pas planqué dans "Avancé")
- Pas de migration des histoires existantes — settings n'affectent que les nouvelles

# Garde-fous respectés

- `useThemeColors()` partout, zéro hardcode
- Modal pageSheet + drag-to-dismiss (gestureEnabled)
- Commits FR atomiques (3 commits : foundation, settings screen, wizard slim)
- `npx tsc --noEmit` propre à chaque commit
- Animations via react-native-reanimated (header existant)

# Validation

- `npx tsc --noEmit` ✅ aucune nouvelle erreur (modulo pré-existantes connues)
- 3 commits atomiques sur main : `080480ef`, `1fec9b2b`, `792c2070`
- Backlog Phase C+ inchangé (livre imprimable, auto-flip pages, animation page-flip 3D)

# Notes pour follow-up

- Le `VoiceRecorderModal` reste hoisté dans `StoriesScreen` mais n'est plus
  déclenchable depuis le wizard. Soit le wirer dans /story-settings (Phase C+)
  soit le retirer s'il est intégralement dispo ailleurs (ex: écran profil).
- Les états locaux `localVoiceEngine`, `voiceSelectedParentId`,
  `voiceSelectedPersonalVoice`, `voicePersonalVoices`, `voiceCloneMode` dans
  `StoriesScreen` survivent pour le VoiceRecorderModal — à nettoyer en même
  temps que la décision sur le modal.
