---
phase: 18-tutoriel-ferme
plan: 02
type: execute
wave: 1
depends_on: []
files_modified:
  - components/help/CoachMarkOverlay.tsx
autonomous: true
requirements: [TUTO-04]
must_haves:
  truths:
    - "CoachMarkOverlay accepte un nouveau prop borderRadius?: number (défaut 0, rétrocompatible)"
    - "Le cutout rectangulaire des étapes tutoriel 2-4 est rendu avec coins arrondis"
    - "Les consommateurs existants de CoachMarkOverlay (dashboard, tasks, ...) ne sont pas cassés"
  artifacts:
    - path: "components/help/CoachMarkOverlay.tsx"
      provides: "borderRadius prop sur cutout spotlight"
      contains: "borderRadius"
  key_links:
    - from: "CoachMarkOverlay"
      to: "cutout View(s)"
      via: "borderRadius style prop"
      pattern: "borderRadius"
---

<objective>
Étendre `CoachMarkOverlay` avec un prop optionnel `borderRadius?: number` pour obtenir des coins arrondis sur la zone cutout, sans casser les consommateurs actuels (dashboard, tasks, etc.) qui utilisent un cutout rectangulaire droit. Respecter D-05 (rectangle arrondi) et D-05bis (PAS de react-native-svg Mask).

Purpose: TUTO-04 — spotlight rectangle arrondi esthétique sur cibles pixel-art de la ferme.
Output: 1 fichier modifié, rétrocompatible.
</objective>

<context>
@.planning/phases/18-tutoriel-ferme/18-CONTEXT.md
@.planning/phases/18-tutoriel-ferme/18-RESEARCH.md
@CLAUDE.md
@components/help/CoachMarkOverlay.tsx

<interfaces>
Nouvelle API CoachMarkOverlayProps :
```typescript
interface CoachMarkOverlayProps {
  targetRect: TargetRect;         // existant
  onPress: () => void;             // existant
  padding?: number;                // existant
  borderRadius?: number;           // NOUVEAU, défaut 0 (rétrocompat)
}
```
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Ajouter borderRadius à CoachMarkOverlay (D-05, D-05bis)</name>
  <files>components/help/CoachMarkOverlay.tsx</files>
  <read_first>
    - components/help/CoachMarkOverlay.tsx (lecture intégrale : connaître la technique 4-Views actuelle)
    - .planning/phases/18-tutoriel-ferme/18-RESEARCH.md section "CoachMarkOverlay Extension — Approche rectangle arrondi"
  </read_first>
  <action>
    Ajouter `borderRadius?: number` (défaut 0) à l'interface `CoachMarkOverlayProps` et au composant.

    **Approche technique recommandée (Option B de RESEARCH.md) — View unique avec borderWidth ultra-épais :**

    Remplacer (ou wrapper) la technique actuelle 4-Views par une approche supportant `borderRadius` :

    ```typescript
    import { Dimensions, StyleSheet, View } from 'react-native';
    const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
    const OVERLAY_COLOR = 'rgba(0,0,0,0.6)';  // couleur existante à réutiliser

    // Si borderRadius > 0, utiliser technique borderWidth géant :
    if (borderRadius > 0) {
      const cutoutX = targetRect.x - padding;
      const cutoutY = targetRect.y - padding;
      const cutoutW = targetRect.width + padding * 2;
      const cutoutH = targetRect.height + padding * 2;
      const borderThickness = Math.max(SCREEN_WIDTH, SCREEN_HEIGHT);

      return (
        <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
          <View
            pointerEvents="auto"
            onStartShouldSetResponder={() => true}
            onResponderRelease={onPress}
            style={{
              position: 'absolute',
              left: cutoutX,
              top: cutoutY,
              width: cutoutW,
              height: cutoutH,
              borderRadius,
              borderWidth: borderThickness,
              borderColor: OVERLAY_COLOR,
            }}
          />
        </View>
      );
    }

    // Sinon : conserver la technique 4-Views existante inchangée (rétrocompat)
    ```

    Alternative acceptable (Claude's Discretion si Option B pose un problème de clipping sur device) : conserver 4-Views et superposer 4 petites Views coin avec `borderRadius` sur le coin concerné + `overflow: hidden`. Documenter le choix en commentaire.

    **NE PAS** :
    - Importer `react-native-svg` (D-05bis explicite)
    - Supprimer la branche rétrocompatible (borderRadius=0 doit continuer à marcher avec la technique historique pour ne pas casser dashboard/tasks coach marks)
    - Changer la signature existante des props déjà présents
    - Ajouter de nouvelle dépendance npm (ARCH-05)

    Conserver `useThemeColors()` si déjà utilisé, ne pas hardcoder de couleur hors de celles déjà présentes dans le fichier.
  </action>
  <verify>
    <automated>grep -q "borderRadius" components/help/CoachMarkOverlay.tsx &amp;&amp; npx tsc --noEmit</automated>
  </verify>
  <acceptance_criteria>
    - grep `borderRadius\?: number` trouve la déclaration du prop (interface)
    - grep `borderRadius` trouve au moins 3 occurrences (interface, destructure, style)
    - grep `react-native-svg` retourne 0 résultats dans ce fichier (D-05bis)
    - `npx tsc --noEmit` exit code 0
    - Rétrocompat : appelants existants sans `borderRadius` prop compilent et rendent un cutout rectangulaire droit
  </acceptance_criteria>
  <done>CoachMarkOverlay accepte borderRadius, cutout arrondi fonctionne sans SVG, rétrocompat préservée.</done>
</task>

</tasks>

<verification>
- `npx tsc --noEmit` passe
- grep `borderRadius` trouve l'ajout
- grep `react-native-svg` dans CoachMarkOverlay retourne 0
</verification>

<success_criteria>
- [ ] TUTO-04 partiellement câblé (API prête, utilisée dans Plan 03/04)
- [ ] Rétrocompat préservée pour consommateurs existants
</success_criteria>

<output>
After completion, create `.planning/phases/18-tutoriel-ferme/18-02-coachmark-overlay-border-radius-SUMMARY.md`
</output>
