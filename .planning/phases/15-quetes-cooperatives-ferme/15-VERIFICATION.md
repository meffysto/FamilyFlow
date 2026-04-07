---
phase: 15-quetes-cooperatives-ferme
verified: 2026-04-06T14:00:00Z
status: human_needed
score: 7/7 must-haves verified
re_verification:
  previous_status: gaps_found
  previous_score: 5/7
  gaps_closed:
    - "La progression d'une quete augmente quand un membre complete une tache, recolte, ou defi"
  gaps_remaining: []
  regressions: []
human_verification:
  - test: "Verifier que le banner ferme s'anime (FadeInDown) et que la barre de progression se met a jour apres completion manuelle"
    expected: "La banniere apparait avec animation, la barre affiche le bon ratio current/target"
    why_human: "Necessite l'app en execution sur simulateur"
  - test: "Verifier que le picker de templates est invisible pour un profil enfant"
    expected: "Le bouton '+ Nouvelle quete familiale' ne s'affiche pas quand le profil actif a role='enfant'"
    why_human: "Role gate UI depend du profil actif au runtime"
  - test: "Verifier la notification d'expiration sur simulateur"
    expected: "Une notification locale apparait immediatement quand une quete active a une endDate < today au rechargement"
    why_human: "expo-notifications necessite un contexte d'app reelle"
  - test: "Completion de quete avec reward ferme"
    expected: "Selon le type de reward : lootBoxesAvailable incremente, farmRareSeeds augmente, ou activeEffect ecrit dans family-quests.md"
    why_human: "Necessite de manipuler les fichiers Markdown du vault et de l'app en execution"
---

# Phase 15: Quetes Cooperatives Ferme — Rapport de Verification

**Phase Goal:** Systeme de quetes cooperatives familiales — creer, progresser, completer des quetes partagees avec recompenses ferme. Contrainte : 1 seule quete active a la fois, demarrage reserve aux adultes/ados, detection expiration avec notification, UI banniere ferme + dashboard compact.
**Verified:** 2026-04-06T14:00:00Z
**Status:** human_needed (tous les checks automatises passent)
**Re-verification:** Oui — apres cloture du gap Truth 4 (plan 15-03)

---

## Re-verification Summary

Previous score: 5/7 (Truth 4 FAILED — progression automatique non chablee)
Current score: 7/7 (Truth 4 CLOSED — 4 call sites corriges)

### Gap clos : Truth 4

Plan 15-03 a effectue 4 modifications chirurgicales :

1. `hooks/useVault.ts` — questsHook initialise AVANT defisHook (l.508-515); `questsHook.contribute` passe comme 5e param a `useVaultDefis`
2. `app/(tabs)/tree.tsx` — `useFarm(contributeFamilyQuest)` (l.311)
3. `app/(tabs)/tasks.tsx` — `useGamification({ vault, notifPrefs, onQuestProgress: contributeFamilyQuest })` (l.194)
4. `app/(tabs)/index.tsx` — `useGamification({ vault, notifPrefs, onQuestProgress: contributeFamilyQuest })` (l.219)

---

## Goal Achievement

### Observable Truths

