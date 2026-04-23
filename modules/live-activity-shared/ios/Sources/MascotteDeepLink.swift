import Foundation

/// Deep links centralisés pour l'app FamilyFlow. Partagés par le widget
/// (Link destinations, widgetURL) et l'app main (routing côté RN bridge).
@available(iOS 16.2, *)
public enum MascotteDeepLink: String {
    case tree = "family-vault://open/tree"
    case stories = "family-vault://open/stories"
    case routines = "family-vault://open/routines"

    public var url: URL { URL(string: rawValue)! }
}
