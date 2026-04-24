import ActivityKit
import AppIntents
import SwiftUI
import WidgetKit
import LiveActivityShared

// MARK: - Attributes, Deep Links & App Intent
//
// MascotteActivityAttributes, MascotteDeepLink et ToggleNextTaskIntent vivent
// dans le module partagé LiveActivityShared (modules/live-activity-shared/).
// Même module côté app ET widget → identité de type unique → l'App Intent
// peut retrouver la Live Activity via `Activity<MascotteActivityAttributes>
// .activities` et faire l'update optimiste (tasksDone+1, clear nextTask).

// MARK: - Stage Narrative

@available(iOS 16.2, *)
enum MascotteStage {
    case reveil, travail, midi, jeu, routine, dodo, recap

    static func `for`(date: Date) -> MascotteStage {
        let h = Calendar.current.component(.hour, from: date)
        switch h {
        case 0..<9: return .reveil
        case 9..<12: return .travail
        case 12..<14: return .midi
        case 14..<18: return .jeu
        case 18..<20: return .routine
        case 20..<22: return .dodo
        default: return .recap
        }
    }

    static func from(override: String?) -> MascotteStage? {
        switch override {
        case "reveil": return .reveil
        case "travail": return .travail
        case "midi": return .midi
        case "jeu": return .jeu
        case "routine": return .routine
        case "dodo": return .dodo
        case "recap": return .recap
        default: return nil
        }
    }

    /// Résout le stage : override si fourni, sinon basé sur l'heure
    static func resolve(date: Date, override: String?) -> MascotteStage {
        MascotteStage.from(override: override) ?? MascotteStage.for(date: date)
    }

    /// Emoji conservé uniquement comme fallback si le sprite base64 est absent
    /// (DI compact leading, minimal, Lock Screen avatar).
    var emoji: String {
        switch self {
        case .reveil: return "🌅"
        case .travail: return "⛏️"
        case .midi: return "🍽️"
        case .jeu: return "🌿"
        case .routine: return "🛁"
        case .dodo: return "🌙"
        case .recap: return "🌙"
        }
    }

    var compactLabel: String {
        switch self {
        case .reveil: return "Réveil"
        case .travail: return "Au boulot"
        case .midi: return "À table"
        case .jeu: return "Joue!"
        case .routine: return "Routine"
        case .dodo: return "Dodo"
        case .recap: return "Récap"
        }
    }

    func title(name: String) -> String {
        switch self {
        case .reveil: return "\(name) s'étire au soleil"
        case .travail: return "\(name) est au boulot !"
        case .midi: return "\(name) déjeune avec la famille"
        case .jeu: return "\(name) s'amuse dans la clairière"
        case .routine: return "L'heure de la routine du soir"
        case .dodo: return "\(name) se prépare à dormir"
        case .recap: return "Journée accomplie 🌙"
        }
    }

    func subtitle(state: MascotteActivityAttributes.ContentState) -> String {
        let meal = state.currentMeal ?? ""
        switch self {
        case .reveil:
            return "Bonjour 🌅 · Prête pour la journée"
        case .travail:
            if state.tasksTotal > 0 {
                return "Tâches du matin : \(state.tasksDone)/\(state.tasksTotal)"
            }
            return "Prête à coopérer avec ta famille"
        case .midi:
            if let rdv = state.nextRdvText, !rdv.isEmpty {
                return "RDV : \(rdv)"
            }
            return meal.isEmpty ? "Au menu : à planifier 🍴" : "Au menu : \(meal) 🍝"
        case .jeu:
            if state.tasksTotal > 0 {
                return "Tâches : \(state.tasksDone)/\(state.tasksTotal) · +\(state.xpGained) XP"
            }
            return "Temps libre dans la clairière"
        case .routine:
            return meal.isEmpty
                ? "Douche → Pyjama → Dents"
                : "Dîner : \(meal) · Puis routine 🛁"
        case .dodo:
            return "Une petite histoire avant de dormir ?"
        case .recap:
            return recapLine(state: state)
        }
    }

}

