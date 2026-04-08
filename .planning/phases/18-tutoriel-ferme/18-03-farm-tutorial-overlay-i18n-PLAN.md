---
phase: 18-tutoriel-ferme
plan: 03
type: execute
wave: 2
depends_on: [18-01, 18-02]
files_modified:
  - components/mascot/FarmTutorialOverlay.tsx
  - locales/fr/help.json
  - locales/en/help.json
autonomous: true
requirements: [TUTO-03, TUTO-04, TUTO-05, TUTO-07]
must_haves:
  truths:
    - "FarmTutorialOverlay orchestre 5 étapes : 2 cartes narratives (1, 5) + 3 coach marks (2, 3, 4)"
    - "Un bouton 'Passer' est visible à toutes les étapes et appelle markScreenSeen('farm_tutorial') immédiatement"
    - "Quand resetScreen('farm_tutorial') est appelé depuis FarmCodexModal, la séquence se relance (hasStarted.current reset)"
    - "Les clés i18n help.farm_tutorial.* existent en FR et EN (parité stricte)"
  artifacts:
    - path: "components/mascot/FarmTutorialOverlay.tsx"
      provides: "Orchestrateur tutoriel 5 étapes"
      contains: "FarmTutorialOverlay"
    - path: "locales/fr/help.json"
      provides: "Textes FR tutoriel"
      contains: "farm_tutorial"
    - path: "locales/en/help.json"
      provides: "Textes EN tutoriel (parité)"
      contains: "farm_tutorial"
  key_links:
    - from: "FarmTutorialOverlay"
      to: "HelpContext"
      via: "useHelp() { hasSeenScreen, markScreenSeen, isLoaded, setActiveFarmTutorialStep }"
      pattern: "setActiveFarmTutorialStep"
    - from: "FarmTutorialOverlay"
      to: "CoachMark + CoachMarkOverlay"
      via: "import depuis components/help"
      pattern: "CoachMark"
---

<objective>
Créer le composant orchestrateur `FarmTutorialOverlay` (D-07) qui pilote 5 étapes (2 cartes narratives + 3 coach marks rectangle arrondi), avec bouton "Passer" à toutes les étapes, déclenchement automatique au premier affichage, et relance fonctionnelle via `resetScreen('farm_tutorial')`. Ajouter les textes i18n FR+EN sous `help.farm_tutorial.*`.

Purpose: TUTO-03 (5 étapes), TUTO-04 (spotlight arrondi), TUTO-05 (skip), TUTO-07 (rejouable).
Output: 1 composant créé, 2 fichiers i18n mis à jour.
</objective>

<context>
@.planning/phases/18-tutoriel-ferme/18-CONTEXT.md
@.planning/phases/18-tutoriel-ferme/18-RESEARCH.md
@CLAUDE.md
@contexts/HelpContext.tsx
@components/help/ScreenGuide.tsx
@components/help/CoachMark.tsx
@components/help/CoachMarkOverlay.tsx
@components/mascot/TreeView.tsx
@locales/fr/help.json
@locales/en/help.json

<interfaces>
Contrat d'utilisation de HelpContext (déjà étendu en Plan 01) :
```typescript
const {
  hasSeenScreen,
  markScreenSeen,
  isLoaded,
  activeFarmTutorialStep,
  setActiveFarmTutorialStep,
} = useHelp();
```

Props de FarmTutorialOverlay (consommé par tree.tsx en Plan 04) :
```typescript
interface FarmTutorialOverlayProps {
  profile: Profile;  // pour lire profile.species et déterminer le sprite arbre étape 1
  targetRefs?: {
    plantation?: React.RefObject<View | null>;  // étape 2
    harvest?: React.RefObject<View | null>;     // étape 3
    hudXp?: React.RefObject<View | null>;       // étape 4
  };
}
```

Mapping sprite arbre (duplication locale depuis TreeView.tsx, D-02) :
```typescript
const SPECIES_TO_FRUIT: Record<string, string> = {
  cerisier: 'peach',
  chene: 'apple_red',
  oranger: 'orange',
  bambou: 'plum',
  palmier: 'pear',
};
```

Spring config (cohérent CoachMark) :
```typescript
const SPRING_CONFIG = { damping: 12, stiffness: 140 };
```
</interfaces>
</context>

<tasks>

