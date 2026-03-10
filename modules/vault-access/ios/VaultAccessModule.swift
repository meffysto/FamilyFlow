import ExpoModulesCore
import Foundation

public class VaultAccessModule: Module {
  /// Tracks active security-scoped resources to stop accessing on cleanup
  private var activeURLs: [URL] = []

  public func definition() -> ModuleDefinition {
    Name("VaultAccess")

    /// Start accessing a security-scoped URL and save a bookmark for persistent access
    AsyncFunction("startAccessing") { (uriString: String) -> Bool in
      guard let url = URL(string: uriString) else { return false }

      // Start security-scoped access
      let success = url.startAccessingSecurityScopedResource()
      if !success {
        return false
      }
      self.activeURLs.append(url)

      // Save bookmark for persistent access across app launches
      do {
        let bookmarkData = try url.bookmarkData(
          options: .minimalBookmark,
          includingResourceValuesForKeys: nil,
          relativeTo: nil
        )
        UserDefaults.standard.set(bookmarkData, forKey: "vault_bookmark")
        UserDefaults.standard.set(uriString, forKey: "vault_uri")
      } catch {
        // Bookmark save failed — access still works for this session
        print("[VaultAccess] Bookmark save failed: \(error)")
      }

      return true
    }

    /// Restore access from a saved bookmark (call on app launch)
    AsyncFunction("restoreAccess") { () -> String? in
      guard let bookmarkData = UserDefaults.standard.data(forKey: "vault_bookmark") else {
        return nil
      }

      do {
        var isStale = false
        let url = try URL(
          resolvingBookmarkData: bookmarkData,
          options: [],
          relativeTo: nil,
          bookmarkDataIsStale: &isStale
        )

        if isStale {
          // Re-save the bookmark
          let newBookmark = try url.bookmarkData(
            options: .minimalBookmark,
            includingResourceValuesForKeys: nil,
            relativeTo: nil
          )
          UserDefaults.standard.set(newBookmark, forKey: "vault_bookmark")
        }

        let success = url.startAccessingSecurityScopedResource()
        if success {
          self.activeURLs.append(url)
        }

        return url.absoluteString
      } catch {
        print("[VaultAccess] Restore failed: \(error)")
        return nil
      }
    }

    /// Stop accessing all security-scoped resources
    Function("stopAccessing") {
      for url in self.activeURLs {
        url.stopAccessingSecurityScopedResource()
      }
      self.activeURLs.removeAll()
    }

    /// Clear saved bookmark
    Function("clearBookmark") {
      UserDefaults.standard.removeObject(forKey: "vault_bookmark")
      UserDefaults.standard.removeObject(forKey: "vault_uri")
    }
  }
}
