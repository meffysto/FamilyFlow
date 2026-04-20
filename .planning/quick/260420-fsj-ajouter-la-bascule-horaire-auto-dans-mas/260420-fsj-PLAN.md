---
phase: quick-260420-fsj
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - ios/MaJourneeWidget/MascotteLiveActivity.swift
autonomous: false
requirements:
  - FSJ-01  # Stage auto-calculé depuis l'heure locale via TimelineView
  - FSJ-02  # stageOverride préservé pour tests dev
  - FSJ-03  # Updates ActivityKit (tasks/meal/xp) non cassées

must_haves:
  truths:
    - "La Live Activity bascule automatiquement de stage à chaque heure ronde (9h, 12h, 14h, 18h, 21h, 0h) sans update ActivityKit"
    - "Les 6 stages (reveil/travail/midi/jeu/routine/dodo) s'affichent chacun dans leur plage horaire correcte"
    - "stageOverride en mode dev continue de forcer le stage affiché et bypass le calcul horaire"
    - "Les updates ActivityKit (tasksDone, currentMeal, xpGained) continuent de refresh les données affichées"
  artifacts:
    - path: "ios/MaJourneeWidget/MascotteLiveActivity.swift"
      provides: "UI Live Activity avec TimelineView pour bascule stage automatique"
      contains: "TimelineView"
  key_links:
    - from: "MascotteLockScreenView.body"
      to: "MascotteStage.resolve(date:override:)"
      via: "TimelineView(.explicit(...)) → timeline.date"
      pattern: "TimelineView.*MascotteStage.resolve"
    - from: "DynamicIsland closures (expanded/compact/minimal)"
      to: "MascotteStage.resolve(date:override:)"
      via: "TimelineView wrap autour du contenu render"
      pattern: "TimelineView.*stage"
---

<objective>
Ajouter une bascule horaire automatique dans la Live Activity mascotte : le stage (reveil/travail/midi/jeu/routine/dodo) se recalcule tout seul depuis l'heure locale à chaque heure ronde de transition, sans nécessiter d'update ActivityKit depuis l'app RN.

Purpose: Aujourd'hui, le stage est calculé UNE FOIS au lancement puis figé jusqu'à la prochaine update push. Résultat : si la Live Activity démarre à 10h en "travail", elle reste en "travail" à 13h au lieu de passer à "midi". TimelineView SwiftUI résout ce problème en re-renderant la vue aux dates planifiées.
Output: Live Activity autonome sur la chronologie narrative, updates ActivityKit toujours dédiées aux données (tâches/repas/XP).
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
</execution_context>

<context>
@ios/MaJourneeWidget/MascotteLiveActivity.swift
@modules/vault-access/ios/VaultAccessModule.swift

<interfaces>
<!-- Types clés déjà en place — NE PAS MODIFIER le shape ContentState (compatibilité JS bridge) -->

Depuis MascotteLiveActivity.swift :
```swift
struct MascotteActivityAttributes: ActivityAttributes {
    public struct ContentState: Codable, Hashable {
        var tasksDone: Int
        var tasksTotal: Int
        var xpGained: Int
        var currentMeal: String?
        var stageOverride: String?  // "reveil"|"travail"|"midi"|"jeu"|"routine"|"dodo" (dev/test)
    }
    var mascotteName: String
    var startedAt: Date
}

enum MascotteStage {
    case reveil, travail, midi, jeu, routine, dodo
    static func `for`(date: Date) -> MascotteStage  // plages 0-9 / 9-12 / 12-14 / 14-18 / 18-21 / 21-24
    static func from(override: String?) -> MascotteStage?
    static func resolve(date: Date, override: String?) -> MascotteStage
    var emoji: String
    var compactLabel: String
    func title(name: String) -> String
    func subtitle(state: MascotteActivityAttributes.ContentState) -> String
    func progress(state: MascotteActivityAttributes.ContentState) -> Double
}
```

TimelineView SwiftUI (standard API, dispo iOS 15+, fonctionne dans Live Activity / Widget) :
```swift
TimelineView(.explicit([Date])) { timeline in
    // timeline.date = date courante de la timeline entry
    // Re-render automatique à chaque date fournie
}
```

Heures de transition (locales) : 9h, 12h, 14h, 18h, 21h, 0h (du lendemain) → 6 entries/jour.
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Extraire MascotteStageContent et wrapper LockScreen + DynamicIsland dans TimelineView(.explicit)</name>
  <files>ios/MaJourneeWidget/MascotteLiveActivity.swift</files>
  <action>
Modifier `ios/MaJourneeWidget/MascotteLiveActivity.swift` pour rendre le stage réactif à l'heure locale via TimelineView.

