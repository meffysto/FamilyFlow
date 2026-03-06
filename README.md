# Family Vault

Application mobile familiale qui transforme un vault [Obsidian](https://obsidian.md) en hub de gestion du quotidien.

## Fonctionnalités

- **Tâches récurrentes** — suivi par enfant et par pièce, toggle depuis l'app
- **Liste de courses** — checkbox synchronisée avec le vault
- **Journal bébé** — quick-add biberon, couche, sieste avec horodatage
- **Rendez-vous médicaux** — lecture des RDV depuis le vault (frontmatter YAML)
- **Ménage hebdo** — tâches filtrées par jour de la semaine
- **Gamification** — points, niveaux, streaks, loot boxes avec 5 raretés
- **Notifications Telegram** — templates configurables, envoi direct depuis l'appareil
- **100% offline** — toutes les données restent sur l'appareil

## Stack

- [Expo](https://expo.dev) SDK 52 + React Native
- [expo-router](https://docs.expo.dev/router/introduction/) (file-based routing)
- [expo-file-system](https://docs.expo.dev/versions/latest/sdk/filesystem/) (lecture/écriture vault)
- [expo-secure-store](https://docs.expo.dev/versions/latest/sdk/securestore/) (tokens Telegram)

## Installation

```bash
npm install
npx expo start
```

## Structure

```
app/
├── (tabs)/          → Écrans principaux (dashboard, tâches, journal, loot, settings)
├── setup.tsx        → Assistant de configuration (5 étapes)
└── _layout.tsx      → Layout racine
components/          → Composants réutilisables (TaskCard, LootBoxOpener, etc.)
hooks/               → useVault (state global), useGamification (points/loot)
lib/                 → Parser markdown, gamification, notifications, types
constants/           → Pool de récompenses loot box
docs/                → Privacy policy (GitHub Pages)
```

## Données

Aucune donnée ne transite par un serveur. L'app lit et écrit directement dans les fichiers `.md` du vault Obsidian sur l'appareil. La synchronisation entre appareils est gérée par Obsidian Sync ou Syncthing.

## Licence

Usage personnel.
