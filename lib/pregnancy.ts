/** Fruit comparatif par semaine d'aménorrhée (SA) — taille du bébé */
const PREGNANCY_FRUITS: { emoji: string; label: string }[] = [
  /* SA 0–3  */ { emoji: '🌰', label: 'graine de pavot' },
  /* SA 4    */ { emoji: '🌰', label: 'graine de pavot' },
  /* SA 5    */ { emoji: '🫐', label: 'grain de poivre' },
  /* SA 6    */ { emoji: '🫐', label: 'myrtille' },
  /* SA 7    */ { emoji: '🫐', label: 'myrtille' },
  /* SA 8    */ { emoji: '🫒', label: 'framboise' },
  /* SA 9    */ { emoji: '🍇', label: 'raisin' },
  /* SA 10   */ { emoji: '🍇', label: 'kumquat' },
  /* SA 11   */ { emoji: '🫒', label: 'olive' },
  /* SA 12   */ { emoji: '🍑', label: 'prune' },
  /* SA 13   */ { emoji: '🍋', label: 'citron' },
  /* SA 14   */ { emoji: '🍊', label: 'nectarine' },
  /* SA 15   */ { emoji: '🍎', label: 'pomme' },
  /* SA 16   */ { emoji: '🥑', label: 'avocat' },
  /* SA 17   */ { emoji: '🍐', label: 'poire' },
  /* SA 18   */ { emoji: '🫑', label: 'poivron' },
  /* SA 19   */ { emoji: '🥭', label: 'mangue' },
  /* SA 20   */ { emoji: '🍌', label: 'banane' },
  /* SA 21   */ { emoji: '🥕', label: 'carotte' },
  /* SA 22   */ { emoji: '🌽', label: 'épi de maïs' },
  /* SA 23   */ { emoji: '🥝', label: 'grosse mangue' },
  /* SA 24   */ { emoji: '🌽', label: 'épi de maïs' },
  /* SA 25   */ { emoji: '🫛', label: 'rutabaga' },
  /* SA 26   */ { emoji: '🥬', label: 'laitue' },
  /* SA 27   */ { emoji: '🥦', label: 'chou-fleur' },
  /* SA 28   */ { emoji: '🍆', label: 'aubergine' },
  /* SA 29   */ { emoji: '🎃', label: 'courge butternut' },
  /* SA 30   */ { emoji: '🥥', label: 'noix de coco' },
  /* SA 31   */ { emoji: '🍍', label: 'ananas' },
  /* SA 32   */ { emoji: '🍍', label: 'ananas' },
  /* SA 33   */ { emoji: '🍍', label: 'ananas' },
  /* SA 34   */ { emoji: '🍈', label: 'melon cantaloup' },
  /* SA 35   */ { emoji: '🍈', label: 'melon' },
  /* SA 36   */ { emoji: '🥬', label: 'romaine' },
  /* SA 37   */ { emoji: '🥬', label: 'blette' },
  /* SA 38   */ { emoji: '🍉', label: 'mini pastèque' },
  /* SA 39   */ { emoji: '🍉', label: 'pastèque' },
  /* SA 40   */ { emoji: '🎃', label: 'citrouille' },
  /* SA 41+  */ { emoji: '🎃', label: 'citrouille' },
];

export function getFruitForWeek(week: number): string {
  const idx = Math.min(Math.max(0, week), PREGNANCY_FRUITS.length - 1);
  return PREGNANCY_FRUITS[idx].emoji;
}

export function getFruitLabel(week: number): string {
  const idx = Math.min(Math.max(0, week), PREGNANCY_FRUITS.length - 1);
  return PREGNANCY_FRUITS[idx].label;
}
