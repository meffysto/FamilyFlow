---
phase: 18-tutoriel-ferme
plan: 04
type: execute
wave: 3
depends_on: [18-01, 18-02, 18-03]
files_modified:
  - app/(tabs)/tree.tsx
autonomous: false
requirements: [TUTO-01, TUTO-02, TUTO-06, TUTO-07]
must_haves:
  truths:
    - "Au premier affichage de l'écran ferme sur l'appareil, le tutoriel se déclenche automatiquement (TUTO-01)"
    - "Les animations WorldGridView sont mises en pause pendant le tutoriel via paused={activeFarmTutorialStep !== null} (TUTO-06)"
    - "Le bouton 'Rejouer le tutoriel' dans FarmCodexModal relance effectivement la séquence (TUTO-07 end-to-end)"
    - "Le flag SecureStore 'farm_tutorial' empêche le retrigger aux affichages suivants (TUTO-02)"
  artifacts:
    - path: "app/(tabs)/tree.tsx"
      provides: "Intégration FarmTutorialOverlay + pause WorldGridView + refs cibles"
      contains: "FarmTutorialOverlay"
  key_links:
    - from: "app/(tabs)/tree.tsx"
      to: "FarmTutorialOverlay"
      via: "Mount au-dessus du HUD avec refs cibles"
      pattern: "FarmTutorialOverlay"
    - from: "app/(tabs)/tree.tsx"
      to: "WorldGridView"
      via: "paused prop depuis useHelp().activeFarmTutorialStep"
      pattern: "paused=\\{activeFarmTutorialStep"
---

<objective>
Finaliser la phase 18 en intégrant `FarmTutorialOverlay` dans `app/(tabs)/tree.tsx` : monter le composant au-dessus du HUD, créer des refs sur les cibles des étapes 2-4, et passer `paused={activeFarmTutorialStep !== null}` à `WorldGridView`. Valider la boucle complète end-to-end : premier affichage → tutoriel → skip ou done → rejouer depuis codex.

Purpose: TUTO-01 (déclenchement auto), TUTO-02 (persistance device), TUTO-06 (pause), TUTO-07 (rejouable end-to-end).
Output: 1 fichier modifié + validation humaine de la boucle complète.
</objective>

<context>
@.planning/phases/18-tutoriel-ferme/18-CONTEXT.md
@.planning/phases/18-tutoriel-ferme/18-RESEARCH.md
@CLAUDE.md
@app/(tabs)/tree.tsx
@components/mascot/FarmTutorialOverlay.tsx
@components/mascot/WorldGridView.tsx
@contexts/HelpContext.tsx
@components/mascot/FarmCodexModal.tsx