| #  | Truth                                                                                                          | Status      | Evidence                                                                                  |
|----|----------------------------------------------------------------------------------------------------------------|-------------|-------------------------------------------------------------------------------------------|
| 1  | Une quete familiale peut etre creee depuis un template avec target, reward, et dates                           | VERIFIED    | startQuest() useVaultFamilyQuests.ts l.79 : createQuestFromTemplate + write disk          |
| 2  | Une seule quete active a la fois — startQuest refuse si une quete est deja active                              | VERIFIED    | l.83 : familyQuests.some(q => q.status === 'active') + Alert.alert                       |
| 3  | Seuls les adultes et ados peuvent demarrer une quete (role check)                                              | VERIFIED    | l.94 : profile.role !== 'adulte' && profile.role !== 'ado' + Alert.alert                 |
| 4  | La progression d'une quete augmente quand un membre complete une tache, recolte, ou defi                       | VERIFIED    | useFarm(contributeFamilyQuest) tree.tsx l.311 ; onQuestProgress: contributeFamilyQuest tasks.tsx l.194 + index.tsx l.219 ; questsHook.contribute passe a useVaultDefis useVault.ts l.514 |
| 5  | Quand current >= target, la quete peut etre completee et les recompenses ferme s'appliquent a tous les profils | VERIFIED    | completeQuest() l.166 : applyQuestReward(vault, profileIds, quest.farmReward) reward-first |
| 6  | Les quetes et leur progression sont persistees dans family-quests.md et rechargees au demarrage                | VERIFIED    | useVault.ts l.1107-1111 : readFile(FAMILY_QUESTS_FILE) + parseFamilyQuests + setFamilyQuests |
| 7  | Une quete expiree est detectee au loadVault, passe en expired, et declenche une notification locale            | VERIFIED    | checkAndExpireQuests l.205-236 : endDate < todayStr + scheduleNotificationAsync (trigger: null) |

**Score:** 7/7 truths verified

---

### Required Artifacts — Plan 01

| Artifact                          | Expected                                             | Status      | Details                                                                       |
|-----------------------------------|------------------------------------------------------|-------------|-------------------------------------------------------------------------------|
| `lib/quest-engine.ts`             | Types + applyQuestReward + serialize/parse + create  | VERIFIED    | 13.9K — export async function applyQuestReward, all types present             |
| `constants/questTemplates.ts`     | 7 templates cooperatifs                              | VERIFIED    | 2.3K — QUEST_TEMPLATES avec 7 entrees dont moisson_collective                 |
| `lib/parser.ts`                   | parseFamilyQuests + serializeFamilyQuests            | VERIFIED    | l.1046/1053/1121 — FAMILY_QUESTS_FILE, parseFamilyQuests, serializeFamilyQuests |
| `hooks/useVaultFamilyQuests.ts`   | CRUD quetes + contrainte 1 active + role check       | VERIFIED    | startQuest/contribute/completeQuest/checkAndExpireQuests tous presents         |

### Required Artifacts — Plan 02

| Artifact                                    | Expected                                         | Status      | Details                                                                        |
|---------------------------------------------|--------------------------------------------------|-------------|--------------------------------------------------------------------------------|
| `components/mascot/FamilyQuestBanner.tsx`   | Widget banniere + barre progression + avatars    | VERIFIED    | 6.9K — FadeInDown, barre, contributions (max 4), getRewardLabel exporte        |
| `components/mascot/FamilyQuestDetailSheet.tsx` | Bottom sheet detail + boutons completer/suppr | VERIFIED    | 11.3K — pageSheet, FlatList contributions, onComplete/onDelete presents        |
| `components/mascot/FamilyQuestPickerSheet.tsx` | Picker templates + role gate UI              | VERIFIED    | 6.1K — QUEST_TEMPLATES, pageSheet, React.memo                                  |
| `components/dashboard/DashboardGarden.tsx`  | Indicateur compact quete active                  | VERIFIED    | familyQuests depuis useVault(), activeQuest memo, questCompact styles          |

### Required Artifacts — Plan 03 (gap closure)

| Artifact                | Expected                                                          | Status   | Evidence                                                                         |
|-------------------------|-------------------------------------------------------------------|----------|----------------------------------------------------------------------------------|
| `hooks/useVault.ts`     | questsHook avant defisHook; questsHook.contribute en 5e param    | VERIFIED | l.508-514 : questsHook initialise l.511, defisHook l.514 avec 5 params          |
| `app/(tabs)/tree.tsx`   | useFarm(contributeFamilyQuest)                                    | VERIFIED | l.311 : useFarm(contributeFamilyQuest) confirme                                  |
| `app/(tabs)/tasks.tsx`  | onQuestProgress: contributeFamilyQuest dans useGamification       | VERIFIED | l.193-194 : contributeFamilyQuest destructure + passe                            |
| `app/(tabs)/index.tsx`  | onQuestProgress: contributeFamilyQuest dans useGamification       | VERIFIED | l.213-219 : contributeFamilyQuest destructure + passe                            |

