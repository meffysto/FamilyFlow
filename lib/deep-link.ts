// lib/deep-link.ts — Parsing deep links Family Vault.
// Phase 50 (QR audio) : extraction storyId depuis family-vault://story/<id>.
// Pattern pur testable Jest, zéro dépendance native.

export interface ParsedStoryLink {
  storyId: string;
}

const STORY_SCHEME = 'family-vault:';
const STORY_HOST = 'story';

/**
 * Parse une URL deep link Family Vault story.
 * @param href URL brute reçue (depuis QR scan ou Linking)
 * @returns `{ storyId }` si match, `null` sinon (jamais throw)
 *
 * @example
 * parseStoryDeepLink('family-vault://story/abc-123') // { storyId: 'abc-123' }
 * parseStoryDeepLink('family-vault://story/')        // null
 * parseStoryDeepLink('https://x.com/story/abc')       // null
 */
export function parseStoryDeepLink(href: string): ParsedStoryLink | null {
  if (typeof href !== 'string' || href.length === 0) return null;
  try {
    const url = new URL(href);
    if (url.protocol !== STORY_SCHEME) return null;
    if (url.host !== STORY_HOST) return null;
    // Premier segment du path uniquement, trim slashes
    const firstSegment = url.pathname.replace(/^\/+/, '').split('/')[0] ?? '';
    if (!firstSegment) return null;
    return { storyId: decodeURIComponent(firstSegment) };
  } catch {
    return null;
  }
}
