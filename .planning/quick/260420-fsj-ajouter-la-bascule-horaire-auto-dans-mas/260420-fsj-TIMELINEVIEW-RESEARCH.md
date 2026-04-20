# TimelineView dans Live Activity — Research

**Researched:** 2026-04-20
**Domain:** iOS ActivityKit / SwiftUI TimelineView / Live Activities
**Confidence:** HIGH (sources : Apple Developer Forums officiels + Apple doc officielle)

## Summary

**Verdict : TimelineView ne fonctionne PAS de façon fiable dans une Live Activity pour déclencher des changements d'UI conditionnels basés sur l'heure.** Le widget extension est suspendu ~10 secondes après le démarrage de la Live Activity, ce qui tue toute re-planification côté extension. Les seules primitives qu'iOS interpole frame-to-frame dans une Live Activity sont `Text(timerInterval:)` et `ProgressView(timerInterval:)` — tout le reste est un snapshot statique jusqu'au prochain `activity.update()` ou push.

**Primary recommendation :** Abandonner `TimelineView(.everyMinute)` pour la logique de bascule de stage. Utiliser à la place **des `activity.update()` planifiés côté app RN** (via BackgroundTasks + scheduled local notifications, ou via push ActivityKit depuis un serveur), ou passer au pattern **"pré-calcule les 6 stages et encode-les dans `context.state`"** avec condition SwiftUI basée sur `Date()` au moment du render — sachant que le render n'arrive que quand iOS décide (pas fiable pour pile 12h00).

## Questions → Réponses

### 1. TimelineView fonctionne-t-il dans ActivityConfiguration sur iOS 16.2+ ?

