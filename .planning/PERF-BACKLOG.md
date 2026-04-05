# Performance Backlog

Audit complet fait le 2026-04-05 (4 agents specialises).

## A faire quand le besoin se fait sentir

### Refresh selectif au foreground (effort moyen, gain subtil)

**Probleme** : `loadVaultData` recharge 21 sections (~40 readFile NSFileCoordinator) a chaque retour foreground, meme si seules les taches/courses ont change.

**Solution** :
1. Extraire des fonctions `refreshTasks()`, `refreshMeals()`, `refreshFarm()`, etc. depuis le gros `Promise.allSettled` de `loadVaultData`
2. Au foreground : appeler seulement `refreshCore()` (taches + courses + repas + journal = ~5 readFile)
3. Sur chaque ecran : `useFocusEffect` → `refreshX()` pour charger les donnees a la demande (pattern deja en place sur journal.tsx, tree.tsx, meals.tsx/loadRecipes)
4. Garder `loadVaultData` complet sur pull-to-refresh comme fallback

**Gain** : ~40 readFile → ~5 au foreground. Fraicheur des donnees chaudes en ~200ms au lieu de ~1.5-2s.
**Risque** : Faible. Le pattern useFocusEffect existe deja. Pas de modif native.
**Declencheur** : Vault qui grossit (100+ fichiers), ou plaintes sur la lenteur du refresh.

### listFilesRecursive natif (effort moyen, gain cible)

**Probleme** : `lib/vault.ts:194` fait un appel bridge `coordinatedIsDirectory` sequentiel par entree de repertoire. Pour 60 fichiers recettes = 60 allers-retours JS-Swift.

**Solution** : Ajouter `listDirectoryRecursive(uri, extension)` dans VaultAccessModule.swift qui utilise `FileManager.enumerator` (1 seul appel bridge).
**Gain** : Chargement recettes/notes de ~300-900ms a ~10-30ms.
**Risque** : Quasi nul (fonction additive, lecture seule).
**Declencheur** : 50+ recettes ou notes dans le vault.

## Evalues et rejetes (pas de gain reel)

- **Inverser gray-matter / manualParseFrontmatter** : Gain imperceptible (<1ms par fichier sur Hermes)
- **Remplacer export * dans lib/mascot/index.ts** : Quasi personne n'importe via le barrel (imports directs partout)
- **Lazy loading locales i18next** : Seulement 2 langues, Hermes compile le JSON en bytecode
- **Supprimer expo-speech-recognition** : Utilise par DictaphoneRecorder.tsx
- **Lazy loading des Tabs.Screen** : Expo-router/React Navigation le fait deja par defaut (mount au premier focus)
- **Cache Map dans VaultManager** : Dangereux avec iCloud/Obsidian qui modifient les fichiers en arriere-plan. Le read-modify-write actuel est le pattern le plus sur.

## Vrais problemes structurels (gros chantiers)

- **VaultContext monolithique** : 1 contexte, ~35 useState, ~80 actions. Chaque mutation re-rend tous les consumers. Fix = scinder en sous-contextes ou migrer vers Zustand. Effort eleve.
- **AnimatedAnimal re-renders** : `TreeView.tsx:2090` utilise useState + setInterval(600ms) pour les frames d'animation. Fix = useSharedValue. Effort moyen.
- **FlatList sans optimisations** : ~60 instances sans windowSize/maxToRenderPerBatch. Fix = ajouter les props. Effort faible mais tedieux.
