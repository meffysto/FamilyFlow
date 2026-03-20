export function redirectSystemPath({ path }: { path: string; initial: boolean }) {
  // Import note deep link: family-vault://import-note?url=https://...
  if (typeof path === 'string' && path.includes('import-note')) {
    const urlMatch = path.match(/[?&]url=([^&]+)/);
    const url = urlMatch ? urlMatch[1] : '';
    return `/notes?importUrl=${url}`;
  }

  // Widget deep links: family-vault://open/meals → path reçu contient "open/"
  if (typeof path === 'string' && path.includes('open/')) {
    const afterOpen = path.split('open/').pop() || '';
    const [screen, ...queryParts] = afterOpen.split('?');
    const query = queryParts.length > 0 ? '?' + queryParts.join('?') : '';
    return '/' + screen + query;
  }
  return path;
}
