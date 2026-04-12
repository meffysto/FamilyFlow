---
phase: 27-cran-village-composants
verified: 2026-04-10T22:00:00Z
status: gaps_found
score: 8/9 must-haves verified
re_verification: false
gaps:
  - truth: "Chaque semaine enregistre les contributions par membre (HIST-02)"
    status: partial
    reason: "VillageWeekRecord ne stocke pas le detail par membre (weekStart, target, total, claimed uniquement). La UI n'affiche que cible/total/statut. HIST-02 exige explicitement 'contributions par membre' dans le record historique."
    artifacts:
      - path: "lib/village/types.ts"
        issue: "VillageWeekRecord manque un champ contributionsByMember: Record<string, number>"
      - path: "hooks/useGarden.ts"
        issue: "L'archivage de semaine (ligne ~148) ne capture pas le detail par membre"
      - path: "app/(tabs)/village.tsx"
        issue: "La section historique n'affiche pas les contributions par membre (Pitfall 5 reconnu)"
    missing:
      - "Ajouter contributionsByMember?: Record<string, number> dans VillageWeekRecord (lib/village/types.ts)"
      - "Calculer et archiver le breakdown par membre lors du rollover de semaine dans useGarden.ts"
      - "Afficher le detail par membre dans le CollapsibleSection historique dans village.tsx"
human_verification:
  - test: "Verification visuelle — Task 2 checkpoint:human-verify du plan 02"
    expected: "La carte tilemap cobblestone est visuellement distincte de la ferme (pas d'arbres fruitiers ni koi), le FAB 🏘️ navigue vers le village, toutes les sections sont visibles et fonctionnelles"
    why_human: "Rendu graphique tilemap, apparence visuelle, feedback haptic et navigation reelle ne peuvent pas etre verifies programmatiquement"
---

# Phase 27: Ecran Village — Rapport de Verification

**Phase Goal:** L'ecran village est navigable, distinct visuellement de la ferme perso (tilemap cobblestone), et affiche le feed contributions, la barre de progression de l'objectif, les indicateurs par membre, et le panneau historique des semaines accomplies.
**Verified:** 2026-04-10T22:00:00Z
**Status:** gaps_found
**Re-verification:** Non — verification initiale

---

## Goal Achievement

### Observable Truths (Plan 01)

| #  | Truth                                                                               | Status     | Evidence                                                                                              |
|----|-------------------------------------------------------------------------------------|------------|-------------------------------------------------------------------------------------------------------|
| 1  | La carte village utilise terrain cobblestone dominant distinct de la ferme (herbe)  | ✓ VERIFIED | `buildVillageMap()` appelle `fillRect(cobblestone, 2, 4, 10, 16)` — ~60% surface. `TileMapRenderer` mode='village' appelle `buildVillageMap()` et retourne `[]` pour les decos ferme |
| 2  | TileMapRenderer accepte mode='village' pour conditionner map et decorations          | ✓ VERIFIED | Ligne 452: `mode?: 'farm' \| 'village'`. Ligne 539: `mode === 'village' ? buildVillageMap() : buildFarmMap(treeStage)`. Ligne 595: `if (mode === 'village') return []` |
| 3  | Un bouton FAB sur l'ecran ferme navigue vers /(tabs)/village                        | ✓ VERIFIED | tree.tsx ligne 2033: `styles.villageFAB`, ligne 2037: `router.push('/(tabs)/village' as any)`, ligne 2035: `Haptics.selectionAsync()`, emoji 🏘️ present |

### Observable Truths (Plan 02)

