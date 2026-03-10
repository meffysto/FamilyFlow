import { requireNativeModule, Platform } from 'expo-modules-core';

const isIOS = Platform.OS === 'ios';

interface VaultAccessModuleType {
  startAccessing(uri: string): Promise<boolean>;
  restoreAccess(): Promise<string | null>;
  writeFile(uri: string, content: string): Promise<void>;
  ensureDir(uri: string): Promise<void>;
  deleteFile(uri: string): Promise<void>;
  copyFile(sourceUri: string, destUri: string): Promise<void>;
  stopAccessing(): void;
  clearBookmark(): void;
}

let VaultAccessNative: VaultAccessModuleType | null = null;
if (isIOS) {
  try {
    VaultAccessNative = requireNativeModule('VaultAccess');
  } catch {
    // Expo Go: module natif indisponible, fallback sur expo-file-system
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
