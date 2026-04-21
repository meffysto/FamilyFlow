import { requireNativeModule, Platform } from 'expo-modules-core';

interface VaultAccessModuleType {
  startFeedingActivity(babyName: string, babyEmoji: string, feedType: string, side: string | null, volumeMl: number | null): Promise<boolean>;
  updateFeedingActivity(isPaused: boolean, side: string | null, volumeMl: number | null): Promise<void>;
  stopFeedingActivity(): Promise<void>;
  startMascotteActivity(mascotteName: string, tasksDone: number, tasksTotal: number, xpGained: number, currentMeal: string | null, stageOverride: string | null, companionSpriteBase64: string | null, bonusText: string | null, nextTaskPayload: string | null, extrasPayload: string | null): Promise<boolean>;
  updateMascotteActivity(tasksDone: number, tasksTotal: number, xpGained: number, currentMeal: string | null, stageOverride: string | null, companionSpriteBase64: string | null, bonusText: string | null, nextTaskPayload: string | null, extrasPayload: string | null): Promise<void>;
  stopMascotteActivity(): Promise<void>;
  isMascotteActivityActive(): Promise<boolean>;
  consumePendingTaskToggles(): Promise<string[]>;
  pauseWidgetFeeding(): Promise<void>;
  resumeWidgetFeeding(): Promise<void>;
  stopWidgetFeeding(): Promise<void>;
  checkAndStartWidgetLiveActivity(): Promise<string | null>;
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
  updateJournalWidgetData(json: string): Promise<void>;
  updateWidgetLanguage(json: string): Promise<void>;
  readJournalWidgetData(): Promise<string>;
  clearJournalWidgetFeedings(): Promise<void>;
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

// ─── Live Activity (Feeding Timer) ──────────────────────────────────────────

/**
 * Start a feeding Live Activity (Dynamic Island + Lock Screen).
 * Returns true if started successfully, false if not supported or denied.
 */
export async function startFeedingActivity(
  babyName: string,
  babyEmoji: string,
  feedType: 'allaitement' | 'biberon',
  side: string | null,
  volumeMl: number | null,
): Promise<boolean> {
  if (!VaultAccessNative) return false;
  return VaultAccessNative.startFeedingActivity(babyName, babyEmoji, feedType, side, volumeMl);
}

/**
 * Update the Live Activity state (pause/resume, change side).
 */
export async function updateFeedingActivity(
  isPaused: boolean,
  side: string | null,
  volumeMl: number | null,
): Promise<void> {
  if (!VaultAccessNative) return;
  return VaultAccessNative.updateFeedingActivity(isPaused, side, volumeMl);
}

/**
 * End the feeding Live Activity.
 */
export async function stopFeedingActivity(): Promise<void> {
  if (!VaultAccessNative) return;
  return VaultAccessNative.stopFeedingActivity();
}

// ─── Live Activity (Mascotte — journée narrative) ──────────────────────────

/**
 * Démarrer la Live Activity narrative de la mascotte (dure ~8h).
 * Retourne true si l'activity a bien démarré.
 */
/**
 * Encode `nextTaskId` + `nextTaskText` en un seul string "id\u001Ftext" pour
 * rester à 10 arguments côté bridge natif (workaround Swift 6.3 variadic
 * generics > 10). Le module Swift re-décode via decodeNextTaskPayload().
 */
function encodeNextTaskPayload(
  nextTaskText: string | null,
  nextTaskId: string | null,
): string | null {
  if (!nextTaskText && !nextTaskId) return null;
  return `${nextTaskId ?? ''}\u001F${nextTaskText ?? ''}`;
}

/**
 * Encode `nextRdvText` + `speechBubble` en un seul string "rdv\u001Fbubble". Même
 * motivation que `encodeNextTaskPayload` : garder ≤10 args côté bridge natif.
 */
function encodeExtrasPayload(
  nextRdvText: string | null,
  speechBubble: string | null,
): string | null {
  if (!nextRdvText && !speechBubble) return null;
  return `${nextRdvText ?? ''}\u001F${speechBubble ?? ''}`;
}

export async function startMascotteActivity(
  mascotteName: string,
  tasksDone: number,
  tasksTotal: number,
  xpGained: number,
  currentMeal: string | null,
  stageOverride: string | null = null,
  companionSpriteBase64: string | null = null,
  bonusText: string | null = null,
  nextTaskText: string | null = null,
  nextTaskId: string | null = null,
  nextRdvText: string | null = null,
  speechBubble: string | null = null,
): Promise<boolean> {
  if (!VaultAccessNative) return false;
  const taskPayload = encodeNextTaskPayload(nextTaskText, nextTaskId);
  const extrasPayload = encodeExtrasPayload(nextRdvText, speechBubble);
  return VaultAccessNative.startMascotteActivity(mascotteName, tasksDone, tasksTotal, xpGained, currentMeal, stageOverride, companionSpriteBase64, bonusText, taskPayload, extrasPayload);
}

/**
 * Mettre à jour l'état de la Live Activity mascotte (tâches cochées, repas, XP).
 */
export async function updateMascotteActivity(
  tasksDone: number,
  tasksTotal: number,
  xpGained: number,
  currentMeal: string | null,
  stageOverride: string | null = null,
  companionSpriteBase64: string | null = null,
  bonusText: string | null = null,
  nextTaskText: string | null = null,
  nextTaskId: string | null = null,
  nextRdvText: string | null = null,
  speechBubble: string | null = null,
): Promise<void> {
  if (!VaultAccessNative) return;
  const taskPayload = encodeNextTaskPayload(nextTaskText, nextTaskId);
  const extrasPayload = encodeExtrasPayload(nextRdvText, speechBubble);
  return VaultAccessNative.updateMascotteActivity(tasksDone, tasksTotal, xpGained, currentMeal, stageOverride, companionSpriteBase64, bonusText, taskPayload, extrasPayload);
}

/**
 * Arrêter la Live Activity mascotte.
 */
export async function stopMascotteActivity(): Promise<void> {
  if (!VaultAccessNative) return;
  return VaultAccessNative.stopMascotteActivity();
}

/**
 * Retourne true si la Live Activity mascotte est actuellement active.
 */
export async function isMascotteActivityActive(): Promise<boolean> {
  if (!VaultAccessNative) return false;
  return VaultAccessNative.isMascotteActivityActive();
}

/**
 * Consomme (claim-first) les pending task toggles écrits par l'AppIntent
 * ToggleNextTaskIntent depuis la Live Activity. Retourne les taskIds à appliquer.
 * Les fichiers sont supprimés côté natif avant d'être retournés : si l'app crash
 * entre la suppression et l'application, le toggle est perdu (acceptable, le
 * prochain clic dans l'app le refait).
 */
export async function consumePendingTaskToggles(): Promise<string[]> {
  if (!VaultAccessNative) return [];
  try {
    return await VaultAccessNative.consumePendingTaskToggles();
  } catch {
    return [];
  }
}

/**
 * Sync app → widget: pause/resume/stop the widget feeding timer.
 */
export async function pauseWidgetFeeding(): Promise<void> {
  if (!VaultAccessNative) return;
  return VaultAccessNative.pauseWidgetFeeding();
}
export async function resumeWidgetFeeding(): Promise<void> {
  if (!VaultAccessNative) return;
  return VaultAccessNative.resumeWidgetFeeding();
}
export async function stopWidgetFeeding(): Promise<void> {
  if (!VaultAccessNative) return;
  return VaultAccessNative.stopWidgetFeeding();
}

/**
 * Check if the widget requested a Live Activity, consume the flag, and start it.
 * Returns the payload JSON if a Live Activity was started, null otherwise.
 */
export async function checkAndStartWidgetLiveActivity(): Promise<string | null> {
  if (!VaultAccessNative) return null;
  return VaultAccessNative.checkAndStartWidgetLiveActivity();
}

/**
 * Write widget data JSON to App Group shared container and reload widget timelines.
 * No-op on non-iOS.
 */
export async function updateWidgetData(json: string): Promise<void> {
  if (!VaultAccessNative) return;
  return VaultAccessNative.updateWidgetData(json);
}

/**
 * Write journal bébé widget data JSON to App Group shared container.
 * Merges childName with existing feedings (written by the widget itself).
 * No-op on non-iOS.
 */
export async function updateJournalWidgetData(json: string): Promise<void> {
  if (!VaultAccessNative) return;
  return VaultAccessNative.updateJournalWidgetData(json);
}

/**
 * Write widget language preference to App Group container and reload timelines.
 * No-op on non-iOS.
 */
export async function updateWidgetLanguage(json: string): Promise<void> {
  if (!VaultAccessNative) return;
  return VaultAccessNative.updateWidgetLanguage(json);
}

/**
 * Read journal bébé widget JSON from App Group container.
 * Returns empty string on non-iOS or if file doesn't exist.
 */
export async function readJournalWidgetData(): Promise<string> {
  if (!VaultAccessNative) return '';
  return VaultAccessNative.readJournalWidgetData();
}

/**
 * Clear feedings and activeFeeding from journal widget JSON.
 * Keeps childName and lastSide intact.
 * No-op on non-iOS.
 */
export async function clearJournalWidgetFeedings(): Promise<void> {
  if (!VaultAccessNative) return;
  return VaultAccessNative.clearJournalWidgetFeedings();
}
