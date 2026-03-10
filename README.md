# FamilyFlow

Application mobile familiale qui transforme un vault [Obsidian](https://obsidian.md) en hub de gestion du quotidien.

## Fonctionnalités

- **Dashboard intelligent** — sections configurables par priorité, mode parent et enfant
- **Tâches récurrentes** — suivi par enfant et par pièce, toggle depuis l'app
- **Rendez-vous médicaux** — gestion complète avec statut, questions/réponses, swipe
- **Planning repas** — planification hebdomadaire + liste de courses synchronisée
- **Recettes** — import depuis URL (cook.md + IA), texte collé, communauté cooklang.org
- **Journal bébé** — alimentation, couches, sommeil, humeur, médicaments avec stats temps réel
- **Stock maison** — suivi quantités avec seuils d'alerte
- **Souvenirs** — photos et moments par enfant
- **Gamification** — points, niveaux, streaks, loot boxes avec 5 raretés
- **Défis famille** — objectifs partagés entre membres
- **Liste de souhaits** — par profil
- **Dossier santé** — allergies, antécédents, croissance, médicaments
- **Recherche globale** — recherche multi-type avec navigation directe
- **IA optionnelle** — assistant conversationnel (Claude API) pour questions sur l'organisation
- **Suggestions intelligentes** — analyse locale déterministe + IA optionnelle
- **Multi-profils** — adultes et enfants avec thèmes personnalisés
- **100% offline** — toutes les données restent sur l'appareil

## Stack

- [Expo](https://expo.dev) ~54 + React Native
- [expo-router](https://docs.expo.dev/router/introduction/) v6 (file-based routing)
- [react-native-reanimated](https://docs.swmansion.com/react-native-reanimated/) ~4.1
- [react-native-gesture-handler](https://docs.swmansion.com/react-native-gesture-handler/) ~2.28
- Données : fichiers Markdown dans un vault Obsidian (frontmatter YAML)
- Recettes : format [Cooklang](https://cooklang.org/)
- Stockage préfs : expo-secure-store
- Accès vault iOS : module natif VaultAccess (NSFileCoordinator)
- IA : Claude API (Haiku 4.5 / Sonnet 4.6) — optionnel, anonymisation locale

## Installation

```bash
npm install
npx expo prebuild --platform ios
npx expo run:ios --device
```

## Architecture

```
app/(tabs)/          # Écrans principaux (dashboard, tâches, rdv, repas, more)
components/          # Composants réutilisables (cards, modals, editors)
components/ui/       # Design system (Button, Chip, Badge, DateInput, ModalHeader)
components/settings/ # Sous-composants paramètres
contexts/            # Providers (Vault, Theme, AI, Toast)
hooks/               # useVault (logique vault + file I/O)
lib/                 # Parser markdown, cooklang, insights, search, AI service
constants/           # Couleurs, thèmes, spacing, typography, shadows, rewards
modules/             # Modules natifs (VaultAccess)
```

## Confidentialité

Aucune donnée ne transite par un serveur. L'application lit et écrit directement dans les fichiers Markdown du vault Obsidian. La synchronisation multi-appareils passe par la sync native d'Obsidian ou Syncthing.

L'IA (optionnelle) anonymise toutes les données personnelles avant envoi — noms, médecins et lieux sont remplacés par des pseudonymes. Aucune donnée réelle ne quitte l'appareil.

## Licence

Usage personnel uniquement.
