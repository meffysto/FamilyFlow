# Phase 14: Parité Mobile ↔ Desktop - Context

**Gathered:** 2026-04-05
**Status:** Ready for planning

<domain>
## Phase Boundary

La version desktop (React, dans `apps/desktop/`) doit offrir une expérience fonctionnellement identique à l'app mobile (React Native/Expo). Chaque écran, interaction et feature disponible sur mobile est répliqué sur desktop avec les adaptations UX appropriées (drag & drop au lieu de swipe, raccourcis clavier, hover states, etc.).

**Ce que cette phase livre:**
- 10 écrans manquants sur desktop
- Parité fonctionnelle sur les 17 écrans existants
- Adaptations UX pour les interactions desktop (gestes → clavier/souris)
- Animations CSS/Framer Motion équivalentes aux animations Reanimated
- Toutes les opérations vault manquantes dans VaultContext desktop

**Ce que cette phase NE livre PAS:**
- Fonctionnalités natives impossibles sur desktop (haptics, brightness control, expo-camera)
- Refonte UX desktop-first (on réplique le mobile, on n'innove pas)

</domain>

<decisions>
## Implementation Decisions

### D-01: Scope — Tous les écrans manquants
Les 10 écrans absents du desktop seront tous implémentés :
- Skills (arbre RPG compétences enfants)
- Health (suivi croissance, vaccins, historique médical)
- Routines (séquences visuelles avec timers)
- Pregnancy (timeline semaine par semaine)
- Night-Mode (interface sombre pour tétées nocturnes — sans brightness control)
- Compare (comparaison photos côte à côte)
- Stats (6 visualisations de données)
- RDV (écran dédié rendez-vous avec CRUD complet)
- Notes (éditeur + import web via defuddle)
- More (menu navigation organisé)

### D-02: Interactions desktop — Hover menus + boutons contextuels + raccourcis clavier
Les gestes tactiles mobiles sont remplacés par des équivalents desktop :
| Geste mobile | Équivalent desktop |
|---|---|
| Swipe-to-delete | Bouton supprimer au hover + touche Delete |
| Pull-to-refresh | Bouton refresh + Ctrl/Cmd+R |
| Long-press | Clic droit / menu contextuel |
| Pinch-to-zoom | Scroll wheel zoom + boutons +/- |
| Swipe carousel | Flèches clavier + boutons prev/next |
| Drag-to-reorder | Drag & drop natif HTML5 |
| Tap | Click |

### D-03: Animations — CSS transitions + Framer Motion
- Transitions simples : CSS transitions natives (fade, slide, scale)
- Animations complexes (loot box opener, harvest burst, companion reactions) : Framer Motion
- Particules ambiantes (seasonal, ambiance) : Canvas 2D ou CSS keyframes
- Pas de react-native-reanimated — on utilise les équivalents web

### D-04: OCR Budget — Drag & drop fichier + bouton upload
- Zone de drag & drop pour déposer une photo de reçu
- Bouton upload alternatif (file input classique)
- Même pipeline Claude Vision API que le mobile (`scanReceiptImage()`)
- Composant ReceiptReview pour éditer les items détectés avant sauvegarde
- Conversion image → base64 côté client avant envoi API

### D-05: Gamification — Parité complète
Toutes les features gamification du mobile doivent exister sur desktop :
- Loot box opening avec animation Framer Motion (style Pokémon TCG)
- Confetti effect (librairie canvas-confetti ou équivalent)
- Companion system complet (picker, mood, messages IA, avatar mini)
- Sagas immersives (visiteur pixel, dialogues interactifs)
- Événements saisonniers (même engine, même contenu)
- Tech tree / building upgrades
- Active rewards display
- Badges collection

### D-06: VaultContext desktop — Opérations CRUD manquantes
Le VaultContext desktop doit être étendu avec toutes les mutations présentes sur mobile :
- Budget : addBudgetEntry, updateBudgetEntry, deleteBudgetEntry
- Notes : addNote, updateNote, deleteNote
- RDV : addRDV, updateRDV, deleteRDV
- Défis : addDefi, updateDefi, checkInDefi
- Loot : openLootBox, markLootUsed
- Farm : saveSagaProgress, saveEventProgress
- Skills : unlockSkill
- Health : addHealthRecord, updateHealthRecord
- Pregnancy : addPregnancyEntry
- Routines : saveRoutine, completeRoutineStep

### D-07: Localisation — i18next complet
- Réutiliser les fichiers de traduction existants (`locales/fr/*.json`, `locales/en/*.json`)
- Tous les nouveaux écrans doivent utiliser les namespaces existants
- Pas de texte hardcodé en français dans les composants

### Claude's Discretion
- Choix de la librairie de charts pour Stats (recharts, victory, chart.js — au choix du planner)
- Structure exacte des fichiers CSS (un par page vs modules CSS vs styled-components — pattern existant desktop)
- Ordre d'implémentation des écrans dans les plans (le planner optimise les dépendances)
- Librairie de confetti (canvas-confetti, react-confetti, etc.)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Desktop existant
- `apps/desktop/src/contexts/VaultContext.tsx` — Source unique d'état desktop, 607 lignes, ~5 mutations actuelles
- `apps/desktop/src/pages/Dashboard.tsx` — Pattern de page desktop existant (layout, styles, vault usage)
- `apps/desktop/src/pages/Tree.tsx` — Page la plus complexe côté desktop (82K), référence pour farm/gamification
- `apps/desktop/src/pages/Budget.tsx` — Budget desktop actuel (16K), base pour ajout OCR
- `apps/desktop/src/styles.css` — Styles globaux desktop

### Mobile (source de vérité)
- `app/(tabs)/index.tsx` — Dashboard mobile (55.8K) avec 20+ sections
- `app/(tabs)/budget.tsx` — Budget mobile avec OCR (43.2K)
- `app/(tabs)/tree.tsx` — Ferme mobile complète (102.9K)
- `app/(tabs)/loot.tsx` — Loot box animé (39K)
- `app/(tabs)/defis.tsx` — Défis mobile (42.8K)
- `app/(tabs)/skills.tsx` — Arbre compétences (19.5K)
- `app/(tabs)/health.tsx` — Suivi santé (45.7K)
- `app/(tabs)/routines.tsx` — Routines visuelles (30.6K)
- `app/(tabs)/stats.tsx` — Statistiques (11.6K)
- `app/(tabs)/notes.tsx` — Notes (14.3K)
- `app/(tabs)/rdv.tsx` — Rendez-vous (25.5K)

### Contextes partagés
- `contexts/VaultContext.tsx` — VaultProvider mobile (source de vérité pour les mutations)
- `hooks/useVault.ts` — useVaultInternal (implémentation des ~80+ actions)
- `lib/parser.ts` — Parsers/serializers markdown (partageable entre mobile et desktop)
- `lib/gamification/` — Engine gamification (fonctions pures, réutilisables)
- `lib/mascot/` — Engine mascotte/ferme (fonctions pures, réutilisables)
- `lib/receipt-scanner.ts` — Pipeline OCR reçus (réutilisable)
- `constants/rewards.ts` — Pool rewards et drop rates

### Traductions
- `locales/fr/common.json` — Traductions communes
- `locales/fr/gamification.json` — Traductions gamification
- `locales/fr/skills.json` — Traductions compétences
- `locales/fr/health.json` — Traductions santé (si existe)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **lib/parser.ts** : Tous les parsers/serializers sont des fonctions pures sans dépendance React Native — directement réutilisables sur desktop
- **lib/gamification/** : Engine complet (engine.ts, rewards.ts, seasonal.ts, skill-tree.ts) — fonctions pures
- **lib/mascot/** : Engine mascotte/ferme (farm-engine.ts, sagas-engine.ts, companion-engine.ts) — fonctions pures
- **lib/receipt-scanner.ts** : Pipeline OCR via Claude Vision API — réutilisable (fetch HTTP standard)
- **lib/search.ts** : Recherche multi-type — réutilisable
- **lib/insights.ts** : Suggestions déterministes — réutilisable
- **constants/** : Tous les tokens (colors, spacing, typography, rewards, themes) — réutilisables

### Established Patterns (Desktop)
- Pages desktop : fichier .tsx + fichier .css associé (ex: `Budget.tsx` + `Budget.css`)
- VaultContext comme unique source d'état
- Navigation via React Router (pas expo-router)
- Styles : CSS classes (pas de StyleSheet.create ni styled-components)
- Pas de Framer Motion actuellement — à ajouter comme dépendance

### Integration Points
- `apps/desktop/src/App.tsx` — Router principal, ajouter les nouvelles routes
- `apps/desktop/src/contexts/VaultContext.tsx` — Étendre avec les mutations manquantes
- `apps/desktop/src/components/` — Composants réutilisables desktop existants
- `apps/desktop/package.json` — Ajouter Framer Motion, canvas-confetti, librairie charts

</code_context>

<specifics>
## Specific Ideas

- Le budget desktop DOIT supporter le drag & drop de fichier pour OCR — c'est l'exemple cité explicitement par l'utilisateur
- L'objectif est une "version quasiment identique" — pas d'innovation desktop-first, on réplique fidèlement le mobile
- Les animations loot box doivent reproduire le style Pokémon TCG avec Framer Motion
- Le companion doit afficher les mêmes messages contextuels et réactions au clic que sur mobile

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 14-parite-mobile-desktop*
*Context gathered: 2026-04-05*