| #  | Truth                                                                               | Status     | Evidence                                                                                              |
|----|-------------------------------------------------------------------------------------|------------|-------------------------------------------------------------------------------------------------------|
| 4  | L'ecran village affiche carte tilemap cobblestone via TileMapRenderer mode='village' | ✓ VERIFIED | village.tsx ligne 235-241: `<TileMapRenderer treeStage="arbre" ... season={season} mode="village" />` |
| 5  | Un feed affiche qui a contribue quoi cette semaine (nom, type, montant, heure relative) | ✓ VERIFIED | `FeedItem` React.memo (ligne 80-110), `formatRelativeTime()` (ligne 54-64), feedItems useMemo (ligne 139-146), montant `+{contribution.amount}`, typeLabel 'a recolte'/'a complete une tache' |
| 6  | Une barre de progression montre l'avancement collectif vers la cible                | ✓ VERIFIED | Ligne 259-265: `<LiquidXPBar current={progress} total={currentTarget} label={barLabel} color={barColor} height={24} />`. `barColor` = colors.warning (atteint) ou colors.success (en cours) |
| 7  | Chaque membre a un indicateur de sa contribution hebdomadaire visible               | ✓ VERIFIED | Ligne 350-367: `activeProfiles.map()` avec `ReactiveAvatar mood="idle"`, `memberContribs[profile.id] ?? 0`, `profile.name`. ScrollView horizontal |
| 8  | Un panneau historique liste les semaines passees avec cible, total, statut recompense | ✓ VERIFIED (partiel) | Ligne 383-408: `weekHistory` mapped via `CollapsibleSection id=village_week_*`, titre `Semaine du ${formatDateFR} — ${total}/${target}`, statut "Objectif atteint"/"Non atteint", badge "Recompense reclamee". Mais: pas de detail par membre (HIST-02) |
| 9  | Quand l'objectif est atteint, bouton 'Reclamer la recompense' apparait              | ✓ VERIFIED | Ligne 269-283: `canClaim && <Animated.View entering={FadeInDown.duration(400)}>`, `TouchableOpacity handleClaim`, texte "Reclamer la recompense". `alreadyClaimed` desactive avec opacity 0.5 |

**Score:** 8/9 truths verified (HIST-02 contributions par membre partiellement absent)

---

## Required Artifacts

| Artifact                                 | Attendu                                         | Statut      | Details                                                                                             |
|------------------------------------------|-------------------------------------------------|-------------|-----------------------------------------------------------------------------------------------------|
| `lib/mascot/farm-map.ts`                 | `buildVillageMap()` export                      | ✓ VERIFIED  | Existe, exportee ligne 159, cobblestone dominant, fontaine eau, chemins dirt                        |
| `components/mascot/TileMapRenderer.tsx`  | `mode?: 'farm' \| 'village'` dans props          | ✓ VERIFIED  | Ligne 452. Import buildVillageMap (ligne 34). useMemo conditionnel (ligne 539). Guard decos (ligne 595) |
| `app/(tabs)/tree.tsx`                    | FAB village navigation                          | ✓ VERIFIED  | Ligne 2033-2041. villageFAB dans StyleSheet. colors.catJeux. Haptics.selectionAsync(). 🏘️         |
| `app/(tabs)/village.tsx`                 | Ecran village complet (min 200 lignes)          | ✓ VERIFIED  | 630 lignes. Toutes sections presentes. Export default VillageScreen                                 |

---

## Key Link Verification

