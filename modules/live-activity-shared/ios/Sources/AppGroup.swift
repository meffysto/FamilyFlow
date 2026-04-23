import Foundation

/// Chemins et identifiants App Group partagés entre l'app main, l'extension
/// widget et le Pod VaultAccess. Source unique de vérité — toute dérive
/// silencieuse (typo dans un identifier) devient impossible.
@available(iOS 16.2, *)
public enum AppGroup {
    public static let identifier = "group.com.familyvault.dev"

    public static var container: URL? {
        FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: identifier)
    }

    public static let companionSpriteFilename = "companion-sprite.png"
    public static let pendingTogglesDirectory = "pending-task-toggles"

    /// URL absolue du PNG sprite compagnon (nil si container indisponible).
    public static var companionSpriteURL: URL? {
        container?.appendingPathComponent(companionSpriteFilename)
    }

    /// Dossier des fichiers pending-task-toggle-*.json. Créé paresseusement.
    public static func pendingTogglesDir() -> URL? {
        guard let dir = container?.appendingPathComponent(pendingTogglesDirectory, isDirectory: true) else {
            return nil
        }
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        return dir
    }
}
