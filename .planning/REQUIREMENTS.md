# Requirements: FamilyFlow

**Defined:** 2026-03-28
**Core Value:** L'app doit rester fiable et stable pour un usage quotidien familial — les données ne doivent jamais être perdues ou corrompues, et les features existantes ne doivent pas régresser.

## v1.1 Requirements

Requirements for milestone v1.1 — Ferme Enrichie. La ferme est le levier de motivation pour faire les tâches du quotidien.

### Visuels

- [x] **VIS-01**: La ferme affiche un cycle jour/nuit avec luminosité et teinte adaptées à l'heure réelle
- [x] **VIS-02**: Les cultures ont des sprites pixel améliorés avec au moins 2 frames d'animation par stade de croissance
- [x] **VIS-03**: Les animaux ont des sprites pixel améliorés avec animations idle et marche plus fluides

### Bâtiments

- [x] **BAT-01**: L'utilisateur peut construire un bâtiment productif (moulin, serre, étable) sur une parcelle dédiée
- [x] **BAT-02**: Les bâtiments génèrent des ressources passivement (une récolte toutes les X heures)
- [x] **BAT-03**: Les bâtiments ont au moins 2 niveaux d'amélioration qui augmentent la production

### Craft

- [x] **CRA-01**: L'utilisateur peut combiner des récoltes pour créer des items spéciaux (confiture, bouquet, etc.)
- [x] **CRA-02**: Les recettes de craft sont visibles dans un catalogue avec les ingrédients requis
- [x] **CRA-03**: Les items craftés donnent plus d'XP que les récoltes brutes

### Progression

- [x] **PRO-01**: Un arbre de technologies ferme permet de débloquer des améliorations (vitesse pousse, rendement, nouvelles cultures)
- [x] **PRO-02**: L'utilisateur peut débloquer de nouvelles zones/parcelles en dépensant des ressources
- [x] **PRO-03**: La progression tech est persistée dans le vault et visible sur l'écran arbre

### Architecture

- [x] **ARCH-02**: Chaque profil a son propre fichier gamification (gami-{id}.md) pour éviter les conflits d'écriture multi-device iCloud

### Social

- [ ] **SOC-01**: Un membre peut envoyer une récolte ou un item crafté à un autre membre de la famille
- [ ] **SOC-02**: Le destinataire reçoit une notification et l'item apparaît dans son inventaire

## Future Requirements

Deferred to future milestones.

- **EVT-01**: Événements aléatoires sur la ferme (visiteur mystère, tempête, marché ambulant)
- **SOC-03**: Visiter la ferme des autres membres en lecture seule
- **SOC-04**: Classement familial des fermes

## Out of Scope

| Feature | Reason |
|---------|--------|
| Multijoueur temps réel | Pas de backend — tout est local + iCloud |
| Monnaie achetable (IAP) | App familiale privée, pas de monétisation |
| PvP / compétition | La ferme est coopérative, pas compétitive |

## Traceability

| REQ-ID | Phase | Status |
|--------|-------|--------|
| VIS-01 | Phase 5 | Complete |
| VIS-02 | Phase 5 | Complete |
| VIS-03 | Phase 5 | Complete |
| BAT-01 | Phase 6 | Complete |
| BAT-02 | Phase 6 | Complete |
| BAT-03 | Phase 6 | Complete |
| CRA-01 | Phase 7 | Complete |
| CRA-02 | Phase 7 | Complete |
| CRA-03 | Phase 7 | Complete |
| PRO-01 | Phase 8 | Complete |
| PRO-02 | Phase 8 | Complete |
| PRO-03 | Phase 8 | Complete |
| SOC-01 | Phase 9 | Pending |
| SOC-02 | Phase 9 | Pending |