| From                      | To                                       | Via                              | Status      | Details                                                        |
|---------------------------|------------------------------------------|----------------------------------|-------------|----------------------------------------------------------------|
| `TileMapRenderer.tsx`     | `lib/mascot/farm-map.ts`                 | `buildVillageMap()` import        | ✓ WIRED     | Import ligne 34, usage ligne 539                               |
| `app/(tabs)/tree.tsx`     | `/(tabs)/village`                        | `router.push`                    | ✓ WIRED     | Ligne 2037: `router.push('/(tabs)/village' as any)`           |
| `app/(tabs)/village.tsx`  | `hooks/useGarden.ts`                     | `useGarden()` hook               | ✓ WIRED     | Import ligne 30, destructuring complet ligne 119-128           |
| `app/(tabs)/village.tsx`  | `components/mascot/TileMapRenderer.tsx`  | TileMapRenderer mode='village'   | ✓ WIRED     | Ligne 235: `<TileMapRenderer ... mode="village" />`            |
| `app/(tabs)/village.tsx`  | `components/ui/LiquidXPBar.tsx`          | LiquidXPBar color=barColor       | ✓ WIRED     | Import ligne 32, usage ligne 259 avec `color={barColor}`       |
| `app/(tabs)/village.tsx`  | `components/ui/CollapsibleSection.tsx`   | CollapsibleSection historique     | ✓ WIRED     | Import ligne 33, usage ligne 387 avec `id=village_week_*`      |
| `app/(tabs)/village.tsx`  | `components/ui/ReactiveAvatar.tsx`       | ReactiveAvatar indicateurs membres | ✓ WIRED   | Import ligne 34, usage ligne 352 avec `mood="idle"`            |

---

## Data-Flow Trace (Level 4)

| Artifact               | Variable donnee    | Source                                       | Produit donnees reelles | Statut      |
|------------------------|--------------------|----------------------------------------------|-------------------------|-------------|
| `village.tsx`          | `gardenData`       | `useGarden()` → `parseGardenFile(gardenRaw)` | Oui — `gardenRaw` lit `jardin-familial.md` via `vault.readFile(VILLAGE_FILE)` dans `useVault.ts` (ligne 1078 de useVault.ts, confirme Phase 26) | ✓ FLOWING   |
| `village.tsx`          | `progress`         | `gardenData.contributions?.length ?? 0`      | Oui — compte les contributions depuis le fichier vault | ✓ FLOWING   |
| `village.tsx`          | `weekHistory`      | `gardenData.pastWeeks ?? []`                 | Oui — depuis le vault. Vide si premiere semaine | ✓ FLOWING   |
| `village.tsx`          | `profiles`         | `useVault().profiles`                        | Oui — charge depuis les fichiers gami-*.md dans le vault | ✓ FLOWING   |

---

## Behavioral Spot-Checks

| Behavior                             | Verification                                           | Statut  |
|--------------------------------------|--------------------------------------------------------|---------|
| `buildVillageMap()` retourne FarmMapData avec cobblestone ~60% | `fillRect(cobblestone, 2, 4, 10, 16)` detecte dans farm-map.ts | ✓ PASS  |
| `tsc --noEmit` passe sans erreur     | `npx tsc --noEmit; echo EXIT:$?` → EXIT:0              | ✓ PASS  |
| village.tsx exporte un composant default | `export default function VillageScreen()` ligne 114 | ✓ PASS  |
| `useGarden()` retourne les champs requis | Interface `UseGardenReturn` (ligne 53) inclut tous les champs consommes par village.tsx | ✓ PASS  |
| Rendu visuel tilemap cobblestone     | Necessite device (graphique)                           | ? SKIP  |

---

## Requirements Coverage

| Requirement | Plan source | Description                                                              | Statut           | Evidence                                                                  |
|-------------|-------------|--------------------------------------------------------------------------|------------------|---------------------------------------------------------------------------|
| MAP-01      | 27-01, 27-02 | Carte "Place du Village" terrain cobblestone via TileMapRenderer         | ✓ SATISFIED      | `buildVillageMap()` cree la carte, `TileMapRenderer mode='village'` la rend dans village.tsx |
| COOP-03     | 27-02        | Feed contributions — qui a fait quoi cette semaine                       | ✓ SATISFIED      | `FeedItem` avec nom, type, montant, heure relative. `formatRelativeTime()`. Etat vide gere |
| COOP-04     | 27-02        | Indicateur per-membre — contribution de chaque profil                    | ✓ SATISFIED      | `memberContribs` useMemo + `ReactiveAvatar` + total + nom pour chaque profil actif |
| OBJ-02      | 27-02        | Barre de progression avancement collectif                                | ✓ SATISFIED      | `LiquidXPBar current={progress} total={currentTarget}`, couleur adaptee selon `isGoalReached` |
| HIST-01     | 27-02        | Panneau interactif historique semaines accomplies                        | ✓ SATISFIED      | `CollapsibleSection` par semaine avec `id=village_week_*`, `defaultCollapsed=true` |
| HIST-02     | 27-02        | Chaque semaine enregistre : cible, total, contributions par membre, recompense claimed | ✗ PARTIEL | `VillageWeekRecord` manque `contributionsByMember`. L'historique affiche cible/total/statut/claimed mais PAS le detail par membre. Reconnu comme Pitfall 5. |

