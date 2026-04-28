/**
 * list-icons.tsx — Catalogue d'icônes lucide pour les listes de courses.
 *
 * Stocké en frontmatter sous forme de nom kebab-case (ex "shopping-cart").
 * Le helper renderListIcon mappe le nom au composant lucide.
 */

import React from 'react';
import {
  ShoppingCart,
  ShoppingBag,
  ShoppingBasket,
  Salad,
  Apple,
  Beef,
  Fish,
  Wine,
  Pill,
  Gift,
  Leaf,
  Croissant,
  Milk,
} from 'lucide-react-native';

export interface ListIconDef {
  name: string;
  Component: React.ComponentType<{ size?: number; color?: string }>;
}

export const LIST_ICONS: ListIconDef[] = [
  { name: 'shopping-cart', Component: ShoppingCart },
  { name: 'shopping-bag', Component: ShoppingBag },
  { name: 'shopping-basket', Component: ShoppingBasket },
  { name: 'salad', Component: Salad },
  { name: 'apple', Component: Apple },
  { name: 'beef', Component: Beef },
  { name: 'fish', Component: Fish },
  { name: 'wine', Component: Wine },
  { name: 'pill', Component: Pill },
  { name: 'gift', Component: Gift },
  { name: 'leaf', Component: Leaf },
  { name: 'croissant', Component: Croissant },
  { name: 'milk', Component: Milk },
];

const ICON_BY_NAME: Record<string, ListIconDef['Component']> = LIST_ICONS.reduce(
  (acc, def) => {
    acc[def.name] = def.Component;
    return acc;
  },
  {} as Record<string, ListIconDef['Component']>,
);

export function renderListIcon(name: string, size = 16, color?: string): React.ReactElement {
  const Component = ICON_BY_NAME[name] ?? ShoppingCart;
  return <Component size={size} color={color} />;
}