/// Plage de progression de la Live Activity : du moment où l'utilisateur a
/// appuyé sur "Réveiller" jusqu'à la fin de cette journée (minuit suivant).
/// Alimente `ProgressView(timerInterval:)` pour une progression système animée,
/// qui continue même quand le widget extension est suspendu.
@available(iOS 16.2, *)
private func progressRange(from startedAt: Date) -> ClosedRange<Date> {
    let cal = Calendar.current
    let startOfDay = cal.startOfDay(for: startedAt)
    let endOfDay = cal.date(byAdding: .day, value: 1, to: startOfDay) ?? startedAt.addingTimeInterval(86400)
    return startedAt...endOfDay
}

/// Ligne récap partagée entre la DI expanded et le Lock Screen : "5/5 tâches · +45 XP"
/// (+ ligne bonus optionnelle si `bonusText` présent).
@available(iOS 16.2, *)
private func recapLine(state: MascotteActivityAttributes.ContentState) -> String {
    var parts: [String] = []
    if state.tasksTotal > 0 {
        parts.append("\(state.tasksDone)/\(state.tasksTotal) tâches")
    } else if state.tasksDone > 0 {
        parts.append("\(state.tasksDone) tâches")
    }
    if state.xpGained > 0 {
        parts.append("+\(state.xpGained) XP")
    }
    let line1 = parts.joined(separator: " · ")
    if let bonus = state.bonusText, !bonus.isEmpty {
        return line1.isEmpty ? bonus : "\(line1)\n\(bonus)"
    }
    return line1.isEmpty ? "Repose-toi bien 💚" : line1
}

/// Affiche la prochaine tâche pendant les stages actifs (reveil/travail/jeu/routine).
/// Les stages midi (RDV/repas), dodo (histoire) et recap (stats finales) ont leur propre narratif.
@available(iOS 16.2, *)
private func shouldShowNextTask(stage: MascotteStage) -> Bool {
    switch stage {
    case .reveil, .travail, .jeu, .routine: return true
    case .midi, .dodo, .recap: return false
    }
}

/// Sprite pixel-art du compagnon pour la DI compact (leading + minimal).
/// Phase 260425-0qf : lit companion-sprite-{pose}.png depuis l'App Group.
/// Fallback sur l'emoji de stage si le fichier est absent ou non lisible.
/// Taille fixe ~28pt adaptée à la pilule ; `interpolation(.none)` préserve le pixel-art.
@available(iOS 16.2, *)
@ViewBuilder
private func companionCompactView(
    state: MascotteActivityAttributes.ContentState,
    fallbackEmoji: String
) -> some View {
    let pose = state.pose ?? "idle"
    if let uiImage = CompanionSpriteCache.image(for: pose) {
        Image(uiImage: uiImage)
            .interpolation(.none)
            .resizable()
            .aspectRatio(contentMode: .fit)
            .frame(width: 28, height: 28)
            .accessibilityLabel("Compagnon")
    } else {
        Text(fallbackEmoji)
            .font(.title3)
            .accessibilityLabel("Compagnon")
    }
}

/// Cache mémoire du sprite compagnon indexé par nom de pose.
/// Phase 260425-0qf : keyed par pose ("idle"/"happy"/"sleeping"/"eating"/"celebrating")
/// plutôt que par token — lit companion-sprite-{pose}.png dans l'App Group.
/// Évite la relecture disque à chaque render (compactLeading + minimal +
/// Lock Screen = 3× par refresh). Cache partagé pour toute la durée de la LA.
@available(iOS 16.2, *)
private enum CompanionSpriteCache {
    private static var cache: [String: UIImage] = [:]

