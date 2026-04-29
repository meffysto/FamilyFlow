# Phase 46: Auberge — Spawn automatique + notifications locales - Context

**Gathered:** 2026-04-29
**Status:** Ready for planning
**Source:** Conversation design + survey codebase

<domain>
## Phase Boundary

Cette phase fait passer l'Auberge de "démo testable" à "feature jouable". Sans elle, aucun visiteur n'apparaît en conditions réelles (le bouton dev sera retiré).

**IN scope :**
- Wiring `tickAuberge(profileId)` au launch (cohabite avec `setupAllNotifications()` dans `useVault.ts:1548`).
- Wiring `tickAuberge(profileId)` après chaque tâche complétée via `subscribeTaskComplete` (API déjà exposée par `useVaultTasks.ts:66-71`).
- Notif locale à l'arrivée d'un visiteur : *"🛖 {Nom} arrive à l'auberge — {N}h pour livrer"*.
- Notif rappel 4h avant deadline si visiteur toujours actif.
- Annulation propre des notifs sur `deliverVisitor` / `dismissVisitor` / `expireVisitors`.
- Toggle "Visiteurs auberge" dans `NotificationSettings.tsx` (réutilise le pattern `BUILTIN_NOTIFICATIONS` + `NotifEvent`).
- Re-gating du bouton dev `__DEV__ && ...` dans AubergeSheet (revert du chore temporaire).

**OUT of scope :**
- Sprites pixel art (Phase 47).
- Animations livraison sophistiquées (Phase 47).
- Microcopy polish via skills clarify/delight (Phase 47).
- Badges et achievements Auberge (Phase 48+).
- Équilibrage formules reward (Phase 48+).

</domain>

<decisions>
## Implementation Decisions

### Wiring spawn auto

**1. Launch trigger** dans `hooks/useVault.ts` autour de la ligne 1548 (où `setupAllNotifications` est appelé) :
- Récupérer `activeProfile.id` (déjà accessible).
- Appeler `tickAuberge(activeProfile.id)` en fire-and-forget après chaque refresh.
- Ne pas bloquer le refresh principal si tickAuberge échoue.

