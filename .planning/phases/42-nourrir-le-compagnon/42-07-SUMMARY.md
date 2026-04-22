---
phase: 42-nourrir-le-compagnon
plan: 07
subsystem: mascot-companion-integration
tags: [integration, hook, ui, tree, feed, transaction]
requirements: [FEED-13, FEED-14]
dependency-graph:
  requires:
    - "Plan 42-03 (feedCompanion engine pur + FeedResult)"
    - "Plan 42-05 (CompanionCard component)"
    - "Plan 42-06 (FeedPicker component avec mapping grades EN↔FR)"
  provides:
    - "hooks/useVault.ts#feedCompanion — mutation profile.companion + décrément harvestInventory en 1 seule écriture farm-{id}.md"
    - "tree.tsx — chip compagnon ouvre CompanionCard (refonte D-26/D-28), tap long sprite ouvre FeedPicker direct (D-29)"
    - "Boucle UX feed complète end-to-end (picker → mutation vault → refresh UI immédiat)"
  affects:
    - "hooks/useVault.ts — +85 lignes (import feedCompanionEngine + fonction + type interface + return + deps)"
    - "app/(tabs)/tree.tsx — +55 lignes (imports + state + handler + chip redirect + modal + FeedPicker render)"
    - "components/mascot/CompanionSlot.tsx — +2 lignes (prop onLongPress optionnelle passée au Pressable interne)"
tech-stack:
  added: []
  patterns:
    - "Transaction single-file (parseFarmProfile → mutate companion + harvest → serializeFarmProfile → writeFile UNE SEULE fois)"
    - "Fail-open sur I/O : try/catch silencieux + __DEV__ warn, return null si échec"
    - "Mapping EN→FR appliqué au boundary hook (companion-engine EN ↔ grade-engine FR)"
    - "Update local profiles[].companion + profiles[].harvestInventory après write réussi (refresh UI immédiat sans attendre vault refresh)"
    - "Gotcha pageSheet stacking iOS : setTimeout(300ms) entre fermeture et ouverture successives"
    - "Extension prop onLongPress sur Pressable interne CompanionSlot (évite double wrapping gesture)"
key-files:
  created: []
  modified:
    - "hooks/useVault.ts"
    - "app/(tabs)/tree.tsx"
    - "components/mascot/CompanionSlot.tsx"
decisions:
  - "Mapping EN→FR placé DANS la fonction feedCompanion du hook (pas exporté) — la frontière est locale à la transaction, pas besoin d'exposer globalement"
  - "Update local state inclut harvestInventory (pas juste companion comme setCompanion) — sinon le FeedPicker afficherait un stock périmé jusqu'au prochain refresh vault"
  - "CompanionSlot : ajout prop onLongPress passée au Pressable natif interne, plutôt que wrapper extérieur — zéro conflit gesture, 2 lignes de diff"
  - "CompanionPicker conservé intact pour le choix initial (level 5 unlock) — CompanionCard est un nouveau chemin, pas un remplacement total"
  - "chipCozyCompanion redirect : tap ouvre CompanionCard quand companion existe, sinon (edge case) fallback CompanionPicker conservé via useEffect initial"
metrics:
  duration: "~12min"
  completed: "2026-04-22"
  tasks: 2
  commits: 2
  lines_added: 142
---

# Phase 42 Plan 07 : Integration CompanionCard + FeedPicker + hook feedCompanion Summary

Câblage end-to-end de la boucle "Nourrir le compagnon" : action `feedCompanion` dans le hook qui persiste mutation companion + décrément harvestInventory en **une seule écriture** farm-{id}.md, wiring dans `tree.tsx` via CompanionCard en modal pageSheet (ouvert depuis chip cozy) et FeedPicker accessible depuis le bouton Nourrir **ET** tap long sur sprite compagnon.

## Objectif livré

