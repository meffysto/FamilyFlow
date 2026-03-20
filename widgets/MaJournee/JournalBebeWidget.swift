import WidgetKit
import SwiftUI
import AppIntents
import ActivityKit

// MARK: - Data Model

struct ActiveFeeding: Codable {
    var side: String          // "gauche" ou "droite"
    var startTimestamp: String // ISO8601 — début du segment en cours
    let child: String
    var pausedAt: String?     // ISO8601 — moment de la pause (nil = en cours)
    var accumulatedSeconds: Int // secondes accumulées avant la dernière pause

    init(side: String, startTimestamp: String, child: String, pausedAt: String? = nil, accumulatedSeconds: Int = 0) {
        self.side = side
        self.startTimestamp = startTimestamp
        self.child = child
        self.pausedAt = pausedAt
        self.accumulatedSeconds = accumulatedSeconds
    }

    var isPaused: Bool { pausedAt != nil }
}

struct JournalFeedingEntry: Codable {
    let type: String       // "biberon" ou "tétée"
    let child: String
    let timestamp: String  // ISO8601
    var side: String?      // "gauche" ou "droite" (tétée uniquement)
    var durationSeconds: Int? // durée en secondes (tétée uniquement)
    var volumeMl: Int?     // volume en ml (biberon uniquement)
}

struct JournalData: Codable {
    var childName: String
    var feedings: [JournalFeedingEntry]
    var activeFeeding: ActiveFeeding?
    var lastSide: String?  // "gauche" ou "droite"

    init(childName: String = "", feedings: [JournalFeedingEntry] = [], activeFeeding: ActiveFeeding? = nil, lastSide: String? = nil) {
        self.childName = childName
        self.feedings = feedings
        self.activeFeeding = activeFeeding
        self.lastSide = lastSide
    }
}

// MARK: - Data Store

final class JournalWidgetStore {
    static let shared = JournalWidgetStore()

    private let fileName = "journal-bebe-widget.json"

    private var containerURL: URL? {
        FileManager.default.containerURL(
            forSecurityApplicationGroupIdentifier: "group.com.familyvault.dev"
        )
    }

    private var fileURL: URL? {
        containerURL?.appendingPathComponent(fileName)
    }

    func load() -> JournalData {
        guard let url = fileURL,
              let data = try? Data(contentsOf: url),
              let journal = try? JSONDecoder().decode(JournalData.self, from: data) else {
            return JournalData()
        }
        return journal
    }

    func save(_ journal: JournalData) {
        guard let url = fileURL else { return }
        let encoder = JSONEncoder()
        encoder.outputFormatting = .prettyPrinted
        guard let data = try? encoder.encode(journal) else { return }
        try? data.write(to: url)
    }

    func logFeeding(type: String, child: String, at date: Date = Date(), side: String? = nil, durationSeconds: Int? = nil, volumeMl: Int? = nil) {
        var journal = load()

        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime]
        let entry = JournalFeedingEntry(
            type: type,
            child: child,
            timestamp: formatter.string(from: date),
            side: side,
            durationSeconds: durationSeconds,
            volumeMl: volumeMl
        )

        journal.feedings.append(entry)

        // Garder les 50 dernières entrées
        if journal.feedings.count > 50 {
            journal.feedings = Array(journal.feedings.suffix(50))
        }