    /// Retourne l'image pour la pose donnée. Lit depuis l'App Group si absent du cache.
    static func image(for pose: String) -> UIImage? {
        let key = pose.isEmpty ? "idle" : pose
        if let cached = cache[key] { return cached }
        guard let container = FileManager.default.containerURL(
            forSecurityApplicationGroupIdentifier: "group.com.familyvault.dev"
        ) else { return nil }
        let fileURL = container.appendingPathComponent("companion-sprite-\(key).png")
        guard let data = try? Data(contentsOf: fileURL),
              let image = UIImage(data: data) else { return nil }
        cache[key] = image
        return image
    }
}

/// Contenu du compact trailing de la DI. Priorités :
/// 1. Bonus level-up (bonusText non vide) → flèche ⬆️ dorée
/// 2. Récap 100% → checkmark vert (journée bouclée)
/// 3. Récap partiel → texte "X/Y" compact
/// 4. Tâches en cours (tasksTotal > 0) → Gauge circulaire avec nombre de tâches faites
/// 5. Fallback → label narratif du stage (ex: "Joue", "Réveil")
@available(iOS 16.2, *)
@ViewBuilder
private func compactTrailingView(
    state: MascotteActivityAttributes.ContentState,
    stage: MascotteStage
) -> some View {
    if stage == .recap {
        if let bonus = state.bonusText, !bonus.isEmpty {
            Text("⬆️")
                .font(.caption)
        } else if state.tasksTotal > 0 && state.tasksDone >= state.tasksTotal {
            Image(systemName: "checkmark.circle.fill")
                .font(.caption)
                .foregroundColor(.green)
        } else if state.tasksTotal > 0 {
            Text("\(state.tasksDone)/\(state.tasksTotal)")
                .font(.system(size: 11, weight: .semibold))
                .foregroundColor(.white)
        } else {
            Text(stage.compactLabel)
                .font(.caption2)
                .fontWeight(.semibold)
        }
    } else if state.tasksTotal > 0 && state.tasksDone > 0 {
        let progress = min(1.0, Double(state.tasksDone) / Double(state.tasksTotal))
        let justFlashed = state.justCompletedAt != nil
        ZStack {
            Circle()
                .stroke(Color.white.opacity(0.25), lineWidth: 2.5)
            Circle()
                .trim(from: 0, to: progress)
                .stroke(Color.green, style: StrokeStyle(lineWidth: 2.5, lineCap: .round))
                .rotationEffect(.degrees(-90))
            // Pendant le flash post-tap : ✓ bondissant au centre (feedback
            // immédiat). Sinon : le compteur numérique tasksDone.
            if justFlashed {
                if #available(iOS 17.0, *) {
                    Image(systemName: "checkmark")
                        .font(.system(size: 11, weight: .heavy))
                        .foregroundColor(.green)
                        .symbolEffect(.bounce, value: state.justCompletedAt)
                } else {
                    Image(systemName: "checkmark")
                        .font(.system(size: 11, weight: .heavy))
                        .foregroundColor(.green)
                }
            } else {
                Text("\(state.tasksDone)")
                    .font(.system(size: 11, weight: .bold))
                    .foregroundColor(.white)
                    .monospacedDigit()
            }
        }
        .frame(width: 22, height: 22)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(justFlashed
            ? "Tâche cochée, \(state.tasksDone) sur \(state.tasksTotal)"
            : "\(state.tasksDone) tâches sur \(state.tasksTotal)")
    } else {
        Text(stage.compactLabel)
            .font(.caption2)
            .fontWeight(.semibold)
    }
}

// MARK: - Live Activity