---

### Key Link Verification

| From                         | To                              | Via                                         | Status   | Details                                                                    |
|------------------------------|---------------------------------|---------------------------------------------|----------|----------------------------------------------------------------------------|
| hooks/useVault.ts            | hooks/useVaultFamilyQuests.ts   | questsHook = useVaultFamilyQuests(…)        | WIRED    | l.511 — initialise avant defisHook                                         |
| hooks/useVault.ts            | hooks/useVaultDefis.ts          | questsHook.contribute comme 5e param        | WIRED    | l.514 — useVaultDefis(..., questsHook.contribute) confirme                 |
| hooks/useGamification.ts     | onQuestProgress callback        | onQuestProgress: contributeFamilyQuest      | WIRED    | tasks.tsx l.194 + index.tsx l.219 — passe aux deux call sites              |
| hooks/useFarm.ts             | onQuestProgress callback        | useFarm(contributeFamilyQuest)              | WIRED    | tree.tsx l.311 — argument positionnel confirme                             |
| hooks/useVaultDefis.ts       | onQuestProgress callback        | 5e param recu depuis useVault.ts            | WIRED    | useVault.ts l.514 — questsHook.contribute passe                           |
| app/(tabs)/tree.tsx          | FamilyQuestBanner               | rendu conditionnel avant WeeklyGoal         | WIRED    | activeQuest ? banner : bouton                                              |
| FamilyQuestBanner            | FamilyQuestDetailSheet          | onPress -> setShowQuestDetail(true)         | WIRED    | showQuestDetail state + modal conditionnel                                 |
| FamilyQuestPickerSheet       | startFamilyQuest                | onSelect -> handleCreateQuest               | WIRED    | handleCreateQuest useCallback avec startFamilyQuest(templateId)            |
| DashboardGarden.tsx          | familyQuests (via useVault)     | familyQuests depuis useVault()              | WIRED    | activeQuest memo, rendu compact                                            |

---

### Data-Flow Trace (Level 4)

| Artifact                      | Data Variable   | Source                                        | Produit des vraies donnees | Status   |
|-------------------------------|-----------------|-----------------------------------------------|----------------------------|----------|
| FamilyQuestBanner.tsx         | quest (prop)    | activeQuest = familyQuests.find(active)        | Oui — lu depuis disk       | FLOWING  |
| DashboardGarden.tsx           | familyQuests    | useVault() -> parseFamilyQuests(disk)          | Oui — fichier family-quests.md | FLOWING |
| useVaultFamilyQuests contribute | current/contributions | Lit family-quests.md frais (l.131-132) | Oui — read-modify-write    | FLOWING  |
| tree.tsx activeQuest          | familyQuests    | useVault() -> questsHook.familyQuests          | Oui — state mis a jour au load | FLOWING |
| useFarm -> onQuestProgress    | contribute()    | contributeFamilyQuest passe l.311              | Oui — declenche depuis vraie action farm | FLOWING |
| useGamification -> onQuestProgress | contribute() | contributeFamilyQuest passe tasks.tsx+index.tsx | Oui — declenche depuis vraie completion tache | FLOWING |
| useVaultDefis -> onQuestProgress | contribute() | questsHook.contribute passe l.514             | Oui — declenche depuis completion defi | FLOWING |

---

### Requirements Coverage

| Requirement | Plan(s)    | Description                                                                                       | Status   | Evidence                                                                          |
|-------------|------------|---------------------------------------------------------------------------------------------------|----------|-----------------------------------------------------------------------------------|
| QUEST-01    | 01, 02, 03 | Quete familiale demarrable, progressable par n'importe quel membre, completable avec reward ferme | VERIFIED | Creer/contribuer/completer tout cabres — 4 call sites connectes par plan 03       |
| QUEST-02    | 02         | Banniere widget ferme avec quete active, progression globale, contributions par membre            | VERIFIED | FamilyQuestBanner, FamilyQuestDetailSheet, integration tree.tsx                  |
| QUEST-03    | 01, 02     | Recompenses ferme distinctives (cultures, batiments, graines rares, trophee) distinctes XP indiv. | VERIFIED | applyQuestReward (11 variantes), FamilyFarmReward union discriminee, getRewardLabel |

