# Phase 17: Codex UI - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-08
**Phase:** 17-codex-ui
**Areas discussed:** Layout catégories, Architecture vue détail, Stats vs lore, Recherche + découverte, Position bouton HUD, Détail mini-modal, Empty state recherche, dropOnly discovery

---

## Sélection initiale des zones grises

**Question présentée :** « Quelles zones grises veux-tu discuter pour Phase 17 (Codex UI) ? »

| Option | Description | Selected |
|--------|-------------|----------|
| Layout catégories | Tabs horizontaux, sections empilées, drawer latéral ? | — |
| Architecture vue détail | Écran push, bottom sheet, carte expandable inline ? | — |
| Stats vs lore | Équilibre lore narratif i18n / stats live | — |
| Recherche + découverte | Portée de la recherche + règle « découvert » pour dropOnly | — |

**Réponse utilisateur :** « choisit ce qui est plus cohérent avec l'ui actuelle »

**Interprétation :** Déléguer les 4 zones à Claude avec instruction de s'aligner sur les patterns UI existants (CraftSheet, TechTreeSheet, BadgesSheet, BuildingShopSheet). Claude a scouté ces composants puis verrouillé :
- **D-01** Tabs horizontaux scrollables + FlatList 2-col (extension pattern CraftSheet)
- **D-02** Mini-modal détail au tap (pattern CraftSheet identique)
- **D-14** Squelette Modal pageSheet + SafeAreaView + header (pattern uniforme 5+ sheets ferme)

---

## Carte entrée (grille 2-col)

| Option | Description | Selected |
|--------|-------------|----------|
| Icône + nom uniquement | Carte compacte avec sprite/emoji + nom, stats et lore dans mini-modal | ✓ |
| Icône + nom + 1 stat clé | Cartes plus denses, moins épurées | |
| Icône + nom + lore court | Aperçu narratif visible, moins de cartes par écran | |

**User's choice :** Icône + nom uniquement (recommandé)
**Notes :** Cohérent avec CraftSheet catalogue et TreeShop. Maximum cartes visibles, visuel épuré.

---

## dropOnly — silhouette « ??? »

| Option | Description | Selected |
|--------|-------------|----------|
| Présence en inventaire actuel | Requiert l'item right now ; consommation = re-silhouette | |
| Historique de récolte/déblocage | Déverrouillage permanent, nouveau champ persisté | ✓ |
| Toujours visible (pas de silhouette) | Abandon du spoil gate | |

**User's choice :** Historique de récolte/déblocage (recommandé)
**Notes :** Décision initialement « permanent » mais raffinée à la question suivante (« Discovery ») où le calcul lazy à l'ouverture a été choisi, avec le trade-off documenté en D-07 (consommation peut rétablir silhouette). Pas de nouveau champ persisté.

---

## Recherche — portée

| Option | Description | Selected |
|--------|-------------|----------|
| Cross-catégories global | Override tabs, liste plate avec badge catégorie | ✓ |
| Catégorie active uniquement | Filtre seulement la tab sélectionnée | |
| Toggle utilisateur | Switch « tout / cette catégorie » | |

**User's choice :** Cross-catégories global (recommandé)
**Notes :** Comportement habituel d'un wiki. Effacer la recherche = retour à la tab active. Captured en D-08.

---

## Position bouton « ? » dans le HUD

| Option | Description | Selected |
|--------|-------------|----------|
| À droite après season | 5e item du HUD horizontal, même style | ✓ |
| En coin top-right séparé | Bouton flottant — viole légèrement CODEX-06 | |
| À gauche avant coins | 1er item du HUD, décale les autres | |

**User's choice :** À droite après season (recommandé)
**Notes :** Respect CODEX-06 (pas de nouveau bouton flottant), zero nouveau style. Captured en D-12.

---

## Discovery — calcul

| Option | Description | Selected |
|--------|-------------|----------|
| Calcul lazy à l'ouverture | Scan farmInventory + sagas, zero nouveau champ | ✓ |
| Champ persisté `discoveredCodex` | Nouveau champ farm-{id}.md + hooks write paths | |
| Hybride : scan + cache session | Pas de persistance disque | |

**User's choice :** Calcul lazy à l'ouverture (recommandé)
**Notes :** Simplicité maximale, trade-off accepté (consommation peut rétablir silhouette — D-07). Captured en D-06.

---

## Mini-modal détail — ordre des sections

| Option | Description | Selected |
|--------|-------------|----------|
| Lore en haut, stats en bas | Immersion d'abord (style Stardew wiki) | ✓ |
| Stats en haut, lore en bas | Utilitaire d'abord | |
| Accordion expandable | Deux sections collapsées | |

**User's choice :** Lore en haut, stats en bas (recommandé)
**Notes :** Cohérent avec le ton « ferme comme levier de motivation » du milestone v1.1+. Captured en D-04.

---

## Empty state recherche

| Option | Description | Selected |
|--------|-------------|----------|
| Message + emoji neutre | Pattern existant dans l'app | ✓ |
| Suggestions de catégories | Plus d'effort UX, moins cohérent | |
| Rien — liste vide | Minimal mais déconcertant | |

**User's choice :** Message + emoji neutre (recommandé)
**Notes :** Emoji 🔍 + texte i18n `codex.search.empty`. Captured en D-11.

---

## Claude's Discretion

Zones laissées à Claude pendant la planification/implémentation :
- **D-13** Choix de l'emoji du bouton HUD (📖 vs ❓) — préférence 📖
- **D-09** Helper `normalize()` dupliqué en local dans `lib/codex/search.ts` plutôt que d'exporter depuis `lib/search.ts`
- **Debounce recherche** : 150ms via `useDeferredValue` ou `useState + setTimeout` — décision pendant planning selon perf mesurée
- **Sticky header tabs** : stickyHeaderIndices vs ListHeaderComponent — décision pendant planning

## Deferred Ideas

- Persistance `discoveredCodex` si le trade-off D-07 pose problème en TestFlight
- Recherche multi-langue simultanée
- Filtres avancés (rareté, stade, saisonnalité)
- Partage/export d'une entrée codex
- Animations pixel-art (frames A/B) dans le mini-modal détail
