import { requireNativeModule, Platform } from 'expo-modules-core';

const isIOS = Platform.OS === 'ios';

interface VaultAccessModuleType {
  startAccessing(uri: string): Promise<boolean>;
  restoreAccess(): Promise<string | null>;
  stopAccessing(): void;
  clearBookmark(): void;
}

const VaultAccessNative: VaultAccessModuleType | null = isIOS
  ? requireNativeModule('VaultAccess')
  : null;

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
