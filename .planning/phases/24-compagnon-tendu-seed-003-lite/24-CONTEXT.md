# Phase 24: Compagnon étendu (SEED-003 lite) - Context

**Gathered:** 2026-04-10
**Status:** Ready for planning

<domain>
## Phase Boundary

Activer 4 event types compagnon proactifs (morning_greeting, gentle_nudge, comeback, weekly_recap), persister les messages compagnon au-delà du RAM, étendre les triggers sur le dashboard, et intégrer les stats de couplage sémantique dans le weekly recap. Le type `celebration` (streak multiples de 7) est exclu de cette phase.

</domain>

<decisions>
## Implementation Decisions

### Persistance messages (COMPANION-06)
- **D-01:** SecureStore JSON — clé unique par profil (`companion_messages_{profileId}`), même pattern que les caps anti-abus Phase 20
- **D-02:** Garder les 5 derniers messages — suffisant pour l'anti-répétition IA (mémoire courte actuelle = 3) et léger en SecureStore
- **D-03:** Chaque message persisté contient : `text` (message affiché), `event` (CompanionEvent type), `timestamp` (ISO datetime)
- **D-04:** Au mount, charger les messages persistés dans `companionRecentMessagesRef` pour alimenter l'anti-répétition IA dès le premier message

### Triggers cross-feature
- **D-05:** Dashboard seulement — le dashboard affiche `morning_greeting` (première ouverture matin) et `weekly_recap` (dimanche soir). Les events d'action (task_completed, harvest, etc.) restent sur tree.tsx
- **D-06:** Affichage par bulle inline — petite section compagnon en haut du dashboard avec avatar + bulle de texte, discret et cohérent avec l'UI existante
- **D-07:** Pas de provider global pour cette phase — le compagnon reste câblé localement (tree.tsx + dashboard)

### Timing & fréquence
- **D-08:** Pas de `celebration` (streak%7) dans cette phase — retirer de `detectProactiveEvent()` ou le laisser dormant (Claude's discretion)
- **D-09:** `weekly_recap` déclenché dimanche entre 18h et 21h, première ouverture dans ce créneau
- **D-10:** `gentle_nudge` limité à 1 seul par jour — persister un flag `nudge_shown_today` pour éviter les doublons
- **D-11:** Conserver les créneaux existants inchangés : morning 6h-11h, nudge 14h-19h, comeback >24h

### Claude's Discretion
- Implémentation technique de la bulle inline sur le dashboard (composant, animation)
- Comment gérer le flag `celebration` : supprimer de detectProactiveEvent ou simplement désactiver
- Structure exacte du weekly recap (layout, quelles stats de couplage afficher)
- Pattern de chargement async des messages persistés au mount

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Companion engine
- `lib/mascot/companion-engine.ts` — Moteur complet : pickCompanionMessage, generateCompanionAIMessage, detectProactiveEvent, cache IA, budget quotidien
- `lib/mascot/companion-types.ts` — Types CompanionEvent (5 proactifs déjà déclarés), CompanionData, CompanionMessageContext

### Current trigger point
- `app/(tabs)/tree.tsx` — Seul consommateur actuel des messages compagnon : greeting au mount, triggerActionMsg pour actions, saveToMemory en RAM

### Anti-abus pattern (Phase 20)
- `lib/effects/abuse-caps.ts` — Pattern SecureStore JSON avec clé par profil, à réutiliser pour la persistance messages

### Couplage sémantique (stats pour weekly recap)
- `lib/effects/semantic-coupling.ts` — Dispatcher applyTaskEffect, catégories, stats
- `lib/effects/abuse-caps.ts` — Caps par catégorie (contiennent les compteurs d'effets déclenchés)

### Dashboard
- `app/(tabs)/index.tsx` — Dashboard principal, point d'intégration pour la bulle compagnon

### Requirements
- `.planning/REQUIREMENTS.md` §COMPANION-EXT — COMPANION-01 à COMPANION-06

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `detectProactiveEvent()` dans companion-engine.ts — logique de détection déjà implémentée pour les 5 types, juste pas câblée partout
- `pickCompanionMessage()` + `generateCompanionAIMessage()` — pipeline template → IA déjà fonctionnel pour tous les event types
- `MESSAGE_TEMPLATES` — templates i18n déjà définis pour morning_greeting, gentle_nudge, comeback, celebration, weekly_recap
- `buildCompanionPrompt()` — prompts IA personnalisés par espèce déjà écrits pour chaque event type
- SecureStore pattern (abuse-caps.ts) — load/save JSON par profil, réutilisable tel quel

### Established Patterns
- Companion messages : fallback template immédiat + tentative IA async (remplace si réussi)
- Anti-répétition : `recentMessages` dans CompanionMessageContext, injecté dans le prompt IA
- Cache IA : `CACHE_TTL` par event type + budget quotidien 15 appels/jour
- Dashboard sections : composants indépendants dans `components/dashboard/`, wrappés par SectionErrorBoundary

### Integration Points
- Dashboard (`app/(tabs)/index.tsx`) — ajouter une section compagnon bulle inline en haut
- tree.tsx — modifier saveToMemory pour persister en SecureStore au lieu de RAM
- detectProactiveEvent — ajouter condition weekly_recap dimanche 18h-21h, désactiver celebration

</code_context>

<specifics>
## Specific Ideas

- La bulle dashboard doit être discrète — pas un bandeau plein écran, juste avatar + texte
- Le weekly recap doit mentionner les stats de couplage sémantique (combien d'effets déclenchés cette semaine, catégories les plus actives)
- Le nudge ne doit pas être culpabilisant — ton gentil, pas "tu n'as rien fait"

</specifics>

<deferred>
## Deferred Ideas

- Provider global CompanionProvider pour messages sur tous les écrans — futur milestone
- Celebration streak (multiples de 7) — réactiver dans un futur milestone si demandé
- Historique complet des messages compagnon consultable (au-delà des 5 derniers) — futur milestone

</deferred>

---

*Phase: 24-compagnon-tendu-seed-003-lite*
*Context gathered: 2026-04-10*
