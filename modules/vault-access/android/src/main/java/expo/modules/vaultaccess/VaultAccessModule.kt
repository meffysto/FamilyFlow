package expo.modules.vaultaccess

import android.content.Context
import android.net.Uri
import android.provider.DocumentsContract
import androidx.documentfile.provider.DocumentFile
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File
import java.io.FileNotFoundException

class VaultAccessModule : Module() {

  private val context: Context
    get() = appContext.reactContext ?: throw IllegalStateException("Context non disponible")

  private fun isFileUri(uri: Uri): Boolean = uri.scheme == "file" || uri.scheme == null

  override fun definition() = ModuleDefinition {
    Name("VaultAccess")

    // ─── Security-scoped access (SAF persistable permissions) ───────────

    AsyncFunction("startAccessing") { uriString: String ->
      try {
        val uri = Uri.parse(uriString)
        if (isFileUri(uri)) {
          // file:// URIs — pas besoin de SAF permissions
          context.getSharedPreferences("vault_access", Context.MODE_PRIVATE)
            .edit()
            .putString("vault_uri", uriString)
            .apply()
          return@AsyncFunction true
        }
        // content:// URIs — prendre la permission persistante
        val flags = android.content.Intent.FLAG_GRANT_READ_URI_PERMISSION or
          android.content.Intent.FLAG_GRANT_WRITE_URI_PERMISSION
        context.contentResolver.takePersistableUriPermission(uri, flags)

        context.getSharedPreferences("vault_access", Context.MODE_PRIVATE)
          .edit()
          .putString("vault_uri", uriString)
          .apply()

        true
      } catch (e: Exception) {
        false
      }
    }

    AsyncFunction("restoreAccess") {
      val prefs = context.getSharedPreferences("vault_access", Context.MODE_PRIVATE)
      val savedUri = prefs.getString("vault_uri", null) ?: return@AsyncFunction null

      val uri = Uri.parse(savedUri)
      if (isFileUri(uri)) {
        // file:// — vérifier que le dossier existe toujours
        val path = uri.path
        if (path != null && File(path).exists()) savedUri else null
      } else {
        // content:// — vérifier la permission persistante
        val hasPermission = context.contentResolver.persistedUriPermissions.any {
          it.uri == uri && it.isReadPermission
        }
        if (hasPermission) savedUri else null
      }
    }

    // ─── File I/O ────────────────────────────────────────────────────────

    AsyncFunction("readFile") { uriString: String ->
      val uri = Uri.parse(uriString)
      try {
        if (isFileUri(uri)) {
          val file = File(uri.path ?: throw FileNotFoundException("Chemin vide"))
          file.readText(Charsets.UTF_8)
        } else {
          context.contentResolver.openInputStream(uri)?.use { stream ->
            stream.bufferedReader(Charsets.UTF_8).readText()
          } ?: throw FileNotFoundException("Impossible d'ouvrir: $uriString")
        }
      } catch (e: Exception) {
        throw Exception("VaultAccess.readFile: $uriString — ${e.message}")
      }
    }

    AsyncFunction("writeFile") { uriString: String, content: String ->
      val uri = Uri.parse(uriString)
      if (isFileUri(uri)) {
        val file = File(uri.path ?: throw Exception("Chemin vide"))
        file.parentFile?.mkdirs()
        file.writeText(content, Charsets.UTF_8)
      } else {
        try {
          context.contentResolver.openOutputStream(uri, "wt")?.use { stream ->
            stream.write(content.toByteArray(Charsets.UTF_8))
          } ?: throw FileNotFoundException("Impossible d'écrire: $uriString")
        } catch (e: FileNotFoundException) {
          createAndWriteFile(uri, content)
        }
      }
    }

    AsyncFunction("ensureDir") { uriString: String ->
      val uri = Uri.parse(uriString)
      if (isFileUri(uri)) {
        val dir = File(uri.path ?: return@AsyncFunction)
        if (!dir.exists()) dir.mkdirs()
      } else {
        ensureDirectoryExists(uri)
      }
    }

    AsyncFunction("deleteFile") { uriString: String ->
      val uri = Uri.parse(uriString)
      try {
        if (isFileUri(uri)) {
          val file = File(uri.path ?: return@AsyncFunction)
          file.delete()
        } else {
          DocumentsContract.deleteDocument(context.contentResolver, uri)
        }
      } catch (e: Exception) {
        // Fichier déjà supprimé ou inexistant
      }
    }

    AsyncFunction("copyFile") { sourceUriString: String, destUriString: String ->
      val sourceUri = Uri.parse(sourceUriString)
      val destUri = Uri.parse(destUriString)

      try {
        val bytes = if (isFileUri(sourceUri)) {
          File(sourceUri.path ?: throw FileNotFoundException("Source vide")).readBytes()
        } else {
          context.contentResolver.openInputStream(sourceUri)?.use { it.readBytes() }
            ?: throw FileNotFoundException("Source introuvable: $sourceUriString")
        }

        if (isFileUri(destUri)) {
          val destFile = File(destUri.path ?: throw Exception("Destination vide"))
          destFile.parentFile?.mkdirs()
          destFile.writeBytes(bytes)
        } else {
          try {
            context.contentResolver.openOutputStream(destUri, "wt")?.use { stream ->
              stream.write(bytes)
            } ?: throw FileNotFoundException("Destination non ouvrable")
          } catch (e: FileNotFoundException) {
            createAndWriteFileBytes(destUri, bytes)
          }
        }
      } catch (e: Exception) {
        throw Exception("VaultAccess.copyFile: ${e.message}")
      }
    }

    AsyncFunction("downloadICloudFiles") { _: String ->
      // Pas d'iCloud sur Android
      0
    }

    AsyncFunction("listDirectory") { uriString: String ->
      val uri = Uri.parse(uriString)
      val entries = mutableListOf<String>()

      try {
        if (isFileUri(uri)) {
          val dir = File(uri.path ?: return@AsyncFunction entries)
          if (dir.isDirectory) {
            dir.listFiles()?.forEach { child ->
              if (!child.name.startsWith(".")) {
                entries.add(child.name)
              }
            }
          }
        } else {
          val docFile = DocumentFile.fromTreeUri(context, uri)
            ?: DocumentFile.fromSingleUri(context, uri)

          if (docFile != null && docFile.isDirectory) {
            docFile.listFiles().forEach { child ->
              child.name?.let { name ->
                if (!name.startsWith(".")) {
                  entries.add(name)
                }
              }
            }
          } else {
            val childrenUri = DocumentsContract.buildChildDocumentsUriUsingTree(
              uri,
              DocumentsContract.getDocumentId(uri)
            )
            val cursor = context.contentResolver.query(
              childrenUri,
              arrayOf(DocumentsContract.Document.COLUMN_DISPLAY_NAME),
              null, null, null
            )
            cursor?.use {
              while (it.moveToNext()) {
                val name = it.getString(0)
                if (!name.startsWith(".")) {
                  entries.add(name)
                }
              }
            }
          }
        }
      } catch (e: Exception) {
        // Répertoire inaccessible
      }

      entries
    }

    AsyncFunction("isDirectory") { uriString: String ->
      val uri = Uri.parse(uriString)
      try {
        if (isFileUri(uri)) {
          File(uri.path ?: return@AsyncFunction false).isDirectory
        } else {
          val docFile = DocumentFile.fromTreeUri(context, uri)
            ?: DocumentFile.fromSingleUri(context, uri)
          docFile?.isDirectory ?: false
        }
      } catch (e: Exception) {
        false
      }
    }

    AsyncFunction("fileExists") { uriString: String ->
      val uri = Uri.parse(uriString)
      try {
        if (isFileUri(uri)) {
          File(uri.path ?: return@AsyncFunction false).exists()
        } else {
          val docFile = DocumentFile.fromTreeUri(context, uri)
            ?: DocumentFile.fromSingleUri(context, uri)
          docFile?.exists() ?: false
        }
      } catch (e: Exception) {
        false
      }
    }

    Function("stopAccessing") {
      // Sur Android, les permissions persistantes restent actives
    }

    Function("clearBookmark") {
      val prefs = context.getSharedPreferences("vault_access", Context.MODE_PRIVATE)
      val savedUri = prefs.getString("vault_uri", null)

      if (savedUri != null) {
        try {
          val uri = Uri.parse(savedUri)
          if (!isFileUri(uri)) {
            val flags = android.content.Intent.FLAG_GRANT_READ_URI_PERMISSION or
              android.content.Intent.FLAG_GRANT_WRITE_URI_PERMISSION
            context.contentResolver.releasePersistableUriPermission(uri, flags)
          }
        } catch (e: Exception) {
          // Permission déjà révoquée
        }
      }

      prefs.edit().clear().apply()
    }
  }

