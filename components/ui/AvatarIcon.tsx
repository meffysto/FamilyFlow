/**
 * AvatarIcon — rendu unifié des avatars de profil via icônes Lucide.
 *
 * Stockage : `Profile.avatar` reste un string. Deux formats supportés :
 *   - Nouveau : nom canonique d'icône (ex: "cat", "rabbit", "smile")
 *   - Legacy  : ancien emoji (ex: "👨", "🦊", "👧") — auto-migré via EMOJI_MIGRATION
 *
 * Fallback : si la valeur n'est ni connue dans le catalogue ni mappable,
 * affichage texte brut (compatibilité totale avec les vaults existants).
 */

import React from 'react';
import { View, Text, StyleSheet, type ViewStyle } from 'react-native';
import {
  User,
  UserCircle,
  UserRound,
  Smile,
  Baby,
  Cat,
  Dog,
  Rabbit,
  Bird,
  Fish,
  Turtle,
  Squirrel,
  Snail,
  PawPrint,
  Bug,
  Leaf,
  TreePine,
  Flower2,
  Sprout,
  Sun,
  Moon,
  Star,
  Sparkles,
  Rocket,
  Crown,
  Heart,
  Gem,
  Music,
  Palette,
  Gamepad2,
  BookOpen,
  Ghost,
  Bot,
  Drama,
  Wand,
  Briefcase,
  type LucideIcon,
} from 'lucide-react-native';
import { withAlpha } from '../../lib/colors';

/** Catalogue d'avatars Lucide — clé canonique = string serialisé en vault. */
export const AVATAR_CATALOG: Record<string, LucideIcon> = {
  // Personnes neutres
  user: User,
  'user-circle': UserCircle,
  'user-round': UserRound,
  smile: Smile,
  baby: Baby,
  // Animaux
  cat: Cat,
  dog: Dog,
  rabbit: Rabbit,
  bird: Bird,
  fish: Fish,
  turtle: Turtle,
  squirrel: Squirrel,
  snail: Snail,
  'paw-print': PawPrint,
  bug: Bug,
  // Nature & symboles
  leaf: Leaf,
  'tree-pine': TreePine,
  flower: Flower2,
  sprout: Sprout,
  sun: Sun,
  moon: Moon,
  star: Star,
  sparkles: Sparkles,
  // Loisirs & objets
  rocket: Rocket,
  crown: Crown,
  heart: Heart,
  gem: Gem,
  music: Music,
  palette: Palette,
  gamepad: Gamepad2,
  book: BookOpen,
  // Fantastiques
  ghost: Ghost,
  bot: Bot,
  drama: Drama,
  wand: Wand,
  // Travail
  briefcase: Briefcase,
};

/** Migration emoji legacy → clé du catalogue. */
export const EMOJI_MIGRATION: Record<string, string> = {
  // Adultes humains → User neutre
  '👨': 'user',
  '👩': 'user',
  '🧑': 'user',
  '👤': 'user',
  '👴': 'user-round',
  '👵': 'user-round',
  '🧔': 'user-round',
  '👱‍♀️': 'user-round',
  '👨‍💻': 'briefcase',
  '👩‍💻': 'briefcase',
  // Enfants humains → Smile neutre
  '👦': 'smile',
  '👧': 'smile',
  '🧒': 'smile',
  '👶': 'baby',
  '🍼': 'baby',
  '👼': 'sparkles',
  '🎒': 'book',
  '🐣': 'bird',
  // Animaux fréquents
  '🐶': 'dog',
  '🐱': 'cat',
  '🐰': 'rabbit',
  '🐻': 'paw-print',
  '🐼': 'paw-print',
  '🐯': 'paw-print',
  '🦁': 'paw-print',
  '🦊': 'paw-print',
  '🐸': 'turtle',
  '🐧': 'bird',
  '🦉': 'bird',
  '🐢': 'turtle',
  '🐌': 'snail',
  '🐠': 'fish',
  '🐟': 'fish',
  '🦋': 'bug',
  '🐝': 'bug',
  '🦄': 'sparkles',
  // Nature
  '🌟': 'star',
  '⭐': 'star',
  '🌙': 'moon',
  '☀️': 'sun',
  '🌳': 'tree-pine',
  '🌲': 'tree-pine',
  '🍃': 'leaf',
  '🌿': 'leaf',
  '🌸': 'flower',
  '🌷': 'flower',
  '🌹': 'flower',
  '🌊': 'palette',
  // Objets / loisirs
  '🚀': 'rocket',
  '👑': 'crown',
  '❤️': 'heart',
  '💎': 'gem',
  '🎵': 'music',
  '🎮': 'gamepad',
  '📚': 'book',
};

/** Résout n'importe quelle valeur avatar vers une clé du catalogue (ou null). */
export function resolveAvatarKey(value?: string): string | null {
  if (!value) return null;
  if (value in AVATAR_CATALOG) return value;
  if (value in EMOJI_MIGRATION) return EMOJI_MIGRATION[value];
  return null;
}

/** Liste des avatars proposés dans le picker, groupés. */
export const AVATAR_GROUPS: { id: string; label: string; keys: string[] }[] = [
  { id: 'people',  label: 'Personnes', keys: ['user', 'user-circle', 'user-round', 'smile', 'baby'] },
  { id: 'animals', label: 'Animaux',   keys: ['cat', 'dog', 'rabbit', 'bird', 'fish', 'turtle', 'squirrel', 'snail', 'paw-print', 'bug'] },
  { id: 'nature',  label: 'Nature',    keys: ['leaf', 'tree-pine', 'flower', 'sprout', 'sun', 'moon', 'star', 'sparkles'] },
  { id: 'hobby',   label: 'Loisirs',   keys: ['rocket', 'crown', 'heart', 'gem', 'music', 'palette', 'gamepad', 'book'] },
  { id: 'fun',     label: 'Fantaisie', keys: ['ghost', 'bot', 'drama', 'wand'] },
];

interface AvatarIconProps {
  /** Valeur avatar (clé catalogue ou emoji legacy) */
  name: string;
  /** Couleur primary du thème de profil */
  color: string;
  /** Diamètre du cercle (défaut 40) */
  size?: number;
  /** Style additionnel pour le wrapper */
  style?: ViewStyle;
  /** Fond plein au lieu de tinté (défaut false) */
  filled?: boolean;
}

export const AvatarIcon = React.memo(function AvatarIcon({
  name,
  color,
  size = 40,
  style,
  filled = false,
}: AvatarIconProps) {
  const key = resolveAvatarKey(name);
  const Icon = key ? AVATAR_CATALOG[key] : null;
  const iconSize = Math.round(size * 0.55);
  const bg = filled ? color : withAlpha(color, 0.14);
  const fg = filled ? '#FFFFFF' : color;

  return (
    <View
      style={[
        styles.circle,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: bg },
        style,
      ]}
    >
      {Icon ? (
        <Icon size={iconSize} strokeWidth={1.75} color={fg} />
      ) : (
        <Text style={{ fontSize: iconSize, color: fg }}>{name}</Text>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  circle: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
