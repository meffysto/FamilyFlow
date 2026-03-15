export function redirectSystemPath({ path }: { path: string; initial: boolean }) {
  // Widget deep links: family-vault://open/meals → path reçu contient "open/"
  if (typeof path === 'string' && path.includes('open/')) {
    // Séparer le path du query string
    const afterOpen = path.split('open/').pop() || '';
    const [screen, ...queryParts] = afterOpen.split('?');
    const query = queryParts.length > 0 ? '?' + queryParts.join('?') : '';
    return '/' + screen + query;
  }
  return path;
}
