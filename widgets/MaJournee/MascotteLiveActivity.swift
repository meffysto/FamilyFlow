import ActivityKit
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
        var currentMeal: String?    // ex: "Pâtes carbonara" (déjeuner ou dîner selon l'heure)
        var stageOverride: String?  // "reveil"|"travail"|"midi"|"jeu"|"routine"|"dodo" (dev/test)
    }

    var mascotteName: String
    var startedAt: Date
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
        case .jeu: return "Joue"
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

    /// Progression visuelle (0-1) pour la barre Lock Screen
    func progress(state: MascotteActivityAttributes.ContentState) -> Double {
        switch self {
        case .reveil: return 0.08
        case .travail: return 0.30
        case .midi: return 0.50
        case .jeu: return 0.70
        case .routine: return 0.88
        case .dodo: return 1.0
        }
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
            let stage = MascotteStage.resolve(date: Date(), override: context.state.stageOverride)
            return DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    Text(stage.emoji)
                        .font(.system(size: 32))
                }
                DynamicIslandExpandedRegion(.center) {
                    VStack(alignment: .leading, spacing: 2) {
                        Text(stage.title(name: context.attributes.mascotteName))
                            .font(.caption)
                            .fontWeight(.bold)
                            .foregroundColor(.white)
                            .lineLimit(1)
                        Text(stage.subtitle(state: context.state))
                            .font(.caption2)
                            .foregroundColor(.white.opacity(0.75))
                            .lineLimit(1)
                    }
                }
                DynamicIslandExpandedRegion(.bottom) {
                    ProgressView(value: stage.progress(state: context.state))
                        .tint(.green)
                }
            } compactLeading: {
                Text(stage.emoji)
                    .font(.caption)
            } compactTrailing: {
                Text(stage.compactLabel)
                    .font(.caption2)
                    .fontWeight(.semibold)
            } minimal: {
                Text(stage.emoji)
                    .font(.caption2)
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
        return Group {
            HStack(spacing: 14) {
                Text(stage.emoji)
                    .font(.system(size: 38))
                    .frame(width: 56, height: 56)
                    .background(Color.white.opacity(0.08))
                    .clipShape(RoundedRectangle(cornerRadius: 14))

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
                    Text(stage.title(name: context.attributes.mascotteName))
                        .font(.subheadline)
                        .fontWeight(.semibold)
                        .foregroundColor(.white)
                        .lineLimit(1)
                    Text(stage.subtitle(state: context.state))
                        .font(.caption2)
                        .foregroundColor(.white.opacity(0.7))
                        .lineLimit(1)
                    ProgressView(value: stage.progress(state: context.state))
                        .tint(.green)
                        .padding(.top, 2)
                }

                Spacer(minLength: 0)
            }
            .padding(14)
            .activityBackgroundTint(Color.black.opacity(0.85))
        }
    }
}