D-01 (2 entry points), D-28 (CompanionCard remplace l'ouverture directe du picker pour switch), D-29 (tap long sprite = shortcut FeedPicker), D-30 (persist companion via parser déjà étendu Plan 02).

## Stratégie finale transaction single-file

Le moteur `feedCompanion` (Plan 03) ne touche à rien d'autre que `CompanionData`. Le hook ajoute **en une seule opération** :

```
parseFarmProfile(farmContent)
  → farmData.companion = result.updated      // D-30
  → farmData.harvestInventory[cropId][gradeFr] -= 1
  → writeFile(fp, serializeFarmProfile(...))   // UN SEUL writeFile
  → setProfiles(...) update local
```

**Vérification** : `awk '/const feedCompanion = useCallback/,/\[profiles\],/' hooks/useVault.ts | grep -c "writeFile"` → **1** (single write confirmé).

Fail-open : try/catch silencieux, `__DEV__ console.warn`, `return null` si échec — aucun rollback requis puisque rien n'est commit tant que writeFile n'a pas réussi.

## Pontage grades EN↔FR (résolu au hook boundary)

- `companion-engine.feedCompanion` attend `HarvestGrade EN` ('ordinary' | 'good' | 'excellent' | 'perfect')
- `harvestInventory` stocke `HarvestGrade FR` ('ordinaire' | 'beau' | 'superbe' | 'parfait')
- FeedPicker emit EN au callback (conversion FR→EN faite Plan 06)
- **Hook feedCompanion** applique le mapping inverse EN→FR localement pour décrémenter le bon bucket :

```typescript
const GRADE_EN_TO_FR: Record<CompanionHarvestGrade, FarmHarvestGrade> = {
  ordinary:  'ordinaire',
  good:      'beau',
  excellent: 'superbe',
  perfect:   'parfait',
};
```

Support du cas legacy `entry: number` (pré-Phase B) : traité comme `ordinaire`, décrémenté uniquement si grade demandé = `ordinaire`.

## Approche tap long sprite (CompanionSlot)

Deux options évaluées :

| Option                           | Verdict |
| -------------------------------- | ------- |
| Wrapper `Pressable onLongPress` extérieur | ❌ double gesture, risque de priorité sur le onPress interne du sprite |
| **Prop `onLongPress` optionnelle** passée au Pressable natif interne | ✅ retenu — 2 lignes, zéro conflit, l'API Pressable de RN gère proprement les deux gestures |

Le `Pressable` interne (L917) gère nativement la coexistence `onPress` + `onLongPress` (seuil système ≈500ms).

## Update local state : harvestInventory inclus

Contrairement à `setCompanion` qui n'update que `profile.companion`, `feedCompanion` update aussi `profile.harvestInventory` — sinon le FeedPicker (qui lit `profile?.harvestInventory ?? {}`) afficherait un stock périmé jusqu'au prochain refresh vault complet.

```typescript
setProfiles(prev => prev.map(p =>
  p.id === profileId
    ? { ...p, companion: result.updated, harvestInventory: farmData.harvestInventory }
    : p,
));
```

## farmDataByProfile state — audit

Grep L1044-1062 : `farmDataByProfile` est un Record local construit pendant `refresh()` puis mergé dans `profiles[]` via `profiles[i].harvestInventory = farmDataByProfile[...].harvestInventory`. **Pas de state React séparé** — c'est uniquement un buffer de chargement. Une fois refresh terminé, la source de vérité devient `profile.harvestInventory`. Donc mettre à jour `profiles[]` directement (ce qu'on fait) suffit à refléter le décrément dans toute l'UI qui consomme `profile.harvestInventory`.

## Boucle UX complète livrée

1. User tap chip "🐾 {nom}" dans signpost → ouverture `<Modal pageSheet>` CompanionCard
2. CompanionCard affiche avatar + nom + stade + buff actif (si présent) + bouton "🥕 Nourrir"
3. Tap Nourrir → setShowCompanionCard(false) + setTimeout(300ms) → setShowFeedPicker(true)
4. FeedPicker affiche combinaisons (cropId × grade) triées par affinité puis grade desc
5. User tap un crop → `handleFeedCrop(cropId, gradeEn)` appelle `feedCompanion(profile.id, cropId, gradeEn)`
6. Hook : moteur pur appliqué, farm file écrit, profiles state mis à jour
7. Haptic feedback Heavy (préféré) / Light (neutre/détesté)
8. Alternative : tap long sur sprite CompanionSlot → skip étapes 2-3, ouvre directement FeedPicker