<task type="auto" tdd="false">
  <name>Task 1: Ajouter clés i18n help.farm_tutorial.* (FR + EN) (D-10)</name>
  <files>locales/fr/help.json, locales/en/help.json</files>
  <read_first>
    - locales/fr/help.json (lecture intégrale pour comprendre la structure existante)
    - locales/en/help.json (lecture intégrale)
    - .planning/phases/18-tutoriel-ferme/18-RESEARCH.md section "i18n — Structure des clés"
  </read_first>
  <action>
    Ajouter une section `farm_tutorial` dans les deux fichiers JSON avec parité stricte (mêmes clés, mêmes niveaux).

    Structure à ajouter (FR) dans `locales/fr/help.json` :
    ```json
    "farm_tutorial": {
      "step1": {
        "title": "Bienvenue à la ferme !",
        "body": "Ici, tu cultives, récoltes et regardes ton arbre grandir. Laisse-moi te montrer comment ça marche."
      },
      "step2": {
        "title": "Plante ta première culture",
        "body": "Tape sur une parcelle vide pour planter une graine. Chaque culture a son propre cycle."
      },
      "step3": {
        "title": "Le cycle de croissance",
        "body": "Tes cultures poussent avec le temps. Quand elles sont mûres, récolte-les d'un tap !"
      },
      "step4": {
        "title": "Récolte et gains XP",
        "body": "Chaque récolte te donne des pièces et de l'XP. Ton arbre et ta mascotte progressent avec toi."
      },
      "step5": {
        "title": "Et ensuite ?",
        "body": "Ouvre le codex 📖 depuis le bouton en haut de la ferme pour découvrir toutes les cultures, animaux, bâtiments et secrets."
      },
      "skip": "Passer",
      "next": "Suivant",
      "done": "C'est parti !"
    }
    ```

    Équivalent EN dans `locales/en/help.json` (parité stricte, mêmes clés, traduction naturelle) :
    ```json
    "farm_tutorial": {
      "step1": {
        "title": "Welcome to the farm!",
        "body": "Here you grow crops, harvest them, and watch your tree thrive. Let me show you the basics."
      },
      "step2": {
        "title": "Plant your first crop",
        "body": "Tap an empty plot to plant a seed. Each crop has its own growth cycle."
      },
      "step3": {
        "title": "The growth cycle",
        "body": "Your crops grow over time. When they're ripe, tap them to harvest!"
      },
      "step4": {
        "title": "Harvest and XP gains",
        "body": "Every harvest rewards coins and XP. Your tree and companion grow with you."
      },
      "step5": {
        "title": "What's next?",
        "body": "Open the codex 📖 from the button at the top of the farm to discover all crops, animals, buildings and secrets."
      },
      "skip": "Skip",
      "next": "Next",
      "done": "Let's go!"
    }
    ```

    Insérer proprement dans le JSON existant sans casser les autres clés. Préserver l'indentation existante.

    **NE PAS** :
    - Créer un nouveau namespace (utiliser `help` existant)
    - Oublier la parité FR/EN (test de parité en Phase 16 pourrait checker)
    - Mettre du texte anglais dans le fichier FR ou vice-versa
  </action>
  <verify>
    <automated>node -e "const fr=require('./locales/fr/help.json'); const en=require('./locales/en/help.json'); const keys=(o,p='')=>Object.entries(o).flatMap(([k,v])=>typeof v==='object'?keys(v,p+k+'.'):[p+k]); const fk=keys(fr.farm_tutorial).sort(); const ek=keys(en.farm_tutorial).sort(); if(JSON.stringify(fk)!==JSON.stringify(ek)){console.error('parity mismatch',fk,ek);process.exit(1)} console.log('OK',fk.length,'keys')"</automated>
  </verify>
  <acceptance_criteria>
    - `locales/fr/help.json` contient la clé racine `farm_tutorial` avec sous-clés step1..step5, skip, next, done
    - `locales/en/help.json` contient exactement les mêmes clés (parité)
    - Les deux fichiers restent du JSON valide (parsable via `node -e "require('./locales/fr/help.json')"`)
    - Le script node de verify exit 0 et affiche "OK" avec au minimum 13 clés
  </acceptance_criteria>
  <done>Les 2 fichiers i18n contiennent farm_tutorial avec parité FR/EN stricte.</done>
</task>

