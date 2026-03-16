/**
 * MarkdownText.tsx — Rendu markdown Obsidian-flavored
 *
 * Supporte : **gras**, *italique*, `code`, ~~barré~~, ==surligné==,
 * [[wikilinks]], [liens](url), #tags, listes (- / * / 1.),
 * cases à cocher (- [ ] / - [x]), titres (### / ##),
 * callouts Obsidian (> [!type]), blockquotes (>),
 * blocs de code (```), lignes horizontales (---),
 * retours à la ligne. Pas de dépendance externe.
 */

import React, { useCallback, useMemo } from 'react';
import { Text, View, StyleSheet, TextStyle, Linking } from 'react-native';
import { useThemeColors } from '../../contexts/ThemeContext';
import { FontSize, FontWeight, LineHeight } from '../../constants/typography';
import { Spacing, Radius } from '../../constants/spacing';

interface MarkdownTextProps {
  children: string;
  style?: TextStyle;
  /** Callback quand un wikilink est pressé — reçoit le nom de la note cible */
  onLinkPress?: (target: string) => void;
  /** Nombre max de lignes (tronque le rendu) */
  numberOfLines?: number;
}

// — Types segments inline —

type InlineSegment =
  | { type: 'text'; text: string }
  | { type: 'bold'; text: string }
  | { type: 'italic'; text: string }
  | { type: 'code'; text: string }
  | { type: 'strikethrough'; text: string }
  | { type: 'highlight'; text: string }
  | { type: 'wikilink'; target: string; alias: string }
  | { type: 'link'; text: string; url: string }
  | { type: 'tag'; name: string };

/**
 * Regex inline — groupes de capture :
 *   2,3 = [[wikilink|alias]]   4,5 = [texte](url)
 *   6 = ==highlight==          7 = **bold**
 *   8 = ~~strikethrough~~      9 = *italic*
 *   10 = `code`                11 = #tag
 * Note : pas de lookbehind pour les tags (Hermes ne supporte pas)
 */
const INLINE_RE =
  /(\[\[([^\]|]+?)(?:\|([^\]]+?))?\]\]|\[([^\]]+?)\]\(([^)]+?)\)|==(.+?)==|\*\*(.+?)\*\*|~~(.+?)~~|\*(.+?)\*|`(.+?)`|(?:^|\s)#([\w-]+))/g;

function parseInline(text: string): InlineSegment[] {
  const segments: InlineSegment[] = [];
  // Créer une copie pour reset lastIndex (regex globale partagée)
  const regex = new RegExp(INLINE_RE.source, 'g');
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match[11] !== undefined) {
      // Tag : le match inclut l'espace avant, on l'ajoute au texte précédent
      const fullMatch = match[0];
      const spacePrefix = fullMatch.startsWith('#') ? '' : fullMatch[0];
      const textBefore = text.slice(lastIndex, match.index) + spacePrefix;
      if (textBefore) {
        segments.push({ type: 'text', text: textBefore });
      }
      segments.push({ type: 'tag', name: match[11] });
      lastIndex = regex.lastIndex;
      continue;
    }

    // Texte avant le match
    if (match.index > lastIndex) {
      segments.push({ type: 'text', text: text.slice(lastIndex, match.index) });
    }

    if (match[2] !== undefined) {
      // Wikilink [[target]] ou [[target|alias]]
      segments.push({ type: 'wikilink', target: match[2], alias: match[3] ?? match[2] });
    } else if (match[4] !== undefined && match[5] !== undefined) {
      // External link [text](url)
      segments.push({ type: 'link', text: match[4], url: match[5] });
    } else if (match[6] !== undefined) {
      segments.push({ type: 'highlight', text: match[6] });
    } else if (match[7] !== undefined) {
      segments.push({ type: 'bold', text: match[7] });
    } else if (match[8] !== undefined) {
      segments.push({ type: 'strikethrough', text: match[8] });
    } else if (match[9] !== undefined) {
      segments.push({ type: 'italic', text: match[9] });
    } else if (match[10] !== undefined) {
      segments.push({ type: 'code', text: match[10] });
    }

    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) {
    segments.push({ type: 'text', text: text.slice(lastIndex) });
  }

  return segments;
}

// — Types blocs —

/** Types de callout Obsidian supportés */
type CalloutType =
  | 'note' | 'tip' | 'warning' | 'danger' | 'info'
  | 'example' | 'quote' | 'success' | 'question' | 'bug';

const CALLOUT_TYPES = new Set<string>([
  'note', 'tip', 'warning', 'danger', 'info',
  'example', 'quote', 'success', 'question', 'bug',
]);

