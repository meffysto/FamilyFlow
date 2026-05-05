---
phase: 51-ux-export-manuel-lulu
plan: 02
subsystem: ui-export-pdf
tags: [export, pdf, manifeste, navigation, ux]
requires:
  - lib/pdf (parseManifeste, MANIFESTE_FILE, BookManifestEntry, BookExportModal Phase 51-01)
  - contexts/VaultContext (vault, stories)
  - contexts/ThemeContext (useThemeColors)
provides:
  - Route `/impressions` (écran liste manifeste + CTA générer)
  - components/pdf/ExportCard (item liste memoïsé)
  - lib/pdf.buildVaultPdfUri (API publique reconstruction URI vault)
affects:
  - app/(tabs)/more.tsx (1 row ajoutée catégorie souvenirs — édit minimal)
  - app/_layout.tsx (Stack.Screen "impressions" enregistré)
  - locales/fr/common.json (clé menu.items.impressions)
tech-stack:
  added: []
  patterns:
    - "Pull-to-refresh via RefreshControl + état local refreshing"
    - "ExportCard React.memo + useCallback handler (perf liste)"
    - "Branchement BookExportModal.onSuccess → loadManifeste (refresh auto)"
    - "Histoires supprimées : fallback `entry.id` italique + label `t(...deletedStory)`"
key-files:
  created:
    - app/impressions.tsx
    - components/pdf/ExportCard.tsx
    - lib/pdf/__tests__/book-storage.uri.test.ts
  modified:
    - lib/pdf/book-storage.ts
    - lib/pdf/index.ts
    - components/pdf/index.ts
    - app/_layout.tsx
    - app/(tabs)/more.tsx
    - locales/fr/common.json
decisions:
  - "Layout cards verticales scrollables (vs table/timeline) — cohérent avec le reste de l'app, gestion histoires supprimées plus lisible"
  - "buildVaultPdfUri = wrapper public sur logique URI existante (pas de duplication) — rename interne `buildVaultUri` → `buildVaultUriFromPath`"
  - "Édit more.tsx STRICTEMENT minimal : +1 import lucide (`Printer`) +1 entrée menuItems — aucun refacto, working tree user en cours préservé"
  - "i18n FR : clé `menu.items.impressions` ajoutée à common.json (nécessaire pour le row), reste des clés UI via `defaultValue` (namespace impressions à créer en 51-03)"
  - "BookExportModal.onSuccess ne reçoit pas l'entry — on déclenche juste `loadManifeste()` qui re-parse le manifeste à jour (entrée fraîchement persistée)"
metrics:
  duration_seconds: 480
  tasks_completed: 2
  files_created: 3
  files_modified: 6
  completed_date: 2026-05-05
---

# Phase 51 Plan 02 : Écran "Mes impressions" Summary

**One-liner :** Route `/impressions` navigable depuis menu Plus — liste le manifeste vault, ouvre les PDFs via Print.printAsync, branche BookExportModal pour générer.

## Objectif atteint

Création de l'écran "Mes impressions" (`app/impressions.tsx`) qui matérialise l'entry-point Phase 51 (déviation ROADMAP — écran dédié vs long-press menu). L'écran lit le manifeste vault, affiche les exports passés en cards verticales, permet de tap pour ouvrir le PDF, et expose un CTA header "Nouveau livre" qui ouvre `BookExportModal` (51-01). Le manifeste est rafraîchi automatiquement après chaque export via `onSuccess`.

## Tâches exécutées

| Task | Description                                            | Commit     |
|------|--------------------------------------------------------|------------|
| 1    | Tests RED `buildVaultPdfUri` (3 cas)                   | `fd585149` |
| 1    | Export public `buildVaultPdfUri` + GREEN tests         | `a2cc0ae8` |
| 2    | ExportCard + écran impressions + row more.tsx + i18n   | `e9931692` |

## Décisions de design

### Layout — cards verticales scrollables (retenu)
Cohérent avec le pattern dashboard / liste rdv / liste recettes du projet. Une card par export avec :
- titre histoire (italique si supprimée — `stories.find(s => s.id === e.id)` absent)
- ligne meta (date FR `JJ/MM/AAAA` + format Lulu)
- hash court (8 premiers chars en monospace `colors.textFaint`)
- onPress unique → `Print.printAsync({ uri })` (iOS) ou `Linking.openURL(uri)` (Android)