## Commits

| # | Hash    | Message                                                                 |
|---|---------|-------------------------------------------------------------------------|
| 1 | 279b84c | feat(42-07): expose feedCompanion dans useVault (transaction single-file) |
| 2 | be098e7 | feat(42-07): integration CompanionCard + FeedPicker dans tree.tsx       |

## Verification

- `grep -q "const feedCompanion = useCallback" hooks/useVault.ts` — OK
- `grep -q "feedCompanionEngine" hooks/useVault.ts` — OK
- `grep -q "farmData.companion = result.updated" hooks/useVault.ts` — OK
- `grep -q "currentQty - 1" hooks/useVault.ts` — OK
- `awk writeFile count in feedCompanion` — **1 seule écriture** confirmée
- `grep -q "feedCompanion," hooks/useVault.ts` dans le return block — OK
- `grep -q "CompanionCard" app/(tabs)/tree.tsx` — OK
- `grep -q "FeedPicker" app/(tabs)/tree.tsx` — OK
- `grep -q "handleFeedCrop" app/(tabs)/tree.tsx` — OK
- `grep -q "setShowFeedPicker" app/(tabs)/tree.tsx` — OK
- `grep -q "setShowCompanionCard" app/(tabs)/tree.tsx` — OK
- `grep -q "onLongPress={" app/(tabs)/tree.tsx` — OK (tap long sprite)
- `grep -q "setTimeout.*300" app/(tabs)/tree.tsx` — OK (gotcha pageSheet stacking)
- `grep -q "import.*CompanionPicker" app/(tabs)/tree.tsx` — OK (choix initial conservé)
- `npx tsc --noEmit` — clean, aucune nouvelle erreur
- `npx jest lib/__tests__/companion-feed.test.ts --no-coverage` — 26/26 pass

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] CompanionSlot n'expose pas onLongPress**

- **Found during:** Task 2 (intégration tap long)
- **Issue:** Le plan anticipait deux branches selon la présence ou non de la prop `onLongPress` sur `CompanionSlot`. Lecture du fichier : la prop n'existe pas. Wrapper extérieur `Pressable onLongPress` crée un risque de conflit avec le `Pressable onPress` interne géré par `handleTap` (L917).
- **Fix:** Ajout direct d'une prop optionnelle `onLongPress?: () => void` sur `CompanionSlotProps`, passée telle quelle au `Pressable` natif interne. L'API React Native Pressable gère nativement la coexistence onPress + onLongPress — zéro conflit.
- **Files modified:** `components/mascot/CompanionSlot.tsx`
- **Commit:** be098e7

**2. [Rule 2 - Missing critical] Update local harvestInventory sinon stock périmé**

- **Found during:** Task 1 (audit state local)
- **Issue:** Le plan suggérait de ne mettre à jour que `profiles[].companion` (pattern setCompanion). Mais FeedPicker lit `profile?.harvestInventory`, donc sans update local de harvestInventory, le stock affiché resterait périmé jusqu'au prochain refresh vault complet — le user verrait encore le crop qu'il vient de consommer.
- **Fix:** setProfiles map inclut `harvestInventory: farmData.harvestInventory` en plus de `companion: result.updated`. Refresh UI immédiat, transaction toujours single-file (pas d'I/O supplémentaire).
- **Files modified:** `hooks/useVault.ts`
- **Commit:** 279b84c

## Known Stubs

Aucun — boucle UX fonctionnelle end-to-end. Les animations "manger" (Plan 08) et messages contextualisés (Plan 09) sont des enrichissements prévus explicitement dans les prochains plans, pas des stubs manquants pour ce plan.

## Self-Check: PASSED

- FOUND: hooks/useVault.ts feedCompanion (grep OK)
- FOUND: app/(tabs)/tree.tsx CompanionCard + FeedPicker + handleFeedCrop (grep OK)
- FOUND: components/mascot/CompanionSlot.tsx onLongPress prop (grep OK)
- FOUND: commit 279b84c (feedCompanion hook)
- FOUND: commit be098e7 (tree.tsx integration)
- npx tsc --noEmit : clean
- npx jest companion-feed : 26/26 pass
- Single writeFile confirmé par awk count = 1
