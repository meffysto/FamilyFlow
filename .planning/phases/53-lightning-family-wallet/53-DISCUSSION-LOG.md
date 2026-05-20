# Phase 53: Lightning Family Wallet — Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-18
**Phase:** 53-lightning-family-wallet
**Areas discussed:** UX cagnotte ferme, UX mode validation parent

---

## UX cagnotte ferme

### Q1 — Placement initial (carte vs badge vs grille vs FAB)

| Option | Description | Selected |
|--------|-------------|----------|
| Sous la mascotte/arbre (carte HUD haut) | Carte horizontale pleine largeur sous la mascotte | |
| Mini badge sur la mascotte (coin) | Badge `⚡ 3 200` collé à la mascotte | |
| Carte dans la grille de cartes ferme | Une carte parmi Auberge / Village / Expéditions | |
| FAB flottant en bas à droite | Bouton flottant sur les onglets | |

**User's choice:** ❌ Aucun — l'utilisateur a interrompu et proposé une 5ème option ("petit bouton dans l'HUD") qui a été retenue en Q1bis.

### Q1bis — Format exact du bouton HUD

| Option | Description | Selected |
|--------|-------------|----------|
| **Bouton tappable (comme codex / screenshot)** | Bouton ⚡ isolé à côté de 📖 et 📷, tap → /lightning-wallet, balance dans l'écran dédié | **✓** |
| Stat dans le groupe (comme 🍃 🔥 🌿) | Ajouté dans la rangée de stats avec divider : '⚡ 3 200' | |
| Bouton compact avec balance inline (⚡ 3 200) | Bouton tappable mais avec balance visible dans le HUD | |

**User's choice:** Bouton tappable — affordance claire de touch, cohérent avec 📖 et 📷.
**Notes:** Insertion dans `app/(tabs)/tree.tsx:3508-3525`, style `styles.hudCodexButton` à dupliquer.

### Q2 — Visibilité du bouton ⚡

| Option | Description | Selected |
|--------|-------------|----------|
| **Visible seulement si activeProfile a un wallet** | Bouton apparaît si LIGHTNING_ENABLED ET activeProfile.id ∈ memberWallets | **✓** |
| Toujours visible si LIGHTNING_ENABLED, même sans wallet | Bouton visible, tap → modal "Créer un sub-wallet" | |
| Toujours visible si configuré côté famille | Bouton visible sur tous les profils dès qu'au moins 1 wallet existe | |

**User's choice:** Visible seulement si activeProfile a un wallet.
**Notes:** Conforme SPEC #8 acceptance criterion. Pas de bouton mort.

### Q3 — Feedback pay-out reçu (app au foreground)

| Option | Description | Selected |
|--------|-------------|----------|
| **Toast '+100 sats ⚡' + pulse sur bouton HUD** | Toast HarvestCardToast-style + pulse scale+glow, Haptic Light | **✓** |
| Pulse animation discret uniquement | Pas de toast, juste pulse + flash du bouton | |
| Aucun feedback ferme — refresh silencieux | Découverte en tappant le bouton | |
| Notif locale + pulse (même foreground) | Notification iOS visible même foreground | |

**User's choice:** Toast + pulse.

### Q4 — Refresh strategy balance

