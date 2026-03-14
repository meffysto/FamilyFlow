export function redirectSystemPath({ path }: { path: string; initial: boolean }) {
  // Widget deep links: family-vault://open/meals → path reçu contient "open/"
  if (typeof path === 'string' && path.includes('open/')) {
    const screen = path.split('open/').pop() || '';
    return '/' + screen;
  }
  return path;
}
