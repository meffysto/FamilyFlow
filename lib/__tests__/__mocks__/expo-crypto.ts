/**
 * Mock expo-crypto pour les tests Jest — utilise crypto Node natif pour SHA-256.
 */

import { createHash } from 'crypto';

export const CryptoDigestAlgorithm = {
  SHA1: 'SHA-1',
  SHA256: 'SHA-256',
  SHA384: 'SHA-384',
  SHA512: 'SHA-512',
  MD2: 'MD2',
  MD4: 'MD4',
  MD5: 'MD5',
} as const;

export const CryptoEncoding = {
  HEX: 'hex',
  BASE64: 'base64',
} as const;

export async function digestStringAsync(
  algorithm: string,
  data: string,
  options?: { encoding?: string },
): Promise<string> {
  const algo = algorithm.toLowerCase().replace('-', '');
  const hash = createHash(algo);
  hash.update(data, 'utf8');
  return hash.digest((options?.encoding as 'hex' | 'base64') ?? 'hex');
}