  // ─── Helpers SAF (content:// URIs uniquement) ─────────────────────────

  private fun createAndWriteFile(fileUri: Uri, content: String) {
    createAndWriteFileBytes(fileUri, content.toByteArray(Charsets.UTF_8))
  }

  private fun createAndWriteFileBytes(fileUri: Uri, content: ByteArray) {
    val docId = DocumentsContract.getDocumentId(fileUri)
    val treeUri = DocumentsContract.buildTreeDocumentUri(fileUri.authority, docId.substringBefore(":") + ":")

    val parts = docId.substringAfter("/").split("/")
    val fileName = parts.last()
    val dirParts = parts.dropLast(1)

    var currentDoc = DocumentFile.fromTreeUri(context, treeUri)
      ?: throw Exception("Impossible d'accéder au tree URI")

    for (part in dirParts) {
      val existing = currentDoc.findFile(part)
      currentDoc = if (existing != null && existing.isDirectory) {
        existing
      } else {
        currentDoc.createDirectory(part)
          ?: throw Exception("Impossible de créer le répertoire: $part")
      }
    }

    val mimeType = if (fileName.endsWith(".md")) "text/markdown"
    else if (fileName.endsWith(".cook")) "text/plain"
    else "application/octet-stream"

    val newFile = currentDoc.createFile(mimeType, fileName.substringBeforeLast("."))
      ?: throw Exception("Impossible de créer le fichier: $fileName")

    context.contentResolver.openOutputStream(newFile.uri, "wt")?.use { stream ->
      stream.write(content)
    } ?: throw Exception("Impossible d'écrire dans le fichier créé")
  }

  private fun ensureDirectoryExists(uri: Uri) {
    try {
      val docId = DocumentsContract.getDocumentId(uri)
      val treeUri = DocumentsContract.buildTreeDocumentUri(uri.authority, docId.substringBefore(":") + ":")

      val parts = docId.substringAfter("/").split("/").filter { it.isNotEmpty() }

      var currentDoc = DocumentFile.fromTreeUri(context, treeUri)
        ?: throw Exception("Impossible d'accéder au tree URI")

      for (part in parts) {
        val existing = currentDoc.findFile(part)
        currentDoc = if (existing != null && existing.isDirectory) {
          existing
        } else {
          currentDoc.createDirectory(part)
            ?: throw Exception("Impossible de créer le répertoire: $part")
        }
      }
    } catch (e: Exception) {
      val path = uri.path ?: return
      val dir = File(path)
      if (!dir.exists()) dir.mkdirs()
    }
  }
}
