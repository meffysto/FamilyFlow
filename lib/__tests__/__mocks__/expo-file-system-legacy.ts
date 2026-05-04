/**
 * Mock expo-file-system/legacy pour les tests Jest.
 */

export const EncodingType = {
  UTF8: 'utf8',
  Base64: 'base64',
} as const;

export const documentDirectory = '/mock/documents/';
export const cacheDirectory = '/mock/cache/';

export async function readAsStringAsync(
  uri: string,
  _opts?: { encoding?: string },
): Promise<string> {
  return `mock-base64-content-for-${uri}`;
}

export async function writeAsStringAsync(
  _uri: string,
  _content: string,
  _opts?: { encoding?: string },
): Promise<void> {
  return;
}

export async function copyAsync(_opts: { from: string; to: string }): Promise<void> {
  return;
}

export async function makeDirectoryAsync(
  _uri: string,
  _opts?: { intermediates?: boolean },
): Promise<void> {
  return;
}

export async function getInfoAsync(uri: string): Promise<{ exists: boolean; uri: string; size?: number }> {
  return { exists: true, uri, size: 0 };
}

export async function deleteAsync(_uri: string, _opts?: { idempotent?: boolean }): Promise<void> {
  return;
}