---

## Anti-Patterns Trouvés

| Fichier              | Ligne | Pattern                                   | Severite   | Impact                                                                                            |
|----------------------|-------|-------------------------------------------|------------|---------------------------------------------------------------------------------------------------|
| `app/(tabs)/tree.tsx` | 2037 | `router.push('/(tabs)/village' as any)`   | ℹ️ Info    | Cast necessaire car expo-router type-verifie les routes. Fonctionnel a l'execution. Documenté dans SUMMARY-01 |
| `app/(tabs)/village.tsx` | 211 | `router.replace('/(tabs)/tree' as any)` | ⚠️ Warning | Plan specifiait `router.back()`, l'implementation utilise `router.replace`. Fonctionnel mais navigation stack differente — l'ecran ferme est recharge au lieu de remonter dans l'historique |
| `lib/village/types.ts` | 28-33 | `VillageWeekRecord` sans `contributionsByMember` | 🛑 Blocker | HIST-02 requiert les contributions par membre dans le record. Le modele de donnees n'inclut pas ce champ — les semaines archivees ne peuvent pas afficher le detail par membre |

---

## Verification Humaine Requise

### 1. Verification visuelle ecran village

**Test:** Lancer `npx expo run:ios --device`, ouvrir l'onglet Arbre, taper sur le FAB 🏘️ en bas-droite de la carte.
**Expected:**
- L'ecran "Place du Village" s'ouvre avec carte tilemap cobblestone en haut (42% ecran)
- La carte ne montre PAS d'arbres fruitiers ni de koi (distincts de la ferme)
- Les sections sous la carte : Objectif de la semaine (barre verte), Contributions cette semaine, Membres actifs, Semaines precedentes
- Bouton retour (‹) en haut a gauche fonctionne
**Why human:** Rendu graphique Wang tileset, feedback haptic, transitions visuelles.

---

## Gaps Summary

**1 gap bloquant — HIST-02 contributions par membre manquantes**

HIST-02 exige que chaque semaine enregistre les contributions par membre dans l'historique. Le type `VillageWeekRecord` ne contient que `weekStart`, `target`, `total`, `claimed`. Ce manque est reconnu dans le plan comme "Pitfall 5" mais n'a pas ete resolu — c'est un compromis technique documente, non un oubli.

Impact: L'historique affiche les agregats (total/cible/statut) mais pas le detail par profil. Les semaines archivees perdent definitivement l'information "qui a contribue combien". Les contributions de la semaine courante sont visibles via le feed.

Pour fermer ce gap:
1. Ajouter `contributionsByMember?: Record<string, number>` dans `VillageWeekRecord` (lib/village/types.ts)
2. Calculer et archiver ce champ dans `useGarden.ts` lors du rollover de semaine (~ligne 148)
3. Afficher le detail par membre dans les `CollapsibleSection` historique (village.tsx)

**Note architecturale:** Les 8 autres must-haves sont pleinement implementes et cables sur des donnees reelles. Le goal principal (ecran village navigable, visuellement distinct, avec feed/barre/membres/historique) est substantiellement atteint.

---

_Verified: 2026-04-10T22:00:00Z_
_Verifier: Claude (gsd-verifier)_
