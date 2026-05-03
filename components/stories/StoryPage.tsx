/**
 * StoryPage — Page d'histoire en mode picture-book.
 *
 * Une page = une scène = (illustration + texte + mots-clés colorés).
 * Fond papier cream `#F5EFE0`, typographie Patrick Hand, highlights teal.
 *
 * Pas d'animation reveal : les inner steps de stories.tsx sont des inner
 * functions qui remountent à chaque render parent. Une animation 0→1 sur
 * chaque mount = scintillement perçu. Rendu statique = stable.
 *
 * Quand `image` est null (univers non illustré), seul le texte est rendu —
 * le ressenti livre est préservé via la palette + la typo.
 */
import React, { useMemo } from 'react';
import { View, Text, Image, StyleSheet, type ImageSourcePropType } from 'react-native';
import { Radius, Spacing } from '../../constants/spacing';
import type { HighlightSpan } from '../../lib/types';

const PAGE_COLORS = {
  /** Fond papier — légèrement crème, pas blanc pur */
  cream: '#F5EFE0',
  /** Encre principale — bleu nuit profond */
  ink: '#2C3E50',
  /** Highlight mots-clés — teal foncé pour contraste lecture */
  teal: '#4F9396',
} as const;

interface StoryPageProps {
  /** Texte complet de la scène */
  text: string;
  /** Mots-clés à colorer (indices RELATIFS au texte de la scène) */
  highlights: HighlightSpan[];
  /** Illustration bundlée — null = pas d'image, texte seul */
  image: ImageSourcePropType | null;
  /** Affiche le ♡ teal en fin (dernière page de l'histoire) */
  isLast?: boolean;
}

export const StoryPage = React.memo(function StoryPage({
  text,
  highlights,
  image,
  isLast = false,
}: StoryPageProps) {
  // Découpe le texte en segments {plain, hl} pour rendre les mots-clés
  // colorés via <Text> imbriqués (preserve word-wrap natif RN).
  const segments = useMemo(() => splitWithHighlights(text, highlights), [text, highlights]);

  return (
    <View style={styles.page}>
      {image && (
        <Image
          source={image}
          style={styles.illustration}
          resizeMode="cover"
          accessibilityIgnoresInvertColors
        />
      )}
      <Text style={styles.text}>
        {segments.map((seg, i) =>
          seg.kind === 'hl' ? (
            <Text key={i} style={styles.highlight}>{seg.text}</Text>
          ) : (
            <Text key={i}>{seg.text}</Text>
          ),
        )}
      </Text>
      {isLast && <Text style={styles.endMark}>♡</Text>}
    </View>
  );
});

// ─── Helpers ────────────────────────────────────────────────────────────────

type Segment = { kind: 'plain' | 'hl'; text: string };

/**
 * Découpe `text` selon les `highlights` en segments alternés plain/hl.
 * Les highlights non-valides (indices hors texte ou se chevauchant) sont
 * ignorés silencieusement — le segment est rendu en plain. Tolérance
 * volontaire : on préfère afficher du texte non coloré qu'un crash.
 */
function splitWithHighlights(text: string, highlights: HighlightSpan[]): Segment[] {
  if (!highlights.length) return [{ kind: 'plain', text }];

  // Tri + filtre des highlights valides + déduplication des chevauchements
  const valid = highlights
    .filter(h => h.startChar >= 0 && h.endChar > h.startChar && h.endChar <= text.length)
    .sort((a, b) => a.startChar - b.startChar);

  const segments: Segment[] = [];
  let cursor = 0;
  for (const h of valid) {
    if (h.startChar < cursor) continue; // chevauchement avec un précédent — skip
    if (h.startChar > cursor) {
      segments.push({ kind: 'plain', text: text.slice(cursor, h.startChar) });
    }
    segments.push({ kind: 'hl', text: text.slice(h.startChar, h.endChar) });
    cursor = h.endChar;
  }
  if (cursor < text.length) {
    segments.push({ kind: 'plain', text: text.slice(cursor) });
  }
  return segments;
}

// Largeur commune image + texte. La vue est elle-même cream (le parchemin
// remplit tout l'écran), donc on s'aligne juste à 80% du viewport pour un
// livre lisible — pas de "boîte" autour de chaque scène.
const CONTENT_WIDTH = '80%' as const;

const styles = StyleSheet.create({
  page: {
    // Pas de bg ni de border ici : le parchemin = la vue (StoryBody/ScrollView).
    // Juste un séparateur vertical entre scènes successives.
    paddingVertical: Spacing.xl,
  },
  illustration: {
    width: CONTENT_WIDTH,
    aspectRatio: 1,
    alignSelf: 'center',
    borderRadius: Radius.lg,
    marginBottom: Spacing.xl,
    backgroundColor: PAGE_COLORS.cream, // évite flash blanc avant load
  },
  text: {
    width: CONTENT_WIDTH,
    alignSelf: 'center',
    fontFamily: 'PatrickHand_400Regular',
    fontSize: 20,
    lineHeight: 28,
    color: PAGE_COLORS.ink,
  },
  highlight: {
    color: PAGE_COLORS.teal,
    fontWeight: '700',
  },
  endMark: {
    width: CONTENT_WIDTH,
    alignSelf: 'center',
    fontFamily: 'PatrickHand_400Regular',
    fontSize: 26,
    color: PAGE_COLORS.teal,
    marginTop: Spacing.md,
  },
});
