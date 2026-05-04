// lib/pdf/text-splitter.ts — Découpe d'un texte en N sections équilibrées (mode B).
// Utilisé par renderModeBPages pour distribuer le récit sur 6 doubles-pages.
//
// Garanties (Plan 49-04 §122-282) :
// - Retourne EXACTEMENT n entrées (jamais 0, jamais > n)
// - Pas de mot coupé
// - Concat des sections (avec espace) ≈ texte d'origine modulo whitespace
// - Pure function — déterministe, sans Date.now / Math.random

/**
 * Découpe un texte en N sections équilibrées par longueur, en respectant les
 * frontières de phrase ([.!?] suivi d'espace ou fin). Fallback sur frontières
 * de mot si moins de N phrases.
 */
export function splitTextIntoSections(text: string, n: number = 6): string[] {
  if (n < 1) throw new Error('n must be >= 1');
  const trimmed = text.trim();
  if (trimmed.length === 0) {
    return Array.from({ length: n }, () => '');
  }

  // 1. Frontières phrase
  const sentenceBoundaries: number[] = [];
  const re = /[.!?]+(?:\s+|$)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(trimmed)) !== null) {
    sentenceBoundaries.push(m.index + m[0].length);
  }

  // Si moins de n phrases → fallback frontières mot
  if (sentenceBoundaries.length < n) {
    return splitOnWordBoundaries(trimmed, n);
  }

  const targetLen = trimmed.length / n;
  const sections: string[] = [];
  let cursor = 0;
  for (let i = 0; i < n; i++) {
    if (i === n - 1) {
      sections.push(trimmed.slice(cursor).trim());
      break;
    }
    const targetEnd = Math.round((i + 1) * targetLen);
    let bestBoundary = -1;
    let bestDist = Infinity;
    for (const b of sentenceBoundaries) {
      if (b <= cursor) continue;
      const dist = Math.abs(b - targetEnd);
      if (dist < bestDist) {
        bestDist = dist;
        bestBoundary = b;
      }
    }
    if (bestBoundary === -1) {
      sections.push(trimmed.slice(cursor).trim());
      while (sections.length < n) sections.push('');
      return sections;
    }
    sections.push(trimmed.slice(cursor, bestBoundary).trim());
    cursor = bestBoundary;
  }

  while (sections.length < n) sections.push('');
  return sections.slice(0, n);
}

function splitOnWordBoundaries(text: string, n: number): string[] {
  const targetLen = text.length / n;
  const sections: string[] = [];
  let cursor = 0;
  for (let i = 0; i < n; i++) {
    if (i === n - 1) {
      sections.push(text.slice(cursor).trim());
      break;
    }
    const targetEnd = Math.round((i + 1) * targetLen);
    let boundary = text.indexOf(' ', targetEnd);
    if (boundary === -1 || boundary <= cursor) boundary = text.length;
    sections.push(text.slice(cursor, boundary).trim());
    cursor = boundary;
  }
  while (sections.length < n) sections.push('');
  return sections.slice(0, n);
}