        save(journal)
    }

    // MARK: - Feeding Timer

    func startFeeding(side: String, child: String) {
        var journal = load()

        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime]

        journal.activeFeeding = ActiveFeeding(
            side: side,
            startTimestamp: formatter.string(from: Date()),
            child: child
        )

        save(journal)
    }

    func pauseFeeding() {
        var journal = load()
        guard var active = journal.activeFeeding, !active.isPaused else { return }

        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime]

        // Accumuler le temps écoulé depuis le dernier resume/start
        if let startDate = formatter.date(from: active.startTimestamp) {
            active.accumulatedSeconds += Int(Date().timeIntervalSince(startDate))
        }
        active.pausedAt = formatter.string(from: Date())
        journal.activeFeeding = active
        save(journal)
    }

    func resumeFeeding(side: String? = nil) {
        var journal = load()
        guard var active = journal.activeFeeding, active.isPaused else { return }

        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime]

        // Nouveau startTimestamp = maintenant (accumulatedSeconds garde le temps passé)
        active.startTimestamp = formatter.string(from: Date())
        active.pausedAt = nil
        if let newSide = side {
            active.side = newSide
        }
        journal.activeFeeding = active
        save(journal)
    }

    func stopFeeding() {
        var journal = load()
        guard let active = journal.activeFeeding else { return }

        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime]

        // Calculer la durée totale
        var durationSeconds = active.accumulatedSeconds
        if !active.isPaused, let startDate = formatter.date(from: active.startTimestamp) {
            durationSeconds += Int(Date().timeIntervalSince(startDate))
        }

        // Créer l'entrée avec le timestamp original
        let entry = JournalFeedingEntry(
            type: "tétée",
            child: active.child,
            timestamp: journal.feedings.isEmpty ? active.startTimestamp : formatter.string(from: Date()),
            side: active.side,
            durationSeconds: durationSeconds
        )

        journal.feedings.append(entry)

        if journal.feedings.count > 50 {
            journal.feedings = Array(journal.feedings.suffix(50))
        }

        journal.lastSide = active.side
        journal.activeFeeding = nil

        save(journal)
    }

    var isFeeding: Bool {
        load().activeFeeding != nil
    }

    var isFeedingPaused: Bool {
        load().activeFeeding?.isPaused ?? false
    }

    /// Durée formatée "X min" depuis le début de la tétée en cours
    var activeFeedingDuration: String? {
        guard let active = load().activeFeeding else { return nil }

        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime]
        guard let startDate = formatter.date(from: active.startTimestamp) else { return nil }

        let interval = Date().timeIntervalSince(startDate)
        let minutes = Int(interval / 60)

        if minutes < 1 { return "< 1 min" }
        return "\(minutes) min"
    }

    /// Label relatif du dernier repas
    var lastFeedingLabel: String {
        let journal = load()
        guard let last = journal.feedings.last else {
            return "Aucun repas"
        }

        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime]
        guard let feedingDate = formatter.date(from: last.timestamp) else {
            return "Aucun repas"
        }

        let interval = Date().timeIntervalSince(feedingDate)
        let minutes = Int(interval / 60)

        if minutes < 2 { return "À l'instant" }
        if minutes < 60 { return "Il y a \(minutes) min" }

        let hours = minutes / 60
        let remainingMin = minutes % 60

        if remainingMin == 0 {
            return "Il y a \(hours)h"
        }
        return "Il y a \(hours)h\(String(format: "%02d", remainingMin))"
    }

    /// Type du dernier repas
    var lastFeedingType: String? {
        load().feedings.last?.type
    }

    /// Dernier sein utilisé
    var lastSide: String? {
        load().lastSide
    }

    /// Stats du jour
    var todayStats: (biberons: Int, tetees: Int) {
        let journal = load()
        let calendar = Calendar.current
        let today = calendar.startOfDay(for: Date())

        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime]

        var biberons = 0
        var tetees = 0

        for feeding in journal.feedings {
            guard let date = formatter.date(from: feeding.timestamp),
                  calendar.isDate(date, inSameDayAs: today) else { continue }

            if feeding.type == "biberon" {
                biberons += 1
            } else if feeding.type == "tétée" {
                tetees += 1
            }
        }

        return (biberons, tetees)
    }
}

// MARK: - App Intents

@available(iOS 17.0, *)
struct LogFeedingIntent: AppIntent {
    static var title: LocalizedStringResource = "Enregistrer un repas"
    static var description: IntentDescription = "Enregistre un biberon ou une tétée dans le journal bébé"

    @Parameter(title: "Type de repas")
    var feedingType: String

    @Parameter(title: "Prénom de l'enfant")
    var childName: String

    init() {}

    init(feedingType: String, childName: String) {
        self.feedingType = feedingType
        self.childName = childName
    }

    func perform() async throws -> some IntentResult {
        JournalWidgetStore.shared.logFeeding(type: feedingType, child: childName)
        WidgetCenter.shared.reloadTimelines(ofKind: "JournalBebeWidget")
        return .result()
    }
}

@available(iOS 17.0, *)
struct StartFeedingIntent: AppIntent {
    static var title: LocalizedStringResource = "Démarrer une tétée"
    static var description: IntentDescription = "Démarre le chronomètre de tétée avec le côté choisi"

    @Parameter(title: "Côté")
    var side: String

    @Parameter(title: "Prénom de l'enfant")
    var childName: String

    init() {}

    init(side: String, childName: String) {
        self.side = side
        self.childName = childName
    }