| Option | Description | Selected |
|--------|-------------|----------|
| **Après chaque pay-out + foreground (pas de polling)** | Refresh event-driven uniquement | **✓** |
| Polling 60s + après pay-out + foreground | Capture pay-outs externes mais consomme réseau | |
| Au mount uniquement (pas d'actualisation live) | Pull-to-refresh manuel | |

**User's choice:** Event-driven.
**Notes:** Économique réseau, conforme offline-first.

---

## UX mode validation parent (daily-review + hybrid)

### Q5 — Accès à l'écran "Pay-outs en attente"

| Option | Description | Selected |
|--------|-------------|----------|
| **Section Réglages → Labo → Lightning (sous SettingsLightning)** | Bouton "Pay-outs en attente (N)" dans SettingsLightning | **✓** |
| Route dédiée depuis /lightning-wallet du parent | Carte "Pay-outs en attente" dans l'écran wallet du parent | |
| Notif locale quotidienne 20h | Notif qui deep-link vers la queue | |
| Combinaison badge HUD + notif 20h + Settings | Triple accès, maximum découvrabilité | |

**User's choice:** Settings → Labo → Lightning.
**Notes:** Conforme à la posture App Store-safe (feature en Labo). Pas de notif 20h pour MVP.

### Q6 — UX de la validation

| Option | Description | Selected |
|--------|-------------|----------|
| **Validation batch (1 tap valide tout, 1 FaceID)** | Liste + bouton "Valider les N pay-outs (N×100 sats)" + 1 FaceID + boucle interne | **✓** |
| Validation par item (swipe valider/rejeter) | Granulaire mais lent | |
| Validation sélective (checkboxes + bouton) | Flexible, contrôle total | |
| Bouton "Tout valider" OU tap individuel par item | Hybride avec expiration 7 jours | |

**User's choice:** Batch.
**Notes:** UX simple et rapide. Pas de validation par item, pas de sélection partielle pour MVP.

### Q7 — Comportement échec mid-batch

| Option | Description | Selected |
|--------|-------------|----------|
| **Items payés sortent de la queue, items échoués y restent + audit per item** | Transparent, retry auto au foreground/reachability | **✓** |
| Rollback impossible + Alert modal claire | Identique mais avec popup d'info | |
| Stop à la première erreur, garder le reste en queue | Plus sûr en cas d'erreur LNbits générique | |

**User's choice:** Per-item transparent.
**Notes:** Cohérent avec SPEC #5 (queue offline + retry) et finalité Lightning (pas de rollback).

### Q8 — Notif locale parent

| Option | Description | Selected |
|--------|-------------|----------|
| **expo-notifications local + agrégation 1/jour + silencieuse 9h-16h** | Une notif/jour max regroupant plafond + failed + queue | **✓** |
| Notif locale stricte par événement (pas d'agrégation) | Plus granulaire mais plus bruyant | |
| Pas de notif — badge numérique sur app icon | Très discret mais peut être raté | |
| Section Labo affiche un compteur — zéro notif | App Store-safe maximal mais nécessite action proactive | |

**User's choice:** Agrégation 1/jour + silencieuse 9h-16h.
**Notes:** Wording chaleureux et factuel, pas de promotion sats. Timestamp dernière notif en SecureStore pour cap.

---

## Claude's Discretion

Areas delegated au planner/researcher (détail dans CONTEXT.md `<decisions>` § Claude's Discretion) :

- Architecture du listener Lightning (`useVault.ts` subscribe vs hook dédié `useVaultLightning`)
- Structure SecureStore queue + audit log (1 clé vs 2 clés, partitionnement si > 2KB iOS)
- Mutex / lock concurrent pour idempotence (lock in-memory vs vérif atomique)
- Stratégie codemod `Child*` → `Member*` (atomique en 1 commit + backward-compat read)
- Cleanup playgrounds (1 commit final après que tout fonctionne)
- Lieu d'exécution de la migration single→family (VaultProvider effect vs hook dédié)
- Scan QR avec `expo-camera` (lib déjà présente pour OCR recettes)
- Wording exact i18n FR (toasts, alerts, notifs, validation batch)

## Deferred Ideas

- **Notif locale 20h pour ouvrir la queue de validation** — discutée puis non retenue (D-07 dans CONTEXT.md). Reconsidérer en v2.
- **Badge numérique sur app icon iOS** — alternative à la notif, non retenue. Possible v2.
- **Validation par item (swipe / checkboxes)** — alternative à la validation batch, non retenue pour MVP.
- Tous les items "Out of scope" hérités du SPEC.md (LNURL-withdraw, fiat, multi-instance LNbits, xpOverride par tâche, feuille→sats, etc.) restent déférés.
