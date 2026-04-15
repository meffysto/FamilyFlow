---
phase: quick-260415-mby
plan: 01
type: execute
wave: 1
depends_on: []
files_modified: [components/mascot/VisitorSlot.tsx]
autonomous: true
requirements: [QUICK-mby]
must_haves:
  truths:
    - "Le visiteur saisonnier (targetFX < 0.5) entre par la gauche et marche vers la droite"
    - "Le visiteur saga (targetFX >= 0.5) entre par la droite et marche vers la gauche (comportement actuel)"
    - "Aucun fade-in — opacité 1 dès le début, le visiteur est simplement hors-écran"
    - "Le sprite walk est flippé correctement selon le côté d'entrée"
    - "Le départ se fait par le même côté que l'entrée"
  artifacts:
    - path: "components/mascot/VisitorSlot.tsx"
      provides: "Entrée directionnelle visiteur"
      contains: "enterFromLeft"
  key_links:
    - from: "VisitorSlot.tsx"
      to: "targetFX prop"
      via: "Condition targetFX < 0.5 pour direction d'entrée"
      pattern: "enterFromLeft"
---

<objective>
Rendre l'animation d'entrée du visiteur naturelle : le personnage marche progressivement dans la map depuis hors-écran, côté gauche ou droit selon sa position cible (targetFX). Plus de fade-in artificiel.

Purpose: Le fade-in + spring depuis la droite est identique pour tous les visiteurs et ne correspond pas à un mouvement naturel dans le diorama. Les visiteurs saisonniers (côté gauche) entrent par la droite ce qui est incohérent.
Output: VisitorSlot.tsx avec entrée directionnelle dynamique.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@components/mascot/VisitorSlot.tsx
</context>

<tasks>

<task type="auto">
  <name>Tâche 1 : Entrée directionnelle dynamique du visiteur</name>
  <files>components/mascot/VisitorSlot.tsx</files>
  <action>
Modifier VisitorSlot.tsx pour que l'entrée et le départ du visiteur soient dynamiques selon le côté de la map :

1. **Calculer le côté d'entrée** — Ajouter une variable dérivée `enterFromLeft` :
   ```typescript
   const effectiveFX = propTargetFX ?? TARGET_FX;
   const enterFromLeft = effectiveFX < 0.5;
   ```

2. **ENTRY_X et DEPART_X dynamiques** — Remplacer les constantes actuelles (lignes 189-190) :
   ```typescript
   const ENTRY_X = enterFromLeft ? -VISITOR_SIZE : containerWidth * 1.15;
   const DEPART_X = enterFromLeft ? -VISITOR_SIZE * 1.5 : containerWidth * 1.20;
   ```

3. **posX initial dynamique** — Le useSharedValue(ENTRY_X) ne se met pas à jour après le premier render. Utiliser un useEffect pour initialiser posX à ENTRY_X avant l'animation d'entrée. Alternative : garder le useSharedValue avec une valeur initiale hors-écran droite (par défaut), et dans le useEffect d'entrée, setter posX.value = ENTRY_X avant de lancer le spring. C'est plus simple :
   ```typescript
   // Dans le useEffect visible (ligne 205-221) :
   posX.value = ENTRY_X; // Position initiale hors-écran (côté correct)
   opacity.value = 1;    // Opacité 1 direct — PAS de withTiming fade-in
   ```

4. **Flip sprite pendant l'entrée** — Les sprites walk sont `walk_left_*.png` (personnage marchant vers la gauche). Quand le visiteur entre par la gauche (enterFromLeft=true), il marche vers la DROITE, donc il faut flipper le sprite (scaleX: -1). Ajouter un état `flipForEntry` :
   ```typescript
   const [flipForEntry, setFlipForEntry] = useState(false);
   ```
   Dans le useEffect d'entrée :
   ```typescript
   setFlipForEntry(enterFromLeft); // flip si entre par la gauche
   ```
   Et dans le callback finished du spring d'entrée :
   ```typescript
   runOnJS(setFlipForEntry)(false); // reset flip quand idle
   ```

5. **Appliquer le flip sur Image** — Modifier la condition de flip du sprite (ligne 455) pour combiner entrée et départ :
   ```typescript
   (flipForDepart || flipForEntry) ? { transform: [{ scaleX: -1 }] } : {}
   ```
   ATTENTION : flipForDepart inverse scaleX pour marcher vers la droite pendant le départ. Pour le départ côté GAUCHE (enterFromLeft), le visiteur marche vers la gauche = sprites normaux (pas de flip). Donc modifier la logique de départ (ligne 358) :
   ```typescript
   setFlipForDepart(!enterFromLeft); // flip seulement si départ vers la droite
   ```

6. **Départ vers le bon côté** — La ligne 382 `posX.value = withSpring(DEPART_X, ...)` utilise déjà DEPART_X qui est maintenant dynamique. Rien à changer ici.

7. **Supprimer le fade-in** — Ligne 210 : remplacer `opacity.value = withTiming(1, { duration: 200 })` par `opacity.value = 1` (affectation directe, pas d'animation).

Résumé des changements :
- Ajouter `effectiveFX`, `enterFromLeft` (variables dérivées)
- ENTRY_X et DEPART_X conditionnels
- `flipForEntry` state + logique dans useEffect entrée
- `opacity.value = 1` direct (plus de fade-in)
- `posX.value = ENTRY_X` explicite avant le spring
- `setFlipForDepart(!enterFromLeft)` dans le useEffect départ
- Combiner `flipForDepart || flipForEntry` sur l'Image
  </action>
  <verify>
    <automated>cd /Users/gabrielwaltio/Documents/family-vault && npx tsc --noEmit 2>&1 | head -30</automated>
  </verify>
  <done>
- Le visiteur saga (targetFX=0.72) entre par la droite, marche vers la gauche (sprites normaux), repart vers la droite (flip)
- Le visiteur saisonnier (targetFX=0.28) entre par la gauche, marche vers la droite (flip), repart vers la gauche (pas de flip)
- Aucun fade-in — opacité 1 immédiate, le personnage est simplement hors-écran et marche dedans
- TypeScript compile sans erreur
  </done>
</task>

</tasks>

<verification>
- `npx tsc --noEmit` passe sans nouvelles erreurs
- Vérifier visuellement sur device : visiteur saga entre par la droite, visiteur saisonnier entre par la gauche
- Le sprite est orienté dans la bonne direction pendant la marche d'entrée et de départ
</verification>

<success_criteria>
- L'entrée du visiteur est naturelle — il marche depuis hors-écran sans fade-in
- La direction d'entrée correspond au côté de la map (gauche pour saisonnier, droite pour saga)
- Le départ se fait par le même côté que l'entrée
- Le flip du sprite walk est correct dans les 4 cas (entrée gauche, entrée droite, départ gauche, départ droite)
</success_criteria>

<output>
After completion, create `.planning/quick/260415-mby-entr-e-naturelle-visiteur-marche-depuis-/260415-mby-SUMMARY.md`
</output>
