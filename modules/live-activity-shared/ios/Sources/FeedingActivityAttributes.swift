import ActivityKit
import Foundation

/// Attributes de la Live Activity feeding (allaitement / biberon). Source
/// unique de vérité partagée entre VaultAccess (start/update/stop depuis le
/// bridge JS) et le widget extension (rendu DI + Lock Screen + App Intent).
///
/// IMPORTANT : toute modification du ContentState doit être ADDITIVE avec
/// valeurs par défaut — les activities en cours encodent/décodent via
/// Codable JSON, un champ retiré casserait une session active.
@available(iOS 16.2, *)
public struct FeedingActivityAttributes: ActivityAttributes {
    public struct ContentState: Codable, Hashable {
        public var isPaused: Bool
        public var side: String?       // "G" ou "D" (allaitement)
        public var volumeMl: Int?      // ml (biberon)

        public init(isPaused: Bool, side: String? = nil, volumeMl: Int? = nil) {
            self.isPaused = isPaused
            self.side = side
            self.volumeMl = volumeMl
        }
    }

    public var babyName: String
    public var babyEmoji: String
    public var feedType: String        // "allaitement" ou "biberon"
    public var startedAt: Date

    public init(babyName: String, babyEmoji: String, feedType: String, startedAt: Date) {
        self.babyName = babyName
        self.babyEmoji = babyEmoji
        self.feedType = feedType
        self.startedAt = startedAt
    }
}
