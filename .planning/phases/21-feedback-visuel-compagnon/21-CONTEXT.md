# Phase 21: Feedback visuel + compagnon - Context

**Gathered:** 2026-04-09
**Status:** Ready for planning

<domain>
## Phase Boundary

Rendre les 10 effets sémantiques (Phase 20) tangibles à l'utilisateur via feedback visuel et sonore différencié par catégorie : toasts spécifiques, variantes HarvestBurst, patterns haptiques distincts, et messages compagnon contextualisés, le tout en parité i18n FR+EN stricte.

</domain>

<decisions>
## Implementation Decisions

### Toast design par effet
- **D-01:** Mapping fixe emoji + texte FR/EN — un dictionnaire `EFFECT_TOASTS` avec emoji, message FR et EN par `EffectId`. Pas de templates dynamiques avec placeholders.
- **D-02:** Toast immédiat en parallèle du HarvestBurst — tout le feedback arrive d'un coup à la complétion de la tâche, pas de séquencement.
- **D-03:** Silencieux si cappé — pas de toast quand `isCapExceeded = true`. Évite la frustration.

### Messages compagnon
- **D-04:** Templates fixes avec sub_type — ajouter `subType?: CategoryId` dans `CompanionMessageContext`. `pickCompanionMessage` vérifie si des templates sub_type existent, sinon fallback générique `task_completed`.
- **D-05:** 2 templates par catégorie — 20 templates total (10 catégories × 2), chaque template référence la catégorie + l'effet déclenché.
- **D-06:** Bulle arbre uniquement — le compagnon parle dans sa bulle sur tree.tsx comme aujourd'hui. Pas de notification toast cross-écran pour les messages compagnon.

### Claude's Discretion
- Toast type par effet : Claude choisit le mapping success/info le plus adapté par catégorie
- HarvestBurst variants : Claude décide des variantes visuelles (golden/rare/ambient) — couleurs, animations, nombre de particules
- Haptic patterns : Claude conçoit les 10 patterns haptiques distincts en s'appuyant sur les patterns existants de `lib/mascot/haptics.ts`

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Feedback visuel
- `components/mascot/HarvestBurst.tsx` — Composant particules existant (couleur, position, reward). Base pour les variants.
- `contexts/ToastContext.tsx` — `showToast(message, type, action?, { icon?, subtitle? })`. API toast existante à utiliser.
- `lib/mascot/haptics.ts` — Patterns haptic existants (tap, evolution, shopBuy, crescendo). Modèle pour les nouveaux patterns.

### Compagnon
- `lib/mascot/companion-engine.ts` — `pickCompanionMessage(event, context)`, `MESSAGE_TEMPLATES`, `generateCompanionAIMessage()`. Base pour les sub_type templates.
- `lib/mascot/companion-types.ts` — `CompanionEvent`, `CompanionMessageContext`, `CompanionData` (avec `lastEventType?` et `lastEventAt?` ajoutés en Phase 20).

### Effets Phase 20
- `lib/semantic/effects.ts` — `applyTaskEffect()`, `EffectResult` (retourne `effectApplied`, `companionEvent`, `sagaTraitDelta`). Source des données pour le feedback.
- `lib/semantic/categories.ts` — `CategoryId` type. Sert de clé pour le mapping toast + templates compagnon.
- `hooks/useGamification.ts` — `completeTask` — point d'injection où le feedback doit être déclenché après `applyTaskEffect()`.

### i18n
- `lib/types.ts` — structure i18n existante du projet (clés FR/EN)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `HarvestBurst.tsx` : composant particules paramétrable (couleur, position, reward) — extensible pour des variants (golden, rare, ambient) via props supplémentaires
- `ToastContext.tsx` : supporte déjà `icon` (emoji) + `subtitle` (sous-titre) — layout riche prêt à l'emploi
- `haptics.ts` : patterns crescendo, tap, evolution — modèle clair pour créer de nouveaux patterns par catégorie
- `companion-engine.ts` : `MESSAGE_TEMPLATES` est un Record extensible, `pickCompanionMessage` sélectionne aléatoirement — architecture prête pour sub_type
- `CompanionMessageContext` : déjà riche (profileName, tasksToday, streak, timeOfDay, pendingTasks) — ajouter `subType` est minimal

### Established Patterns
- Haptics : `if (isWeb) return;` guard systématique, `async function` pour les séquences, `delay()` helper
- i18n : clés format `companion.msg.{event}.{n}` dans MESSAGE_TEMPLATES, correspondances FR/EN dans les fichiers de traduction
- Animations : `react-native-reanimated` obligatoire (useSharedValue + withSpring/withTiming)

### Integration Points
- `completeTask` dans `useGamification.ts` : après `applyTaskEffect()` — c'est là que le toast et le HarvestBurst variant doivent être déclenchés
- `tree.tsx` : affiche la bulle compagnon — doit consommer le `subType` pour afficher le message contextuel
- `_layout.tsx` : `ToastProvider` est dans la hiérarchie — les toasts sont disponibles partout

</code_context>

<specifics>
## Specific Ideas

- Toast exemple roadmap : "🌿 Ménage : 1 weeds retiré !"
- HarvestBurst variants mentionnés : golden / rare / ambient
- Parité FR+EN stricte obligatoire sur tous les strings de feedback

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 21-feedback-visuel-compagnon*
*Context gathered: 2026-04-09*
