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
          options: [],
          includingResourceValuesForKeys: nil,
          relativeTo: nil
        )
        UserDefaults.standard.set(bookmarkData, forKey: "vault_bookmark")
        UserDefaults.standard.set(uriString, forKey: "vault_uri")
      } catch {
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
          let newBookmark = try url.bookmarkData(
            options: [],
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

    // ─── Coordinated File Operations ─────────────────────────────────────
    // Required for writing to file provider containers (Obsidian, iCloud, etc.)
    // expo-file-system doesn't use NSFileCoordinator, so writes fail.

    /// Write a string to a file using NSFileCoordinator
    AsyncFunction("writeFile") { (uriString: String, content: String) in
      guard let url = URL(string: uriString) else {
        throw NSError(domain: "VaultAccess", code: 1, userInfo: [
          NSLocalizedDescriptionKey: "URL invalide: \(uriString)"
        ])
      }

      // Ensure parent directory exists
      let parent = url.deletingLastPathComponent()
      try self.coordinatedMkdir(at: parent)

      var coordinatorError: NSError?
      var writeError: Error?

      let coordinator = NSFileCoordinator()
      coordinator.coordinate(writingItemAt: url, options: .forReplacing, error: &coordinatorError) { writingURL in
        do {
          try content.write(to: writingURL, atomically: true, encoding: .utf8)
        } catch {
          writeError = error
        }
      }

      if let err = coordinatorError ?? writeError {
        throw err
      }
    }

    /// Create a directory (with intermediates) using NSFileCoordinator
    AsyncFunction("ensureDir") { (uriString: String) in
      guard let url = URL(string: uriString) else {
        throw NSError(domain: "VaultAccess", code: 1, userInfo: [
          NSLocalizedDescriptionKey: "URL invalide: \(uriString)"
        ])
      }
      try self.coordinatedMkdir(at: url)
    }

    /// Delete a file using NSFileCoordinator
    AsyncFunction("deleteFile") { (uriString: String) in
      guard let url = URL(string: uriString) else {
        throw NSError(domain: "VaultAccess", code: 1, userInfo: [
          NSLocalizedDescriptionKey: "URL invalide: \(uriString)"
        ])
      }

      var coordinatorError: NSError?
      var deleteError: Error?

      let coordinator = NSFileCoordinator()
      coordinator.coordinate(writingItemAt: url, options: .forDeleting, error: &coordinatorError) { deletingURL in
        do {
          if FileManager.default.fileExists(atPath: deletingURL.path) {
            try FileManager.default.removeItem(at: deletingURL)
          }
        } catch {
          deleteError = error
        }
      }

      if let err = coordinatorError ?? deleteError {
        throw err
      }
    }

    /// Copy a file into the vault using NSFileCoordinator
    AsyncFunction("copyFile") { (sourceUriString: String, destUriString: String) in
      guard let sourceURL = URL(string: sourceUriString),
            let destURL = URL(string: destUriString) else {
        throw NSError(domain: "VaultAccess", code: 1, userInfo: [
          NSLocalizedDescriptionKey: "URL invalide"
        ])
      }

      // Ensure parent directory exists
      let parent = destURL.deletingLastPathComponent()
      try self.coordinatedMkdir(at: parent)

      var coordinatorError: NSError?
      var copyError: Error?

      let coordinator = NSFileCoordinator()
      coordinator.coordinate(
        readingItemAt: sourceURL, options: [],
        writingItemAt: destURL, options: .forReplacing,
        error: &coordinatorError
      ) { readingURL, writingURL in
        do {
          // Remove destination if it exists
          if FileManager.default.fileExists(atPath: writingURL.path) {
            try FileManager.default.removeItem(at: writingURL)
          }
          try FileManager.default.copyItem(at: readingURL, to: writingURL)
        } catch {
          copyError = error
        }
      }

      if let err = coordinatorError ?? copyError {
        throw err
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

  // MARK: - Helpers

  /// Create directory with intermediates using NSFileCoordinator
  private func coordinatedMkdir(at url: URL) throws {
    let fm = FileManager.default
    if fm.fileExists(atPath: url.path) { return }

    var coordinatorError: NSError?
    var mkdirError: Error?

    let coordinator = NSFileCoordinator()
    coordinator.coordinate(writingItemAt: url, options: .forReplacing, error: &coordinatorError) { writingURL in
      do {
        try fm.createDirectory(at: writingURL, withIntermediateDirectories: true, attributes: nil)
      } catch {
        mkdirError = error
      }
    }

    if let err = coordinatorError ?? mkdirError {
      throw err
    }
  }
}
