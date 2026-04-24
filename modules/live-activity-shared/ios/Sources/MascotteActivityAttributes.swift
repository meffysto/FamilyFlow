import ActivityKit
import Foundation

/// Attributes de la Live Activity mascotte. Source unique de vérité —
/// partagée par VaultAccess (qui lance/update l'activity depuis le bridge
/// JS), par le widget extension (qui rend DI / Lock Screen), et par l'intent
/// partagé (qui fait l'update optimiste depuis le tap utilisateur).
///
/// IMPORTANT : toute modification du ContentState (ajout/retrait de champ,
/// changement de type) doit être ADDITIVE avec valeurs par défaut pour ne
/// pas casser les activities en cours au moment d'un update depuis
/// l'App Store (ActivityKit persiste et décode via Codable JSON).
@available(iOS 16.2, *)
public struct MascotteActivityAttributes: ActivityAttributes {
    public struct ContentState: Codable, Hashable {
        public var tasksDone: Int
        public var tasksTotal: Int
        public var xpGained: Int
        public var currentMeal: String?
        public var stageOverride: String?
        /// Phase 260425-0qf — remplace companionSpriteToken (ancien base64 ~5-15KB).
        /// Pose courante du compagnon : "idle" | "happy" | "sleeping" | "eating" | "celebrating".
        /// Le widget lit `companion-sprite-{pose}.png` depuis l'App Group.
        /// Optionnel pour compatibilité Codable avec les anciennes activities en cours
        /// (decode d'un JSON sans ce champ → nil, widget fallback sur emoji).
        /// Additive : anciens widgets ignorent ce champ sans crasher.
        public var pose: String?
        public var bonusText: String?
        public var nextTaskText: String?
        public var nextTaskId: String?
        public var nextRdvText: String?
        public var speechBubble: String?
        /// Timestamp posé par ToggleNextTaskIntent au tap. Non-nil → le widget
        /// affiche un ✓ flash sur la gauge (feedback immédiat de l'action).
        /// Remis à nil à chaque update côté app (la réconciliation foreground
        /// consume le flash en même temps que la vraie prochaine tâche arrive).
        public var justCompletedAt: Date?

        public init(
            tasksDone: Int,
            tasksTotal: Int,
            xpGained: Int,
            currentMeal: String? = nil,
            stageOverride: String? = nil,
            pose: String? = "idle",
            bonusText: String? = nil,
            nextTaskText: String? = nil,
            nextTaskId: String? = nil,
            nextRdvText: String? = nil,
            speechBubble: String? = nil,
            justCompletedAt: Date? = nil
        ) {
            self.tasksDone = tasksDone
            self.tasksTotal = tasksTotal
            self.xpGained = xpGained
            self.currentMeal = currentMeal
            self.stageOverride = stageOverride
            self.pose = pose
            self.bonusText = bonusText
            self.nextTaskText = nextTaskText
            self.nextTaskId = nextTaskId
            self.nextRdvText = nextRdvText
            self.speechBubble = speechBubble
            self.justCompletedAt = justCompletedAt
        }
    }

    public var mascotteName: String
    public var startedAt: Date

    public init(mascotteName: String, startedAt: Date) {
        self.mascotteName = mascotteName
        self.startedAt = startedAt
    }
}
