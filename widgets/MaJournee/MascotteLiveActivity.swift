import ActivityKit
import AppIntents
import SwiftUI
import UIKit
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
        var stageOverride: String?         // "reveil"|"travail"|"midi"|"jeu"|"routine"|"dodo" (dev/test)
        var companionSpriteBase64: String? // PNG idle du compagnon du profil (Lock Screen)
        var recapMode: Bool                // true >= 21h → layout récap de fin de journée
        var bonusText: String?             // ligne bonus récap (ex: "⬆️ Niveau 12 atteint !")
        var nextTaskText: String?          // prochaine tâche (récurrente prioritaire) — affichée pendant travail/jeu/routine
        var nextTaskId: String?            // identifiant unique de la prochaine tâche (pour ToggleNextTaskIntent)
        var upcomingTasksJson: String?     // queue JSON des 3 prochaines tâches [{"id":"...","text":"..."}] pour swap live au tap
    }

    var mascotteName: String
    var startedAt: Date
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

    @MainActor
    func perform() async throws -> some IntentResult {
        let logPath: (URL) -> URL = { $0.appendingPathComponent("toggle-intent-debug.log") }
        func log(_ msg: String, container: URL?) {
            guard let container else { return }
            let url = logPath(container)
            let stamp = ISO8601DateFormatter().string(from: Date())
            let line = "[\(stamp)] \(msg)\n"
            if let data = line.data(using: .utf8) {
                if FileManager.default.fileExists(atPath: url.path),
                   let handle = try? FileHandle(forWritingTo: url) {
                    handle.seekToEndOfFile()
                    handle.write(data)
                    try? handle.close()
                } else {
                    try? data.write(to: url)
                }
            }
        }

        guard let container = FileManager.default.containerURL(
            forSecurityApplicationGroupIdentifier: "group.com.familyvault.dev"
        ) else {
            return .result()
        }

        log("perform() called taskId=\(taskId)", container: container)

        guard !taskId.isEmpty else {
            log("taskId is empty — aborted", container: container)
            return .result()
        }

        let dir = container.appendingPathComponent("pending-task-toggles", isDirectory: true)
        do {
            try FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        } catch {
            log("createDirectory failed: \(error)", container: container)
        }

        let filename = "pending-task-toggle-\(UUID().uuidString).json"
        let fileURL = dir.appendingPathComponent(filename)
        let payload: [String: Any] = [
            "taskId": taskId,
            "timestamp": ISO8601DateFormatter().string(from: Date())
        ]
        do {
            let data = try JSONSerialization.data(withJSONObject: payload)
            try data.write(to: fileURL)
            log("wrote \(filename)", container: container)
        } catch {
            log("write failed: \(error)", container: container)
        }

        // NOTE : l'update optimiste (swap live vers la tâche suivante) est
        // désactivé car Activity<MascotteActivityAttributes>.activities retourne
        // toujours 0 dans le process widget — l'activity a été lancée depuis le
        // module VaultAccess, le widget a son propre module MaJourneeWidget,
        // et Swift considère les types comme distincts malgré un shape
        // identique. La vraie solution serait de partager le struct via un
        // framework Swift commun aux 2 targets (refonte Xcode). En attendant,
        // la réconciliation se fait au foreground app suivant.

        return .result()
    }
}

// MARK: - Upcoming Tasks Queue

/// Représente une tâche dans la queue de la Live Activity (payload compact
/// pour permettre le swap live au tap du bouton "Cocher").
struct UpcomingTask: Codable, Hashable {
    let id: String
    let text: String
}

/// Décode le JSON `[{"id":"...","text":"..."}]` stocké dans ContentState en
/// liste Swift. Retourne [] si null / invalide.
func decodeUpcomingTasks(_ json: String?) -> [UpcomingTask] {
    guard let json = json, let data = json.data(using: .utf8) else { return [] }
    return (try? JSONDecoder().decode([UpcomingTask].self, from: data)) ?? []
}

/// Encode la queue en JSON pour stockage dans ContentState. Retourne nil si vide.
func encodeUpcomingTasks(_ tasks: [UpcomingTask]) -> String? {
    guard !tasks.isEmpty, let data = try? JSONEncoder().encode(tasks) else { return nil }
    return String(data: data, encoding: .utf8)
}

// MARK: - Stage Narrative

@available(iOS 16.2, *)
enum MascotteStage {
    case reveil, travail, midi, jeu, routine, dodo

    static func `for`(date: Date) -> MascotteStage {
        let h = Calendar.current.component(.hour, from: date)
        switch h {
        case 0..<9: return .reveil
        case 9..<12: return .travail
        case 12..<14: return .midi
        case 14..<18: return .jeu
        case 18..<21: return .routine
        default: return .dodo
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
        default: return nil
        }
    }

    /// Résout le stage : override si fourni, sinon basé sur l'heure
    static func resolve(date: Date, override: String?) -> MascotteStage {
        MascotteStage.from(override: override) ?? MascotteStage.for(date: date)
    }

    var emoji: String {
        switch self {
        case .reveil: return "🌅"
        case .travail: return "⛏️"
        case .midi: return "🍽️"
        case .jeu: return "🌿"
        case .routine: return "🛁"
        case .dodo: return "🌙"
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
        }
    }