**2. Task completion trigger** :
- Souscrire à `subscribeTaskComplete` quelque part (probablement dans `useVault.ts` au moment d'initialiser le contexte).
- Sur chaque `(task) => completed`, appeler `tickAuberge(activeProfile.id)`.
- ⚠️ Le hook `useAuberge` est consommé par les composants UI uniquement aujourd'hui — il faut soit l'instancier dans `useVault.ts` (au risque de duplication), soit exposer les fonctions du moteur directement (pattern plus propre).

**Décision retenue** : créer un helper `lib/auberge/auto-tick.ts` qui :
- Lit le profil ferme via VaultManager (pas via le hook).
- Appelle `expireVisitors` + `shouldSpawnVisitor` + `spawnVisitor` (engine pur).
- Persiste l'état farm via `writeFarmProfile` (ou équivalent — vérifier).
- Schedule/cancel les notifs pour les nouveaux/expirés visiteurs.
- S'appelle depuis `useVault.ts` (launch + task complete).

### Notifs locales

**Format des identifiants** (suivre pattern `scheduled-notifications.ts`) :
- `auberge-visitor-arrival-{instanceId}` — notif d'arrivée.
- `auberge-visitor-reminder-{instanceId}` — rappel 4h avant deadline.
- `auberge-visitor-{instanceId}` — préfixe générique pour `cancelByCategory`.

**Schedule** :
- Arrivée : `Notifications.scheduleNotificationAsync` immédiat (`trigger: null`) au moment du spawn → l'utilisateur sait qu'un visiteur arrive.
- Rappel : trigger temporel = `deadlineAt - 4h`. Skip si `deadlineAt - 4h < now`.

**Texte (FR direct, i18n key réservée pour Phase 47 polish)** :
- Title : *"🛖 {visitorName} à l'auberge"*
- Body arrival : *"Une nouvelle commande t'attend : {N}h pour livrer."*
- Body reminder : *"Plus que 4h pour livrer la commande de {visitorName}."*

**Cancel patterns** (mirror `cancelByCategory`) :
- Sur `deliverVisitor(instanceId)` → cancel `auberge-visitor-{instanceId}*`.
- Sur `dismissVisitor(instanceId)` → cancel `auberge-visitor-{instanceId}*`.
- Sur `expireVisitors` (chaque expiré) → cancel `auberge-visitor-{instanceId}*`.

### Toggle dans NotificationSettings

- Étendre `NotifEvent` (`lib/types.ts`) avec `'auberge_visitor_reminder'`.
- Étendre `BUILTIN_NOTIFICATIONS` (`lib/notifications.ts:104-182`) avec une entrée :
  ```ts
  {
    id: 'auberge_visitor_reminder',
    label: 'Visiteurs auberge',
    emoji: '🛖',
    enabled: true,                                                      // default ON
    template: '🛖 {visitorName} arrive à l\'auberge — {hours}h pour livrer',
    defaultTemplate: ...,
    event: 'auberge_visitor_reminder',
    availableVariables: ['visitorName', 'hours'],
    isCustom: false,
  }
  ```
- Le helper de schedule lit cette pref avant de schedule. Si désactivé → skip silencieux.

### Gestion du cas "permission refusée"
- Si `requestNotificationPermissions()` retourne `false`, le spawn fonctionne quand même (le visiteur arrive en silence). Pas de blocage.

### Re-gating bouton dev
Restaurer dans `components/mascot/AubergeSheet.tsx` :
```tsx
{__DEV__ && (
  <TouchableOpacity ...>
    🪄 Forcer un visiteur (dev)
  </TouchableOpacity>
)}
```
(le chore temporaire `28d7810` est à reverter).

### Tests
- `lib/__tests__/auberge-auto-tick.test.ts` : couverture du helper auto-tick (mock VaultManager + Notifications).
- Réutiliser les 45 tests Jest existants — vérifier non-régression.

### Claude's Discretion
- Texte exact des notifs (microcopy).
- Décision : où exactement souscrire à `subscribeTaskComplete` (dans `useVaultInternal` au moment de la mount, ou via un useEffect dans VaultProvider).
- Si `expireVisitors` doit notifier l'utilisateur ("Hugo est parti déçu") ou rester silencieux. Recommandation : silencieux (éviter le frustrant).

</decisions>

<canonical_refs>
## Canonical References

### Patterns à imiter
- `lib/scheduled-notifications.ts:160-167` — `cancelByCategory`.
- `lib/scheduled-notifications.ts:202-307` — `scheduleRDVAlerts` (pattern complet : cancel + filter + schedule).
- `lib/notifications.ts:104-182` — `BUILTIN_NOTIFICATIONS` array.
- `hooks/useVaultTasks.ts:99-114` — fire-and-forget listener pattern.
- `hooks/useVault.ts:1548-1554` — `setupAllNotifications` call site (exemple wiring launch).
- `hooks/useVault.ts:1570-1581` — défi spawn instant notif (exemple notif locale).

### Code à modifier
- `lib/types.ts:531` (NotifEvent) — ajout `'auberge_visitor_reminder'`.
- `lib/notifications.ts:~150` — ajout entrée BUILTIN_NOTIFICATIONS.
- `lib/scheduled-notifications.ts` — ajout `scheduleAubergeVisitorArrival`, `scheduleAubergeVisitorReminder`, `cancelAubergeVisitorNotifs`.
- `hooks/useVault.ts:~1548` — appel `tickAubergeAuto(profileId)` après refresh + souscription `subscribeTaskComplete`.
- `components/mascot/AubergeSheet.tsx` — re-gate `__DEV__`.

### Code nouveau
- `lib/auberge/auto-tick.ts` — helper orchestrateur (engine + persistance + notifs).
- `lib/__tests__/auberge-auto-tick.test.ts` — tests Jest.

### Conventions
- `CLAUDE.md` — FR, no hardcoded colors, `console.warn` sous `__DEV__`.

</canonical_refs>

<specifics>
## Specific Ideas

- **Critère de succès testable** : sans toucher au bouton dev, après un refresh ou une tâche complétée, un visiteur peut apparaître. Une notif locale arrive sur l'iPhone. À H-4, un rappel arrive. À la livraison/refus, plus de notif fantôme.
- Le helper `auto-tick` est l'endroit idéal pour la cohérence : un seul point d'entrée pour spawn auto + scheduling notifs + cancel sur résolution.
- Idempotent : si `tickAuberge` est appelé 5x en 6s, un seul spawn se déclenche grâce au cooldown `lastSpawnAt + 6h`.

</specifics>

<deferred>
## Deferred Ideas

- Phase 47 : sprites + portraits PNJ + animations livraison + microcopy polish.
- Phase 48 : badges (1ère livraison, 10 livraisons, cœur max), équilibrage formules reward, XP profil par livraison.

</deferred>

---

*Phase: 46-auberge-spawn-automatique-notifications-locales*
*Context gathered: 2026-04-29 via design + survey codebase (auto mode)*
