---
phase: 260421-nvj-phase-a-grades-de-recolte
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - lib/mascot/tech-engine.ts
  - lib/mascot/grade-engine.ts
  - lib/__tests__/grade-engine.test.ts
  - hooks/useFarm.ts
  - app/(tabs)/tree.tsx
  - locales/fr/common.json
  - locales/en/common.json
autonomous: true
requirements:
  - GRADE-01  # Tech culture-5 "Agriculture de précision" (10 000 🍃, prérequis culture-4)
  - GRADE-02  # Moteur pur rollHarvestGrade : 70/20/8/2 + multiplicateurs ×1/×1.5/×2.5/×4
  - GRADE-03  # Branchement récolte : bonus coins immédiats (compat ascendante sans tech)
  - GRADE-04  # Toast récolte enrichi : grade affiché + coins gagnés
  - GRADE-05  # i18n FR/EN pour la tech + grades + toast
  - GRADE-06  # Tests unitaires Jest (probas + multiplicateurs + absence de tech = ×1)

must_haves:
  truths:
    - "Sans tech culture-5 (prérequis non atteint ou non achetée), aucune récolte ne déclenche de bonus de grade — comportement identique à aujourd'hui (statu quo strict)."
    - "Avec tech culture-5 débloquée, chaque récolte roll un grade (Ordinaire 70% / Beau 20% / Superbe 8% / Parfait 2%) et applique le multiplicateur correspondant (×1 / ×1.5 / ×2.5 / ×4) sur harvestReward."
    - "Les coins bonus sont crédités immédiatement au moment de la récolte via addCoins (pas d'inventaire par grade — Phase A)."
    - "Le toast de récolte (HarvestCardToast) affiche le grade obtenu + coins gagnés quand un grade > Ordinaire est roulé."
    - "La tech culture-5 apparaît automatiquement dans TechTreeSheet (rendue depuis TECH_TREE) avec coût 10 000 🍃 et prérequis culture-4."
    - "npx tsc --noEmit passe clean ; npx jest lib/__tests__/grade-engine.test.ts passe."
  artifacts:
    - path: "lib/mascot/grade-engine.ts"
      provides: "Moteur pur : HarvestGrade type, GRADE_PROBABILITIES, GRADE_MULTIPLIERS, rollHarvestGrade(rng?), getGradeMultiplier, getGradeLabelKey"
    - path: "lib/__tests__/grade-engine.test.ts"
      provides: "Tests Jest : distribution sur 10 000 rolls (marges ±2%), multiplicateurs exacts, injection RNG déterministe"
    - path: "lib/mascot/tech-engine.ts"
      provides: "TECH_TREE étendu avec noeud culture-5 (cost 10000, requires culture-4)"
  key_links:
    - from: "hooks/useFarm.ts:harvest"
      to: "lib/mascot/grade-engine.ts"
      via: "import + rollHarvestGrade() gated par unlockedTechs.includes('culture-5')"
      pattern: "rollHarvestGrade|getGradeMultiplier"
    - from: "hooks/useFarm.ts:harvest"
      to: "addCoins"
      via: "bonus coins = Math.round(cropDef.harvestReward * finalQty * (multiplier - 1))"
      pattern: "addCoins\\(profileId,\\s*gradeBonusCoins"
    - from: "app/(tabs)/tree.tsx:handleCropCellPress"
      to: "showHarvestCard (HarvestItem.grade)"
      via: "prop grade optionnel transmis par result.grade"
      pattern: "grade:\\s*result\\.grade"
---

<objective>
Ajouter la tech culture-5 "Agriculture de précision" qui active un système de grades de récolte (Ordinaire / Beau / Superbe / Parfait) avec multiplicateurs de coins immédiats. Compatibilité ascendante totale : sans la tech, aucun changement de comportement.

Purpose : Phase A d'un système de grades (Phase B ultérieure fera inventaire + craft + marché). Ici, simple pari bienveillant : plus de récoltes → chance occasionnelle de coins bonus, sans pénalité.