**Étape 1 — Ajouter un schedule provider.**
Créer une fonction statique dans `MascotteStage` :
```swift
/// Calcule les prochaines dates de transition horaire (9,12,14,18,21,0) pour les 48h à venir.
/// Toutes les dates sont en heure locale device.
static func upcomingTransitionDates(from now: Date = Date(), horizonHours: Int = 48) -> [Date] {
    let cal = Calendar.current
    let transitionHours = [0, 9, 12, 14, 18, 21]
    var dates: [Date] = [now] // première entry = maintenant (render initial)
    let startOfToday = cal.startOfDay(for: now)
    for dayOffset in 0...(horizonHours / 24 + 1) {
        guard let day = cal.date(byAdding: .day, value: dayOffset, to: startOfToday) else { continue }
        for h in transitionHours {
            if let d = cal.date(bySettingHour: h, minute: 0, second: 0, of: day), d > now {
                dates.append(d)
            }
        }
    }
    return dates.sorted()
}
```

**Étape 2 — Wrapper la LockScreen view dans TimelineView.**
Remplacer le body de `MascotteLockScreenView` par un `TimelineView(.explicit(...))` qui utilise `timeline.date` pour résoudre le stage :
```swift
var body: some View {
    TimelineView(.explicit(MascotteStage.upcomingTransitionDates())) { timeline in
        let stage = MascotteStage.resolve(date: timeline.date, override: context.state.stageOverride)
        HStack(spacing: 14) {
            Text(stage.emoji)
                .font(.system(size: 38))
                .frame(width: 56, height: 56)
                .background(Color.white.opacity(0.08))
                .clipShape(RoundedRectangle(cornerRadius: 14))
            VStack(alignment: .leading, spacing: 4) {
                HStack(spacing: 6) {
                    Circle().fill(Color.green).frame(width: 6, height: 6)
                    Text("La journée de \(context.attributes.mascotteName)")
                        .font(.caption).fontWeight(.bold).foregroundColor(.white)
                }
                Text(stage.title(name: context.attributes.mascotteName))
                    .font(.subheadline).fontWeight(.semibold).foregroundColor(.white).lineLimit(1)
                Text(stage.subtitle(state: context.state))
                    .font(.caption2).foregroundColor(.white.opacity(0.7)).lineLimit(1)
                ProgressView(value: stage.progress(state: context.state))
                    .tint(.green).padding(.top, 2)
            }
            Spacer(minLength: 0)
        }
        .padding(14)
        .activityBackgroundTint(Color.black.opacity(0.85))
    }
}
```
Note : supprimer le `let stage = MascotteStage.resolve(date: Date(), override: ...)` et le `Group { ... }` wrapper de l'ancien body.

**Étape 3 — Wrapper chaque DynamicIslandExpandedRegion, compactLeading/Trailing et minimal dans TimelineView.**
Dans le closure `dynamicIsland: { context in ... }` du `MascotteLiveActivity.body`, supprimer le calcul top-level `let stage = MascotteStage.resolve(date: Date(), override: ...)` et wrapper chaque région :

```swift
} dynamicIsland: { context in
    DynamicIsland {
        DynamicIslandExpandedRegion(.leading) {
            TimelineView(.explicit(MascotteStage.upcomingTransitionDates())) { timeline in
                let stage = MascotteStage.resolve(date: timeline.date, override: context.state.stageOverride)
                Text(stage.emoji).font(.system(size: 32))
            }
        }
        DynamicIslandExpandedRegion(.center) {
            TimelineView(.explicit(MascotteStage.upcomingTransitionDates())) { timeline in
                let stage = MascotteStage.resolve(date: timeline.date, override: context.state.stageOverride)
                VStack(alignment: .leading, spacing: 2) {
                    Text(stage.title(name: context.attributes.mascotteName))
                        .font(.caption).fontWeight(.bold).foregroundColor(.white).lineLimit(1)
                    Text(stage.subtitle(state: context.state))
                        .font(.caption2).foregroundColor(.white.opacity(0.75)).lineLimit(1)
                }
            }
        }
        DynamicIslandExpandedRegion(.bottom) {
            TimelineView(.explicit(MascotteStage.upcomingTransitionDates())) { timeline in
                let stage = MascotteStage.resolve(date: timeline.date, override: context.state.stageOverride)
                ProgressView(value: stage.progress(state: context.state)).tint(.green)
            }
        }
    } compactLeading: {
        TimelineView(.explicit(MascotteStage.upcomingTransitionDates())) { timeline in
            let stage = MascotteStage.resolve(date: timeline.date, override: context.state.stageOverride)
            Text(stage.emoji).font(.caption)
        }
    } compactTrailing: {
        TimelineView(.explicit(MascotteStage.upcomingTransitionDates())) { timeline in
            let stage = MascotteStage.resolve(date: timeline.date, override: context.state.stageOverride)
            Text(stage.compactLabel).font(.caption2).fontWeight(.semibold)
        }
    } minimal: {
        TimelineView(.explicit(MascotteStage.upcomingTransitionDates())) { timeline in
            let stage = MascotteStage.resolve(date: timeline.date, override: context.state.stageOverride)
            Text(stage.emoji).font(.caption2)
        }
    }
    .widgetURL(URL(string: "family-vault://open/tree"))
}
```