    func perform() async throws -> some IntentResult {
        JournalWidgetStore.shared.startFeeding(side: side, child: childName)
        WidgetCenter.shared.reloadTimelines(ofKind: "JournalBebeWidget")
        return .result()
    }
}

@available(iOS 17.0, *)
struct PauseFeedingIntent: AppIntent {
    static var title: LocalizedStringResource = "Mettre en pause la tétée"
    static var description: IntentDescription = "Met en pause le chronomètre de tétée"

    init() {}

    func perform() async throws -> some IntentResult {
        JournalWidgetStore.shared.pauseFeeding()
        WidgetCenter.shared.reloadTimelines(ofKind: "JournalBebeWidget")
        return .result()
    }
}

@available(iOS 17.0, *)
struct ResumeFeedingIntent: AppIntent {
    static var title: LocalizedStringResource = "Reprendre la tétée"
    static var description: IntentDescription = "Reprend le chronomètre de tétée"

    @Parameter(title: "Côté")
    var side: String

    init() {}

    init(side: String) {
        self.side = side
    }

    func perform() async throws -> some IntentResult {
        JournalWidgetStore.shared.resumeFeeding(side: side)
        WidgetCenter.shared.reloadTimelines(ofKind: "JournalBebeWidget")
        return .result()
    }
}

@available(iOS 17.0, *)
struct StopFeedingIntent: AppIntent {
    static var title: LocalizedStringResource = "Arrêter la tétée"
    static var description: IntentDescription = "Arrête le chronomètre et enregistre la tétée"

    init() {}

    func perform() async throws -> some IntentResult {
        JournalWidgetStore.shared.stopFeeding()
        WidgetCenter.shared.reloadTimelines(ofKind: "JournalBebeWidget")
        return .result()
    }
}

// MARK: - Timeline

struct JournalBebeEntry: TimelineEntry {
    let date: Date
    let data: JournalData
    let lastFeedingLabel: String
    let lastFeedingType: String?
    let todayBiberons: Int
    let todayTetees: Int
    let isFeeding: Bool
    let activeFeedingSide: String?
    let activeFeedingStart: Date?  // nil si en pause
    let isFeedingPaused: Bool
    let accumulatedSeconds: Int    // temps accumulé avant la pause
    let lastSide: String?
}

struct JournalBebeProvider: TimelineProvider {
    func placeholder(in context: Context) -> JournalBebeEntry {
        JournalBebeEntry(
            date: Date(),
            data: JournalData(childName: "Lucas"),
            lastFeedingLabel: "Il y a 2h30",
            lastFeedingType: "biberon",
            todayBiberons: 3,
            todayTetees: 2,
            isFeeding: false,
            activeFeedingSide: nil,
            activeFeedingStart: nil,
            isFeedingPaused: false,
            accumulatedSeconds: 0,
            lastSide: "gauche"
        )
    }

    func getSnapshot(in context: Context, completion: @escaping (JournalBebeEntry) -> Void) {
        completion(makeEntry())
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<JournalBebeEntry>) -> Void) {
        let entry = makeEntry()

        // Refresh toutes les minutes si tétée en cours, sinon toutes les 15 min
        let refreshMinutes = entry.isFeeding ? 1 : 15
        let nextRefresh = Calendar.current.date(byAdding: .minute, value: refreshMinutes, to: Date())!
        completion(Timeline(entries: [entry], policy: .after(nextRefresh)))
    }

    private func makeEntry() -> JournalBebeEntry {
        let store = JournalWidgetStore.shared
        let data = store.load()
        let stats = store.todayStats
        let feeding = store.isFeeding

        return JournalBebeEntry(
            date: Date(),
            data: data,
            lastFeedingLabel: store.lastFeedingLabel,
            lastFeedingType: store.lastFeedingType,
            todayBiberons: stats.biberons,
            todayTetees: stats.tetees,
            isFeeding: feeding,
            activeFeedingSide: data.activeFeeding?.side,
            activeFeedingStart: {
                guard let active = data.activeFeeding, !active.isPaused else { return nil }
                let fmt = ISO8601DateFormatter()
                fmt.formatOptions = [.withInternetDateTime]
                return fmt.date(from: active.startTimestamp)
            }(),
            isFeedingPaused: data.activeFeeding?.isPaused ?? false,
            accumulatedSeconds: data.activeFeeding?.accumulatedSeconds ?? 0,
            lastSide: store.lastSide
        )
    }
}

// MARK: - Small View

