import ActivityKit
import AppIntents
import Foundation

/// App Intent iOS 17+ qui coche la prochaine tâche depuis le bouton affiché
/// dans la Live Activity (Dynamic Island expanded + Lock Screen).
///
/// Le système iOS exécute `perform()` dans le process de l'app main, pas
/// dans l'extension widget. L'app est démarrée en background si nécessaire.
///
/// Double action :
/// 1. **Update optimiste** : modifie immédiatement l'activity (tasksDone+1,
///    nextTaskText/Id clear) pour que l'UI reflète le tap en <100ms, sans
///    attendre que l'app reprenne la main en foreground.
/// 2. **Pending file** : écrit un JSON dans l'App Group pour que l'app,
///    au prochain foreground, applique le vrai toggle (vault markdown, XP,
///    loot, calcul prochaine tâche). Le consumer est idempotent et supprime
///    le fichier avant traitement (pattern claim-first).
@available(iOS 17.0, *)
public struct ToggleNextTaskIntent: LiveActivityIntent {
    public static var title: LocalizedStringResource = "Cocher la prochaine tâche"
    public static var description: IntentDescription? = IntentDescription(
        "Coche la prochaine tâche affichée dans la Live Activity de la mascotte."
    )
    public static var openAppWhenRun: Bool = false

    @Parameter(title: "Task ID")
    public var taskId: String

    public init() {}
    public init(taskId: String) { self.taskId = taskId }

    /// Formatter ISO8601 partagé — l'instanciation est coûteuse, un seul suffit.
    private static let isoFormatter = ISO8601DateFormatter()

    @MainActor
    public func perform() async throws -> some IntentResult {
        guard !taskId.isEmpty else { return .result() }

        writePendingToggle(taskId: taskId)
        await applyOptimisticUpdate(taskId: taskId)

        return .result()
    }

    // MARK: - Pending file (réconciliation foreground)

    private func writePendingToggle(taskId: String) {
        guard let dir = AppGroup.pendingTogglesDir() else { return }
        let fileURL = dir.appendingPathComponent("pending-task-toggle-\(UUID().uuidString).json")
        let payload: [String: Any] = [
            "taskId": taskId,
            "timestamp": Self.isoFormatter.string(from: Date())
        ]
        if let data = try? JSONSerialization.data(withJSONObject: payload) {
            try? data.write(to: fileURL)
        }
    }

    // MARK: - Update optimiste Live Activity

    /// Met à jour les activities en cours dont `nextTaskId` correspond au
    /// taskId tapé. Incrémente `tasksDone`, clear `nextTaskText/Id` pour
    /// faire disparaître visuellement la ligne prochaine-tâche.
    ///
    /// Les autres champs (xpGained, pose, etc.) sont
    /// intentionnellement préservés — ils seront mis à jour par l'app au
    /// prochain foreground avec les vraies valeurs gamification.
    private func applyOptimisticUpdate(taskId: String) async {
        for activity in Activity<MascotteActivityAttributes>.activities {
            let currentState = activity.content.state
            guard currentState.nextTaskId == taskId else { continue }

            let newState = MascotteActivityAttributes.ContentState(
                tasksDone: currentState.tasksDone + 1,
                tasksTotal: currentState.tasksTotal,
                xpGained: currentState.xpGained,
                currentMeal: currentState.currentMeal,
                stageOverride: currentState.stageOverride,
                pose: currentState.pose,
                bonusText: currentState.bonusText,
                nextTaskText: nil,
                nextTaskId: nil,
                nextRdvText: currentState.nextRdvText,
                speechBubble: currentState.speechBubble,
                justCompletedAt: Date()
            )
            await activity.update(ActivityContent(state: newState, staleDate: nil))
        }
    }
}