Output : Moteur pur testé + 1 noeud tech + branchement harvest + toast enrichi + i18n.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@CLAUDE.md
@lib/mascot/tech-engine.ts
@lib/mascot/farm-engine.ts
@lib/mascot/types.ts
@hooks/useFarm.ts
@app/(tabs)/tree.tsx
@contexts/ToastContext.tsx
@components/gamification/HarvestCardToast.tsx

<interfaces>
<!-- Extraits clés du codebase existant — ne pas re-explorer -->

From lib/mascot/tech-engine.ts :
```typescript
export interface TechNode {
  id: string;              // ex: 'culture-5'
  branch: TechBranchId;    // 'culture' | 'elevage' | 'expansion'
  order: number;
  labelKey: string;
  descriptionKey: string;
  emoji: string;
  cost: number;
  requires: string | null;
}
export const TECH_TREE: TechNode[] = [...]; // Ajouter culture-5 en fin de branche Culture
```

From hooks/useFarm.ts (signature actuelle du harvest — l'étendre avec grade) :
```typescript
const harvest = useCallback(async (profileId, plotIndex): Promise<{
  cropId: string; isGolden: boolean;
  harvestEvent: HarvestEvent | null; seedDrop: RareSeedDrop | null;
  qty: number;
  wager?: { won; multiplier; dropBack; cumulCurrent; cumulTarget };
  sporeeFirstObtained?: boolean;
  // AJOUTER :
  grade?: HarvestGrade;       // undefined si tech culture-5 absente
  gradeBonusCoins?: number;   // 0 si grade === 'ordinaire' ou absent
} | null>
```

Note : la liste des techs est déjà disponible via `getTechBonuses(profile.farmTech ?? [])` et le tableau brut via `profile.farmTech ?? []`.

From components/gamification/HarvestCardToast.tsx :
```typescript
export interface HarvestItem {
  emoji: string; label: string; qty: number;
  wager?: { won; multiplier; dropBack };
  // AJOUTER (optionnel) :
  grade?: { key: HarvestGrade; bonusCoins: number; emoji: string };
}
```

From contexts/ToastContext.tsx : le merge par emoji dans showHarvestCard garde le dernier `grade` comme pour `wager` — pattern identique.

From locales/fr/common.json (ligne ~4259) : les clés tech sont sous `"tech": { "culture-4": "...", "culture-4_desc": "..." }` — ajouter `culture-5` et `culture-5_desc` dans le même objet. Les clés grades vont dans un nouveau sous-objet `"farm": { "grade": { "ordinaire": "...", ... } }`.
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1 : Moteur pur grade-engine + extension TECH_TREE + tests Jest</name>
  <files>lib/mascot/grade-engine.ts, lib/__tests__/grade-engine.test.ts, lib/mascot/tech-engine.ts</files>
  <behavior>
    Tests à écrire AVANT implémentation (RED → GREEN) :
    - rollHarvestGrade(rng) avec rng déterministe retourne bien :
      * rng=0.00 → 'ordinaire'
      * rng=0.69 → 'ordinaire' (limite haute 70%)
      * rng=0.70 → 'beau'
      * rng=0.89 → 'beau' (limite haute 20%)
      * rng=0.90 → 'superbe'
      * rng=0.97 → 'superbe' (limite haute 8%)
      * rng=0.98 → 'parfait'
      * rng=0.999 → 'parfait'
    - Distribution sur 10 000 rolls (Math.random) : ordinaire ∈ [68%, 72%], beau ∈ [18%, 22%], superbe ∈ [6%, 10%], parfait ∈ [1%, 3%]
    - getGradeMultiplier : 'ordinaire'→1, 'beau'→1.5, 'superbe'→2.5, 'parfait'→4
    - getGradeLabelKey : retourne la clé i18n attendue (`farm.grade.ordinaire`, etc.)
    - TECH_TREE contient culture-5 avec branch='culture', order=5, cost=10000, requires='culture-4', emoji='🔬' (ou similaire culture), labelKey='tech.culture-5', descriptionKey='tech.culture-5_desc'
  </behavior>
  <action>
    1. Créer `lib/mascot/grade-engine.ts` :
       ```typescript
       export type HarvestGrade = 'ordinaire' | 'beau' | 'superbe' | 'parfait';

       // Cumulatif : 0-0.70 ordinaire, 0.70-0.90 beau, 0.90-0.98 superbe, 0.98-1.00 parfait
       export const GRADE_THRESHOLDS: Array<[HarvestGrade, number]> = [
         ['ordinaire', 0.70],
         ['beau',     0.90],
         ['superbe',  0.98],
         ['parfait',  1.00],
       ];

       export const GRADE_MULTIPLIERS: Record<HarvestGrade, number> = {
         ordinaire: 1,
         beau:      1.5,
         superbe:   2.5,
         parfait:   4,
       };

       export const GRADE_EMOJIS: Record<HarvestGrade, string> = {
         ordinaire: '⚪', beau: '🟢', superbe: '🟡', parfait: '🟣',
       };

       /** RNG injectable pour tests déterministes (Math.random par défaut) */
       export function rollHarvestGrade(rng: () => number = Math.random): HarvestGrade {
         const r = rng();
         for (const [grade, upper] of GRADE_THRESHOLDS) {
           if (r < upper) return grade;
         }
         return 'parfait'; // fallback rng=1.0
       }

       export function getGradeMultiplier(grade: HarvestGrade): number {
         return GRADE_MULTIPLIERS[grade];
       }

       export function getGradeLabelKey(grade: HarvestGrade): string {
         return `farm.grade.${grade}`;
       }

       export function getGradeEmoji(grade: HarvestGrade): string {
         return GRADE_EMOJIS[grade];
       }
       ```
    2. Étendre `lib/mascot/tech-engine.ts` : ajouter en fin de branche Culture (après culture-4) :
       ```typescript
       {
         id: 'culture-5', branch: 'culture', order: 5,
         labelKey: 'tech.culture-5', descriptionKey: 'tech.culture-5_desc',
         emoji: '🔬', cost: 10000, requires: 'culture-4',
       },
       ```
       NE PAS toucher à `getTechBonuses` (l'effet de culture-5 est consommé directement dans useFarm.ts via `unlockedTechs.includes('culture-5')` — pas un TechBonus agrégé, car c'est un effet probabiliste per-roll, pas un multiplicateur global).
    3. Créer `lib/__tests__/grade-engine.test.ts` avec les tests listés dans <behavior>. Utiliser un RNG fake `() => 0.69` pour les limites, et un loop `Math.random` pour la distribution (accepter ±2% de tolérance). Mocker `Math.random` n'est pas nécessaire — utiliser l'injection rng.
    4. Vérifier : `npx jest lib/__tests__/grade-engine.test.ts --no-coverage` passe.
    5. Vérifier : `npx tsc --noEmit` reste clean sur les fichiers touchés.

    Compat ascendante : grade-engine est un module pur isolé — zéro import depuis le reste du code à ce stade. TECH_TREE étend simplement un tableau, TechTreeSheet (qui itère TECH_TREE) affiche automatiquement le nouveau noeud.
  </action>
  <verify>
    <automated>npx jest lib/__tests__/grade-engine.test.ts --no-coverage && npx tsc --noEmit</automated>
  </verify>
  <done>
    - lib/mascot/grade-engine.ts existe avec types + rollHarvestGrade + helpers
    - lib/__tests__/grade-engine.test.ts : ≥6 tests passent, distribution 10 000 rolls vérifiée
    - TECH_TREE contient le noeud culture-5 (cost 10000, requires culture-4)
    - Zéro erreur TS nouvelle
    - TechTreeSheet affichera automatiquement culture-5 au prochain render (pas de modif UI directe)
  </done>
</task>

<task type="auto">
  <name>Task 2 : Branchement harvest (useFarm.ts) + toast enrichi (tree.tsx + HarvestCardToast) + i18n FR/EN</name>
  <files>hooks/useFarm.ts, app/(tabs)/tree.tsx, components/gamification/HarvestCardToast.tsx, contexts/ToastContext.tsx, locales/fr/common.json, locales/en/common.json</files>
  <action>
    1. **hooks/useFarm.ts — étendre `harvest`** (lignes ~316-472) :
       - Importer : `import { rollHarvestGrade, getGradeMultiplier, getGradeEmoji, type HarvestGrade } from '../lib/mascot/grade-engine';`
       - Après le calcul de `finalQty` (après application wager/golden), AVANT le return, ajouter le calcul grade SEULEMENT si la tech est débloquée :
         ```typescript
         const unlockedTechs = profile.farmTech ?? [];
         const hasGradeTech = unlockedTechs.includes('culture-5');
         let grade: HarvestGrade | undefined;
         let gradeBonusCoins = 0;
         if (hasGradeTech) {
           grade = rollHarvestGrade();
           const multiplier = getGradeMultiplier(grade);
           // Bonus coins = harvestReward × finalQty × (multiplier - 1) — delta par rapport à la vente normale
           // Phase A : coins immédiats, pas d'inventaire par grade.
           const harvestReward = CROP_CATALOG.find(c => c.id === result.harvestedCropId)?.harvestReward ?? 0;
           gradeBonusCoins = Math.round(harvestReward * finalQty * (multiplier - 1));
         }
         ```
       - Après `await writeProfileFields(...)` (les deux chemins golden et standard), si `gradeBonusCoins > 0`, appeler :
         ```typescript
         if (gradeBonusCoins > 0) {
           await addCoins(profileId, gradeBonusCoins, `✨ Récolte grade ${grade} ×${getGradeMultiplier(grade!)}`);
         }
         ```
         (dans la branche wasGoldenEffect ET la branche standard — les deux returns).
       - Étendre le type de retour et ajouter `grade` + `gradeBonusCoins` aux deux `return { ... }` finaux.
       - CRITIQUE : SANS tech culture-5, `grade` et `gradeBonusCoins` restent `undefined`/0 → aucune modification de comportement (compat stricte).

    2. **components/gamification/HarvestCardToast.tsx** — étendre `HarvestItem` :
       ```typescript
       export interface HarvestItem {
         emoji: string; label: string; qty: number;
         wager?: { won: boolean; multiplier: number; dropBack: boolean };
         grade?: { key: string; bonusCoins: number; emoji: string }; // NOUVEAU
       }
       ```
       Dans le rendu de la card (chercher le bloc existant wager badge), ajouter un badge grade juste après le wager badge (conditionnel `item.grade && item.grade.key !== 'ordinaire'`) :
       - Format : `{grade.emoji} {labelGrade} +{grade.bonusCoins} 🍃`
       - Utiliser useThemeColors() pour les couleurs (jamais hardcoded — ou constantes Farm theme si existantes pour grades). Tokens Spacing/FontSize/Radius. Animation d'apparition cohérente avec le badge wager existant (pop spring reanimated).
       - Import i18n `useTranslation` + `t('farm.grade.' + grade.key)`.

    3. **app/(tabs)/tree.tsx — handleCropCellPress** (ligne ~1325) : transmettre `grade` au `showHarvestCard` :
       ```typescript
       showHarvestCard(
         {
           emoji, label: harvestLabel, qty: result.qty,
           wager: result.wager?.won ? { ... } : undefined,
           grade: result.grade && result.grade !== 'ordinaire' ? {
             key: result.grade,
             bonusCoins: result.gradeBonusCoins ?? 0,
             emoji: getGradeEmoji(result.grade), // import depuis grade-engine
           } : undefined,
         },
         result.isGolden,
       );
       ```
       Haptique optionnel : sur grade === 'parfait', déclencher `Haptics.notificationAsync(Success)` pour récompense tactile.

    4. **contexts/ToastContext.tsx** — le merge existant (ligne ~180) préfère le `wager` du nouvel item. Appliquer le même pattern pour `grade` :
       ```typescript
       ? { ...i, qty: i.qty + item.qty, wager: item.wager ?? i.wager, grade: item.grade ?? i.grade }
       ```

    5. **locales/fr/common.json** — ajouter dans l'objet `"tech"` :
       ```json
       "culture-5": "Agriculture de précision",
       "culture-5_desc": "Chance d'obtenir des récoltes de qualité supérieure (Beau 20% ×1.5 · Superbe 8% ×2.5 · Parfait 2% ×4)",
       ```
       Et dans `"farm"` (créer sous-objet `"grade"` s'il n'existe pas) :
       ```json
       "grade": {
         "ordinaire": "Ordinaire",
         "beau": "Beau",
         "superbe": "Superbe",
         "parfait": "Parfait"
       }
       ```

    6. **locales/en/common.json** — miroir EN :
       ```json
       "culture-5": "Precision Farming",
       "culture-5_desc": "Chance to harvest premium quality crops (Fine 20% ×1.5 · Superb 8% ×2.5 · Perfect 2% ×4)",
       ```
       Et :
       ```json
       "grade": { "ordinaire": "Common", "beau": "Fine", "superbe": "Superb", "parfait": "Perfect" }
       ```

    7. Vérifier manuellement : `TechTreeSheet.tsx` itère `TECH_TREE` → culture-5 s'affichera automatiquement (pas de modif nécessaire). Si TechTreeSheet a des sections hardcodées par order (1-4), vérifier via Grep qu'il n'y a pas de limite order <= 4.

    Gotchas :
    - NE PAS modifier CROP_CATALOG ni harvestReward (types.ts) — juste les lire.
    - NE PAS toucher le flow wager/golden/seedDrop existant — le grade est additif.
    - gradeBonusCoins = Math.round(reward × qty × (mult - 1)) : delta, pas total — le joueur vendra toujours sa récolte dans son inventaire en plus (statu quo). Le grade c'est du BONUS pur.
    - addCoins appelé APRÈS writeProfileFields : pas de race, addCoins lit gami-{id}.md (fichier séparé).
    - Commentaires en français (convention CLAUDE.md).
  </action>
  <verify>
    <automated>npx tsc --noEmit && npx jest lib/__tests__/grade-engine.test.ts --no-coverage</automated>
  </verify>
  <done>
    - harvest() dans useFarm.ts retourne grade + gradeBonusCoins (undefined/0 sans tech)
    - addCoins appelé avec gradeBonusCoins quand grade > ordinaire
    - HarvestCardToast affiche badge grade (emoji + label i18n + +X 🍃) pour grades > ordinaire
    - ToastContext merge le grade comme le wager
    - i18n FR + EN complets (tech.culture-5, tech.culture-5_desc, farm.grade.*)
    - npx tsc --noEmit clean
    - Sans tech culture-5 débloquée : comportement strictement identique à aujourd'hui (zéro nouveau coin, zéro badge grade affiché)
    - TechTreeSheet affiche culture-5 automatiquement (coût 10000, requires culture-4)
  </done>
</task>

</tasks>

<verification>
1. `npx tsc --noEmit` — zéro erreur nouvelle
2. `npx jest lib/__tests__/grade-engine.test.ts --no-coverage` — tous les tests passent
3. Smoke test manuel (optionnel, auto mode) :
   - Sans culture-5 débloqué : récolter une carotte → toast récolte identique à avant, pas de badge grade, pas de coins bonus
   - Avec culture-5 débloqué (via dev/admin ou unlock manuel du profil) : récolter ~10 fois → observer au moins 1-2 grades > ordinaire avec badge + coins bonus crédités dans gamification
</verification>

<success_criteria>
- Tech culture-5 apparaît dans TechTreeSheet (rendu auto depuis TECH_TREE)
- Roll de grade uniquement si culture-5 débloqué (compat ascendante stricte)
- Multiplicateurs ×1/×1.5/×2.5/×4 appliqués correctement sur coins bonus
- Toast récolte affiche grade + coins gagnés pour grades > ordinaire
- Tests unitaires Jest : distribution statistique + multiplicateurs + injection RNG
- i18n FR/EN complets
- tsc clean
- Phase B future non bloquée (grade est déjà typé + calculé ; suffira d'ajouter un inventaire par grade plus tard)
</success_criteria>

<output>
Après complétion, créer `.planning/quick/260421-nvj-phase-a-grades-de-r-colte-tech-culture-5/260421-nvj-SUMMARY.md` résumant :
- Fichiers créés/modifiés
- Décisions techniques (bonus delta vs total, RNG injection, pattern additif non-breaking)
- Points d'attention Phase B (futur inventaire par grade + craft/marché)
</output>