struct JournalBebeSmallView: View {
    let entry: JournalBebeEntry

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack(spacing: 4) {
                Text("👶")
                    .font(.caption)
                Text("Journal bébé")
                    .font(.caption2)
                    .fontWeight(.semibold)
                    .foregroundStyle(.secondary)
                    .textCase(.uppercase)
            }

            Spacer()

            if entry.isFeeding {
                // État tétée en cours
                VStack(alignment: .leading, spacing: 2) {
                    Text(entry.isFeedingPaused ? "⏸ Tétée en pause" : "🤱 Tétée en cours")
                        .font(.caption2)
                        .foregroundStyle(.pink)
                    if let side = entry.activeFeedingSide {
                        Text(side.capitalized)
                            .font(.caption)
                            .fontWeight(.medium)
                    }
                    if let start = entry.activeFeedingStart {
                        // Timer temps réel (en cours)
                        Text(timerInterval: start.addingTimeInterval(-Double(entry.accumulatedSeconds))...Date.distantFuture, countsDown: false)
                            .font(.title3)
                            .fontWeight(.bold)
                            .foregroundStyle(.pink)
                            .monospacedDigit()
                    } else if entry.isFeedingPaused {
                        // En pause — afficher le temps accumulé figé
                        let mins = entry.accumulatedSeconds / 60
                        let secs = entry.accumulatedSeconds % 60
                        Text("\(mins):\(String(format: "%02d", secs))")
                            .font(.title3)
                            .fontWeight(.bold)
                            .foregroundStyle(.orange)
                            .monospacedDigit()
                    }
                }

                Spacer()

                if #available(iOS 17.0, *) {
                    HStack(spacing: 6) {
                        if entry.isFeedingPaused {
                            Button(intent: ResumeFeedingIntent(side: entry.activeFeedingSide ?? "gauche")) {
                                Image(systemName: "play.circle.fill")
                                    .font(.caption)
                                    .foregroundStyle(.white)
                                    .padding(6)
                                    .background(.green, in: Circle())
                            }
                            .buttonStyle(.plain)
                        } else {
                            Button(intent: PauseFeedingIntent()) {
                                Image(systemName: "pause.circle.fill")
                                    .font(.caption)
                                    .foregroundStyle(.white)
                                    .padding(6)
                                    .background(.orange, in: Circle())
                            }
                            .buttonStyle(.plain)
                        }

                        Button(intent: StopFeedingIntent()) {
                            Image(systemName: "stop.circle.fill")
                                .font(.caption)
                                .foregroundStyle(.white)
                                .padding(6)
                                .background(.red, in: Circle())
                        }
                        .buttonStyle(.plain)

                        // Ouvrir l'app → lance le Live Activity
                        Link(destination: URL(string: "family-vault://open/night-mode?startLive=1")!) {
                            Image(systemName: "lock.display")
                                .font(.caption)
                                .foregroundStyle(.white)
                                .padding(6)
                                .background(.purple, in: Circle())
                        }
                    }
                }
            } else {
                // État normal
                VStack(alignment: .leading, spacing: 2) {
                    Text("Dernier repas")
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                    Text(entry.lastFeedingLabel)
                        .font(.subheadline)
                        .fontWeight(.semibold)
                        .foregroundStyle(entry.lastFeedingType != nil ? .primary : .tertiary)
                }

                Spacer()

                if #available(iOS 17.0, *) {
                    let childName = entry.data.childName.isEmpty ? "Bébé" : entry.data.childName
                    // Smart default : côté opposé au dernier
                    let nextSide = (entry.lastSide == "gauche") ? "droite" : "gauche"
                    let sideEmoji = nextSide == "gauche" ? "⬅️" : "➡️"

                    VStack(spacing: 4) {
                        Button(intent: StartFeedingIntent(side: nextSide, childName: childName)) {
                            HStack(spacing: 4) {
                                Text(sideEmoji)
                                    .font(.caption2)
                                Text("Tétée")
                                    .font(.caption)
                                    .fontWeight(.medium)
                            }
                            .foregroundStyle(.white)
                            .padding(.horizontal, 10)
                            .padding(.vertical, 5)
                            .background(.pink, in: Capsule())
                        }
                        .buttonStyle(.plain)

                        Link(destination: URL(string: "family-vault://open/journal?enfant=\(childName.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? childName)")!) {
                            HStack(spacing: 4) {
                                Text("🍼")
                                    .font(.caption2)
                                Text("Biberon")
                                    .font(.caption)
                                    .fontWeight(.medium)
                            }
                            .foregroundStyle(.white)
                            .padding(.horizontal, 10)
                            .padding(.vertical, 5)
                            .background(.blue, in: Capsule())
                        }
                    }
                }
            }
        }
        .padding()
    }
}