type BlockNode =
  | { type: 'paragraph'; text: string }
  | { type: 'heading'; level: number; text: string }
  | { type: 'listItem'; text: string; ordered: boolean; index: number }
  | { type: 'checkbox'; text: string; checked: boolean }
  | { type: 'callout'; calloutType: CalloutType; title: string; content: string }
  | { type: 'blockquote'; text: string }
  | { type: 'codeBlock'; language: string; content: string }
  | { type: 'hr' }
  | { type: 'empty' };

/** Parse le markdown en blocs (avec callouts Obsidian).
 *  maxBlocks : si défini, arrête le parsing après N blocs non-vides (optimisation numberOfLines). */
function parseBlocks(md: string, maxBlocks?: number): BlockNode[] {
  const lines = md.split('\n');
  const blocks: BlockNode[] = [];
  let orderedIdx = 0;
  let blockCount = 0;
  let i = 0;

  while (i < lines.length) {
    const trimmed = lines[i].trim();

    // Ligne vide
    if (!trimmed) {
      blocks.push({ type: 'empty' });
      orderedIdx = 0;
      i++;
      continue;
    }

    // Short-circuit si on a atteint le max de blocs
    if (maxBlocks && blockCount >= maxBlocks) break;

    // Ligne horizontale (---, ***, ___)
    if (/^[-*_]{3,}$/.test(trimmed)) {
      blocks.push({ type: 'hr' });
      blockCount++;
      orderedIdx = 0;
      i++;
      continue;
    }

    // Bloc de code (``` ou ~~~)
    const codeMatch = trimmed.match(/^(`{3,}|~{3,})(\w*)$/);
    if (codeMatch) {
      const fence = codeMatch[1];
      const language = codeMatch[2] || '';
      const contentLines: string[] = [];
      i++;
      while (i < lines.length) {
        if (lines[i].trim().startsWith(fence.charAt(0).repeat(fence.length))) {
          i++;
          break;
        }
        contentLines.push(lines[i]);
        i++;
      }
      blocks.push({
        type: 'codeBlock',
        language,
        content: contentLines.join('\n'),
      });
      blockCount++;
      orderedIdx = 0;
      continue;
    }

    // Callout Obsidian : > [!type] titre optionnel
    const calloutMatch = trimmed.match(/^>\s*\[!(\w+)\]\s*(.*)$/);
    if (calloutMatch) {
      const rawType = calloutMatch[1].toLowerCase();
      const calloutType: CalloutType = CALLOUT_TYPES.has(rawType)
        ? (rawType as CalloutType)
        : 'note';
      const title = calloutMatch[2].trim() ||
        rawType.charAt(0).toUpperCase() + rawType.slice(1);
      const contentLines: string[] = [];
      i++;
      // Collecter les lignes qui continuent le callout (commencent par >)
      while (i < lines.length) {
        const nextTrimmed = lines[i].trim();
        if (nextTrimmed.startsWith('>')) {
          contentLines.push(nextTrimmed.replace(/^>\s?/, ''));
          i++;
        } else {
          break;
        }
      }
      blocks.push({
        type: 'callout',
        calloutType,
        title,
        content: contentLines.join('\n'),
      });
      blockCount++;
      orderedIdx = 0;
      continue;
    }

    // Blockquote simple (> texte, sans callout)
    if (/^>\s/.test(trimmed) || trimmed === '>') {
      const quoteLines: string[] = [trimmed.replace(/^>\s?/, '')];
      i++;
      while (i < lines.length) {
        const nextTrimmed = lines[i].trim();
        if (nextTrimmed.startsWith('>')) {
          quoteLines.push(nextTrimmed.replace(/^>\s?/, ''));
          i++;
        } else {
          break;
        }
      }
      blocks.push({ type: 'blockquote', text: quoteLines.join('\n') });
      blockCount++;
      orderedIdx = 0;
      continue;
    }

    // Titres (h1 à h6, rendu groupé h1/h2/h3+)
    const headingMatch = trimmed.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      blocks.push({ type: 'heading', level: Math.min(headingMatch[1].length, 3), text: headingMatch[2] });
      blockCount++;
      orderedIdx = 0;
      i++;
      continue;
    }

    // Checkbox (- [ ] ou - [x])
    const checkboxMatch = trimmed.match(/^[-*]\s+\[([ xX])\]\s+(.+)$/);
    if (checkboxMatch) {
      blocks.push({ type: 'checkbox', text: checkboxMatch[2], checked: checkboxMatch[1] !== ' ' });
      blockCount++;
      i++;
      continue;
    }

    // Liste non ordonnée
    const ulMatch = trimmed.match(/^[-*]\s+(.+)$/);
    if (ulMatch) {
      blocks.push({ type: 'listItem', text: ulMatch[1], ordered: false, index: 0 });
      blockCount++;
      i++;
      continue;
    }

    // Liste ordonnée
    const olMatch = trimmed.match(/^\d+[.)]\s+(.+)$/);
    if (olMatch) {
      orderedIdx++;
      blocks.push({ type: 'listItem', text: olMatch[1], ordered: true, index: orderedIdx });
      blockCount++;
      i++;
      continue;
    }

    // Paragraphe
    blocks.push({ type: 'paragraph', text: trimmed });
    blockCount++;
    orderedIdx = 0;
    i++;
  }

  return blocks;
}

// — Configuration visuelle des callouts —

interface CalloutConfig {
  icon: string;
  colorKey: 'info' | 'success' | 'warning' | 'error' | 'primary' | 'muted';
}

const CALLOUT_CONFIG: Record<CalloutType, CalloutConfig> = {
  note:     { icon: '📝', colorKey: 'info' },
  info:     { icon: 'ℹ️', colorKey: 'info' },
  question: { icon: '❓', colorKey: 'info' },
  tip:      { icon: '💡', colorKey: 'success' },
  success:  { icon: '✅', colorKey: 'success' },
  example:  { icon: '📋', colorKey: 'primary' },
  warning:  { icon: '⚠️', colorKey: 'warning' },
  danger:   { icon: '🔴', colorKey: 'error' },
  bug:      { icon: '🐛', colorKey: 'error' },
  quote:    { icon: '💬', colorKey: 'muted' },
};

// — Composant principal —

export const MarkdownText = React.memo(function MarkdownText({
  children,
  style,
  onLinkPress,
  numberOfLines,
}: MarkdownTextProps) {
  const { primary, colors } = useThemeColors();

  /** Blocs parsés — si numberOfLines est défini, parseBlocks s'arrête tôt */
  const blocks = useMemo(
    () => parseBlocks(children, numberOfLines ?? undefined),
    [children, numberOfLines],
  );

  /** Résoudre les couleurs d'un callout selon son colorKey */
  const getCalloutColors = useCallback(
    (colorKey: CalloutConfig['colorKey']) => {
      switch (colorKey) {
        case 'info':
          return { border: colors.info, bg: colors.infoBg };
        case 'success':
          return { border: colors.success, bg: colors.successBg };
        case 'warning':
          return { border: colors.warning, bg: colors.warningBg };
        case 'error':
          return { border: colors.error, bg: colors.errorBg };
        case 'primary':
          return { border: primary, bg: colors.infoBg };
        case 'muted':
          return { border: colors.textMuted, bg: colors.cardAlt };
      }
    },
    [colors, primary],
  );

  /** Rendu des segments inline avec styles */
  const renderInline = useCallback(
    (text: string, baseStyle: TextStyle) => {
      const segments = parseInline(text);
      if (segments.length === 1 && segments[0].type === 'text') {
        return <Text style={baseStyle}>{text}</Text>;
      }
      return (
        <Text style={baseStyle}>
          {segments.map((seg, i) => {
            switch (seg.type) {
              case 'bold':
                return (
                  <Text key={i} style={{ fontWeight: FontWeight.bold }}>
                    {seg.text}
                  </Text>
                );
              case 'italic':
                return (
                  <Text key={i} style={{ fontStyle: 'italic' }}>
                    {seg.text}
                  </Text>
                );
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
              case 'strikethrough':
                return (
                  <Text
                    key={i}
                    style={{
                      textDecorationLine: 'line-through',
                      color: colors.textMuted,
                    }}
                  >
                    {seg.text}
                  </Text>
                );
              case 'highlight':
                return (
                  <Text key={i} style={{ backgroundColor: colors.warningBg }}>
                    {seg.text}
                  </Text>
                );
              case 'wikilink':
                return (
                  <Text
                    key={i}
                    style={{ color: primary }}
                    onPress={() => onLinkPress?.(seg.target)}
                    accessibilityRole="link"
                    accessibilityLabel={`Lien vers ${seg.alias}`}
                  >
                    {seg.alias}
                  </Text>
                );
              case 'link':
                return (
                  <Text
                    key={i}
                    style={{ color: primary, textDecorationLine: 'underline' }}
                    onPress={() => Linking.openURL(seg.url)}
                    accessibilityRole="link"
                    accessibilityLabel={seg.text}
                  >
                    {seg.text}
                  </Text>
                );
              case 'tag':
                return (
                  <Text
                    key={i}
                    style={{ color: primary, fontSize: FontSize.caption }}
                  >
                    #{seg.name}
                  </Text>
                );
              default:
                return <Text key={i}>{(seg as InlineSegment & { text: string }).text}</Text>;
            }
          })}
        </Text>
      );
    },
    [colors, primary, onLinkPress],
  );

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

          case 'hr':
            return (
              <View
                key={i}
                style={[mdStyles.hr, { backgroundColor: colors.separator }]}
              />
            );

          case 'heading': {
            const headingSize =
              block.level === 1
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

          case 'checkbox':
            return (
              <View key={i} style={mdStyles.listRow}>
                <Text style={[mdStyles.checkboxIcon, { color: block.checked ? colors.success : colors.textMuted }]}>
                  {block.checked ? '☑' : '☐'}
                </Text>
                <View style={mdStyles.listContent}>
                  {renderInline(block.text, {
                    ...baseTextStyle,
                    ...(block.checked ? { textDecorationLine: 'line-through' as const, color: colors.textMuted } : {}),
                  })}
                </View>
              </View>
            );

          case 'listItem':
            return (
              <View key={i} style={mdStyles.listRow}>
                <Text style={[mdStyles.bullet, { color: primary }]}>
                  {block.ordered ? `${block.index}.` : '•'}
                </Text>
                <View style={mdStyles.listContent}>
                  {renderInline(block.text, baseTextStyle)}
                </View>
              </View>
            );

          case 'blockquote':
            return (
              <View
                key={i}
                style={[
                  mdStyles.blockquote,
                  { borderLeftColor: colors.textMuted, backgroundColor: colors.cardAlt },
                ]}
              >
                {renderInline(block.text, {
                  ...baseTextStyle,
                  fontStyle: 'italic',
                  color: colors.textSub,
                })}
              </View>
            );

          case 'codeBlock':
            return (
              <View
                key={i}
                style={[mdStyles.codeBlock, { backgroundColor: colors.inputBg }]}
              >
                <Text
                  style={[
                    mdStyles.codeBlockText,
                    { color: colors.text },
                  ]}
                >
                  {block.content}
                </Text>
              </View>
            );

          case 'paragraph':
            return (
              <View key={i} style={mdStyles.paragraph}>
                {renderInline(block.text, baseTextStyle)}
              </View>
            );

          case 'callout': {
            const config = CALLOUT_CONFIG[block.calloutType];
            const calloutColors = getCalloutColors(config.colorKey);
            return (
              <View
                key={i}
                style={[
                  mdStyles.callout,
                  {
                    borderLeftColor: calloutColors.border,
                    backgroundColor: calloutColors.bg,
                  },
                ]}
                accessibilityRole="summary"
                accessibilityLabel={`${block.calloutType} : ${block.title}`}
              >
                <View style={mdStyles.calloutHeader}>
                  <Text style={mdStyles.calloutIcon}>{config.icon}</Text>
                  <Text
                    style={[
                      mdStyles.calloutTitle,
                      { color: calloutColors.border },
                    ]}
                  >
                    {block.title}
                  </Text>
                </View>
                {block.content.length > 0 && (
                  <View style={mdStyles.calloutContent}>
                    {renderInline(block.content, {
                      ...baseTextStyle,
                      fontSize: FontSize.sm,
                      lineHeight: LineHeight.body,
                    })}
                  </View>
                )}
              </View>
            );
          }

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
  hr: {
    height: 1,
    marginVertical: Spacing.lg,
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
  checkboxIcon: {
    width: 22,
    fontSize: FontSize.body,
    lineHeight: LineHeight.loose,
  },
  listContent: {
    flex: 1,
  },
  // — Blockquote —
  blockquote: {
    borderLeftWidth: 3,
    borderRadius: Radius.sm,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    marginVertical: Spacing.sm,
  },
  // — Code block —
  codeBlock: {
    borderRadius: Radius.md,
    padding: Spacing.md,
    marginVertical: Spacing.sm,
  },
  codeBlockText: {
    fontFamily: 'Menlo',
    fontSize: FontSize.caption,
    lineHeight: FontSize.caption * 1.6,
  },
  // — Callout —
  callout: {
    borderLeftWidth: 3,
    borderRadius: Radius.md,
    padding: Spacing.md,
    marginVertical: Spacing.sm,
  },
  calloutHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginBottom: Spacing.xs,
  },
  calloutIcon: {
    fontSize: FontSize.lg,
  },
  calloutTitle: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
  },
  calloutContent: {
    marginLeft: Spacing['2xl'],
  },
});
