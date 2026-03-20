import ActivityKit
import SwiftUI
import WidgetKit

// MARK: - Attributes

struct FeedingActivityAttributes: ActivityAttributes {
    /// Données statiques (ne changent pas pendant l'activité)
    public struct ContentState: Codable, Hashable {
        var isPaused: Bool
        var side: String?       // "G" ou "D" (allaitement)
        var volumeMl: Int?      // ml (biberon)
    }

    var babyName: String
    var babyEmoji: String
    var feedType: String        // "allaitement" ou "biberon"
    var startedAt: Date
}

// MARK: - Live Activity

@available(iOS 16.2, *)
struct FeedingLiveActivity: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: FeedingActivityAttributes.self) { context in
            // Lock Screen / StandBy banner
            FeedingLockScreenView(context: context)
                .widgetURL(URL(string: "family-vault://open/night-mode"))
        } dynamicIsland: { context in
            DynamicIsland {
                // Expanded (tap long sur Dynamic Island)
                DynamicIslandExpandedRegion(.leading) {
                    Text(context.attributes.feedType == "allaitement" ? "🤱" : "🍼")
                        .font(.title)
                }
                DynamicIslandExpandedRegion(.center) {
                    VStack(spacing: 2) {
                        Text(feedLabel(context: context))
                            .font(.headline)
                            .foregroundColor(.white)
                        Text(timerInterval: context.attributes.startedAt...Date.distantFuture,
                             countsDown: false)
                            .font(.system(.title2, design: .monospaced))
                            .foregroundColor(.white)
                    }
                }
                DynamicIslandExpandedRegion(.trailing) {
                    if context.state.isPaused {
                        Image(systemName: "pause.circle.fill")
                            .font(.title2)
                            .foregroundColor(.yellow)
                    }
                }
            } compactLeading: {
                // Compact : icone à gauche
                Text(context.attributes.feedType == "allaitement" ? "🤱" : "🍼")
                    .font(.caption)
            } compactTrailing: {
                // Compact : timer à droite
                if context.state.isPaused {
                    Image(systemName: "pause.fill")
                        .font(.caption2)
                        .foregroundColor(.yellow)
                } else {
                    Text(timerInterval: context.attributes.startedAt...Date.distantFuture,
                         countsDown: false)
                        .font(.system(.caption, design: .monospaced))
                        .monospacedDigit()
                }
            } minimal: {
                // Minimal (si autre Live Activity active)
                Text(context.attributes.feedType == "allaitement" ? "🤱" : "🍼")
                    .font(.caption2)
            }
            .widgetURL(URL(string: "family-vault://open/night-mode"))
        }
    }

    private func feedLabel(context: ActivityViewContext<FeedingActivityAttributes>) -> String {
        let baby = context.attributes.babyName
        if context.attributes.feedType == "allaitement" {
            let side = context.state.side ?? ""
            return "\(baby) · Tétée \(side)"
        } else {
            let vol = context.state.volumeMl.map { "\($0) ml" } ?? ""
            return "\(baby) · Biberon \(vol)"
        }
    }
}

// MARK: - Lock Screen View

@available(iOS 16.2, *)
struct FeedingLockScreenView: View {
    let context: ActivityViewContext<FeedingActivityAttributes>

    var body: some View {
        HStack(spacing: 16) {
            // Emoji
            Text(context.attributes.feedType == "allaitement" ? "🤱" : "🍼")
                .font(.system(size: 36))

            // Info
            VStack(alignment: .leading, spacing: 4) {
                Text(lockScreenLabel)
                    .font(.headline)
                    .foregroundColor(.white)

                if context.state.isPaused {
                    HStack(spacing: 4) {
                        Image(systemName: "pause.fill")
                            .font(.caption)
                            .foregroundColor(.yellow)
                        Text("En pause")
                            .font(.subheadline)
                            .foregroundColor(.yellow)
                    }
                } else {
                    Text(timerInterval: context.attributes.startedAt...Date.distantFuture,
                         countsDown: false)
                        .font(.system(.title3, design: .monospaced))
                        .foregroundColor(.white)
                }
            }

            Spacer()
        }
        .padding(16)
        .background(Color.black.opacity(0.85))
        .activityBackgroundTint(Color.black.opacity(0.85))
    }

    private var lockScreenLabel: String {
        let baby = context.attributes.babyName
        if context.attributes.feedType == "allaitement" {
            let side = context.state.side == "G" ? "gauche" : context.state.side == "D" ? "droit" : ""
            return "Tétée \(baby) — côté \(side)"
        } else {
            let vol = context.state.volumeMl.map { "\($0) ml" } ?? ""
            return "Biberon \(baby) — \(vol)"
        }
    }
}
