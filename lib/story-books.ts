/**
 * story-books.ts — Helpers pour regrouper les histoires en livres (sagas multi-chapitres).
 *
 * Une histoire SANS livreId reste un livre implicite mono-chapitre (rétrocompat 100%).
 * Une histoire AVEC livreId rejoint le livre correspondant et se trie par numéro de chapitre.
 *
 * Pas de dépendance externe — slugify maison via String.normalize.
 */

import type { BedtimeStory, StoryUniverseId, StoryAgeRange } from './types';

export interface StoryBook {
  /** Slug stable du livre (ou story.id pour les livres implicites legacy) */
  livreId: string;
  /** Titre affichable du livre (fallback : titre du premier chapitre) */
  livreTitre: string;
  /** Enfant propriétaire (issu du premier chapitre) */
  enfantId: string;
  /** Univers du livre (issu du premier chapitre) */
  universId: StoryUniverseId;
  /** Tranche d'âge verrouillée (issue du premier chapitre, si définie) */
  trancheAge?: StoryAgeRange;
  /** Chapitres triés par chapitre asc — fallback ordre date asc si chapitre absent */
  chapters: BedtimeStory[];
  /** Union ordonnée des slugs personnages (premier chapitre d'apparition d'abord) */
  casting: string[];
  /** true = livre legacy mono-chapitre sans livreId — affichage carte simple */
  isImplicit: boolean;
}

/**
 * Regroupe les histoires en livres.
 * - Histoires SANS livreId → chacune devient un livre implicite mono-chapitre (livreId = story.id, isImplicit=true)
 * - Histoires AVEC livreId → groupées et triées par chapitre asc (fallback : ordre par date si chapitre absent)
 *
 * L'ordre de retour suit la date du dernier chapitre de chaque livre (descendant — plus récent en premier).
 */
export function groupStoriesByBook(stories: BedtimeStory[]): StoryBook[] {
  const booksMap = new Map<string, BedtimeStory[]>();
  const implicitOrder: string[] = []; // pour préserver l'ordre des stories sans livreId

  for (const story of stories) {
    if (story.livreId) {
      const existing = booksMap.get(story.livreId);
      if (existing) {
        existing.push(story);
      } else {
        booksMap.set(story.livreId, [story]);
      }
    } else {
      // Livre implicite : un seul chapitre, clé = story.id
      booksMap.set(story.id, [story]);
      implicitOrder.push(story.id);
    }
  }

  const books: StoryBook[] = [];
  for (const [livreId, chapters] of booksMap) {
    // Tri : par chapitre asc (chapitres définis d'abord), fallback date asc
    const sorted = [...chapters].sort((a, b) => {
      const aCh = typeof a.chapitre === 'number' ? a.chapitre : Number.MAX_SAFE_INTEGER;
      const bCh = typeof b.chapitre === 'number' ? b.chapitre : Number.MAX_SAFE_INTEGER;
      if (aCh !== bCh) return aCh - bCh;
      return a.date.localeCompare(b.date);
    });
    const first = sorted[0]!;
    const isImplicit = !first.livreId;
    const livreTitre = first.livreTitre ?? first.titre;
    books.push({
      livreId,
      livreTitre,
      enfantId: first.enfantId,
      universId: first.univers,
      trancheAge: first.trancheAge,
      chapters: sorted,
      casting: getBookCasting(sorted),
      isImplicit,
    });
  }

  // Tri global : livre dont le dernier chapitre est le plus récent en premier
  books.sort((a, b) => {
    const aLast = a.chapters[a.chapters.length - 1]?.date ?? '';
    const bLast = b.chapters[b.chapters.length - 1]?.date ?? '';
    return bLast.localeCompare(aLast);
  });

  return books;
}

/**
 * Union ordonnée (premier chapitre d'apparition d'abord) des slugs personnages.
 * Préserve l'ordre d'introduction — utile pour afficher le casting d'un livre.
 */
export function getBookCasting(chapters: BedtimeStory[]): string[] {
  const seen = new Set<string>();
  const ordered: string[] = [];
  for (const ch of chapters) {
    if (!ch.personnages) continue;
    for (const slug of ch.personnages) {
      if (!seen.has(slug)) {
        seen.add(slug);
        ordered.push(slug);
      }
    }
  }
  return ordered;
}

/**
 * max(chapitre) + 1, ou 2 si aucun chapitre numéroté trouvé (= le 1er chapitre était implicite).
 * Sert à construire le numéro du prochain chapitre à générer.
 */
export function getNextChapterNumber(chapters: BedtimeStory[]): number {
  let maxCh = 0;
  for (const ch of chapters) {
    if (typeof ch.chapitre === 'number' && ch.chapitre > maxCh) {
      maxCh = ch.chapitre;
    }
  }
  return maxCh > 0 ? maxCh + 1 : 2;
}

/**
 * Construit le payload "book" envoyé à generateBedtimeStory.
 * - previousChapterFullText : `texte` du chapitre N-1 entier
 * - olderSummaries : pour les chapitres < N-1, [{chapitre, titre, summary}] triés par chapitre asc
 *   (summary = memorySummary || fallback "<titre> — résumé manquant")
 */
export function buildBookContextForPrompt(book: StoryBook): {
  livreId: string;
  livreTitre: string;
  chapitre: number;
  lockedCasting: string[];
  previousChapterFullText: string;
  olderSummaries: Array<{ chapitre: number; titre: string; summary: string }>;
} {
  const nextChapter = getNextChapterNumber(book.chapters);
  const previous = book.chapters[book.chapters.length - 1];
  const previousText = previous?.texte ?? '';

  // Tous les chapitres sauf le dernier → résumés (triés par chapitre asc)
  const olders = book.chapters.slice(0, -1);
  const olderSummaries = olders
    .map((ch, idx) => {
      const num = typeof ch.chapitre === 'number' ? ch.chapitre : idx + 1;
      const titre = ch.chapitreTitre ?? ch.titre;
      const summary = ch.memorySummary && ch.memorySummary.trim().length > 0
        ? ch.memorySummary
        : `${titre} — résumé manquant`;
      return { chapitre: num, titre, summary };
    })
    .sort((a, b) => a.chapitre - b.chapitre);

  return {
    livreId: book.livreId,
    livreTitre: book.livreTitre,
    chapitre: nextChapter,
    lockedCasting: book.casting,
    previousChapterFullText: previousText,
    olderSummaries,
  };
}

/**
 * Slugify un titre de livre en kebab-case ASCII safe.
 * - lowercase
 * - normalise les accents (NFD + strip diacritics)
 * - remplace les non [a-z0-9]+ par '-'
 * - trim '-' debut/fin
 * - max 60 chars
 * Append `-<6-char timestamp>` (Date.now base36) pour garantir l'unicité entre livres.
 */
export function slugifyBookTitle(titre: string): string {
  const stripped = titre
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // strip diacritics (U+0300 → U+036F)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  const truncated = stripped.length > 60 ? stripped.slice(0, 60).replace(/-+$/, '') : stripped;
  const base = truncated.length > 0 ? truncated : 'livre';
  const suffix = Date.now().toString(36).slice(-6);
  return `${base}-${suffix}`;
}