**Pièges à éviter :**
- NE PAS modifier `ContentState` (bridge JS côté RN dépend du shape exact — tasksDone/tasksTotal/xpGained/currentMeal/stageOverride).
- NE PAS toucher `VaultAccessModule.swift` (les méthodes start/update/stop continuent de fonctionner à l'identique — seule la UI devient réactive à l'heure).
- NE PAS retirer `stageOverride` : le test dev (menu mascotte) repose dessus.
- `TimelineView(.explicit([...]))` avec la date courante en première entry garantit le render initial ; les dates futures déclenchent les re-renders aux heures de transition.
- Ne pas wrapper TOUT le `DynamicIsland { } compactLeading: { } ...` dans un unique TimelineView — l'API exige que chaque region closure retourne un `View` du type attendu par DynamicIsland. Wrapper région par région.
- Inclure une constante helper locale si la répétition `MascotteStage.upcomingTransitionDates()` gêne : OK de factoriser via `let schedule = MascotteStage.upcomingTransitionDates()` en début de closure `dynamicIsland: { context in let schedule = ...; ... }` puis passer `schedule` aux `TimelineView(.explicit(schedule))`.
  </action>
  <verify>
    <automated>cd ios && xcodebuild -workspace familyvault.xcworkspace -scheme MaJourneeWidgetExtension -configuration Debug -sdk iphonesimulator -destination 'generic/platform=iOS Simulator' build 2>&1 | tail -40</automated>
  </verify>
  <done>
- Le widget extension compile sans erreur Swift.
- `MascotteStage.upcomingTransitionDates(...)` existe et retourne les dates 9h/12h/14h/18h/21h/0h locales.
- `MascotteLockScreenView.body` est wrappé dans `TimelineView(.explicit(...))` et utilise `timeline.date`.
- Chaque closure de région du DynamicIsland (expanded leading/center/bottom, compactLeading, compactTrailing, minimal) est wrappée dans un `TimelineView(.explicit(...))` qui résout le stage depuis `timeline.date`.
- Aucun `MascotteStage.resolve(date: Date(), override: ...)` top-level ne subsiste.
- `ContentState` reste identique (5 champs, même ordre, même types).
  </done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <what-built>Bascule horaire automatique dans la Live Activity mascotte : le stage se recalcule aux heures de transition (9h/12h/14h/18h/21h/0h) sans update depuis l'app RN.</what-built>
  <how-to-verify>
1. Build + lancement sur device physique : `npx expo run:ios --device`
2. Depuis l'app → écran mascotte → démarrer la Live Activity.
3. Vérifier que l'emoji/titre/sous-titre correspondent à la plage horaire actuelle du device :
   - 0h-9h → 🌅 "s'étire au soleil"
   - 9h-12h → ⛏️ "est au boulot"
   - 12h-14h → 🍽️ "déjeune avec la famille"
   - 14h-18h → 🌿 "s'amuse dans la clairière"
   - 18h-21h → 🛁 "L'heure de la routine du soir"
   - 21h-24h → 🌙 "dort paisiblement"
4. **Test de bascule auto** : changer l'heure du device (Réglages iOS → Général → Date et heure → désactiver auto → forcer 11h59). Démarrer la Live Activity (stage = travail ⛏️). Attendre 1 min, passer à 12h00. Observer la Live Activity sur Lock Screen + Dynamic Island : le stage doit basculer à "midi" 🍽️ SANS avoir besoin d'ouvrir l'app.
5. **Test override dev** : depuis le menu dev mascotte, forcer un stage (ex: "dodo"). Vérifier qu'il override l'heure réelle et reste affiché.
6. **Test data updates** : cocher une tâche dans l'app → tasksDone doit s'incrémenter dans la Live Activity sans perturber le stage courant.
7. **Remettre l'heure du device en auto** à la fin du test.
  </how-to-verify>
  <resume-signal>Tape "approved" si la bascule horaire fonctionne, ou décris ce qui cloche (stage figé, override cassé, data update cassée, crash widget).</resume-signal>
</task>

</tasks>

<verification>
- Widget extension compile (xcodebuild) sans erreur.
- Bascule horaire validée sur device via changement manuel d'heure.
- stageOverride dev fonctionne toujours.
- Updates ActivityKit (tasks/meal/xp) fonctionnent toujours.
</verification>

<success_criteria>
- À 11:59 locale → stage "travail". À 12:00 locale → stage "midi" sans action utilisateur, sur Lock Screen ET Dynamic Island.
- stageOverride non-nil force le stage (bypass horaire).
- ContentState JSON identique (aucun breakage bridge JS).
- Aucune régression des updates ActivityKit existantes.
</success_criteria>

<output>
Quick task — pas de SUMMARY requis. Commit français référencé dans STATE.md Quick Tasks après validation.
</output>