// MARK: - Medium View

struct JournalBebeMediumView: View {
    let entry: JournalBebeEntry

    var body: some View {
        HStack(spacing: 12) {
            // Gauche : infos
            VStack(alignment: .leading, spacing: 6) {
                HStack(spacing: 4) {
                    Text("👶")
                        .font(.caption)
                    Text("Journal bébé")
                        .font(.caption2)
                        .fontWeight(.semibold)
                        .foregroundStyle(.secondary)
                        .textCase(.uppercase)
                }

                VStack(alignment: .leading, spacing: 2) {
                    Text("Dernier repas")
                        .font(.caption2)
                        .foregroundStyle(.secondary)

                    HStack(spacing: 4) {
                        if let type = entry.lastFeedingType {
                            Text(type == "biberon" ? "🍼" : "🤱")
                                .font(.caption)
                        }
                        Text(entry.lastFeedingLabel)
                            .font(.subheadline)
                            .fontWeight(.semibold)
                            .foregroundStyle(entry.lastFeedingType != nil ? .primary : .tertiary)
                    }
                }

                Spacer()

                // Stats du jour
                HStack(spacing: 8) {
                    Label("\(entry.todayBiberons)", systemImage: "drop.fill")
                        .font(.caption2)
                        .foregroundStyle(.blue)
                    Label("\(entry.todayTetees)", systemImage: "heart.fill")
                        .font(.caption2)
                        .foregroundStyle(.pink)
                }
            }

            Divider()

            // Droite : boutons d'action ou timer
            if #available(iOS 17.0, *) {
                let childName = entry.data.childName.isEmpty ? "Bébé" : entry.data.childName

                if entry.isFeeding {
                    // État tétée en cours
                    VStack(spacing: 6) {
                        Text(entry.isFeedingPaused ? "⏸ En pause" : "🤱 Tétée en cours")
                            .font(.caption)
                            .fontWeight(.medium)
                            .foregroundStyle(.pink)

                        if let side = entry.activeFeedingSide {
                            Text(side.capitalized)
                                .font(.caption2)
                                .foregroundStyle(.secondary)
                        }

                        if let start = entry.activeFeedingStart {
                            Text(timerInterval: start.addingTimeInterval(-Double(entry.accumulatedSeconds))...Date.distantFuture, countsDown: false)
                                .font(.title2)
                                .fontWeight(.bold)
                                .foregroundStyle(.pink)
                                .monospacedDigit()
                        } else if entry.isFeedingPaused {
                            let mins = entry.accumulatedSeconds / 60
                            let secs = entry.accumulatedSeconds % 60
                            Text("\(mins):\(String(format: "%02d", secs))")
                                .font(.title2)
                                .fontWeight(.bold)
                                .foregroundStyle(.orange)
                                .monospacedDigit()
                        }

                        // Boutons pause/reprendre + arrêter
                        HStack(spacing: 8) {
                            if entry.isFeedingPaused {
                                Button(intent: ResumeFeedingIntent(side: entry.activeFeedingSide ?? "gauche")) {
                                    HStack(spacing: 4) {
                                        Image(systemName: "play.fill")
                                            .font(.caption)
                                        Text("Reprendre")
                                            .font(.caption)
                                            .fontWeight(.medium)
                                    }
                                    .frame(maxWidth: .infinity)
                                    .padding(.vertical, 8)
                                    .background(.green.opacity(0.15), in: RoundedRectangle(cornerRadius: 8))
                                    .foregroundStyle(.green)
                                }
                                .buttonStyle(.plain)
                            } else {
                                Button(intent: PauseFeedingIntent()) {
                                    HStack(spacing: 4) {
                                        Image(systemName: "pause.fill")
                                            .font(.caption)
                                        Text("Pause")
                                            .font(.caption)
                                            .fontWeight(.medium)
                                    }
                                    .frame(maxWidth: .infinity)
                                    .padding(.vertical, 8)
                                    .background(.orange.opacity(0.15), in: RoundedRectangle(cornerRadius: 8))
                                    .foregroundStyle(.orange)
                                }
                                .buttonStyle(.plain)
                            }
                        }

                        HStack(spacing: 6) {
                            Button(intent: StopFeedingIntent()) {
                                HStack(spacing: 4) {
                                    Image(systemName: "stop.circle.fill")
                                        .font(.caption)
                                    Text("Arrêter")
                                        .font(.caption)
                                        .fontWeight(.medium)
                                }
                                .frame(maxWidth: .infinity)
                                .padding(.vertical, 8)
                                .background(.red.opacity(0.15), in: RoundedRectangle(cornerRadius: 10))
                                .foregroundStyle(.red)
                            }
                            .buttonStyle(.plain)

                            // Ouvrir l'app → lance le Live Activity sur écran verrouillé
                            Link(destination: URL(string: "family-vault://open/night-mode?startLive=1")!) {
                                HStack(spacing: 4) {
                                    Image(systemName: "lock.display")
                                        .font(.caption)
                                    Text("Écran")
                                        .font(.caption)
                                        .fontWeight(.medium)
                                }
                                .frame(maxWidth: .infinity)
                                .padding(.vertical, 8)
                                .background(.purple.opacity(0.15), in: RoundedRectangle(cornerRadius: 10))
                                .foregroundStyle(.purple)
                            }
                        }
                    }
                    .frame(maxWidth: .infinity)
                } else {
                    // État normal
                    VStack(spacing: 6) {
                        // Indication du dernier sein
                        if let side = entry.lastSide {
                            Text("Dernier : \(side.capitalized) 🤱")
                                .font(.caption2)
                                .foregroundStyle(.secondary)
                        }

                        // Boutons tétée côte à côte
                        HStack(spacing: 6) {
                            Button(intent: StartFeedingIntent(side: "gauche", childName: childName)) {
                                HStack(spacing: 2) {
                                    Text("⬅️")
                                        .font(.caption2)
                                    Text("Gauche")
                                        .font(.caption)
                                        .fontWeight(.medium)
                                }
                                .frame(maxWidth: .infinity)
                                .padding(.vertical, 8)
                                .background(.pink.opacity(0.15), in: RoundedRectangle(cornerRadius: 8))
                                .foregroundStyle(.pink)
                            }
                            .buttonStyle(.plain)

                            Button(intent: StartFeedingIntent(side: "droite", childName: childName)) {
                                HStack(spacing: 2) {
                                    Text("Droite")
                                        .font(.caption)
                                        .fontWeight(.medium)
                                    Text("➡️")
                                        .font(.caption2)
                                }
                                .frame(maxWidth: .infinity)
                                .padding(.vertical, 8)
                                .background(.pink.opacity(0.15), in: RoundedRectangle(cornerRadius: 8))
                                .foregroundStyle(.pink)
                            }
                            .buttonStyle(.plain)
                        }

                        // Bouton biberon = deep link
                        Link(destination: URL(string: "family-vault://open/journal?enfant=\(childName.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? childName)")!) {
                            HStack(spacing: 6) {
                                Text("🍼")
                                    .font(.body)
                                Text("Biberon")
                                    .font(.subheadline)
                                    .fontWeight(.medium)
                            }
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 8)
                            .background(.blue.opacity(0.15), in: RoundedRectangle(cornerRadius: 10))
                            .foregroundStyle(.blue)
                        }
                    }
                    .frame(maxWidth: .infinity)
                }
            } else {
                VStack {
                    Spacer()
                    Text("iOS 17+ requis")
                        .font(.caption2)
                        .foregroundStyle(.tertiary)
                    Spacer()
                }
            }
        }
        .padding()
    }
}

// MARK: - Entry View

struct JournalBebeEntryView: View {
    @Environment(\.widgetFamily) var family
    let entry: JournalBebeEntry

    var body: some View {
        switch family {
        case .systemSmall:
            JournalBebeSmallView(entry: entry)
        case .systemMedium:
            JournalBebeMediumView(entry: entry)
        default:
            JournalBebeSmallView(entry: entry)
        }
    }
}

// MARK: - Widget

struct JournalBebeWidget: Widget {
    let kind = "JournalBebeWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: JournalBebeProvider()) { entry in
            if #available(iOS 17.0, *) {
                JournalBebeEntryView(entry: entry)
                    .containerBackground(.fill.tertiary, for: .widget)
            } else {
                JournalBebeEntryView(entry: entry)
            }
        }
        .configurationDisplayName("Journal bébé")
        .description("Dernier repas et enregistrement rapide")
        .supportedFamilies([.systemSmall, .systemMedium])
    }
}