@available(iOS 16.2, *)
struct MascotteLiveActivity: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: MascotteActivityAttributes.self) { context in
            MascotteLockScreenView(context: context)
                .widgetURL(MascotteDeepLink.tree.url)
        } dynamicIsland: { context in
            let now = Date()
            let stage = MascotteStage.resolve(date: now, override: context.state.stageOverride)
            let title = stage.title(name: context.attributes.mascotteName)
            let subtitle: String = {
                if let bubble = context.state.speechBubble, !bubble.isEmpty {
                    return bubble
                }
                return stage.subtitle(state: context.state)
            }()
            let headEmoji = stage.emoji
            return DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    // Phase 260425-0qf — sprite pose au lieu de l'emoji pur ; taille
                    // adaptée à la région DI expanded leading (~40pt pour matcher
                    // l'ancien rendu emoji 32pt avec marge pixel art).
                    let pose = context.state.pose ?? "idle"
                    if let uiImage = CompanionSpriteCache.image(for: pose) {
                        Image(uiImage: uiImage)
                            .interpolation(.none)
                            .resizable()
                            .aspectRatio(contentMode: .fit)
                            .frame(width: 52, height: 52)
                            .accessibilityLabel("Compagnon \(context.attributes.mascotteName)")
                    } else {
                        Text(headEmoji)
                            .font(.system(size: 32))
                    }
                }
                DynamicIslandExpandedRegion(.center) {
                    VStack(alignment: .leading, spacing: 2) {
                        Text(title)
                            .font(.caption)
                            .fontWeight(.bold)
                            .foregroundColor(.white)
                            .lineLimit(1)
                        Text(subtitle)
                            .font(.caption2)
                            .foregroundColor(.white.opacity(0.75))
                            .lineLimit(1)
                    }
                }
                DynamicIslandExpandedRegion(.bottom) {
                    VStack(spacing: 5) {
                        if stage == .dodo {
                            Link(destination: MascotteDeepLink.stories.url) {
                                HStack(spacing: 6) {
                                    Image(systemName: "book.fill")
                                        .font(.caption2)
                                        .foregroundColor(.yellow)
                                    Text("Lire une histoire")
                                        .font(.caption2)
                                        .fontWeight(.semibold)
                                        .foregroundColor(.white)
                                    Spacer(minLength: 0)
                                    Image(systemName: "chevron.right")
                                        .font(.caption2)
                                        .foregroundColor(.white.opacity(0.6))
                                }
                                .padding(.vertical, 4)
                                .padding(.horizontal, 8)
                                .background(Color.white.opacity(0.08))
                                .clipShape(RoundedRectangle(cornerRadius: 8))
                            }
                        } else if stage == .routine {
                            Link(destination: MascotteDeepLink.routines.url) {
                                HStack(spacing: 6) {
                                    Image(systemName: "checklist")
                                        .font(.caption2)
                                        .foregroundColor(.cyan)
                                    Text("Ouvrir une routine")
                                        .font(.caption2)
                                        .fontWeight(.semibold)
                                        .foregroundColor(.white)
                                    Spacer(minLength: 0)
                                    Image(systemName: "chevron.right")
                                        .font(.caption2)
                                        .foregroundColor(.white.opacity(0.6))
                                }
                                .padding(.vertical, 4)
                                .padding(.horizontal, 8)
                                .background(Color.white.opacity(0.08))
                                .clipShape(RoundedRectangle(cornerRadius: 8))
                            }
                        }
                        if let next = context.state.nextTaskText, !next.isEmpty,
                           shouldShowNextTask(stage: stage) {
                            HStack(spacing: 6) {
                                Image(systemName: "circle")
                                    .font(.caption2)
                                    .foregroundColor(.green)
                                Text(next)
                                    .font(.caption2)
                                    .foregroundColor(.white.opacity(0.85))
                                    .lineLimit(1)
                                Spacer(minLength: 0)
                                if #available(iOS 17.0, *),
                                   let taskId = context.state.nextTaskId, !taskId.isEmpty {
                                    Button(intent: ToggleNextTaskIntent(taskId: taskId)) {
                                        Label("Cocher", systemImage: "checkmark.circle.fill")
                                            .font(.caption2)
                                            .labelStyle(.titleAndIcon)
                                    }
                                    .tint(.green)
                                    .buttonStyle(.bordered)
                                    .controlSize(.mini)
                                }
                            }
                        }
                        ProgressView(timerInterval: progressRange(from: context.attributes.startedAt), countsDown: false) {
                            EmptyView()
                        } currentValueLabel: {
                            EmptyView()
                        }
                        .tint(.green)
                    }
                }
            } compactLeading: {
                companionCompactView(state: context.state, fallbackEmoji: headEmoji)
            } compactTrailing: {
                compactTrailingView(state: context.state, stage: stage)
            } minimal: {
                companionCompactView(state: context.state, fallbackEmoji: headEmoji)
            }
            .widgetURL(MascotteDeepLink.tree.url)
        }
    }
}

