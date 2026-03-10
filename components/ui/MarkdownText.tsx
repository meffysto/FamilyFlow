/**
 * MarkdownText.tsx — Rendu markdown léger pour texte IA
 *
 * Supporte : **gras**, *italique*, `code`, listes (- / * / 1.), titres (### / ##),
 * retours à la ligne. Pas de dépendance externe.
 */

import React, { useMemo } from 'react';
import { Text, View, StyleSheet, TextStyle, ViewStyle } from 'react-native';
import { useThemeColors } from '../../contexts/ThemeContext';
import { FontSize, FontWeight, LineHeight } from '../../constants/typography';
import { Spacing, Radius } from '../../constants/spacing';

interface MarkdownTextProps {
  children: string;
  style?: TextStyle;
}

type InlineSegment =
  | { type: 'text'; text: string }
  | { type: 'bold'; text: string }
  | { type: 'italic'; text: string }
  | { type: 'code'; text: string };

/** Parse les segments inline (**gras**, *italique*, `code`) */
function parseInline(text: string): InlineSegment[] {
  const segments: InlineSegment[] = [];
  const regex = /(\*\*(.+?)\*\*|\*(.+?)\*|`(.+?)`)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ type: 'text', text: text.slice(lastIndex, match.index) });
    }
    if (match[2]) {
      segments.push({ type: 'bold', text: match[2] });
    } else if (match[3]) {
      segments.push({ type: 'italic', text: match[3] });
    } else if (match[4]) {
      segments.push({ type: 'code', text: match[4] });
    }
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) {
    segments.push({ type: 'text', text: text.slice(lastIndex) });
  }

  return segments;
}

type BlockNode =
  | { type: 'paragraph'; text: string }
  | { type: 'heading'; level: number; text: string }
  | { type: 'listItem'; text: string; ordered: boolean; index: number }
  | { type: 'empty' };

/** Parse le markdown en blocs */
function parseBlocks(md: string): BlockNode[] {
  const lines = md.split('\n');
  const blocks: BlockNode[] = [];
  let orderedIdx = 0;

  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed) {
      blocks.push({ type: 'empty' });
      orderedIdx = 0;
      continue;
    }

    // Titres
    const headingMatch = trimmed.match(/^(#{1,3})\s+(.+)$/);
    if (headingMatch) {
      blocks.push({ type: 'heading', level: headingMatch[1].length, text: headingMatch[2] });
      orderedIdx = 0;
      continue;
    }

    // Liste non ordonnée
    const ulMatch = trimmed.match(/^[-*]\s+(.+)$/);
    if (ulMatch) {
      blocks.push({ type: 'listItem', text: ulMatch[1], ordered: false, index: 0 });
      continue;
    }

    // Liste ordonnée
    const olMatch = trimmed.match(/^\d+[.)]\s+(.+)$/);
    if (olMatch) {
      orderedIdx++;
      blocks.push({ type: 'listItem', text: olMatch[1], ordered: true, index: orderedIdx });
      continue;
    }

    // Paragraphe
    blocks.push({ type: 'paragraph', text: trimmed });
    orderedIdx = 0;
  }

  return blocks;
}

export const MarkdownText = React.memo(function MarkdownText({ children, style }: MarkdownTextProps) {
  const { primary, colors } = useThemeColors();

  const blocks = useMemo(() => parseBlocks(children), [children]);

  const renderInline = (text: string, baseStyle: TextStyle) => {
    const segments = parseInline(text);
    if (segments.length === 1 && segments[0].type === 'text') {
      return <Text style={baseStyle}>{text}</Text>;
    }
    return (
      <Text style={baseStyle}>
        {segments.map((seg, i) => {
          switch (seg.type) {
            case 'bold':
              return <Text key={i} style={{ fontWeight: FontWeight.bold }}>{seg.text}</Text>;
            case 'italic':
              return <Text key={i} style={{ fontStyle: 'italic' }}>{seg.text}</Text>;
            case 'code':
              return (
                <Text
                  key={i}
                  style={{
                    fontFamily: 'Menlo',
                    fontSize: FontSize.caption,
                    backgroundColor: colors.inputBg,
                    color: primary,
                  }}
                >
                  {seg.text}
                </Text>
              );
            default:
              return <Text key={i}>{seg.text}</Text>;
          }
        })}
      </Text>
    );
  };

  const textColor = style?.color ?? colors.text;
  const baseTextStyle: TextStyle = {
    fontSize: FontSize.body,
    lineHeight: LineHeight.loose,
    color: textColor,
    ...style,
  };

  return (
    <View style={mdStyles.container}>
      {blocks.map((block, i) => {
        switch (block.type) {
          case 'empty':
            return <View key={i} style={mdStyles.spacer} />;

          case 'heading': {
            const headingSize = block.level === 1
              ? FontSize.heading
              : block.level === 2
                ? FontSize.subtitle
                : FontSize.lg;
            return (
              <View key={i} style={mdStyles.headingWrap}>
                {renderInline(block.text, {
                  ...baseTextStyle,
                  fontSize: headingSize,
                  fontWeight: FontWeight.bold,
                  lineHeight: headingSize + 8,
                })}
              </View>
            );
          }

          case 'listItem':
            return (
              <View key={i} style={mdStyles.listRow}>
                <Text style={[mdStyles.bullet, { color: primary }]}>
                  {block.ordered ? `${block.index}.` : '\u2022'}
                </Text>
                <View style={mdStyles.listContent}>
                  {renderInline(block.text, baseTextStyle)}
                </View>
              </View>
            );

          case 'paragraph':
            return (
              <View key={i} style={mdStyles.paragraph}>
                {renderInline(block.text, baseTextStyle)}
              </View>
            );

          default:
            return null;
        }
      })}
    </View>
  );
});

const mdStyles = StyleSheet.create({
  container: {
    gap: 0,
  },
  spacer: {
    height: Spacing.md,
  },
  headingWrap: {
    marginTop: Spacing.md,
    marginBottom: Spacing.xs,
  },
  paragraph: {
    marginBottom: Spacing.xs,
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingLeft: Spacing.md,
    marginBottom: Spacing.xxs,
  },
  bullet: {
    width: 18,
    fontSize: FontSize.body,
    lineHeight: LineHeight.loose,
    fontWeight: FontWeight.bold,
  },
  listContent: {
    flex: 1,
  },
});