<interfaces>
API à consommer (déjà livrée par Plan 01-03) :
```typescript
// useHelp() (HelpContext étendu)
const { activeFarmTutorialStep, setActiveFarmTutorialStep } = useHelp();

// FarmTutorialOverlay props (Plan 03)
<FarmTutorialOverlay
  profile={profile}
  targetRefs={{ plantation, harvest, hudXp }}
/>

// WorldGridView props (Plan 01)
<WorldGridView
  /* props existants */
  paused={activeFarmTutorialStep !== null}
/>
```
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Intégrer FarmTutorialOverlay + pause WorldGridView dans tree.tsx</name>
  <files>app/(tabs)/tree.tsx</files>
  <read_first>
    - app/(tabs)/tree.tsx (lecture intégrale : structure du render, position HUD, WorldGridView props, FarmCodexModal)
    - components/mascot/FarmTutorialOverlay.tsx (créé en Plan 03 — lire l'API des props targetRefs)
    - .planning/phases/18-tutoriel-ferme/18-RESEARCH.md section "Intégration tree.tsx" (incluant la note sur les refs problématiques)
  </read_first>
  <action>
    Apporter 4 modifications à `app/(tabs)/tree.tsx` :

    **1. Import et hook HelpContext étendu :**
    En haut du fichier, ajouter l'import de `FarmTutorialOverlay` :
    ```typescript
    import { FarmTutorialOverlay } from '../../components/mascot/FarmTutorialOverlay';
    ```
    Dans le composant `TreeScreen` (ou nom équivalent), lire `activeFarmTutorialStep` depuis `useHelp()` :
    ```typescript
    const { activeFarmTutorialStep } = useHelp();
    ```
    Si `useHelp` n'est pas déjà importé dans tree.tsx, ajouter :
    ```typescript
    import { useHelp } from '../../contexts/HelpContext';
    ```

    **2. Refs cibles pour étapes 2-4 :**
    Créer 3 refs dans le composant :
    ```typescript
    const plantationRef = useRef<View>(null);
    const harvestRef = useRef<View>(null);
    const hudXpRef = useRef<View>(null);
    ```
    Attacher ces refs à des éléments existants du render :
    - `plantationRef` : sur la View wrapper du diorama / du conteneur `WorldGridView` (cible approximative "zone ferme" — RESEARCH.md Pitfall 3 : les cellules internes ne sont pas ref-able)
    - `harvestRef` : sur le même conteneur diorama si aucune meilleure cible n'est disponible (documenter dans un commentaire inline)
    - `hudXpRef` : sur le premier élément HUD affichant coins/XP (ex. la View englobant `styles.hudItem` du compteur XP/coins) — ajouter `ref={hudXpRef}` directement sur la View existante

    Si les éléments HUD sont inline sans View dédiée, créer un wrapper View minimal autour de l'élément XP pour pouvoir poser la ref (sans changer le layout visuel).

    **3. Passer `paused` à WorldGridView :**
    Localiser le `<WorldGridView ...props />` existant dans le JSX et ajouter le nouveau prop :
    ```tsx
    <WorldGridView
      /* props existants inchangés */
      paused={activeFarmTutorialStep !== null}
    />
    ```

    **4. Monter `<FarmTutorialOverlay />` au niveau absolu :**
    Ajouter le composant à la fin du JSX principal (après le HUD, après `FarmCodexModal`, au même niveau que les autres overlays modaux). Le placer dans un fragment ou wrapper qui garantit `zIndex` supérieur au HUD (le composant lui-même gère son `StyleSheet.absoluteFill` et son `zIndex` interne, mais s'assurer qu'il n'est pas inclus dans une View clippée) :
    ```tsx
    <FarmTutorialOverlay
      profile={profile}
      targetRefs={{
        plantation: plantationRef,
        harvest: harvestRef,
        hudXp: hudXpRef,
      }}
    />
    ```
    Où `profile` est le profil actif déjà disponible dans tree.tsx (typiquement depuis `useVault()` ou équivalent — utiliser la variable existante).

    **NE PAS** :
    - Modifier ScreenGuide.tsx ou le mount existant de ScreenGuide dans tree.tsx (D-08, coexistence)
    - Ajouter un nouveau provider (TUTO-08)
    - Modifier FarmCodexModal.tsx — `handleReplayTutorial` appelle déjà `resetScreen('farm_tutorial')` (Phase 17), Plan 03 rend cet appel fonctionnel via `useEffect([seen])`
    - Hardcoder une couleur
    - Changer la structure de la ScrollView ou casser le layout existant
  </action>
  <verify>
    <automated>grep -q "FarmTutorialOverlay" app/\(tabs\)/tree.tsx &amp;&amp; grep -q "activeFarmTutorialStep" app/\(tabs\)/tree.tsx &amp;&amp; grep -q "paused={activeFarmTutorialStep" app/\(tabs\)/tree.tsx &amp;&amp; grep -q "plantationRef\|harvestRef\|hudXpRef" app/\(tabs\)/tree.tsx &amp;&amp; npx tsc --noEmit</automated>
  </verify>
  <acceptance_criteria>
    - grep `import.*FarmTutorialOverlay` trouve l'import
    - grep `FarmTutorialOverlay` trouve au moins 2 occurrences (import + JSX mount)
    - grep `activeFarmTutorialStep` trouve au moins 2 occurrences (destructure useHelp + prop paused)
    - grep `paused=\{activeFarmTutorialStep !== null\}` (ou syntaxe équivalente) trouve exactement 1 occurrence sur WorldGridView
    - grep `plantationRef` ou `hudXpRef` trouve au moins 1 occurrence (création de ref)
    - `npx tsc --noEmit` exit code 0
    - Aucune nouvelle dépendance npm
  </acceptance_criteria>
  <done>tree.tsx monte FarmTutorialOverlay avec refs cibles, passe paused à WorldGridView, compile clean.</done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 2: Validation humaine end-to-end du tutoriel</name>
  <files>app/(tabs)/tree.tsx</files>
  <read_first>
    - .planning/REQUIREMENTS.md section TUTO-01 à TUTO-08
    - .planning/phases/18-tutoriel-ferme/18-CONTEXT.md section decisions D-01 à D-10
  </read_first>
  <action>
    Checkpoint bloquant : exécuter manuellement les étapes décrites dans how-to-verify sur device TestFlight et valider les 8 TUTO-0X. Aucun fichier modifié — cette tâche valide le travail combiné des Plans 01-04.
  </action>
  <verify>
    <automated>echo "Checkpoint human-verify — see how-to-verify section for manual steps"</automated>
  </verify>
  <done>Toutes les validations humaines TUTO-01 à TUTO-08 passent sur device, aucun coach mark existant cassé.</done>
  <what-built>
    Tutoriel ferme 5 étapes complet :
    - Déclenchement automatique au premier affichage de l'écran ferme
    - Étapes 1 et 5 en cartes narratives plein écran (sprite arbre profil / emoji 📖)
    - Étapes 2, 3, 4 en coach marks avec spotlight rectangle arrondi
    - Bouton "Passer" à toutes les étapes
    - Animations WorldGridView pausées pendant le tutoriel
    - Persistance device via SecureStore (HelpContext)
    - Rejouable depuis le codex (bouton "Rejouer le tutoriel")
  </what-built>
  <how-to-verify>
    **Préparation :**
    1. Lancer `npx expo run:ios --device` sur l'appareil TestFlight
    2. Sur l'appareil : ouvrir l'app, aller dans Réglages dev → reset des flags help (ou désinstaller/réinstaller l'app pour partir d'un état vierge)

    **TUTO-01 — Déclenchement auto :**
    3. Naviguer vers l'écran ferme (tab Ferme / arbre)
    4. Attendre ~600ms — le tutoriel doit apparaître automatiquement avec la carte narrative étape 1 ("Bienvenue à la ferme !")
    5. Vérifier que le sprite arbre du profil actif s'affiche (ou 🌳 fallback)

    **TUTO-06 — Pause animations :**
    6. Regarder attentivement la ferme en arrière-plan pendant le tutoriel : les papillons, oiseaux, sprites crops/animals, particules DOIVENT être figés (aucune animation visible)
    7. Mesurer ou vérifier visuellement que le frame rate reste fluide (≥ 58 fps ressenti)

    **TUTO-03 — 5 étapes ordonnées :**
    8. Taper "Suivant" → étape 2 (coach mark plantation) avec spotlight arrondi
    9. Taper "Suivant" → étape 3 (coach mark croissance/récolte)
    10. Taper "Suivant" → étape 4 (coach mark XP/loot — spotlight sur HUD)
    11. Taper "Suivant" → étape 5 (carte narrative finale avec 📖)
    12. Taper "C'est parti !" → le tutoriel se ferme, les animations ferme reprennent

    **TUTO-01/TUTO-02 — Pas de retrigger :**
    13. Quitter et rouvrir l'écran ferme → le tutoriel NE DOIT PAS réapparaître

    **TUTO-07 — Rejouable depuis codex :**
    14. Tap sur bouton "?" du HUD → FarmCodexModal s'ouvre
    15. Naviguer vers le bouton "Rejouer le tutoriel" (CODEX-10)
    16. Tap → la modale se ferme ET le tutoriel se relance à l'étape 1

    **TUTO-05 — Skip à tout moment :**
    17. Relancer le tutoriel (via codex replay)
    18. À l'étape 2 (ou n'importe laquelle), taper "Passer"
    19. Vérifier que l'overlay se ferme immédiatement et que les animations ferme reprennent
    20. Quitter et rouvrir l'écran → le tutoriel NE DOIT PAS réapparaître (flag vu positionné au skip)

    **TUTO-04 — Rectangle arrondi :**
    21. Pendant les étapes 2-4, vérifier visuellement que le cutout spotlight a des coins arrondis (pas d'angles droits) et que la zone cible reste bien éclairée tandis que le reste est assombri (rgba 0.6)

    **Anti-régression :**
    22. Ouvrir d'autres écrans avec coach marks existants (dashboard, tasks) : ScreenGuide doit fonctionner comme avant (spotlight rectangulaire droit)
  </how-to-verify>
  <acceptance_criteria>
    - TUTO-01 : tutoriel déclenché au premier affichage (validé visuellement)
    - TUTO-02 : pas de retrigger après fermeture (validé)
    - TUTO-03 : 5 étapes traversées dans l'ordre attendu (validé)
    - TUTO-04 : spotlight rectangle arrondi visible sur étapes 2-4 (validé)
    - TUTO-05 : bouton Passer ferme immédiatement et positionne le flag (validé)
    - TUTO-06 : animations WorldGridView figées pendant tutoriel, ≥58fps (validé)
    - TUTO-07 : rejouable depuis codex "Rejouer le tutoriel" (validé end-to-end)
    - TUTO-08 : aucun nouveau provider (validé par grep sur diff)
    - Anti-régression : ScreenGuide des autres écrans fonctionne comme avant
  </acceptance_criteria>
  <resume-signal>Taper "approved" si toutes les validations passent, sinon décrire le problème rencontré et à quelle étape.</resume-signal>
</task>

</tasks>

<verification>
- `npx tsc --noEmit` passe
- Tree.tsx monte FarmTutorialOverlay
- Validation humaine approuvée sur les 8 TUTO-0X
</verification>

<success_criteria>
- [ ] TUTO-01, TUTO-02, TUTO-06, TUTO-07 validés end-to-end
- [ ] Anti-régression : aucun coach mark existant cassé
- [ ] Pile de providers reste à 8 niveaux
</success_criteria>

<output>
After completion, create `.planning/phases/18-tutoriel-ferme/18-04-tree-integration-SUMMARY.md`
</output>
