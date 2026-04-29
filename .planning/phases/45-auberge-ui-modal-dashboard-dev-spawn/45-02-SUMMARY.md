---
phase: 45-auberge-ui-modal-dashboard-dev-spawn
plan: 02
subsystem: mascot/auberge
tags: [auberge, modal, ui, mascot, sheet]
requires:
  - hooks/useAuberge.ts (Phase 43-04 + forceSpawn Phase 45-01)
  - lib/mascot/auberge-engine.ts (canDeliver, getRemainingMinutes, getReputation)
  - lib/mascot/visitor-catalog.ts (VISITOR_CATALOG)
  - components/ui/CollapsibleSection.tsx
  - components/SectionErrorBoundary.tsx
  - contexts/ToastContext.tsx (useToast)
provides:
  - components/mascot/AubergeSheet.tsx (export AubergeSheet)
affects: []
tech-stack:
  added: []
  patterns:
    - modal pageSheet + drag-to-dismiss (mirror BuildingDetailSheet)
    - sous-composants memo internes (VisitorCard, ReputationRow)
    - couleurs sémantiques timer constantées (TIMER_AMBER, TIMER_RED)
    - lookup map FR locale pour les 6 PNJ (i18n branchage différé Phase 47+)
key-files:
  created:
    - components/mascot/AubergeSheet.tsx (806 lignes)
  modified: []
decisions:
  - "VISITOR_LABELS_FR : map locale Record<string, {name, bio}> pour les 6 PNJ — labelKey/descriptionKey du catalogue réservés pour i18n future. Copies FR cohérentes avec les emojis/rôles narratifs."
  - "Couleurs timer hardcoded (TIMER_AMBER #F59E0B, TIMER_RED #EF4444) constantées en haut du fichier — alignées sur le pattern wear de DashboardGarden, autorisé par CLAUDE.md pour les couleurs sémantiques."
  - "Reward preview affiche '18% loot' en approximation visuelle (LOOT_CHANCE.uncommon hardcodé) si preferredLoot non vide — la chance réelle reste calculée moteur. Pour cette phase MVP, suffisant ; raffinement Phase 47 polish."
  - "canDeliver checks calculés une seule fois via useMemo, indexés par instanceId — passés en props aux VisitorCard pour éviter recalcul à chaque render."
  - "Reputation list utilise getReputation(state, visitorId) pour cohérence moteur, mais reconstruit un VisitorReputation augmenté du level moteur (sans la perdre)."
metrics:
  duration: ~6min
  completed: 2026-04-29
  tasks: 1
  files: 1
---

# Phase 45 Plan 02: AubergeSheet — modale principale Summary

Créé `components/mascot/AubergeSheet.tsx` (806 lignes) — modale pageSheet complète qui visualise les visiteurs PNJ actifs avec cartes interactives (portrait emoji XL, identité FR, grille demandes ✅/❌, timer coloré sémantique, CTAs Livrer/Décliner), une section repliable de réputation listant les 6 PNJ du catalogue, et un bouton dev `__DEV__` "🪄 Forcer un visiteur" branché sur `useAuberge.forceSpawn`.

## What Changed

- **`components/mascot/AubergeSheet.tsx`** (créé)
  - Export `AubergeSheet = React.memo(AubergeSheetInner)` avec props `{ visible, onClose }`.
  - Modal RN `transparent + animationType="slide"`, overlay tap-to-close + grabber visuel + bouton ✕.
  - Header dynamique : "🛖 Auberge" + sous-titre "{N} visiteur(s) · ❤ {totalReputation}".
  - **VisitorCard** (memo) : portrait 56px, identité (nom + bio FR via `VISITOR_LABELS_FR`), grille demande (chaque item formaté `{emoji} {qty}× ✅/❌` avec `missingIds` dérivés de `canDeliver`), métadonnées (timer formaté `Xh YYmin` avec couleur ambre/rouge sous seuils 6h/1h, reward preview `+N 🍃 · {loot%}`), CTA primaire Livrer (disabled si `!canDeliver.ok`, opacity 0.4) + CTA secondaire Décliner.
  - **ReputationRow** (memo) : emoji + nom FR + cœurs (`❤️.repeat(level) + 🤍.repeat(5-level)`) ou "Jamais rencontré" si pas vu.
  - Empty state centré (emoji 64px, titre + body FR) si `activeVisitors.length === 0`.
  - `CollapsibleSection id="auberge-reputation"` repliée par défaut listant `VISITOR_CATALOG` complet.
  - Bouton dev en bas, gated `{__DEV__ && ...}`, style dashed border discret.
  - Handlers : `handleDeliver` (haptics Success + toast `+N 🍃`), `handleDismiss` (Alert confirm + haptics Warning), `handleForceSpawn` (haptics selection + impact medium si succès, toast info si null).
  - Helpers locaux : `formatRemaining`, `timerColor`, `getVisitorDef`, `itemEmoji` (fallback générique 📦/🍽️ par source).
  - Wrappé dans `SectionErrorBoundary name="Auberge"`.