---

### Anti-Patterns Found

Aucun anti-pattern bloquant. Les 4 appels precedemment manquants sont corriges.

| Fichier | Pattern | Severite | Impact |
|---------|---------|----------|--------|
| — | Aucun | — | — |

Aucune couleur hardcodee detectee dans les composants mascot. Aucun TODO/FIXME/placeholder. tsc propre (erreurs pre-existantes uniquement).

---

### Behavioral Spot-Checks

Step 7b: SKIPPED — les behaviors cles (progression quete) necessitent l'app en execution (hooks React, expo-notifications, iCloud). Voir Human Verification ci-dessous.

---

### Human Verification Required

#### 1. Animation FadeInDown et barre de progression en direct

**Test:** Sur simulateur iOS, ouvrir l'ecran Ferme avec une quete active. Observer l'animation d'entree de la banniere et la barre de progression.
**Expected:** La banniere glisse depuis le bas (FadeInDown), la barre affiche le bon ratio current/target, les avatars de contribution s'affichent.
**Why human:** Necessite l'app en execution sur simulateur.

#### 2. Role gate UI — bouton invisible pour enfant

**Test:** Changer le profil actif vers un profil avec role='enfant'. Aller sur l'ecran Ferme sans quete active.
**Expected:** Le bouton '+ Nouvelle quete familiale' n'est PAS visible. Un profil adulte/ado voit le bouton.
**Why human:** Role gate depend du profil actif au runtime (activeProfile.role).

#### 3. Notification d'expiration quete

**Test:** Creer une quete avec endDate = hier (ou modifier family-quests.md directement). Redemarrer l'app.
**Expected:** Une notification locale apparait immediatement au rechargement, avec le titre 'Quete expiree' et le nom de la quete.
**Why human:** expo-notifications et la persistence iCloud necessitent un contexte d'app reelle.

#### 4. Completion de quete avec reward ferme

**Test:** Creer une quete, incrementer manuellement current >= target dans family-quests.md, ouvrir le detail sheet, taper 'Completer la quete'. Verifier dans gami-{profileId}.md que la recompense est appliquee.
**Expected:** Selon le type de reward : lootBoxesAvailable incremente, ou farmRareSeeds augmente, ou champ activeEffect ecrit dans family-quests.md.
**Why human:** Necessite de manipuler les fichiers Markdown du vault et de l'app en execution.

---

### Gaps Summary

Aucun gap restant. Le gap unique (Truth 4 — progression automatique non chablee) est clos par plan 15-03.

Les 4 call sites manquants ont ete corriges de facon chirurgicale :
- `hooks/useVault.ts` : ordre initialisation inverse (questsHook avant defisHook) + `questsHook.contribute` passe comme 5e param a `useVaultDefis`
- `app/(tabs)/tree.tsx` : `useFarm(contributeFamilyQuest)` au lieu de `useFarm()`
- `app/(tabs)/tasks.tsx` : `contributeFamilyQuest` destructure depuis `useVault()` + passe comme `onQuestProgress`
- `app/(tabs)/index.tsx` : `contributeFamilyQuest` destructure depuis `useVault()` + passe comme `onQuestProgress`

Toutes les 7 truths observables sont VERIFIED. Les 3 requirements QUEST-01/02/03 sont VERIFIED. L'objectif de la phase est atteint.

Les 4 items restants en Human Verification concernent le comportement a l'execution (animations, role gate UI, notifications) — ils ne bloquent pas l'objectif de phase.

---

_Verified: 2026-04-06T14:00:00Z_
_Verifier: Claude (gsd-verifier)_
_Re-verification: Oui — apres cloture gap Truth 4 par plan 15-03_
