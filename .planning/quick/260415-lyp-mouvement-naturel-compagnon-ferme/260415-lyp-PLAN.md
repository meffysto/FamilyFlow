---
phase: quick-260415-lyp
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - components/mascot/CompanionSlot.tsx
autonomous: true
requirements: [QUICK-LYP]
must_haves:
  truths:
    - "Le compagnon choisit des destinations aleatoires dans les zones marchables au lieu de suivre un circuit fixe"
    - "Le compagnon fait des pauses de duree variable entre les deplacements"
    - "Le compagnon ne marche jamais sur les crops, batiments ou dans le lac"
    - "Le mouvement reste fluide avec easing sinusoidal et animation de marche existante"
  artifacts:
    - path: "components/mascot/CompanionSlot.tsx"
      provides: "Mouvement organique avec destinations aleatoires"
      contains: "WALKABLE_ZONES"
  key_links:
    - from: "walkNext random destination"
      to: "WALKABLE_ZONES / activeRoute zones"
      via: "zone selection + random point within zone"
      pattern: "Math\\.random"
---

<objective>
Rendre le mouvement du compagnon organique et naturel dans CompanionSlot.tsx.

Purpose: Remplacer le circuit sequentiel rigide (PATROL_ROUTE waypoint 0->1->...->N->0) par un systeme de destinations aleatoires dans des zones marchables, avec pauses variables et micro-variations, tout en respectant la carte (pas de marche sur crops/batiments/lac).

Output: CompanionSlot.tsx avec mouvement naturel
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@components/mascot/CompanionSlot.tsx
</context>

<tasks>

<task type="auto">
  <name>Task 1: Systeme de zones marchables et destinations aleatoires</name>
  <files>components/mascot/CompanionSlot.tsx</files>
  <action>
Remplacer le systeme de patrouille sequentielle par un mouvement organique. Conserver TOUTE la logique existante de walkTo (easing sinusoidal, direction detection, walk animation) et le detour recolte (harvestablesRef). Ne modifier QUE la logique de selection de destination dans walkNext et la structure des zones.

1. **Definir les zones marchables** — remplacer le PATROL_ROUTE statique par un ensemble de zones rectangulaires avec poids de probabilite :
   ```typescript
   type WalkableZone = {
     id: string;
     xMin: number; xMax: number;
     yMin: number; yMax: number;
     weight: number;        // probabilite relative de choisir cette zone
     pauseMin: number;      // pause min en ms a l'arrivee
     pauseMax: number;      // pause max en ms a l'arrivee
   };
   ```
   
   Zones statiques (toujours presentes) :
   - `path-central` : x 0.38-0.46, y 0.38-0.65, weight 3, pause 1000-4000 — le chemin vertical principal
   - `path-south` : x 0.30-0.46, y 0.60-0.68, weight 1, pause 500-2000 — bifurcation sud
   - `home-area` : x 0.38-0.48, y 0.50-0.60, weight 4, pause 2000-6000 — zone repos pres de l'arbre (favorite)
   
   Zones dynamiques (ajoutees dans le useMemo selon l'etat de la ferme, exactement comme activeRoute le fait deja) :
   - Pour chaque rangee de crops dans plantedCropYs : zone entre les rangees (walkY = fy + 0.04), x 0.14-0.70, weight 2, pause 1000-3000
   - Pour les batiments construits (builtBuildingYs) : zone x 0.85-0.92, y min(buildYs)-0.02 a max(buildYs)+0.05, weight 2, pause 2000-4000, PLUS le chemin d'acces x 0.46-0.90 y 0.43-0.47 weight 1 pause 0-500
   - Si hasLake : zone rive x 0.14-0.22, y 0.63-0.78, weight 2, pause 3000-6000

2. **Remplacer walkNext** — au lieu de suivre un index sequentiel :
   - Choisir une zone aleatoire ponderee par weight (weighted random selection)
   - Generer un point aleatoire (fx, fy) dans cette zone : `fx = zone.xMin + Math.random() * (zone.xMax - zone.xMin)` idem pour fy
   - Calculer la pause : `pause = zone.pauseMin + Math.random() * (zone.pauseMax - zone.pauseMin)`
   - Appeler walkTo vers ce point, puis setTimeout(walkNext, duration + pause)
   - Contrainte : ne pas choisir la meme zone 2 fois de suite (variable lastZoneId via ref) sauf si une seule zone existe
   - Le detour recolte existant reste identique — si harvestablesRef a des crops prets et qu'on est dans une zone crops-*, detourner une fois par cycle

3. **Supprimer PATROL_ROUTE** et le HOME_IDX constant. Garder le home point (0.42, 0.55) comme valeur par defaut pour posX/posY initial.

4. **Renommer activeRoute en activeZones** dans le useMemo (ligne 621-691). Le useMemo retourne maintenant `WalkableZone[]` au lieu du tableau de waypoints. Memes dependances [plantedCropYs, builtBuildingYs, hasLake].

5. **Micro-variation** — ajouter un leger offset aleatoire (+/- 0.015) sur chaque destination pour eviter que le compagnon s'arrete exactement au meme point a chaque visite d'une zone.

Important :
- NE PAS modifier walkTo (lignes 702-727) — la mecanique de deplacement est parfaite
- NE PAS modifier le cycle d'animation idle/walk (lignes 597-613)
- NE PAS modifier handleTap, les bulles de message, ni le rendu JSX
- NE PAS modifier le detour recolte (harvestables) — adapter seulement la detection de zone crops au lieu de step.label.startsWith('crops-')
- Conserver le guard `if (paused) return;` et le cleanup mounted/timeouts
- Conserver la ref visitedHarvestThisCycle et la reinitialiser quand on visite home-area
  </action>
  <verify>
    <automated>cd /Users/gabrielwaltio/Documents/family-vault && npx tsc --noEmit 2>&1 | head -30</automated>
  </verify>
  <done>
    - Le compagnon choisit des destinations aleatoires dans des zones marchables ponderees
    - Les pauses varient entre les min/max de chaque zone
    - Le compagnon ne marche jamais sur les crops, batiments ou lac (zones definies pour eviter)
    - Le detour recolte fonctionne toujours
    - L'animation de marche et idle reste identique
    - tsc --noEmit passe sans erreur nouvelle
  </done>
</task>

</tasks>

<verification>
- `npx tsc --noEmit` passe sans nouvelles erreurs
- Verification visuelle : le compagnon se deplace de facon organique, change de zone, fait des pauses variables
</verification>

<success_criteria>
Le compagnon se deplace naturellement entre des zones marchables aleatoires avec pauses variables, sans jamais marcher sur les crops, batiments ou lac. Le mouvement parait organique et non robotique.
</success_criteria>

<output>
After completion, create `.planning/quick/260415-lyp-mouvement-naturel-compagnon-ferme/260415-lyp-SUMMARY.md`
</output>