## Why This Approach

- **i18n locale FR vs catalogue keys** : le catalogue `VISITOR_CATALOG` expose `labelKey`/`descriptionKey` (`auberge.visitor.{id}.name`) réservés à i18next pour Phase 47+. En attendant, une map `VISITOR_LABELS_FR` locale au composant donne les copies FR sans coupler le catalogue à l'UI ni dupliquer la logique partout.
- **canDeliver précomputé** : un seul `useMemo` calcule tous les checks par instanceId, puis chaque `VisitorCard` reçoit le résultat. Évite de re-itérer 6× sur l'inventaire à chaque render.
- **Couleurs timer constantées** : les 2 hex `#F59E0B`/`#EF4444` ne correspondent à aucune entrée canonique de `useThemeColors().colors`. Le plan autorise explicitement ces 2 constantes sémantiques (alignées sur `DashboardGarden` wear). Tout le reste — fond sheet, cards, bordures, textes, status — utilise `colors.*`.

## Deviations from Plan

Le plan suggérait d'utiliser `colors.success/error` directement pour les bordures de `requestItem` ✅/❌ — j'ai retenu cette option (et non un hex). Pour la couleur du texte status (`✅`/`❌`), j'ai aussi utilisé `colors.successText`/`colors.errorText` du palette — pas de hex.

Le plan mentionnait "animation pulse de timer (laisser pour Phase 47)" — décision : pas d'animation pulse implémentée. Les `Animated.View entering={FadeIn.delay(60*index)}` sont en place sur les cartes pour la cohérence avec BuildingDetailSheet.

Le `lootChance` exact n'est pas exposé sur `ActiveVisitor` (snapshot au spawn ne stocke que `rewardCoins`). J'affiche donc `18%` comme approximation (LOOT_CHANCE.uncommon, milieu de gamme) si `preferredLoot` non vide, sinon rien. Cohérent avec le must_haves.truths qui demande "+N 🍃 · X% loot" — le X% est indicatif. Polish Phase 47 si besoin de précision.

## Verification

- `npx tsc --noEmit` : clean (aucune nouvelle erreur, "TypeScript compilation completed").
- `grep -nE "AubergeSheet"` dans tsc output : 0 erreurs.
- `wc -l components/mascot/AubergeSheet.tsx` : 806 lignes (≥ 250 requis).
- `grep -nE "#[0-9a-fA-F]{6}"` : 2 matches (TIMER_AMBER, TIMER_RED) — exactement les 2 constantes autorisées.
- `grep -cE "useAuberge|deliverVisitor|dismissVisitor|forceSpawn"` : 13 matches (≥ 6 requis).
- `grep -n "useThemeColors"` : 4 matches (composant + 2 sous-composants + import).
- `export const AubergeSheet` : 1 match.
- Test mental d'usage : `<AubergeSheet visible={true} onClose={() => {}} />` type-check OK (props validées par tsc).

## Commits

- `a0a27b4` — feat(45-02): ajoute AubergeSheet — modale principale Auberge

## Self-Check: PASSED

- FOUND: components/mascot/AubergeSheet.tsx
- FOUND: commit a0a27b4
