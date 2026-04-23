import ActivityKit
import AppIntents
import SwiftUI
import WidgetKit

// MARK: - Attributes

@available(iOS 16.2, *)
struct MascotteActivityAttributes: ActivityAttributes {
    /// État dynamique mis à jour au fil de la journée depuis l'app RN
    public struct ContentState: Codable, Hashable {
        var tasksDone: Int
        var tasksTotal: Int
        var xpGained: Int
        var currentMeal: String?           // ex: "Pâtes carbonara" (déjeuner ou dîner selon l'heure)
        var stageOverride: String?         // "reveil"|"travail"|"midi"|"jeu"|"routine"|"dodo"|"recap" (dev/test)
        var companionSpriteToken: String? // cache-bust token ; PNG lu depuis App Group
        var bonusText: String?             // ligne bonus récap (ex: "⬆️ Niveau 12 atteint !")
        var nextTaskText: String?          // prochaine tâche (récurrente prioritaire) — affichée pendant reveil/travail/jeu/routine
        var nextTaskId: String?            // identifiant unique de la prochaine tâche (pour ToggleNextTaskIntent)
        var nextRdvText: String?           // prochain RDV < 24h (ex: "Pédiatre 14:30") — affiché pendant midi
        var speechBubble: String?          // phrase courte du compagnon (≤44 chars) — remplace le subtitle narratif
    }

    var mascotteName: String
    var startedAt: Date
}

// MARK: - Deep Links

/// Deep links centralisés pour éviter les force-unwrap répétés et garder
/// les URLs en un seul endroit (côté Swift ; miroir possible côté RN).
@available(iOS 16.2, *)
enum MascotteDeepLink: String {
    case tree = "family-vault://open/tree"
    case stories = "family-vault://open/stories"
    case routines = "family-vault://open/routines"

    var url: URL { URL(string: rawValue)! }
}

// MARK: - App Intent (toggle next task depuis la DI)

/// App Intent iOS 17+ : coche la prochaine tâche depuis la Live Activity sans
/// ouvrir l'app. Écrit un fichier "pending-task-toggle-{uuid}.json" dans l'App
/// Group partagé ; l'app le consomme au prochain foreground/boot (pattern
/// claim-first : le fichier est supprimé avant application par l'app).
@available(iOS 17.0, *)
struct ToggleNextTaskIntent: LiveActivityIntent {
    static var title: LocalizedStringResource = "Cocher la prochaine tâche"
    static var description: IntentDescription? = IntentDescription("Coche la prochaine tâche affichée dans la Live Activity de la mascotte.")
    // openAppWhenRun = false : le tap écrit juste un fichier pending dans
    // l'App Group, l'app applique toggle + XP/loot au prochain foreground.
    // L'update optimiste (swap live) n'est pas possible sans framework Swift
    // partagé entre widget et main app (limitation Apple connue).
    static var openAppWhenRun: Bool = false

    @Parameter(title: "Task ID")
    var taskId: String

    init() {}
    init(taskId: String) { self.taskId = taskId }

    /// Formatter ISO8601 partagé — l'instanciation est coûteuse, un seul suffit.
    private static let isoFormatter = ISO8601DateFormatter()

    @MainActor
    func perform() async throws -> some IntentResult {
        guard !taskId.isEmpty,
              let container = FileManager.default.containerURL(
                forSecurityApplicationGroupIdentifier: "group.com.familyvault.dev"
              ) else {
            return .result()
        }

        let dir = container.appendingPathComponent("pending-task-toggles", isDirectory: true)
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)

        let fileURL = dir.appendingPathComponent("pending-task-toggle-\(UUID().uuidString).json")
        let payload: [String: Any] = [
            "taskId": taskId,
            "timestamp": Self.isoFormatter.string(from: Date())
        ]
        if let data = try? JSONSerialization.data(withJSONObject: payload) {
            try? data.write(to: fileURL)
        }

        // NOTE : pas d'update optimiste de la Live Activity. Le widget (module
        // MaJourneeWidget) ne peut pas appeler Activity.update() sur une
        // activity lancée depuis le module VaultAccess — les types Swift sont
        // distincts malgré un shape identique (Activity<T>.activities retourne
        // 0 côté widget). La réconciliation (toggle vault + XP + loot + prochaine
        // tâche) se fait au foreground app suivant via le consumer + bridge.
        return .result()
    }
}

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
/// Si le sprite n'est pas disponible dans le state, fallback sur l'emoji de stage.
/// Taille fixe ~20pt adaptée à la pilule ; `interpolation(.none)` préserve le pixel-art.
@available(iOS 16.2, *)
@ViewBuilder
private func companionCompactView(
    state: MascotteActivityAttributes.ContentState,
    fallbackEmoji: String
) -> some View {
    if let token = state.companionSpriteToken,
       let uiImage = CompanionSpriteCache.image(for: token) {
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

/// Cache mémoire du sprite compagnon indexé par `companionSpriteToken`.
/// Évite la relecture disque à chaque render (compactLeading + minimal +
/// Lock Screen = 3× par refresh). Invalidé automatiquement quand l'app
/// change le token après régénération du sprite.
@available(iOS 16.2, *)
private enum CompanionSpriteCache {
    private static var cache: [String: UIImage] = [:]

    static func image(for token: String?) -> UIImage? {
        let key = token ?? "__default__"
        if let cached = cache[key] { return cached }
        guard let container = FileManager.default.containerURL(
            forSecurityApplicationGroupIdentifier: "group.com.familyvault.dev"
        ) else { return nil }
        let fileURL = container.appendingPathComponent("companion-sprite.png")
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
        ZStack {
            Circle()
                .stroke(Color.white.opacity(0.25), lineWidth: 2.5)
            Circle()
                .trim(from: 0, to: progress)
                .stroke(Color.green, style: StrokeStyle(lineWidth: 2.5, lineCap: .round))
                .rotationEffect(.degrees(-90))
            Text("\(state.tasksDone)")
                .font(.system(size: 11, weight: .bold))
                .foregroundColor(.white)
                .monospacedDigit()
        }
        .frame(width: 22, height: 22)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("\(state.tasksDone) tâches sur \(state.tasksTotal)")
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
                    Text(headEmoji)
                        .font(.system(size: 32))
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
                        Circle()
                            .fill(Color.green)
                            .frame(width: 6, height: 6)
                        Text("La journée de \(context.attributes.mascotteName)")
                            .font(.caption)
                            .fontWeight(.bold)
                            .foregroundColor(.white)
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

    /// Affiche le sprite pixel art du compagnon si disponible dans le ContentState,
    /// sinon fallback sur l'emoji du stage narratif.
    @ViewBuilder
    private func companionAvatar(fallbackEmoji: String) -> some View {
        let label = "Compagnon \(context.attributes.mascotteName)"
        if let token = context.state.companionSpriteToken,
           let uiImage = CompanionSpriteCache.image(for: token) {
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
