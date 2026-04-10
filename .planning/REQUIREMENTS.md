# Requirements: FamilyFlow — Milestone v1.4 Jardin Familial

**Defined:** 2026-04-10
**Core Value:** L'app doit rester fiable et stable pour un usage quotidien familial — les données ne doivent jamais être perdues ou corrompues, et les features existantes ne doivent pas régresser.

**Milestone goal:** Créer un espace coopératif partagé entre tous les profils — une "Place du Village" avec sa propre carte — où la famille contribue ensemble (récoltes + tâches) vers un objectif hebdomadaire commun.

## v1.4 Requirements

Requirements pour le milestone Jardin Familial (MVP). Chaque requirement mappe à une phase du roadmap.

### Données & Infrastructure

- [x] **DATA-01**: Le système persiste l'état du village dans un fichier Markdown partagé (`village.md`) compatible Obsidian, avec parser bidirectionnel
- [x] **DATA-02**: Les contributions sont stockées en append-only log (timestamp, profileId, type, montant) pour éviter les corruptions iCloud
- [x] **DATA-03**: Un hook domaine isolé `useGarden.ts` gère toute la logique village (pas d'ajout dans useVault.ts)
- [x] **DATA-04**: Les IDs de la grille village sont namespacés (`village_c0`, `village_b0`) pour éviter les collisions avec la ferme perso

### Carte & Navigation

- [x] **MAP-01**: Une carte "Place du Village" avec son propre terrain tilemap (cobblestone dominant, fontaine, étals) est rendue via le TileMapRenderer existant
- [x] **MAP-02**: Une grille village (`village-grid.ts`) définit les positions des éléments interactifs sur la place
- [ ] **MAP-03**: Un portail interactif dans la scène ferme perso permet de naviguer vers le village avec une transition visuelle

### Coopération & Contributions

- [ ] **COOP-01**: Quand un membre récolte dans sa ferme perso, une contribution est automatiquement ajoutée à l'objectif village
- [ ] **COOP-02**: Quand un membre complète une tâche IRL (via semantic coupling v1.3), une contribution est ajoutée à l'objectif village
- [x] **COOP-03**: Un feed de contributions affiche qui a fait quoi cette semaine sur l'écran village
- [x] **COOP-04**: Un indicateur per-membre montre la contribution de chaque profil cette semaine

### Objectif & Récompense

- [x] **OBJ-01**: Un objectif hebdomadaire est auto-généré chaque lundi, avec cible adaptée au nombre de profils actifs et à l'historique
- [x] **OBJ-02**: Une barre de progression affiche l'avancement collectif vers l'objectif de la semaine
- [ ] **OBJ-03**: Quand l'objectif est atteint, tous les profils reçoivent un bonus in-game (XP + item cosmétique)
- [ ] **OBJ-04**: La récompense inclut une suggestion d'activité familiale IRL (liste curatée, pondérée par saison)
- [x] **OBJ-05**: Un flag partagé + flag per-profil empêchent le double-claim de récompense

### Historique

- [x] **HIST-01**: Un panneau interactif sur la place du village affiche l'historique des semaines accomplies
- [x] **HIST-02**: Chaque semaine enregistre : cible, total, contributions par membre, récompense claimée

## v1.5 Requirements

Déféré au prochain milestone. Trackés mais pas dans le roadmap actuel.

### Village Enrichi

- **VILL-01**: Les avatars des membres de la famille sont affichés dans le village à des positions fixes
- **VILL-02**: L'ambiance visuelle de la place change selon la progression hebdo (vide → actif → festif)
- **VILL-03**: Un arbre familial commun grandit avec les contributions cumulées au fil des semaines
- **VILL-04**: Vote famille pour choisir l'objectif parmi 3 suggestions
- **VILL-05**: Décorations cosmétiques débloquées par milestones collectifs cumulés

## Out of Scope

| Feature | Reason |
|---------|--------|
| Sync temps réel / push notifications | Pas de backend — app 100% locale + iCloud |
| Leaderboard compétitif entre membres | Anti-pattern famille — crée conflit, réduit motivation intrinsèque |
| Sous-objectifs individuels obligatoires | Culpabilisant si un membre rate — la pool partagée est plus saine |
| Bâtiments/craft/tech tree pour le village | Double la charge cognitive — le village est pour voir le progrès collectif, pas un second jeu |
| Decay/wither sur le village | Anxiogène — pas de punition pour les jours manqués |
| Coopération cross-familles (grands-parents) | Nécessite comptes, serveur, GDPR — hors scope |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| DATA-01 | Phase 25 | Complete |
| DATA-02 | Phase 25 | Complete |
| DATA-03 | Phase 26 | Complete |
| DATA-04 | Phase 25 | Complete |
| MAP-01 | Phase 27 | Complete |
| MAP-02 | Phase 25 | Complete |
| MAP-03 | Phase 28 | Pending |
| COOP-01 | Phase 28 | Pending |
| COOP-02 | Phase 28 | Pending |
| COOP-03 | Phase 27 | Complete |
| COOP-04 | Phase 27 | Complete |
| OBJ-01 | Phase 26 | Complete |
| OBJ-02 | Phase 27 | Complete |
| OBJ-03 | Phase 28 | Pending |
| OBJ-04 | Phase 28 | Pending |
| OBJ-05 | Phase 26 | Complete |
| HIST-01 | Phase 27 | Complete |
| HIST-02 | Phase 27 | Complete |

**Coverage:**
- v1.4 requirements: 18 total
- Mapped to phases: 18
- Unmapped: 0

---
*Requirements defined: 2026-04-10*
*Last updated: 2026-04-10 — Traceability mapped after roadmap creation*
