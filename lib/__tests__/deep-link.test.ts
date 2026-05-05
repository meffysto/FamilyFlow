import { parseStoryDeepLink } from '../deep-link';

describe('parseStoryDeepLink', () => {
  it('extrait storyId depuis family-vault://story/<id>', () => {
    expect(parseStoryDeepLink('family-vault://story/abc-123')).toEqual({ storyId: 'abc-123' });
  });

  it('décode les percent-encoded ids', () => {
    expect(parseStoryDeepLink('family-vault://story/abc%2D123')).toEqual({ storyId: 'abc-123' });
  });

  it('retourne null pour un id vide', () => {
    expect(parseStoryDeepLink('family-vault://story/')).toBeNull();
    expect(parseStoryDeepLink('family-vault://story')).toBeNull();
  });

  it('retourne null pour un host différent', () => {
    expect(parseStoryDeepLink('family-vault://import-note?url=x')).toBeNull();
    expect(parseStoryDeepLink('family-vault://open/meals')).toBeNull();
  });

  it('retourne null pour un scheme différent', () => {
    expect(parseStoryDeepLink('https://other.com/story/x')).toBeNull();
    expect(parseStoryDeepLink('familyvault://story/x')).toBeNull(); // sans tiret
  });

  it('retourne null pour une URL invalide sans throw', () => {
    expect(parseStoryDeepLink('not-a-url')).toBeNull();
    expect(parseStoryDeepLink('')).toBeNull();
    // @ts-expect-error — test runtime safety
    expect(parseStoryDeepLink(null)).toBeNull();
  });

  it('extrait le premier segment quand le path a plusieurs niveaux', () => {
    expect(parseStoryDeepLink('family-vault://story/abc/extra')).toEqual({ storyId: 'abc' });
  });
});
