/**
 * Mock expo-print pour les tests Jest (environnement Node).
 */

export async function printToFileAsync(opts: {
  html: string;
  width?: number;
  height?: number;
  margins?: { left: number; top: number; right: number; bottom: number };
}): Promise<{ uri: string; numberOfPages: number }> {
  return {
    uri: `file:///mock/${opts.html.length}.pdf`,
    numberOfPages: 16,
  };
}