**Non, pas de façon fiable.** [Apple Dev Forums thread 766932](https://developer.apple.com/forums/thread/766932) confirme :
- Le closure de TimelineView est appelé **2 fois seulement** puis s'arrête
- Comportement identique pour `.animation`, `.everyMinute`, `.explicit([...])`, `.periodic(...)`
- Citation iband (forum) : *"Using custom progress view or timers in live activities or dynamic island was never possible. It probably worked for you when you tested in simulator or linked to a debugger — in real life the app is suspended after ~10 seconds."*
- Bug FB15590204 ouvert, non résolu (mars 2025)

Techniquement TimelineView **compile** et **ne crashe pas**, mais le scheduler système ne réveille pas l'extension aux dates planifiées.

### 2. iOS réveille-t-il l'extension aux moments planifiés ?

**Non.** Contrairement aux WidgetKit widgets classiques (qui ont un TimelineProvider géré par le système), les **Live Activities n'ont PAS de timeline provider**. [Apple doc officielle](https://developer.apple.com/documentation/activitykit/displaying-live-data-with-live-activities) confirme : *"Live Activities receive updated data from your app with ActivityKit or by receiving remote push notifications."*

Le process du widget extension est suspendu ~10s après lancement. iOS ne re-réveille QUE sur :
- `activity.update()` depuis l'app
- Push ActivityKit
- Interaction utilisateur (App Intent dans iOS 17+)
- `staleDate` dépassé (mais iOS ne garantit PAS un re-render pile à staleDate — c'est un hint)

### 3. Lock Screen vs Dynamic Island — différence ?

**Non, même limitation sur les deux.** Le même widget extension process rend les deux surfaces. Aucune source ne rapporte de comportement différent pour TimelineView entre Lock Screen et Dynamic Island. La suspension ~10s s'applique aux deux.

### 4. Pattern recommandé par Apple pour UI temporelle dans Live Activity ?

Apple recommande **deux primitives système** qui sont les seules à s'animer sans réveil d'extension :

```swift
// Compteur qui décompte/monte tout seul
Text(timerInterval: startDate...endDate, countsDown: true)

// Barre de progression qui avance toute seule
ProgressView(timerInterval: startDate...endDate)
```

Ces primitives sont **interpolées par le système** (pas par le widget extension), donc elles continuent quand l'extension est suspendue.

**Pour changer l'UI conditionnellement selon l'heure** (votre cas : 6 stages différents avec sprites/textes différents), Apple ne fournit **aucune primitive native**. Les options :

- **`staleDate`** : hint à iOS qu'après cette date le contenu est périmé → iOS peut re-render (pas garanti pile à l'heure, souvent best-effort)
- **Push ActivityKit** depuis serveur aux heures clés (9h/12h/14h/18h/21h/0h)
- **`activity.update()` depuis l'app** quand elle est ouverte ou via BackgroundTasks (BGAppRefreshTask — lui aussi best-effort, iOS peut skip)
- **App Intent** (iOS 17+) : bouton dans la Live Activity qui met à jour — pas applicable ici (auto, pas user-triggered)

### 5. Retours développeurs — TimelineView buggué ?

**Oui, largement documenté :**
- [Apple Dev Forum 715138 — "Changing live activity without push notification"](https://developer.apple.com/forums/thread/715138) : consensus = impossible de façon fiable sans push
- [Apple Dev Forum 766932](https://developer.apple.com/forums/thread/766932) : TimelineView closure appelé 2 fois puis stop (régression Xcode 16, toujours ouvert)
- [Monstar-lab engineering blog](https://engineering.monstar-lab.com/en/post/2022/09/30/Live-Activities/) : recommande push notifications pour toute update UI non-timer
- Consensus communauté : *"Your choices are push notifications or background tasks, though if you use background tasks you have very little control over when they run."*

**Workaround fréquemment mentionné :** encoder dans `context.state` une liste de `(date, stage)` et utiliser du SwiftUI conditionnel basé sur `Date()` au moment du render — mais le render lui-même n'a lieu qu'à `activity.update()`, donc ça ne résout pas le problème à 100%. Au mieux : le render déclenché par une interaction ou un staleDate tombera sur le bon stage.

## Ce qui marche / Ce qui ne marche pas

| Approche | Marche ? | Note |
|----------|---------|------|
| `TimelineView(.everyMinute)` | ❌ | Suspendu après ~10s, callback appelé 2x max |
| `TimelineView(.explicit([dates]))` | ❌ | Idem, iOS ne réveille pas l'extension |
| `TimelineView(.periodic)` | ❌ | Idem |
| `Text(timerInterval:)` | ✅ | Seule primitive fiable, compteur uniquement |
| `ProgressView(timerInterval:)` | ✅ | Seule autre primitive fiable |
| `activity.update()` depuis l'app | ✅ | Fiable quand app foreground |
| BGAppRefreshTask + `activity.update()` | ⚠️ | Best-effort, iOS peut skip si batterie faible / app peu utilisée |
| Push ActivityKit serveur | ✅✅ | **Le plus fiable**, recommandé par Apple |
| `staleDate` dans `context.state` | ⚠️ | Hint seulement, pas un timer garanti |
| Local notification à H-0 qui ouvre l'app brièvement | ⚠️ | Nécessite interaction user pour réveiller vraiment |

## Workarounds Recommandés (ordre de préférence)

### Option A — Push ActivityKit (le plus fiable, Apple-recommended)
Serveur pousse 6 updates/jour aux heures clés (9h/12h/14h/18h/21h/0h) avec le nouveau stage. Nécessite backend + APNs — **incompatible avec le constraint "pas de backend"** du projet FamilyFlow (vault Obsidian only).

### Option B — BackgroundTasks + activity.update() (réaliste sans backend)
Enregistrer une `BGAppRefreshTask` qui s'auto-re-planifie à la prochaine heure clé et appelle `Activity.update(using: newState)`. Limitations :
- iOS limite la fréquence (typiquement 1x/heure max, souvent moins)
- Best-effort, peut être skip si app rarement ouverte ou batterie faible
- Nécessite bridge RN → native pour déclencher/maintenir la task

### Option C — Pré-calculer et laisser iOS re-render "quand il peut" (dégradé acceptable)
Push un seul `activity.update()` au démarrage avec dans `context.state` :
- Tous les 6 stages avec leurs dates de transition
- Un `staleDate` = prochaine transition

Au moment où iOS re-render (opportuniste), le code SwiftUI fait :
```swift
let now = Date()
let stage = resolveStage(from: context.state.stages, at: now)
```
→ l'UI sera correcte QUAND iOS décidera de re-render, mais pas **pile** à 12h00. Acceptable si on tolère un lag de quelques minutes.

### Option D — Combiner B + C
BackgroundTasks pour pousser le update pile à l'heure quand possible, fallback sur le re-calcul conditionnel quand la task ne s'est pas exécutée.

## Recommandation pour FamilyFlow

Vu le constraint **"pas de backend"** et **"solo dev, phases non-cassantes"** :

1. **Abandonner `TimelineView(.everyMinute)`** — ne marchera jamais de façon fiable
2. **Implémenter Option C** en premier (dégradé acceptable, pas de native à ajouter)
3. Si UX insuffisante après tests réels sur device (lockscreen fermé plusieurs heures), ajouter **Option B** via un bridge RN → native BGTaskScheduler

Le fait que `TimelineView(.everyMinute)` "est en cours de test" va probablement montrer le même bug : ça marche quelques minutes avec le debugger branché, puis ça s'arrête une fois le câble débranché et le téléphone lock.

## Sources

### Primary (HIGH confidence)
- [Apple Dev Forums thread 766932 — TimelineView in LiveActivity Widget](https://developer.apple.com/forums/thread/766932) — bug FB15590204, callback appelé 2x puis stop
- [Apple Dev Forums thread 715138 — Changing live activity without push notification](https://developer.apple.com/forums/thread/715138) — consensus push-or-nothing
- [Apple Doc — Displaying live data with Live Activities](https://developer.apple.com/documentation/activitykit/displaying-live-data-with-live-activities) — "no timeline provider, updates via ActivityKit or push only"
- [Apple Doc — Starting and updating Live Activities with ActivityKit push notifications](https://developer.apple.com/documentation/activitykit/starting-and-updating-live-activities-with-activitykit-push-notifications)
- [Apple Doc — TimelineView](https://developer.apple.com/documentation/SwiftUI/TimelineView)

### Secondary (MEDIUM confidence)
- [Monstar-lab engineering blog — Realtime updates with Live Activities](https://engineering.monstar-lab.com/en/post/2022/09/30/Live-Activities/)
- [Swift with Majid — Displaying live activities in iOS 16](https://swiftwithmajid.com/2022/09/21/displaying-live-activities-in-ios16/)
- [mfaani — Live Activities Part 3: Development](https://mfaani.com/posts/liveactivities/3-development/)
- [fatbobman — Understanding SwiftUI's View Update Mechanism / TimelineView Update Issue](https://fatbobman.com/en/posts/understanding-swiftui-view-update-mechanism/)

## Metadata

**Confidence breakdown:**
- TimelineView broken in Live Activity: **HIGH** (Apple forum confirmation + bug ID + multiple devs reproduce)
- No native time-based UI change primitive: **HIGH** (Apple doc explicit)
- BGTask unreliability: **MEDIUM** (consensus blogs, pas de chiffres Apple officiels)

**Research date:** 2026-04-20
**Valid until:** ~2026-10 (jusqu'à WWDC 2026 qui pourrait changer l'API)
