import ExpoModulesCore
import Foundation
import WidgetKit
import ActivityKit

// MARK: - Live Activity Attributes (dupliqué dans FeedingLiveActivity.swift pour le widget target)

@available(iOS 16.2, *)
struct FeedingActivityAttributes: ActivityAttributes {
    public struct ContentState: Codable, Hashable {
        var isPaused: Bool
        var side: String?
        var volumeMl: Int?
    }

    var babyName: String
    var babyEmoji: String
    var feedType: String
    var startedAt: Date
}

public class VaultAccessModule: Module {
  /// Tracks active security-scoped resources to stop accessing on cleanup
  private var activeURLs: [URL] = []

  public func definition() -> ModuleDefinition {
    Name("VaultAccess")

    /// Start accessing a security-scoped URL and save a bookmark for persistent access
    AsyncFunction("startAccessing") { (uriString: String) -> Bool in
      guard let url = URL(string: uriString) else { return false }

      let success = url.startAccessingSecurityScopedResource()
      if !success {
        return false
      }
      self.activeURLs.append(url)

      do {
        let bookmarkData = try url.bookmarkData(
          options: [],
          includingResourceValuesForKeys: nil,
          relativeTo: nil
        )
        UserDefaults.standard.set(bookmarkData, forKey: "vault_bookmark")
        UserDefaults.standard.set(uriString, forKey: "vault_uri")
      } catch {
        // Bookmark save failed — access still works for this session
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
        return nil
      }
    }

    // ─── Coordinated File Operations ─────────────────────────────────────
    // Required for reading/writing iCloud Drive files.
    // expo-file-system doesn't use NSFileCoordinator, so reads/writes can fail.

    /// Read a file using NSFileCoordinator (required for iCloud Drive files)
    AsyncFunction("readFile") { (uriString: String) -> String in
      guard let url = URL(string: uriString) else {
        throw NSError(domain: "VaultAccess", code: 1, userInfo: [
          NSLocalizedDescriptionKey: "URL invalide: \(uriString)"
        ])
      }

      var coordinatorError: NSError?
      var readError: Error?
      var content: String = ""

      let coordinator = NSFileCoordinator()
      coordinator.coordinate(readingItemAt: url, options: [], error: &coordinatorError) { readingURL in
        do {
          content = try String(contentsOf: readingURL, encoding: .utf8)
        } catch {
          readError = error
        }
      }

      if let err = coordinatorError ?? readError {
        throw err
      }

      return content
    }

    /// Write a string to a file using NSFileCoordinator
    AsyncFunction("writeFile") { (uriString: String, content: String) in
      guard let url = URL(string: uriString) else {
        throw NSError(domain: "VaultAccess", code: 1, userInfo: [
          NSLocalizedDescriptionKey: "URL invalide: \(uriString)"
        ])
      }

      let parent = url.deletingLastPathComponent()
      try self.coordinatedMkdir(at: parent)

      var coordinatorError: NSError?
      var writeError: Error?

      let coordinator = NSFileCoordinator()
      coordinator.coordinate(writingItemAt: url, options: .forMerging, error: &coordinatorError) { writingURL in
        do {
          let data = content.data(using: .utf8)!
          try data.write(to: writingURL, options: [])
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

      let parent = destURL.deletingLastPathComponent()
      try self.coordinatedMkdir(at: parent)

      let fm = FileManager.default
      var coordinatorError: NSError?
      var copyError: Error?

      let coordinator = NSFileCoordinator()
      coordinator.coordinate(
        readingItemAt: sourceURL, options: [],
        writingItemAt: destURL, options: .forMerging,
        error: &coordinatorError
      ) { readingURL, writingURL in
        do {
          if fm.fileExists(atPath: writingURL.path) {
            try fm.removeItem(at: writingURL)
          }
          try fm.copyItem(at: readingURL, to: writingURL)
        } catch {
          copyError = error
        }
      }

      if let err = coordinatorError ?? copyError {
        throw err
      }
    }

    /// Force download all iCloud evicted files in a directory (recursive)
    /// Returns the number of files triggered for download
    AsyncFunction("downloadICloudFiles") { (uriString: String) -> Int in
      guard let url = URL(string: uriString) else { return 0 }

      let fm = FileManager.default
      var count = 0

      guard let enumerator = fm.enumerator(
        at: url,
        includingPropertiesForKeys: [.ubiquitousItemDownloadingStatusKey, .isDirectoryKey],
        options: [.skipsHiddenFiles]
      ) else { return 0 }

      for case let fileURL as URL in enumerator {
        do {
          let resourceValues = try fileURL.resourceValues(forKeys: [
            .ubiquitousItemDownloadingStatusKey,
            .isDirectoryKey,
          ])

          let isDir = resourceValues.isDirectory ?? false
          if isDir { continue }

          let status = resourceValues.ubiquitousItemDownloadingStatus
          if status == .notDownloaded {
            try fm.startDownloadingUbiquitousItem(at: fileURL)
            count += 1
          }
        } catch {
          // Skip files we can't access
        }
      }

      return count
    }

    /// List directory contents using NSFileCoordinator
    AsyncFunction("listDirectory") { (uriString: String) -> [String] in
      guard let url = URL(string: uriString) else { return [] }

      var coordinatorError: NSError?
      var listError: Error?
      var entries: [String] = []

      let coordinator = NSFileCoordinator()
      coordinator.coordinate(readingItemAt: url, options: [], error: &coordinatorError) { readingURL in
        do {
          let contents = try FileManager.default.contentsOfDirectory(
            at: readingURL,
            includingPropertiesForKeys: nil,
            options: [.skipsHiddenFiles]
          )
          entries = contents.map { $0.lastPathComponent }
        } catch {
          listError = error
        }
      }

      if let err = coordinatorError ?? listError {
        throw err
      }

      return entries
    }

    /// Check if path is a directory using FileManager
    AsyncFunction("isDirectory") { (uriString: String) -> Bool in
      guard let url = URL(string: uriString) else { return false }

      var isDir: ObjCBool = false
      let exists = FileManager.default.fileExists(atPath: url.path, isDirectory: &isDir)
      return exists && isDir.boolValue
    }

    /// Check if a file or directory exists using FileManager
    AsyncFunction("fileExists") { (uriString: String) -> Bool in
      guard let url = URL(string: uriString) else { return false }
      return FileManager.default.fileExists(atPath: url.path)
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

    /// Write journal bébé widget data JSON to App Group container and reload timeline
    AsyncFunction("updateJournalWidgetData") { (jsonString: String) in
      guard let containerURL = FileManager.default.containerURL(
        forSecurityApplicationGroupIdentifier: "group.com.familyvault.dev"
      ) else {
        throw NSError(domain: "VaultAccess", code: 2, userInfo: [
          NSLocalizedDescriptionKey: "App Group container introuvable"
        ])
      }

      let fileURL = containerURL.appendingPathComponent("journal-bebe-widget.json")

      // Lire les données existantes pour conserver les feedings enregistrés par le widget
      var existingData: [String: Any] = [:]
      if let data = try? Data(contentsOf: fileURL),
         let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any] {
        existingData = json
      }

      // Parser les nouvelles données (childName de l'app)
      if let newData = jsonString.data(using: .utf8),
         let newJson = try? JSONSerialization.jsonObject(with: newData) as? [String: Any] {
        // Mettre à jour le childName mais garder les feedings existants
        existingData["childName"] = newJson["childName"]
        if existingData["feedings"] == nil {
          existingData["feedings"] = [] as [[String: Any]]
        }
      }

      let mergedData = try JSONSerialization.data(withJSONObject: existingData, options: .prettyPrinted)
      try mergedData.write(to: fileURL)

      WidgetCenter.shared.reloadTimelines(ofKind: "JournalBebeWidget")
    }

    /// Read journal bébé widget JSON from App Group container
    AsyncFunction("readJournalWidgetData") { () -> String in
      guard let containerURL = FileManager.default.containerURL(
        forSecurityApplicationGroupIdentifier: "group.com.familyvault.dev"
      ) else {
        return ""
      }

      let fileURL = containerURL.appendingPathComponent("journal-bebe-widget.json")
      guard let data = try? Data(contentsOf: fileURL),
            let content = String(data: data, encoding: .utf8) else {
        return ""
      }
      return content
    }

    /// Clear feedings and activeFeeding from journal widget JSON, keep childName and lastSide
    AsyncFunction("clearJournalWidgetFeedings") { () in
      guard let containerURL = FileManager.default.containerURL(
        forSecurityApplicationGroupIdentifier: "group.com.familyvault.dev"
      ) else { return }

      let fileURL = containerURL.appendingPathComponent("journal-bebe-widget.json")
      guard let data = try? Data(contentsOf: fileURL),
            var json = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else { return }

      // Garder childName et lastSide, vider feedings et activeFeeding
      json["feedings"] = [] as [[String: Any]]
      json.removeValue(forKey: "activeFeeding")

      let cleanedData = try JSONSerialization.data(withJSONObject: json, options: .prettyPrinted)
      try cleanedData.write(to: fileURL)

      WidgetCenter.shared.reloadTimelines(ofKind: "JournalBebeWidget")
    }

    // ─── Live Activity (Feeding Timer) ─────────────────────────────────

    /// Start a feeding Live Activity
    AsyncFunction("startFeedingActivity") { (babyName: String, babyEmoji: String, feedType: String, side: String?, volumeMl: Int?) -> Bool in
      if #available(iOS 16.2, *) {
        guard ActivityAuthorizationInfo().areActivitiesEnabled else { return false }

        let attributes = FeedingActivityAttributes(
          babyName: babyName,
          babyEmoji: babyEmoji,
          feedType: feedType,
          startedAt: Date()
        )

        let state = FeedingActivityAttributes.ContentState(
          isPaused: false,
          side: side,
          volumeMl: volumeMl != nil ? volumeMl : nil
        )

        do {
          let content = ActivityContent(state: state, staleDate: nil)
          _ = try Activity<FeedingActivityAttributes>.request(
            attributes: attributes,
            content: content,
            pushType: nil
          )
          return true
        } catch {
          return false
        }
      }
      return false
    }

    /// Update the Live Activity state (pause/resume, change side)
    AsyncFunction("updateFeedingActivity") { (isPaused: Bool, side: String?, volumeMl: Int?) in
      if #available(iOS 16.2, *) {
        guard let activity = Activity<FeedingActivityAttributes>.activities.first else { return }

        let state = FeedingActivityAttributes.ContentState(
          isPaused: isPaused,
          side: side,
          volumeMl: volumeMl
        )

        let content = ActivityContent(state: state, staleDate: nil)
        await activity.update(content)
      }
    }

    /// End the Live Activity
    AsyncFunction("stopFeedingActivity") { () in
      if #available(iOS 16.2, *) {
        for activity in Activity<FeedingActivityAttributes>.activities {
          let state = FeedingActivityAttributes.ContentState(
            isPaused: true,
            side: activity.content.state.side,
            volumeMl: activity.content.state.volumeMl
          )
          let content = ActivityContent(state: state, staleDate: nil)
          await activity.end(content, dismissalPolicy: .immediate)
        }
      }
    }

    /// Write widget data JSON to App Group container and reload timelines
    AsyncFunction("updateWidgetData") { (jsonString: String) in
      guard let containerURL = FileManager.default.containerURL(
        forSecurityApplicationGroupIdentifier: "group.com.familyvault.dev"
      ) else {
        throw NSError(domain: "VaultAccess", code: 2, userInfo: [
          NSLocalizedDescriptionKey: "App Group container introuvable"
        ])
      }

      let fileURL = containerURL.appendingPathComponent("widget-data.json")
      try jsonString.data(using: .utf8)!.write(to: fileURL)

      WidgetCenter.shared.reloadAllTimelines()
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
    coordinator.coordinate(writingItemAt: url, options: .forMerging, error: &coordinatorError) { writingURL in
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