### Refactor `buildVaultPdfUri` — wrapper public
Le plan suggérait d'exposer la logique privée `buildVaultUri` (book-storage.ts:72-92). Choix retenu : **conserver la fonction interne renommée `buildVaultUriFromPath`** + créer un **wrapper public `buildVaultPdfUri(vault, entry)`** qui délègue. Avantages :
- API publique typée sur `BookManifestEntry` (consommateur n'a pas à connaître le format `relativePath`)
- Logique non dupliquée (le `persistBookPdf` interne et le consommateur externe partagent la même fonction)
- 3 tests Jest pinnent le comportement (URI valide, traversal, trailing slash)

### Édit `more.tsx` — minimal chirurgical
Working tree utilisateur en cours sur ce fichier (modifs non-committées). Édit limité à **2 lignes ajoutées** :
1. Import `Printer` ajouté à la liste lucide (entre `BookOpen` et `Sprout`)
2. 1 entrée dans le tableau `menuItems` (juste après `bedtimeStories`)

Aucun refacto, aucun reformat, aucun import optimisé. `git diff app/(tabs)/more.tsx` montre exactement `2 ++`.

### i18n — clé `menu.items.impressions` seule ajoutée à common.json
Le namespace `impressions.*` (titres modal, empty state, errors) sera créé dans le Plan 51-03. En attendant, chaque `t('impressions.foo')` reçoit un `defaultValue` FR explicite — l'UI est pleinement utilisable sans bloquer 51-02 sur 51-03. Seule exception : `menu.items.impressions` doit exister maintenant, sinon le row affiche la clé brute.

### Stack.Screen "impressions" enregistré
Ajout d'un `<Stack.Screen name="impressions" />` dans `app/_layout.tsx` pour expliciter la route hors-tabs (auto-discovery expo-router fonctionne, mais l'enregistrement explicite évite les warnings et clarifie l'arbo).

### BookExportModal — onSuccess refresh
La signature existante `onSuccess(uri, storyTitle)` est conservée. Côté écran, on ignore les paramètres et on appelle juste `loadManifeste()` qui re-parse le fichier disque — l'entrée fraîchement persistée (par `persistBookPdf` dans le modal) apparaît automatiquement. Pas de duplication d'état ni de risque de désync.

## Branchements posés

### Pour Plan 51-03 (post-export + i18n + Lulu)
- Créer `locales/fr/impressions.json` avec les clés référencées par défaut :
  - `impressions.screen.title` / `.newButton` / `.empty.title` / `.empty.description` / `.empty.cta`
  - `impressions.card.exportedOn` (avec interpolation `{{date}}`) / `.deletedStory`
  - `impressions.errors.openTitle` / `.openBody`
- Enregistrer le namespace dans `lib/i18n.ts`
- Implémenter le rendu UI de la phase `post-export` dans `BookExportModal` (3 actions Sauvegarder / Voir / Lulu) — le branchement `onSuccess` côté `app/impressions.tsx` n'a pas besoin d'évoluer

### Pour Plan 51-04 (validation finale)
- Tester e2e : générer un livre via le modal → vérifier qu'une nouvelle card apparaît dans `app/impressions.tsx` après dismiss du modal
- Tester pull-to-refresh quand le manifeste est édité hors-app (Obsidian Mac)
- Vérifier ouverture PDF iOS via Print.printAsync (QLPreviewController)

## Pitfalls anticipés (et mitigés)

| Pitfall                                          | Mitigation                                                            |
|--------------------------------------------------|-----------------------------------------------------------------------|
| Manifeste absent (premier lancement)             | `try/catch` sur `vault.readFile` → `setEntries([])` → empty state     |
| Histoire supprimée du vault mais présente manif  | `stories.find` undefined → fallback `entry.id` italique + label dédié |
| Édit `more.tsx` casse le working tree user       | Édit chirurgical 2 lignes, vérifié via `git diff --stat` (`2 ++`)     |
| Path traversal dans `entry.chemin`               | `buildVaultPdfUri` throw via `buildVaultUriFromPath` (test Jest)      |
| Clé i18n absente quand l'écran s'ouvre           | `defaultValue: 'FR'` sur tous les `t(...)` du nouvel écran            |

## Déviations du plan

Aucune déviation des règles 1-4. Plan exécuté tel que rédigé.

Note mineure (pas une déviation) : le plan suggérait d'utiliser un `<Stack.Screen options={{ title }} />` inline, j'ai choisi `headerShown: false` + un header custom in-component pour cohérence avec les autres écrans hors-tabs du projet (mode pageSheet-like).

## Tests

### Jest — 3 tests verts
```
buildVaultPdfUri
  ✓ reconstruit un URI file:// valide depuis vaultPath et entry.chemin
  ✓ throw quand entry.chemin contient un path traversal (..)
  ✓ ne produit pas de double slash quand vaultPath se termine par '/'
```

### Type-check
`npx tsc --noEmit` clean (hors pré-existantes : MemoryEditor.tsx, cooklang.ts, useVault.ts).

### Diff `more.tsx`
```
app/(tabs)/more.tsx | 2 ++
1 file changed, 2 insertions(+)
```

## Critères de succès — checklist

- [x] Route `/impressions` fonctionnelle (Stack.Screen enregistré)
- [x] ExportCard rend titre/date/format/hash + état "supprimée"
- [x] `buildVaultPdfUri` exporté + 3 tests Jest verts
- [x] more.tsx édit minimal (1 import + 1 row, aucune autre ligne touchée)
- [x] `npx tsc --noEmit` clean (hors pré-existantes)
- [x] Tap card → `Print.printAsync` (iOS) / `Linking.openURL` (Android)
- [x] Pull-to-refresh re-parse le manifeste
- [x] Empty state FR + CTA "Nouveau livre"
- [x] BookExportModal branché via `onSuccess` → refresh manifeste

## Self-Check: PASSED

- FOUND: app/impressions.tsx
- FOUND: components/pdf/ExportCard.tsx
- FOUND: lib/pdf/__tests__/book-storage.uri.test.ts
- FOUND: fd585149 (test RED buildVaultPdfUri)
- FOUND: a2cc0ae8 (feat export buildVaultPdfUri)
- FOUND: e9931692 (feat écran impressions + ExportCard + row more.tsx)
