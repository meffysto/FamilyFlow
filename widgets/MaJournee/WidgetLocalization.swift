import Foundation

/// Localisation centralisée pour les widgets iOS
/// La langue est transmise depuis l'app React Native via le JSON App Group
enum WidgetLang: String, Codable {
    case fr, en

    /// Charge la langue depuis le container App Group (fallback: fr)
    static func fromAppGroup() -> WidgetLang {
        guard let url = FileManager.default.containerURL(
            forSecurityApplicationGroupIdentifier: "group.com.familyvault.dev"
        )?.appendingPathComponent("widget-language.json"),
              let data = try? Data(contentsOf: url),
              let json = try? JSONDecoder().decode([String: String].self, from: data),
              let lang = json["language"],
              let parsed = WidgetLang(rawValue: lang) else {
            return .fr
        }
        return parsed
    }
}

// MARK: - MaJournée Widget Strings

enum MaJourneeStrings {
    static func tasks(_ lang: WidgetLang) -> String {
        lang == .en ? "tasks" : "tâches"
    }

    static func notPlanned(_ lang: WidgetLang) -> String {
        lang == .en ? "Not planned yet" : "Pas encore planifié"
    }

    static func allDone(_ lang: WidgetLang) -> String {
        lang == .en ? "All done" : "Tâches bouclées"
    }

    static func tasksDone(_ count: Int, _ lang: WidgetLang) -> String {
        if lang == .en {
            return "\(count) task\(count > 1 ? "s" : "") done"
        }
        return "\(count) tâche\(count > 1 ? "s" : "") faite\(count > 1 ? "s" : "")"
    }

    static func quietDay(_ lang: WidgetLang) -> String {
        lang == .en ? "Quiet day ☀️" : "Journée tranquille ☀️"
    }

    static func nothingPlanned(_ lang: WidgetLang) -> String {
        lang == .en ? "Nothing planned" : "Rien de prévu"
    }

    static func toDo(_ lang: WidgetLang) -> String {
        lang == .en ? "To do" : "À faire"
    }

    static func noon(_ lang: WidgetLang) -> String {
        lang == .en ? "Lunch" : "Midi"
    }

    static func evening(_ lang: WidgetLang) -> String {
        lang == .en ? "Dinner" : "Soir"
    }

    static func widgetTitle(_ lang: WidgetLang) -> String {
        lang == .en ? "My Day" : "Ma Journée"
    }

    static func widgetDescription(_ lang: WidgetLang) -> String {
        lang == .en ? "Meals, tasks and appointments" : "Repas, tâches et RDV du jour"
    }
}

// MARK: - Journal Bébé Widget Strings

enum JournalStrings {
    static func title(_ lang: WidgetLang) -> String {
        lang == .en ? "Baby journal" : "Journal bébé"
    }

    static func feedingPaused(_ lang: WidgetLang) -> String {
        lang == .en ? "⏸ Feeding paused" : "⏸ Tétée en pause"
    }

    static func feedingActive(_ lang: WidgetLang) -> String {
        lang == .en ? "🤱 Feeding" : "🤱 Tétée en cours"
    }

    static func feedingPausedShort(_ lang: WidgetLang) -> String {
        lang == .en ? "⏸ Paused" : "⏸ En pause"
    }

    static func feedingActiveShort(_ lang: WidgetLang) -> String {
        lang == .en ? "🤱 Feeding" : "🤱 Tétée en cours"
    }

    static func lastMeal(_ lang: WidgetLang) -> String {
        lang == .en ? "Last feed" : "Dernier repas"
    }

    static func noMeal(_ lang: WidgetLang) -> String {
        lang == .en ? "No feed" : "Aucun repas"
    }

    static func justNow(_ lang: WidgetLang) -> String {
        lang == .en ? "Just now" : "À l'instant"
    }

    static func agoMinutes(_ minutes: Int, _ lang: WidgetLang) -> String {
        lang == .en ? "\(minutes) min ago" : "Il y a \(minutes) min"
    }

    static func agoHours(_ hours: Int, _ remainingMin: Int, _ lang: WidgetLang) -> String {
        if lang == .en {
            if remainingMin == 0 { return "\(hours)h ago" }
            return "\(hours)h\(String(format: "%02d", remainingMin)) ago"
        }
        if remainingMin == 0 { return "Il y a \(hours)h" }
        return "Il y a \(hours)h\(String(format: "%02d", remainingMin))"
    }

    static func nursing(_ lang: WidgetLang) -> String {
        lang == .en ? "Nurse" : "Tétée"
    }

    static func bottle(_ lang: WidgetLang) -> String {
        lang == .en ? "Bottle" : "Biberon"
    }

    static func resume(_ lang: WidgetLang) -> String {
        lang == .en ? "Resume" : "Reprendre"
    }

    static func stop(_ lang: WidgetLang) -> String {
        lang == .en ? "Stop" : "Arrêter"
    }

    static func screen(_ lang: WidgetLang) -> String {
        lang == .en ? "Screen" : "Écran"
    }

    static func baby(_ lang: WidgetLang) -> String {
        lang == .en ? "Baby" : "Bébé"
    }

    static func lastSide(_ side: String, _ lang: WidgetLang) -> String {
        let sideName = sideLabel(side, lang)
        if lang == .en { return "Last: \(sideName) 🤱" }
        return "Dernier : \(sideName) 🤱"
    }

    static func left(_ lang: WidgetLang) -> String {
        lang == .en ? "Left" : "Gauche"
    }

    static func right(_ lang: WidgetLang) -> String {
        lang == .en ? "Right" : "Droite"
    }

    static func sideLabel(_ side: String, _ lang: WidgetLang) -> String {
        if side == "gauche" { return left(lang).capitalized }
        if side == "droite" { return right(lang).capitalized }
        return side.capitalized
    }

    static func ios17Required(_ lang: WidgetLang) -> String {
        lang == .en ? "iOS 17+ required" : "iOS 17+ requis"
    }

    static func widgetDescription(_ lang: WidgetLang) -> String {
        lang == .en ? "Last feed and quick logging" : "Dernier repas et enregistrement rapide"
    }
}

// MARK: - Live Activity Strings

enum LiveActivityStrings {
    static func paused(_ lang: WidgetLang) -> String {
        lang == .en ? "Paused" : "En pause"
    }

    static func nursingLabel(baby: String, side: String, _ lang: WidgetLang) -> String {
        if lang == .en {
            let sideEN = side == "G" ? "left" : side == "D" ? "right" : ""
            return "\(baby) · Nursing \(sideEN)"
        }
        let sideFR = side == "G" ? "gauche" : side == "D" ? "droit" : ""
        return "\(baby) · Tétée côté \(sideFR)"
    }

    static func bottleLabel(baby: String, volume: String, _ lang: WidgetLang) -> String {
        lang == .en ? "\(baby) · Bottle \(volume)" : "\(baby) · Biberon \(volume)"
    }

    static func feedLabel(baby: String, side: String, _ lang: WidgetLang) -> String {
        if lang == .en {
            let sideEN = side.isEmpty ? "" : side
            return "\(baby) · Nursing \(sideEN)"
        }
        return "\(baby) · Tétée \(side)"
    }
}

// MARK: - Day of Week

enum DayStrings {
    private static let daysFR = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"]
    private static let daysEN = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]

    static func dayOfWeek(_ frDay: String, _ lang: WidgetLang) -> String {
        guard lang == .en else { return frDay }
        if let idx = daysFR.firstIndex(of: frDay), idx < daysEN.count {
            return daysEN[idx]
        }
        return frDay
    }
}
