# Requirements: v1.5 Village Vivant

**Milestone goal:** Transformer la Place du Village statique en espace vivant et personnalisé — avatars de la famille, décorations persistantes par semaine réussie, ambiance dynamique (jour/nuit + saisons), arbre familial commun, portail retour bidirectionnel.

**Scope constraint (hérité CLAUDE.md + v1.4) :** Aucune nouvelle dépendance npm. Backward compat Obsidian vault. Réutilisation stricte de l'infra existante (`ReactiveAvatar`, `TileMapRenderer`, `useGarden`, `FarmProfileData`).

---

## v1 Requirements

### Catégorie AVATARS — Présence dynamique des membres

- [x] **VILL-01**: User voit un avatar par profil actif (photo/ReactiveAvatar) positionné sur la carte village, à un emplacement fixe par profil
- [x] **VILL-02**: User voit chaque avatar avec un indicateur visuel de l'activité hebdo (contribué cette semaine vs inactif) — halo coloré ou opacité différenciée
- [x] **VILL-03**: User voit un tap sur un avatar ouvrir une bulle rapide "[Prénom] — X contributions cette semaine" avec dismiss automatique

### Catégorie DÉCORATIONS — Progression visuelle persistante

- [ ] **VILL-04**: User voit une nouvelle décoration ajoutée au village chaque semaine où l'objectif collectif est atteint (guirlande, fanion, lanterne, banc, etc.)
- [x] **VILL-05**: User retrouve toutes les décorations accumulées après un restart de l'app (persistance append-only dans `jardin-familial.md`)
- [x] **VILL-06**: User voit un catalogue (écran ou modal) listant les ~8 décorations débloquables par palier de streak collectif (1, 3, 5, 10, 15, 20, 25, 30 semaines réussies)

### Catégorie AMBIANCE — Cycle jour/nuit + saisons

- [ ] **VILL-07**: User voit une luminosité globale du village qui change selon l'heure réelle (jour clair, couchant tiède, nuit avec lanternes allumées)
- [ ] **VILL-08**: User voit des effets saisonniers spécifiques village qui se superposent à la carte (pétales de fleurs au printemps, feuilles mortes en automne, flocons en hiver, insectes/papillons en été)

### Catégorie ARBRE FAMILIAL — Cœur symbolique du village

- [ ] **VILL-09**: User voit un arbre familial commun planté au centre du village (sprite distinct de l'arbre ferme perso)
- [ ] **VILL-10**: User voit l'arbre familial évoluer visuellement selon le streak de semaines réussies collectives (graine → pousse → arbuste → arbre → arbre majestueux)

### Catégorie NAVIGATION — Portail bidirectionnel

- [x] **VILL-11**: User peut revenir à la ferme perso depuis le village via un portail de retour visuel (symétrique au portail ferme → village de la phase 28)
- [x] **VILL-12**: User voit une transition fade cross-dissolve Reanimated (~400ms) lors du retour village → ferme, cohérente avec l'aller

---

## Future Requirements (Deferred)

- [ ] **VILL-13**: Météo dynamique village (pluie, vent, soleil) indépendante des saisons
- [ ] **VILL-14**: Interactions inter-avatars (membres qui "se croisent" animé)
- [ ] **VILL-15**: Personnalisation manuelle du village par les enfants (placement libre de décorations débloquées)

## Out of Scope

- **Multijoueur temps réel** — L'app reste asynchrone, pas de présence temps réel
- **Avatars 3D ou customisation poussée** — Réutilisation stricte de `ReactiveAvatar` existant
- **Animations de marche libre des avatars** — Positions fixes, pas de pathfinding
- **Chat ou messagerie village** — Hors scope (canal existant = messages familiaux Obsidian)
- **Nouveau backend** — 100% local + iCloud comme constraint projet

---

## Traceability

| REQ-ID | Category | Phase | Status |
|--------|----------|-------|--------|
| VILL-01 | AVATARS | Phase 29 | Done |
| VILL-02 | AVATARS | Phase 29 | Done |
| VILL-03 | AVATARS | Phase 29 | Done |
| VILL-04 | DÉCORATIONS | Phase 30 | Pending |
| VILL-05 | DÉCORATIONS | Phase 30 | Pending |
| VILL-06 | DÉCORATIONS | Phase 30 | Pending |
| VILL-07 | AMBIANCE | Phase 31 | Pending |
| VILL-08 | AMBIANCE | Phase 31 | Pending |
| VILL-09 | ARBRE FAMILIAL | Phase 32 | Pending |
| VILL-10 | ARBRE FAMILIAL | Phase 32 | Pending |
| VILL-11 | NAVIGATION | Phase 29 | Done |
| VILL-12 | NAVIGATION | Phase 29 | Done |

**Coverage:** 12/12 requirements mapped ✓

*Traceability table mise à jour automatiquement lors de la création du roadmap.*