    func title(name: String) -> String {
        switch self {
        case .reveil: return "\(name) s'étire au soleil"
        case .travail: return "\(name) est au boulot !"
        case .midi: return "\(name) déjeune avec la famille"
        case .jeu: return "\(name) s'amuse dans la clairière"
        case .routine: return "L'heure de la routine du soir"
        case .dodo: return "\(name) dort paisiblement"
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
            return meal.isEmpty ? "Au menu : à planifier 🍴" : "Au menu : \(meal) 🍝"
        case .jeu:
            if state.tasksTotal > 0 {
                return "Tâches : \(state.tasksDone)/\(state.tasksTotal) · +\(state.xpGained) XP"
            }
            return "Temps libre dans la clairière"
        case .routine:
            return meal.isEmpty
                ? "Douche → Pyjama → Dents → Histoire"
                : "Dîner : \(meal) · Puis routine 🛁"
        case .dodo:
            return "Récap : \(state.tasksDone) tâches · +\(state.xpGained) XP 💚"
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

/// Affiche la prochaine tâche uniquement pendant les stages d'activité (travail/jeu/routine).
/// Les stages reveil/midi/dodo et le mode récap ont leur propre narratif (repas, dodo, stats).
@available(iOS 16.2, *)
private func shouldShowNextTask(stage: MascotteStage, isRecap: Bool) -> Bool {
    if isRecap { return false }
    switch stage {
    case .travail, .jeu, .routine: return true
    case .reveil, .midi, .dodo: return false
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
    if let b64 = state.companionSpriteBase64,
       let data = Data(base64Encoded: b64),
       let uiImage = UIImage(data: data) {
        Image(uiImage: uiImage)
            .interpolation(.none)
            .resizable()
            .aspectRatio(contentMode: .fit)
            .frame(width: 28, height: 28)
    } else {
        Text(fallbackEmoji)
            .font(.title3)
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
    stage: MascotteStage,
    isRecap: Bool
) -> some View {
    if isRecap {
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
                .widgetURL(URL(string: "family-vault://open/tree"))
        } dynamicIsland: { context in
            let now = Date()
            let stage = MascotteStage.resolve(date: now, override: context.state.stageOverride)
            let currentHour = Calendar.current.component(.hour, from: now)
            let isRecap = context.state.recapMode || (currentHour >= 21 && currentHour < 23)
            let title = isRecap
                ? "Journée accomplie 🌙"
                : stage.title(name: context.attributes.mascotteName)
            let subtitle = isRecap
                ? recapLine(state: context.state)
                : stage.subtitle(state: context.state)
            let headEmoji = isRecap ? "🌙" : stage.emoji
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
                        if let next = context.state.nextTaskText, !next.isEmpty,
                           shouldShowNextTask(stage: stage, isRecap: isRecap) {
                            HStack(spacing: 6) {
                                Image(systemName: "circle")
                                    .font(.caption2)
                                    .foregroundColor(.green)
                                Text("Prochain : \(next)")
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
                compactTrailingView(state: context.state, stage: stage, isRecap: isRecap)
            } minimal: {
                companionCompactView(state: context.state, fallbackEmoji: headEmoji)
            }
            .widgetURL(URL(string: "family-vault://open/tree"))
        }
    }
}

// MARK: - Lock Screen View

@available(iOS 16.2, *)
struct MascotteLockScreenView: View {
    let context: ActivityViewContext<MascotteActivityAttributes>

    var body: some View {
        let stage = MascotteStage.resolve(date: Date(), override: context.state.stageOverride)
        // Récap inferré depuis l'heure locale (fenêtre 21-23h) si la ContentState
        // n'a pas encore été refresh. Après 23h, on repasse en dodo narratif.
        let currentHour = Calendar.current.component(.hour, from: Date())
        let isRecap = context.state.recapMode || (currentHour >= 21 && currentHour < 23)
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
                        Text(stage.subtitle(state: context.state))
                            .font(.caption2)
                            .foregroundColor(.white.opacity(0.7))
                            .lineLimit(1)
                    }
                    ProgressView(timerInterval: progressRange(from: context.attributes.startedAt), countsDown: false) {
                        EmptyView()
                    } currentValueLabel: {
                        EmptyView()
                    }
                    .tint(.green)
                    .padding(.top, 2)
                    if !isRecap,
                       shouldShowNextTask(stage: stage, isRecap: isRecap),
                       let next = context.state.nextTaskText, !next.isEmpty {
                        HStack(spacing: 6) {
                            Image(systemName: "circle")
                                .font(.caption2)
                                .foregroundColor(.green)
                            Text("Prochain : \(next)")
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
        .activityBackgroundTint(Color.black.opacity(0.85))
    }

    /// Affiche le sprite pixel art du compagnon si disponible dans le ContentState,
    /// sinon fallback sur l'emoji du stage narratif.
    @ViewBuilder
    private func companionAvatar(fallbackEmoji: String) -> some View {
        if let b64 = context.state.companionSpriteBase64,
           let data = Data(base64Encoded: b64),
           let uiImage = UIImage(data: data) {
            Image(uiImage: uiImage)
                .interpolation(.none)
                .resizable()
                .aspectRatio(contentMode: .fit)
                .scaleEffect(1.5)
        } else {
            Text(fallbackEmoji)
                .font(.system(size: 48))
        }
    }

}
