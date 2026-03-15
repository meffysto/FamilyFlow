import WidgetKit
import SwiftUI

// MARK: - Data Model

struct WidgetData: Codable {
    let date: String
    let dayOfWeek: String
    let meals: MealsData?
    let tasksProgress: TasksProgress?
    let nextTasks: [String]?
    let nextRDVs: [NextRDV]?

    // Rétro-compatibilité
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

    /// Tâches à afficher (préfère la liste, fallback sur l'ancien champ)
    var pendingTasks: [String] {
        if let tasks = nextTasks, !tasks.isEmpty { return tasks }
        if let task = nextTask, !task.isEmpty { return [task] }
        return []
    }

    /// RDVs à afficher (préfère la liste, fallback sur l'ancien champ)
    var upcomingRDVs: [NextRDV] {
        if let rdvs = nextRDVs, !rdvs.isEmpty { return rdvs }
        if let rdv = nextRDV { return [rdv] }
        return []
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
        meals: MealsData(dejeuner: "Pâtes carbonara", diner: "Salade composée"),
        tasksProgress: TasksProgress(done: 2, total: 5),
        nextTasks: ["Nettoyer la cuisine", "Sortir les poubelles"],
        nextRDVs: [NextRDV(title: "Pédiatre", date: "14/03", heure: "10h30", lieu: "Cabinet médical")],
        nextTask: nil,
        nextRDV: nil
    )
}

// MARK: - Deep Link URLs

private enum DeepLink {
    static let meals = URL(string: "family-vault://open/meals")!
    static let tasks = URL(string: "family-vault://open/tasks")!
    static let rdv = URL(string: "family-vault://open/rdv")!
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
                    Text("\(progress.done)/\(progress.total) tâches")
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                }
            }
        }
        .padding()
        // Small widget : un seul lien pour tout le widget
        .widgetURL(DeepLink.meals)
    }

    @ViewBuilder
    func mealRow(icon: String, text: String?) -> some View {
        HStack(spacing: 4) {
            Image(systemName: icon)
                .font(.caption2)
                .foregroundStyle(.orange)
                .frame(width: 14)
            Text(text?.isEmpty == false ? text! : "Pas encore planifié")
                .font(.caption)
                .fontWeight(.medium)
                .lineLimit(1)
                .foregroundStyle(text?.isEmpty == false ? .primary : .tertiary)
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

                Link(destination: DeepLink.meals) {
                    VStack(alignment: .leading, spacing: 4) {
                        mealRow(icon: "sun.max.fill", label: "Midi", text: data.meals?.dejeuner)
                        mealRow(icon: "moon.fill", label: "Soir", text: data.meals?.diner)
                    }
                }

                Spacer()

                if let progress = data.tasksProgress, progress.total > 0 {
                    Link(destination: DeepLink.tasks) {
                        HStack(spacing: 4) {
                            Image(systemName: "checkmark.circle.fill")
                                .font(.caption2)
                                .foregroundStyle(.green)
                            Text("\(progress.done)/\(progress.total) tâches")
                                .font(.caption2)
                                .foregroundStyle(.secondary)
                        }
                    }
                }
            }

            Divider()

            // Droite : Tâches + RDVs (dynamique)
            VStack(alignment: .leading, spacing: 6) {
                let tasks = data.pendingTasks
                let rdvs = data.upcomingRDVs

                if !tasks.isEmpty {
                    Link(destination: DeepLink.tasks) {
                        VStack(alignment: .leading, spacing: 4) {
                            Label("À faire", systemImage: "checklist")
                                .font(.caption2)
                                .foregroundStyle(.orange)
                            ForEach(tasks.prefix(3), id: \.self) { task in
                                Text("• \(task)")
                                    .font(.caption)
                                    .fontWeight(.medium)
                                    .lineLimit(1)
                            }
                        }
                    }
                }

                if !rdvs.isEmpty {
                    if !tasks.isEmpty {
                        Divider()
                    }
                    Link(destination: DeepLink.rdv) {
                        VStack(alignment: .leading, spacing: 4) {
                            Label("RDV", systemImage: "calendar")
                                .font(.caption2)
                                .foregroundStyle(.blue)
                            ForEach(Array(rdvs.prefix(3).enumerated()), id: \.offset) { _, rdv in
                                VStack(alignment: .leading, spacing: 1) {
                                    Text("\(rdv.date) · \(rdv.heure) — \(rdv.title)")
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
                        }
                    }
                }

                if tasks.isEmpty && rdvs.isEmpty {
                    Spacer()
                    Text("Rien de prévu")
                        .font(.caption)
                        .foregroundStyle(.tertiary)
                    Spacer()
                }

                Spacer(minLength: 0)
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
            Text(text?.isEmpty == false ? text! : "Pas encore planifié")
                .font(.caption)
                .fontWeight(.medium)
                .lineLimit(1)
                .foregroundStyle(text?.isEmpty == false ? .primary : .tertiary)
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
        .configurationDisplayName("Ma Journée")
        .description("Repas, tâches et RDV du jour")
        .supportedFamilies([.systemSmall, .systemMedium])
    }
}