<task type="auto" tdd="false">
  <name>Task 2: Créer FarmTutorialOverlay (orchestrateur 5 étapes) (D-07)</name>
  <files>components/mascot/FarmTutorialOverlay.tsx</files>
  <read_first>
    - components/help/ScreenGuide.tsx (patron à dupliquer — hasStarted.current, useEffect [seen], mesure 600ms)
    - components/help/CoachMark.tsx (props API : targetRect, title, body, onNext, onDismiss, stepIndex, totalSteps)
    - components/help/CoachMarkOverlay.tsx (props API avec le nouveau borderRadius du Plan 02)
    - components/mascot/TreeView.tsx (pour copier SPECIES_TO_FRUIT)
    - contexts/HelpContext.tsx (API étendue en Plan 01)
    - .planning/phases/18-tutoriel-ferme/18-RESEARCH.md sections "Patron d'orchestration", "Format mixte (discriminated union)", "Mesure des cibles", "Sprite arbre pour illustration étape 1", "Pitfall 2", "Pitfall 4", "Pitfall 5"
  </read_first>
  <action>
    Créer le fichier `components/mascot/FarmTutorialOverlay.tsx` — nouveau orchestrateur sibling de ScreenGuide (D-08 : ne pas modifier ScreenGuide).

    **Structure générale (dupliquée du patron ScreenGuide.tsx) :**

    ```typescript
    import React, { useEffect, useRef, useState, useCallback } from 'react';
    import { View, Text, Image, StyleSheet, Pressable, Dimensions } from 'react-native';
    import Animated, { useSharedValue, useAnimatedStyle, withSpring, withTiming } from 'react-native-reanimated';
    import { useTranslation } from 'react-i18next';
    import * as Haptics from 'expo-haptics';
    import { useHelp } from '../../contexts/HelpContext';
    import { useThemeColors } from '../../contexts/ThemeContext';
    import { CoachMark } from '../help/CoachMark';
    import { CoachMarkOverlay } from '../help/CoachMarkOverlay';
    import type { Profile } from '../../lib/types';  // adapter au vrai path
    // ... imports selon besoin réel

    const SCREEN_ID = 'farm_tutorial';
    const TRIGGER_DELAY_MS = 600;  // cohérent ScreenGuide
    const SPRING_CONFIG = { damping: 12, stiffness: 140 };

    // Duplication locale depuis TreeView.tsx (D-02, Pitfall 5)
    const SPECIES_TO_FRUIT: Record<string, string> = {
      cerisier: 'peach',
      chene: 'apple_red',
      oranger: 'orange',
      bambou: 'plum',
      palmier: 'pear',
    };

    // Require map statique pour Metro bundler (les dynamic requires cassent)
    const TREE_SPRITES: Record<string, any> = {
      apple_red: require('../../assets/garden/trees/apple_red/spring_3.png'),
      orange: require('../../assets/garden/trees/orange/spring_3.png'),
      peach: require('../../assets/garden/trees/peach/spring_3.png'),
      plum: require('../../assets/garden/trees/plum/spring_3.png'),
      pear: require('../../assets/garden/trees/pear/spring_3.png'),
    };

    type TargetRect = { x: number; y: number; width: number; height: number };

    interface FarmTutorialOverlayProps {
      profile: { species?: string; tree?: string; [k: string]: any };
      targetRefs?: {
        plantation?: React.RefObject<View | null>;
        harvest?: React.RefObject<View | null>;
        hudXp?: React.RefObject<View | null>;
      };
    }

    export function FarmTutorialOverlay({ profile, targetRefs }: FarmTutorialOverlayProps) {
      const { t } = useTranslation();
      const colors = useThemeColors();
      const {
        hasSeenScreen,
        markScreenSeen,
        isLoaded,
        setActiveFarmTutorialStep,
      } = useHelp();

      const [currentStep, setCurrentStep] = useState<number>(-1);  // -1 = inactif
      const [measuredRect, setMeasuredRect] = useState<TargetRect | null>(null);
      const hasStarted = useRef(false);
      const seen = hasSeenScreen(SCREEN_ID);

      // Pitfall 2 : reset hasStarted quand resetScreen() appelé depuis codex
      useEffect(() => {
        if (!seen) { hasStarted.current = false; }
      }, [seen]);

      // Déclenchement initial (délai 600ms)
      useEffect(() => {
        if (!isLoaded || hasStarted.current || seen) return;
        hasStarted.current = true;
        const timer = setTimeout(() => {
          setCurrentStep(0);
          setActiveFarmTutorialStep(0);
        }, TRIGGER_DELAY_MS);
        return () => clearTimeout(timer);
      }, [isLoaded, seen, setActiveFarmTutorialStep]);

      // Mesurer cible pour coach marks (étapes 1, 2, 3 en index 0-based ? NON — on a 5 étapes
      // Étape 0 = narrative, 1-2-3 = coach, 4 = narrative)
      const measureForStep = useCallback((step: number) => {
        const refMap = [null, targetRefs?.plantation, targetRefs?.harvest, targetRefs?.hudXp, null];
        const ref = refMap[step];
        if (!ref?.current) { setMeasuredRect(null); return; }
        ref.current.measureInWindow((x, y, width, height) => {
          if (width === 0 && height === 0) { setMeasuredRect(null); return; }
          setMeasuredRect({ x, y, width, height });
        });
      }, [targetRefs]);

      useEffect(() => {
        if (currentStep >= 1 && currentStep <= 3) {
          measureForStep(currentStep);
        } else {
          setMeasuredRect(null);
        }
      }, [currentStep, measureForStep]);

      const handleNext = useCallback(() => {
        Haptics.selectionAsync().catch(() => {});
        if (currentStep >= 4) {
          // Dernière étape : done
          markScreenSeen(SCREEN_ID);
          setCurrentStep(-1);
          setActiveFarmTutorialStep(null);
          return;
        }
        const next = currentStep + 1;
        setCurrentStep(next);
        setActiveFarmTutorialStep(next);
      }, [currentStep, markScreenSeen, setActiveFarmTutorialStep]);

      const handleSkip = useCallback(() => {
        Haptics.selectionAsync().catch(() => {});
        markScreenSeen(SCREEN_ID);
        setCurrentStep(-1);
        setActiveFarmTutorialStep(null);
      }, [markScreenSeen, setActiveFarmTutorialStep]);

      if (currentStep < 0) return null;

      // Rendu étapes 0 et 4 : cartes narratives plein écran
      if (currentStep === 0 || currentStep === 4) {
        return (
          <NarrativeCard
            step={currentStep}
            profile={profile}
            colors={colors}
            t={t}
            onNext={handleNext}
            onSkip={handleSkip}
            treeSprite={resolveTreeSprite(profile)}
          />
        );
      }

      // Étapes 1, 2, 3 : coach marks
      if (!measuredRect) {
        // Fallback : si cible non mesurable, afficher comme carte narrative
        return (
          <NarrativeCard
            step={currentStep}
            profile={profile}
            colors={colors}
            t={t}
            onNext={handleNext}
            onSkip={handleSkip}
            treeSprite={null}
          />
        );
      }

      return (
        <>
          <CoachMarkOverlay
            targetRect={measuredRect}
            onPress={handleNext}
            padding={8}
            borderRadius={12}  // nouveau prop Plan 02
          />
          <CoachMark
            targetRect={measuredRect}
            title={t(`help:farm_tutorial.step${currentStep + 1}.title`)}
            body={t(`help:farm_tutorial.step${currentStep + 1}.body`)}
            stepIndex={currentStep}
            totalSteps={5}
            onNext={handleNext}
            onDismiss={handleSkip}  // bouton "Passer"
          />
        </>
      );
    }

    function resolveTreeSprite(profile: { species?: string }) {
      const species = profile?.species ?? '';
      const fruit = SPECIES_TO_FRUIT[species];
      if (!fruit) return null;
      return TREE_SPRITES[fruit] ?? null;
    }
    ```

    **Composant NarrativeCard (sous-composant privé dans le même fichier) :**
    - View fullscreen absolu (StyleSheet.absoluteFill) avec fond semi-transparent (`rgba(0,0,0,0.7)`)
    - Animated.View card centrée avec animation d'entrée spring (opacity 0→1 + scale 0.9→1 avec SPRING_CONFIG)
    - Étape 0 : titre + body + sprite arbre (ou emoji 🌳 XL en fallback via `<Text style={{fontSize: 120}}>🌳</Text>`)
    - Étape 4 : titre + body + gros emoji 📖 XL (120+)
    - Footer avec 2 boutons : "Passer" (secondaire) + "Suivant" ou "C'est parti !" pour étape 4 (primaire)
    - Utiliser `useThemeColors()` pour toutes les couleurs
    - Clés i18n via `t('help:farm_tutorial.step1.title')` (séparateur `:` — Pitfall 4)
    - Clés boutons : `t('help:farm_tutorial.skip')`, `t('help:farm_tutorial.next')`, `t('help:farm_tutorial.done')`
    - Spring config constante module
    - `pointerEvents="auto"` sur la carte pour bloquer les taps sous-jacents

    **Notes importantes :**
    - Pitfall 4 : TOUJOURS `help:farm_tutorial.xxx` avec `:` pas `.`
    - Si `profile.species` est absent/inconnu, `resolveTreeSprite` retourne null et NarrativeCard affiche l'emoji 🌳 fallback
    - Le composant doit compiler avec tsc strict. Les imports exacts de `Profile` type peuvent nécessiter `any` si le type n'est pas facilement disponible — préférer un type inline minimal `{ species?: string; ... }` (comme dans le code exemple ci-dessus)
    - Spring config en const module (convention CLAUDE.md)
    - Utiliser `React.memo` sur le composant exporté si raisonnable

    **NE PAS** :
    - Modifier ScreenGuide.tsx (D-08)
    - Créer un nouveau provider/context (TUTO-08)
    - Utiliser `react-native-svg` pour le spotlight (D-05bis)
    - Utiliser `react-native` Animated — utiliser Reanimated 4 (CLAUDE.md)
    - Hardcoder des couleurs (utiliser `useThemeColors()`)
    - Ajouter une dépendance npm (ARCH-05)
    - Ouvrir automatiquement le codex à l'étape 5 (D-03 : juste un pointer visuel 📖)
  </action>
  <verify>
    <automated>test -f components/mascot/FarmTutorialOverlay.tsx &amp;&amp; grep -q "FarmTutorialOverlay" components/mascot/FarmTutorialOverlay.tsx &amp;&amp; grep -q "farm_tutorial" components/mascot/FarmTutorialOverlay.tsx &amp;&amp; grep -q "setActiveFarmTutorialStep" components/mascot/FarmTutorialOverlay.tsx &amp;&amp; grep -q "markScreenSeen" components/mascot/FarmTutorialOverlay.tsx &amp;&amp; grep -q "help:farm_tutorial" components/mascot/FarmTutorialOverlay.tsx &amp;&amp; npx tsc --noEmit</automated>
  </verify>
  <acceptance_criteria>
    - Le fichier `components/mascot/FarmTutorialOverlay.tsx` existe
    - grep `export.*FarmTutorialOverlay` trouve l'export du composant
    - grep `SCREEN_ID = 'farm_tutorial'` ou équivalent (string literal `'farm_tutorial'` présent)
    - grep `hasStarted` trouve le pattern de reset (Pitfall 2)
    - grep `useEffect.*\[seen\]` ou pattern équivalent pour le reset
    - grep `help:farm_tutorial` trouve au moins 1 appel t() avec namespace `:`
    - grep `setActiveFarmTutorialStep\(null\)` trouve le reset après skip/done
    - grep `markScreenSeen.*farm_tutorial` ou `markScreenSeen\(SCREEN_ID\)` trouve l'appel
    - grep `react-native-svg` retourne 0 occurrences (D-05bis)
    - grep `from 'react-native'` ne contient pas `Animated` importé depuis `react-native` (doit être `react-native-reanimated`)
    - grep `useThemeColors` trouve au moins 1 usage
    - `npx tsc --noEmit` exit code 0
  </acceptance_criteria>
  <done>FarmTutorialOverlay compile, orchestre 5 étapes, expose handleSkip et handleNext, lit HelpContext étendu, utilise CoachMarkOverlay avec borderRadius.</done>
</task>

</tasks>

<verification>
- `npx tsc --noEmit` passe
- Le composant existe et s'exporte depuis components/mascot/
- i18n FR+EN en parité stricte sous help.farm_tutorial
- Le composant réutilise CoachMark + CoachMarkOverlay (+ borderRadius du Plan 02) sans modifier ScreenGuide
</verification>

<success_criteria>
- [ ] TUTO-03 : 5 étapes orchestrées
- [ ] TUTO-04 : spotlight arrondi via borderRadius
- [ ] TUTO-05 : skip disponible à toute étape
- [ ] TUTO-07 : pattern hasStarted reset via useEffect[seen]
</success_criteria>

<output>
After completion, create `.planning/phases/18-tutoriel-ferme/18-03-farm-tutorial-overlay-i18n-SUMMARY.md`
</output>
