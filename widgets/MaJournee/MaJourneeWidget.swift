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
    let lang: WidgetLang

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(DayStrings.dayOfWeek(data.dayOfWeek, lang))
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
                    Text("\(progress.done)/\(progress.total) \(MaJourneeStrings.tasks(lang))")
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
            Text(text?.isEmpty == false ? text! : MaJourneeStrings.notPlanned(lang))
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
    let lang: WidgetLang

    var body: some View {
        HStack(spacing: 12) {
            // Gauche : Repas
            VStack(alignment: .leading, spacing: 6) {
                Text(DayStrings.dayOfWeek(data.dayOfWeek, lang))
                    .font(.caption2)
                    .fontWeight(.semibold)
                    .foregroundStyle(.secondary)
                    .textCase(.uppercase)

                Link(destination: DeepLink.meals) {
                    VStack(alignment: .leading, spacing: 4) {
                        mealRow(icon: "sun.max.fill", label: MaJourneeStrings.noon(lang), text: data.meals?.dejeuner)
                        mealRow(icon: "moon.fill", label: MaJourneeStrings.evening(lang), text: data.meals?.diner)
                    }
                }

                Spacer()

                if let progress = data.tasksProgress, progress.total > 0 {
                    Link(destination: DeepLink.tasks) {
                        HStack(spacing: 4) {
                            Image(systemName: "checkmark.circle.fill")
                                .font(.caption2)
                                .foregroundStyle(.green)
                            Text("\(progress.done)/\(progress.total) \(MaJourneeStrings.tasks(lang))")
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
                let allTasksDone = data.tasksProgress.map { $0.done == $0.total && $0.total > 0 } ?? false

                if allTasksDone {
                    // État zen : toutes les tâches sont faites
                    Link(destination: DeepLink.tasks) {
                        HStack(spacing: 6) {
                            Image(systemName: "checkmark.seal.fill")
                                .font(.title3)
                                .foregroundStyle(.green)
                            VStack(alignment: .leading, spacing: 2) {
                                Text(MaJourneeStrings.allDone(lang))
                                    .font(.caption)
                                    .fontWeight(.semibold)
                                Text(MaJourneeStrings.tasksDone(data.tasksProgress!.total, lang))
                                    .font(.caption2)
                                    .foregroundStyle(.secondary)
                            }
                        }
                    }

                    if !rdvs.isEmpty {
                        Divider()
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
                    } else {
                        Spacer()
                        Text(MaJourneeStrings.quietDay(lang))
                            .font(.caption)
                            .foregroundStyle(.secondary)
                        Spacer()
                    }
                } else if !tasks.isEmpty {
                    Link(destination: DeepLink.tasks) {
                        VStack(alignment: .leading, spacing: 4) {
                            Label(MaJourneeStrings.toDo(lang), systemImage: "checklist")
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

                    if !rdvs.isEmpty {
                        Divider()
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
                } else if !rdvs.isEmpty {
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
                } else {
                    Spacer()
                    Text(MaJourneeStrings.nothingPlanned(lang))
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
            Text(text?.isEmpty == false ? text! : MaJourneeStrings.notPlanned(lang))
                .font(.caption)
                .fontWeight(.medium)
                .lineLimit(1)
                .foregroundStyle(text?.isEmpty == false ? .primary : .tertiary)
        }
    }
}

// MARK: - Large View

struct MaJourneeLargeView: View {
    let data: WidgetData
    let lang: WidgetLang

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            // En-tête
            Text(DayStrings.dayOfWeek(data.dayOfWeek, lang))
                .font(.headline)
                .fontWeight(.bold)
                .foregroundStyle(.secondary)
                .textCase(.uppercase)

            // Repas
            Link(destination: DeepLink.meals) {
                VStack(alignment: .leading, spacing: 8) {
                    Label(MaJourneeStrings.noon(lang), systemImage: "sun.max.fill")
                        .font(.caption)
                        .foregroundStyle(.orange)
                    Text(data.meals?.dejeuner ?? MaJourneeStrings.notPlanned(lang))
                        .font(.body)
                        .fontWeight(.medium)
                        .foregroundStyle(data.meals?.dejeuner != nil ? .primary : .tertiary)
                        .lineLimit(2)

                    Label(MaJourneeStrings.evening(lang), systemImage: "moon.fill")
                        .font(.caption)
                        .foregroundStyle(.orange)
                    Text(data.meals?.diner ?? MaJourneeStrings.notPlanned(lang))
                        .font(.body)
                        .fontWeight(.medium)
                        .foregroundStyle(data.meals?.diner != nil ? .primary : .tertiary)
                        .lineLimit(2)
                }
            }

            Divider()

            // Tâches
            let tasks = data.pendingTasks
            let allTasksDone = data.tasksProgress.map { $0.done == $0.total && $0.total > 0 } ?? false

            if let progress = data.tasksProgress, progress.total > 0 {
                Link(destination: DeepLink.tasks) {
                    VStack(alignment: .leading, spacing: 6) {
                        HStack(spacing: 4) {
                            Image(systemName: allTasksDone ? "checkmark.seal.fill" : "checklist")
                                .foregroundStyle(allTasksDone ? .green : .orange)
                            Text(allTasksDone ? MaJourneeStrings.allDone(lang) : MaJourneeStrings.toDo(lang))
                                .font(.caption)
                                .fontWeight(.semibold)
                                .foregroundStyle(allTasksDone ? .green : .orange)
                            Spacer()
                            Text("\(progress.done)/\(progress.total)")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }

                        if !allTasksDone {
                            ForEach(tasks.prefix(5), id: \.self) { task in
                                Text("• \(task)")
                                    .font(.callout)
                                    .fontWeight(.medium)
                                    .lineLimit(1)
                            }
                        }
                    }
                }
            }

            // RDVs
            let rdvs = data.upcomingRDVs
            if !rdvs.isEmpty {
                Divider()

                Link(destination: DeepLink.rdv) {
                    VStack(alignment: .leading, spacing: 6) {
                        Label("RDV", systemImage: "calendar")
                            .font(.caption)
                            .fontWeight(.semibold)
                            .foregroundStyle(.blue)

                        ForEach(Array(rdvs.prefix(4).enumerated()), id: \.offset) { _, rdv in
                            VStack(alignment: .leading, spacing: 2) {
                                Text("\(rdv.date) · \(rdv.heure) — \(rdv.title)")
                                    .font(.callout)
                                    .fontWeight(.medium)
                                    .lineLimit(1)
                                if let lieu = rdv.lieu, !lieu.isEmpty {
                                    Text(lieu)
                                        .font(.caption)
                                        .foregroundStyle(.secondary)
                                        .lineLimit(1)
                                }
                            }
                        }
                    }
                }
            }

            Spacer(minLength: 0)
        }
        .padding()
    }
}

// MARK: - Lock Screen Accessory Views (iOS 16+)

/// Circulaire : jauge tâches du jour (X/Y)
@available(iOS 16.0, *)
struct MaJourneeCircularView: View {
    let data: WidgetData

    var body: some View {
        let progress = data.tasksProgress
        let done = progress?.done ?? 0
        let total = progress?.total ?? 0
        let fraction = total > 0 ? Double(done) / Double(total) : 1.0

        Group {
            if total > 0 {
                Gauge(value: fraction) {
                    Image(systemName: "checklist")
                } currentValueLabel: {
                    Text("\(done)/\(total)")
                        .font(.system(size: 14, weight: .bold))
                }
                .gaugeStyle(.accessoryCircular)
            } else {
                Gauge(value: 1) {
                    Image(systemName: "checkmark.seal.fill")
                } currentValueLabel: {
                    Image(systemName: "checkmark")
                        .font(.system(size: 14, weight: .bold))
                }
                .gaugeStyle(.accessoryCircular)
                .tint(.green)
            }
        }
        .widgetURL(DeepLink.tasks)
    }
}

/// Rectangulaire : prochain RDV (date/heure + titre + lieu)
@available(iOS 16.0, *)
struct MaJourneeRectangularView: View {
    let data: WidgetData
    let lang: WidgetLang

    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            if let rdv = data.upcomingRDVs.first {
                HStack(spacing: 4) {
                    Image(systemName: "calendar")
                        .font(.caption2)
                    Text("\(rdv.date) · \(rdv.heure)")
                        .font(.caption2)
                        .fontWeight(.semibold)
                }
                Text(rdv.title)
                    .font(.caption)
                    .fontWeight(.bold)
                    .lineLimit(1)
                if let lieu = rdv.lieu, !lieu.isEmpty {
                    Text(lieu)
                        .font(.caption2)
                        .lineLimit(1)
                        .foregroundStyle(.secondary)
                }
            } else {
                HStack(spacing: 4) {
                    Image(systemName: "calendar")
                        .font(.caption2)
                    Text(MaJourneeStrings.noRDV(lang))
                        .font(.caption2)
                        .lineLimit(2)
                }
            }
        }
        .widgetURL(DeepLink.rdv)
    }
}

/// Inline : repas pertinent selon l'heure (midi avant 14h, soir après)
@available(iOS 16.0, *)
struct MaJourneeInlineView: View {
    let data: WidgetData
    let lang: WidgetLang

    private var showLunch: Bool {
        Calendar.current.component(.hour, from: Date()) < 14
    }

    var body: some View {
        let meal = showLunch ? (data.meals?.dejeuner ?? "") : (data.meals?.diner ?? "")
        let fallback = showLunch ? MaJourneeStrings.noLunch(lang) : MaJourneeStrings.noDinner(lang)
        let text = meal.isEmpty ? fallback : meal
        let icon = showLunch ? "sun.max.fill" : "moon.fill"
        Label {
            Text(text).lineLimit(1)
        } icon: {
            Image(systemName: icon)
        }
        .widgetURL(DeepLink.meals)
    }
}

// MARK: - Entry View

struct MaJourneeEntryView: View {
    @Environment(\.widgetFamily) var family
    let entry: MaJourneeEntry
    let lang = WidgetLang.fromAppGroup()

    var body: some View {
        switch family {
        case .systemSmall:
            MaJourneeSmallView(data: entry.data, lang: lang)
        case .systemMedium:
            MaJourneeMediumView(data: entry.data, lang: lang)
        case .systemLarge:
            MaJourneeLargeView(data: entry.data, lang: lang)
        default:
            if #available(iOS 16.0, *) {
                switch family {
                case .accessoryCircular:
                    MaJourneeCircularView(data: entry.data)
                case .accessoryRectangular:
                    MaJourneeRectangularView(data: entry.data, lang: lang)
                case .accessoryInline:
                    MaJourneeInlineView(data: entry.data, lang: lang)
                default:
                    MaJourneeMediumView(data: entry.data, lang: lang)
                }
            } else {
                MaJourneeMediumView(data: entry.data, lang: lang)
            }
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
        .supportedFamilies(MaJourneeWidget.families)
    }

    static var families: [WidgetFamily] {
        var f: [WidgetFamily] = [.systemSmall, .systemMedium, .systemLarge]
        if #available(iOS 16.0, *) {
            f.append(contentsOf: [.accessoryCircular, .accessoryRectangular, .accessoryInline])
        }
        return f
    }
}
