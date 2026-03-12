import { requireNativeModule, Platform } from 'expo-modules-core';

interface VaultAccessModuleType {
  startAccessing(uri: string): Promise<boolean>;
  restoreAccess(): Promise<string | null>;
  readFile(uri: string): Promise<string>;
  writeFile(uri: string, content: string): Promise<void>;
  ensureDir(uri: string): Promise<void>;
  deleteFile(uri: string): Promise<void>;
  copyFile(sourceUri: string, destUri: string): Promise<void>;
  downloadICloudFiles(uri: string): Promise<number>;
  listDirectory(uri: string): Promise<string[]>;
  isDirectory(uri: string): Promise<boolean>;
  fileExists(uri: string): Promise<boolean>;
  updateWidgetData(json: string): Promise<void>;
  stopAccessing(): void;
  clearBookmark(): void;
}

let VaultAccessNative: VaultAccessModuleType | null = null;
if (Platform.OS === 'ios' || Platform.OS === 'android') {
  try {
    VaultAccessNative = requireNativeModule('VaultAccess');
  } catch {
    // Module natif indisponible, fallback sur expo-file-system
  }
}

/**
 * Start accessing a security-scoped folder URL (iOS only).
 * Saves a bookmark for persistent access across app launches.
 */
export async function startAccessing(uri: string): Promise<boolean> {
  if (!VaultAccessNative) return true; // No-op on non-iOS
  return VaultAccessNative.startAccessing(uri);
}

/**
 * Restore access from a saved bookmark (call on app launch).
 * Returns the folder URI if successful, null otherwise.
 */
export async function restoreAccess(): Promise<string | null> {
  if (!VaultAccessNative) return null;
  return VaultAccessNative.restoreAccess();
}

/**
 * Read a file using NSFileCoordinator (required for iCloud Drive files).
 * Returns null on non-iOS (caller should fall back to expo-file-system).
 */
export async function coordinatedReadFile(uri: string): Promise<string | null> {
  if (!VaultAccessNative) return null;
  return VaultAccessNative.readFile(uri);
}

/**
 * Write a file using NSFileCoordinator (required for file providers like Obsidian).
 * Creates parent directories automatically.
 * Returns false on non-iOS (caller should fall back to expo-file-system).
 */
export async function coordinatedWriteFile(uri: string, content: string): Promise<boolean> {
  if (!VaultAccessNative) return false;
  await VaultAccessNative.writeFile(uri, content);
  return true;
}

/**
 * Create a directory using NSFileCoordinator.
 * Returns false on non-iOS (caller should fall back to expo-file-system).
 */
export async function coordinatedEnsureDir(uri: string): Promise<boolean> {
  if (!VaultAccessNative) return false;
  await VaultAccessNative.ensureDir(uri);
  return true;
}

/**
 * Delete a file using NSFileCoordinator.
 * Returns false on non-iOS (caller should fall back to expo-file-system).
 */
export async function coordinatedDeleteFile(uri: string): Promise<boolean> {
  if (!VaultAccessNative) return false;
  await VaultAccessNative.deleteFile(uri);
  return true;
}

/**
 * Copy a file using NSFileCoordinator (e.g. photo into vault).
 * Creates parent directories automatically.
 * Returns false on non-iOS (caller should fall back to expo-file-system).
 */
export async function coordinatedCopyFile(sourceUri: string, destUri: string): Promise<boolean> {
  if (!VaultAccessNative) return false;
  await VaultAccessNative.copyFile(sourceUri, destUri);
  return true;
}

/**
 * List directory contents using NSFileCoordinator (résout les listings stale iCloud).
 * Returns null on non-iOS (caller should fall back to expo-file-system).
 */
export async function coordinatedListDir(uri: string): Promise<string[] | null> {
  if (!VaultAccessNative) return null;
  return VaultAccessNative.listDirectory(uri);
}

/**
 * Check if a path is a directory (via FileManager).
 * Returns null on non-iOS.
 */
export async function coordinatedIsDirectory(uri: string): Promise<boolean | null> {
  if (!VaultAccessNative) return null;
  return VaultAccessNative.isDirectory(uri);
}

/**
 * Stop accessing all security-scoped resources.
 */
export function stopAccessing(): void {
  VaultAccessNative?.stopAccessing();
}

/**
 * Clear saved bookmark.
 */
export function clearBookmark(): void {
  VaultAccessNative?.clearBookmark();
}

/**
 * Check if a file or directory exists (via FileManager).
 * Returns null on non-iOS.
 */
export async function coordinatedFileExists(uri: string): Promise<boolean | null> {
  if (!VaultAccessNative) return null;
  return VaultAccessNative.fileExists(uri);
}

/**
 * Force download all iCloud evicted files in a directory (recursive).
 * Returns the number of files triggered for download.
 */
export async function downloadICloudFiles(uri: string): Promise<number> {
  if (!VaultAccessNative) return 0;
  return VaultAccessNative.downloadICloudFiles(uri);
}

/**
 * Write widget data JSON to App Group shared container and reload widget timelines.
 * No-op on non-iOS.
 */
export async function updateWidgetData(json: string): Promise<void> {
  if (!VaultAccessNative) return;
  return VaultAccessNative.updateWidgetData(json);
}
