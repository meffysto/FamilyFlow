# Requirements: FamilyFlow

**Defined:** 2026-03-28
**Core Value:** L'app doit rester fiable et stable pour un usage quotidien familial -- les donnees ne doivent jamais etre perdues ou corrompues, et les features existantes ne doivent pas regresser.

## v1.1 Requirements

Requirements for milestone v1.1 -- Ferme Enrichie. La ferme est le levier de motivation pour faire les taches du quotidien.

### Visuels

- [x] **VIS-01**: La ferme affiche un cycle jour/nuit avec luminosite et teinte adaptees a l'heure reelle
- [x] **VIS-02**: Les cultures ont des sprites pixel ameliores avec au moins 2 frames d'animation par stade de croissance
- [x] **VIS-03**: Les animaux ont des sprites pixel ameliores avec animations idle et marche plus fluides

### Batiments

- [x] **BAT-01**: L'utilisateur peut construire un batiment productif (moulin, serre, etable) sur une parcelle dediee
- [x] **BAT-02**: Les batiments generent des ressources passivement (une recolte toutes les X heures)
- [x] **BAT-03**: Les batiments ont au moins 2 niveaux d'amelioration qui augmentent la production

### Craft

- [x] **CRA-01**: L'utilisateur peut combiner des recoltes pour creer des items speciaux (confiture, bouquet, etc.)
- [x] **CRA-02**: Les recettes de craft sont visibles dans un catalogue avec les ingredients requis
- [x] **CRA-03**: Les items craftes donnent plus d'XP que les recoltes brutes

### Progression

- [x] **PRO-01**: Un arbre de technologies ferme permet de debloquer des ameliorations (vitesse pousse, rendement, nouvelles cultures)
- [x] **PRO-02**: L'utilisateur peut debloquer de nouvelles zones/parcelles en depensant des ressources
- [x] **PRO-03**: La progression tech est persistee dans le vault et visible sur l'ecran arbre

### Architecture

- [x] **ARCH-02**: Chaque profil a son propre fichier gamification (gami-{id}.md) pour eviter les conflits d'ecriture multi-device iCloud

### Social

- [x] **SOC-01**: Un membre peut envoyer une recolte ou un item crafte a un autre membre de la famille
- [x] **SOC-02**: Le destinataire recoit une notification et l'item apparait dans son inventaire

### Compagnon Mascotte

- [x] **COMP-01**: L'utilisateur peut choisir un compagnon parmi 5 especes (chat, chien, lapin, renard, herisson) a partir du niveau 5
- [x] **COMP-02**: Le compagnon evolue visuellement en 3 stades (bebe, jeune, adulte) lies au niveau XP du profil
- [x] **COMP-03**: Le compagnon a un systeme d'humeur (content, endormi, excite, triste) et reagit au tap avec animation + haptic
- [x] **COMP-04**: Le compagnon affiche des messages contextuels (predefinies i18n + IA optionnelle Claude Haiku)
- [x] **COMP-05**: De nouveaux compagnons sont debloquables via lootbox (rarites rare/epique)
- [x] **COMP-06**: Le compagnon actif donne un bonus passif +5% XP
- [ ] **COMP-07**: Le compagnon sert d'avatar de profil dans la tab bar et le selecteur de profil
- [x] **COMP-08**: Le compagnon affiche des bulles d'emotion sur les evenements de l'app (tache completee, lootbox, level up)

### Sagas Immersives

- [x] **SAG-01**: Un personnage visiteur pixel (genere via PixelLab) apparait dans la scene de l'arbre quand une saga est active, avec animation d'arrivee
- [x] **SAG-02**: Taper sur le visiteur ouvre un dialogue narratif interactif avec les choix de la saga (style RPG/Animal Crossing)
- [x] **SAG-03**: Le dashboard affiche un indicateur texte compact de la saga en cours (plus de boutons/carte dediee)
- [x] **SAG-04**: Le visiteur a des animations de reaction (joie, surprise, mystere) et un depart anime apres completion de saga

### Quetes Cooperatives Ferme

- **QUEST-01**: Une quete familiale peut etre demarree, progressee par n'importe quel membre de la famille, et completee avec une recompense ferme distribuee a tous
- **QUEST-02**: La ferme affiche un widget banniere montrant la quete active, la progression globale famille, et les contributions par membre
- **QUEST-03**: Les recompenses de quete sont des effets ferme distinctifs (cultures accelerees, cultures dorees garanties, batiments offerts, graines rares, trophee familial permanent) — distinctes des XP individuels

## Future Requirements

Deferred to future milestones.

- **EVT-01**: Evenements aleatoires sur la ferme (visiteur mystere, tempete, marche ambulant)
- **SOC-03**: Visiter la ferme des autres membres en lecture seule
- **SOC-04**: Classement familial des fermes

## Out of Scope

| Feature | Reason |
|---------|--------|
| Multijoueur temps reel | Pas de backend -- tout est local + iCloud |
| Monnaie achetable (IAP) | App familiale privee, pas de monetisation |
| PvP / competition | La ferme est cooperative, pas competitive |

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
| SOC-01 | Phase 9 | Complete |
| SOC-02 | Phase 9 | Complete |
| QUEST-01 | Phase 15 | Complete |
| QUEST-02 | Phase 15 | Pending |
| QUEST-03 | Phase 15 | Complete |
| COMP-01 | Phase 10 | Complete |
| COMP-02 | Phase 10 | Complete |
| COMP-03 | Phase 10 | Complete |
| COMP-04 | Phase 10 | Complete |
| COMP-05 | Phase 10 | Complete |
| COMP-06 | Phase 10 | Complete |
| COMP-07 | Phase 10 | Pending |
| COMP-08 | Phase 10 | Complete |
