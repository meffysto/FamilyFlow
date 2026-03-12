import WidgetKit
import SwiftUI

// MARK: - Data Model

struct WidgetData: Codable {
    let date: String
    let dayOfWeek: String
    let meals: MealsData?
    let tasksProgress: TasksProgress?
    let nextTask: String?
    let nextRDV: NextRDV?

    struct MealsData: Codable {
        let dejeuner: String?
        let diner: String?
    }

    struct TasksProgress: Codable {
        let done: Int
        let total: Int
    }

    struct NextRDV: Codable {
        let title: String
        let date: String
        let heure: String
        let lieu: String?
    }

    static func load() -> WidgetData? {
        guard let url = FileManager.default.containerURL(
            forSecurityApplicationGroupIdentifier: "group.com.familyvault.dev"
        )?.appendingPathComponent("widget-data.json"),
              let data = try? Data(contentsOf: url) else {
            return nil
        }
        return try? JSONDecoder().decode(WidgetData.self, from: data)
    }

    static let placeholder = WidgetData(
        date: "2026-03-12",
        dayOfWeek: "Mercredi",
        meals: MealsData(dejeuner: "Pates carbonara", diner: "Salade composee"),
        tasksProgress: TasksProgress(done: 2, total: 5),
        nextTask: "Nettoyer la cuisine",
        nextRDV: NextRDV(title: "Pediatre", date: "14/03", heure: "10h30", lieu: "Cabinet medical")
    )
}

// MARK: - Timeline

struct MaJourneeEntry: TimelineEntry {
    let date: Date
    let data: WidgetData
}

struct MaJourneeProvider: TimelineProvider {
    func placeholder(in context: Context) -> MaJourneeEntry {
        MaJourneeEntry(date: Date(), data: .placeholder)
    }

    func getSnapshot(in context: Context, completion: @escaping (MaJourneeEntry) -> Void) {
        let data = WidgetData.load() ?? .placeholder
        completion(MaJourneeEntry(date: Date(), data: data))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<MaJourneeEntry>) -> Void) {
        let data = WidgetData.load() ?? .placeholder
        let entry = MaJourneeEntry(date: Date(), data: data)

        // Refresh au prochain minuit ou dans 30 min
        let calendar = Calendar.current
        let tomorrow = calendar.startOfDay(for: calendar.date(byAdding: .day, value: 1, to: Date())!)
        let thirtyMin = calendar.date(byAdding: .minute, value: 30, to: Date())!
        let nextRefresh = min(tomorrow, thirtyMin)

        completion(Timeline(entries: [entry], policy: .after(nextRefresh)))
    }
}

// MARK: - Small View

struct MaJourneeSmallView: View {
    let data: WidgetData

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(data.dayOfWeek)
                .font(.caption2)
                .fontWeight(.semibold)
                .foregroundStyle(.secondary)
                .textCase(.uppercase)

            VStack(alignment: .leading, spacing: 4) {
                mealRow(icon: "sun.max.fill", text: data.meals?.dejeuner)
                mealRow(icon: "moon.fill", text: data.meals?.diner)
            }

            Spacer()

            if let progress = data.tasksProgress, progress.total > 0 {
                HStack(spacing: 4) {
                    Image(systemName: "checkmark.circle.fill")
                        .font(.caption2)
                        .foregroundStyle(.green)
                    Text("\(progress.done)/\(progress.total) taches")
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                }
            }
        }
        .padding()
    }

    @ViewBuilder
    func mealRow(icon: String, text: String?) -> some View {
        HStack(spacing: 4) {
            Image(systemName: icon)
                .font(.caption2)
                .foregroundStyle(.orange)
                .frame(width: 14)
            Text(text?.isEmpty == false ? text! : "\u{2014}")
                .font(.caption)
                .fontWeight(.medium)
                .lineLimit(1)
        }
    }
}

// MARK: - Medium View

struct MaJourneeMediumView: View {
    let data: WidgetData

    var body: some View {
        HStack(spacing: 12) {
            // Gauche : Repas
            VStack(alignment: .leading, spacing: 6) {
                Text(data.dayOfWeek)
                    .font(.caption2)
                    .fontWeight(.semibold)
                    .foregroundStyle(.secondary)
                    .textCase(.uppercase)

                VStack(alignment: .leading, spacing: 4) {
                    mealRow(icon: "sun.max.fill", label: "Midi", text: data.meals?.dejeuner)
                    mealRow(icon: "moon.fill", label: "Soir", text: data.meals?.diner)
                }

                Spacer()

                if let progress = data.tasksProgress, progress.total > 0 {
                    HStack(spacing: 4) {
                        Image(systemName: "checkmark.circle.fill")
                            .font(.caption2)
                            .foregroundStyle(.green)
                        Text("\(progress.done)/\(progress.total) taches")
                            .font(.caption2)
                            .foregroundStyle(.secondary)
                    }
                }
            }

            Divider()

            // Droite : Tache + RDV
            VStack(alignment: .leading, spacing: 8) {
                if let task = data.nextTask, !task.isEmpty {
                    VStack(alignment: .leading, spacing: 2) {
                        Label("A faire", systemImage: "checklist")
                            .font(.caption2)
                            .foregroundStyle(.orange)
                        Text(task)
                            .font(.caption)
                            .fontWeight(.medium)
                            .lineLimit(2)
                    }
                }

                if let rdv = data.nextRDV {
                    VStack(alignment: .leading, spacing: 2) {
                        Label("\(rdv.date) \u{00B7} \(rdv.heure)", systemImage: "calendar")
                            .font(.caption2)
                            .foregroundStyle(.blue)
                        Text(rdv.title)
                            .font(.caption)
                            .fontWeight(.medium)
                            .lineLimit(1)
                        if let lieu = rdv.lieu, !lieu.isEmpty {
                            Text(lieu)
                                .font(.caption2)
                                .foregroundStyle(.secondary)
                                .lineLimit(1)
                        }
                    }
                }

                Spacer()
            }
        }
        .padding()
    }

    @ViewBuilder
    func mealRow(icon: String, label: String, text: String?) -> some View {
        HStack(spacing: 4) {
            Image(systemName: icon)
                .font(.caption2)
                .foregroundStyle(.orange)
                .frame(width: 14)
            Text(text?.isEmpty == false ? text! : "\u{2014}")
                .font(.caption)
                .fontWeight(.medium)
                .lineLimit(1)
        }
    }
}

// MARK: - Entry View

struct MaJourneeEntryView: View {
    @Environment(\.widgetFamily) var family
    let entry: MaJourneeEntry

    var body: some View {
        switch family {
        case .systemSmall:
            MaJourneeSmallView(data: entry.data)
        case .systemMedium:
            MaJourneeMediumView(data: entry.data)
        default:
            MaJourneeSmallView(data: entry.data)
        }
    }
}

// MARK: - Widget

@main
struct MaJourneeWidget: Widget {
    let kind = "MaJourneeWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: MaJourneeProvider()) { entry in
            if #available(iOS 17.0, *) {
                MaJourneeEntryView(entry: entry)
                    .containerBackground(.fill.tertiary, for: .widget)
            } else {
                MaJourneeEntryView(entry: entry)
            }
        }
        .configurationDisplayName("Ma Journee")
        .description("Repas, taches et RDV du jour")
        .supportedFamilies([.systemSmall, .systemMedium])
    }
}
