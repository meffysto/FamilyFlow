// ─── Stock — Emplacements & sous-catégories ─────────────────────────────────

export const EMPLACEMENTS = [
  { id: 'frigo', label: 'Frigo', emoji: '🧊' },
  { id: 'congelateur', label: 'Congélateur', emoji: '❄️' },
  { id: 'placards', label: 'Placards', emoji: '🗄️' },
  { id: 'bebe', label: 'Bébé & Hygiène', emoji: '👶' },
] as const;

export type EmplacementId = typeof EMPLACEMENTS[number]['id'];

// Sous-catégories par emplacement (vide = pas de sous-catégories)
export const SUBCATEGORIES: Record<EmplacementId, string[]> = {
  frigo: [],
  congelateur: [],
  placards: ['Épicerie', 'Conserves', 'Boissons', 'Petit-déjeuner', 'Condiments'],
  bebe: ['Couches', 'Hygiène & soins', 'Alimentation'],
};

// Mapping header markdown → emplacement
// Headers format: "## Frigo" ou "## Placards — Épicerie"
export function parseEmplacementFromHeader(header: string): { emplacement: EmplacementId; section?: string } | null {
  for (const emp of EMPLACEMENTS) {
    if (header === emp.label) return { emplacement: emp.id };
    if (header.startsWith(emp.label + ' — ')) {
      return { emplacement: emp.id, section: header.slice(emp.label.length + 3) };
    }
  }
  return null;
}

// Construit le header markdown depuis emplacement + sous-catégorie optionnelle
export function buildSectionHeader(emplacement: EmplacementId, section?: string): string {
  const emp = EMPLACEMENTS.find(e => e.id === emplacement);
  if (!emp) return '';
  return section ? `${emp.label} — ${section}` : emp.label;
}

// Anciens noms de sections (pré-refactoring) mappés vers emplacement bébé
export const LEGACY_BEBE_SECTIONS = new Set([
  'Couches', 'Hygiène & soins', 'Alimentation', 'Lait', 'Repas', 'Soins',
]);