// MARK: - Lock Screen View

@available(iOS 16.2, *)
struct MascotteLockScreenView: View {
    let context: ActivityViewContext<MascotteActivityAttributes>
    @Environment(\.colorScheme) private var colorScheme

    var body: some View {
        let stage = MascotteStage.resolve(date: Date(), override: context.state.stageOverride)
        let isRecap = stage == .recap
        return HStack(spacing: 14) {
                companionAvatar(fallbackEmoji: stage.emoji)
                    .frame(width: 72, height: 72)
                    .background(Color.white.opacity(0.08))
                    .clipShape(RoundedRectangle(cornerRadius: 16))

                VStack(alignment: .leading, spacing: 4) {
                    HStack(spacing: 6) {
                        // Flash post-tap : le point vert devient un ✓ bondissant
                        // (feedback immédiat de l'action "Cocher") tant que l'app
                        // n'a pas réconcilié en foreground.
                        if context.state.justCompletedAt != nil {
                            if #available(iOS 17.0, *) {
                                Image(systemName: "checkmark.circle.fill")
                                    .font(.system(size: 11, weight: .bold))
                                    .foregroundColor(.green)
                                    .symbolEffect(.bounce, value: context.state.justCompletedAt)
                            } else {
                                Image(systemName: "checkmark.circle.fill")
                                    .font(.system(size: 11, weight: .bold))
                                    .foregroundColor(.green)
                            }
                        } else {
                            Circle()
                                .fill(Color.green)
                                .frame(width: 6, height: 6)
                        }
                        Text("La journée de \(context.attributes.mascotteName)")
                            .font(.caption)
                            .fontWeight(.bold)
                            .foregroundColor(.white)
                        if context.state.justCompletedAt != nil {
                            Text("+1 fait")
                                .font(.system(size: 10, weight: .semibold))
                                .foregroundColor(.green)
                                .padding(.horizontal, 5)
                                .padding(.vertical, 1)
                                .background(Color.green.opacity(0.15))
                                .clipShape(Capsule())
                        }
                    }
                    if isRecap {
                        Text("Journée accomplie 🌙")
                            .font(.subheadline)
                            .fontWeight(.semibold)
                            .foregroundColor(.white)
                            .lineLimit(1)
                        Text(recapLine(state: context.state))
                            .font(.caption2)
                            .foregroundColor(.white.opacity(0.7))
                            .lineLimit(2)
                    } else {
                        Text(stage.title(name: context.attributes.mascotteName))
                            .font(.subheadline)
                            .fontWeight(.semibold)
                            .foregroundColor(.white)
                            .lineLimit(1)
                        if let bubble = context.state.speechBubble, !bubble.isEmpty {
                            Text("\u{201C}\(bubble)\u{201D}")
                                .font(.caption2)
                                .italic()
                                .foregroundColor(.white.opacity(0.85))
                                .lineLimit(2)
                        } else {
                            Text(stage.subtitle(state: context.state))
                                .font(.caption2)
                                .foregroundColor(.white.opacity(0.7))
                                .lineLimit(1)
                        }
                    }
                    ProgressView(timerInterval: progressRange(from: context.attributes.startedAt), countsDown: false) {
                        EmptyView()
                    } currentValueLabel: {
                        EmptyView()
                    }
                    .tint(.green)
                    .padding(.top, 2)
                    if stage == .dodo {
                        Link(destination: MascotteDeepLink.stories.url) {
                            HStack(spacing: 6) {
                                Image(systemName: "book.fill")
                                    .font(.caption2)
                                    .foregroundColor(.yellow)
                                Text("Lire une histoire")
                                    .font(.caption2)
                                    .fontWeight(.semibold)
                                    .foregroundColor(.white)
                                Spacer(minLength: 0)
                                Image(systemName: "chevron.right")
                                    .font(.caption2)
                                    .foregroundColor(.white.opacity(0.6))
                            }
                            .padding(.vertical, 5)
                            .padding(.horizontal, 9)
                            .background(Color.white.opacity(0.08))
                            .clipShape(RoundedRectangle(cornerRadius: 8))
                        }
                        .padding(.top, 4)
                    } else if stage == .routine {
                        Link(destination: MascotteDeepLink.routines.url) {
                            HStack(spacing: 6) {
                                Image(systemName: "checklist")
                                    .font(.caption2)
                                    .foregroundColor(.cyan)
                                Text("Ouvrir une routine")
                                    .font(.caption2)
                                    .fontWeight(.semibold)
                                    .foregroundColor(.white)
                                Spacer(minLength: 0)
                                Image(systemName: "chevron.right")
                                    .font(.caption2)
                                    .foregroundColor(.white.opacity(0.6))
                            }
                            .padding(.vertical, 5)
                            .padding(.horizontal, 9)
                            .background(Color.white.opacity(0.08))
                            .clipShape(RoundedRectangle(cornerRadius: 8))
                        }
                        .padding(.top, 4)
                    }
                    if shouldShowNextTask(stage: stage),
                       let next = context.state.nextTaskText, !next.isEmpty {
                        HStack(spacing: 6) {
                            Image(systemName: "circle")
                                .font(.caption2)
                                .foregroundColor(.green)
                            Text(next)
                                .font(.caption2)
                                .foregroundColor(.white.opacity(0.75))
                                .lineLimit(1)
                            Spacer(minLength: 0)
                            if #available(iOS 17.0, *),
                               let taskId = context.state.nextTaskId, !taskId.isEmpty {
                                Button(intent: ToggleNextTaskIntent(taskId: taskId)) {
                                    Label("Cocher", systemImage: "checkmark.circle.fill")
                                        .font(.caption2)
                                        .labelStyle(.titleAndIcon)
                                }
                                .tint(.green)
                                .buttonStyle(.bordered)
                                .controlSize(.mini)
                            }
                        }
                        .padding(.top, 4)
                    }
                }

                Spacer(minLength: 0)
            }
        .padding(14)
        .activityBackgroundTint(colorScheme == .dark
            ? Color.black.opacity(0.85)
            : Color(white: 0.12).opacity(0.92))
    }

    /// Affiche le sprite pixel art du compagnon depuis l'App Group (keyed par pose).
    /// Phase 260425-0qf : lit companion-sprite-{pose}.png — plus de companionSpriteToken.
    /// Fallback sur l'emoji du stage narratif si le fichier est absent.
    @ViewBuilder
    private func companionAvatar(fallbackEmoji: String) -> some View {
        let label = "Compagnon \(context.attributes.mascotteName)"
        let pose = context.state.pose ?? "idle"
        if let uiImage = CompanionSpriteCache.image(for: pose) {
            Image(uiImage: uiImage)
                .interpolation(.none)
                .resizable()
                .aspectRatio(contentMode: .fit)
                .scaleEffect(1.5)
                .accessibilityLabel(label)
        } else {
            Text(fallbackEmoji)
                .font(.system(size: 48))
                .accessibilityLabel(label)
        }
    }

}
