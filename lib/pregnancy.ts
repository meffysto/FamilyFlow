/** Fruit comparatif par semaine d'aménorrhée (SA) — taille du bébé */
const PREGNANCY_FRUITS: { emoji: string; label: string; sizeCm: number }[] = [
  /* SA 0–3  */ { emoji: '🌰', label: 'graine de pavot', sizeCm: 0 },
  /* SA 4    */ { emoji: '🌰', label: 'graine de pavot', sizeCm: 0.1 },
  /* SA 5    */ { emoji: '🫐', label: 'grain de poivre', sizeCm: 0.2 },
  /* SA 6    */ { emoji: '🫐', label: 'myrtille', sizeCm: 0.5 },
  /* SA 7    */ { emoji: '🫐', label: 'myrtille', sizeCm: 1 },
  /* SA 8    */ { emoji: '🫒', label: 'framboise', sizeCm: 1.5 },
  /* SA 9    */ { emoji: '🍇', label: 'raisin', sizeCm: 2.5 },
  /* SA 10   */ { emoji: '🍇', label: 'kumquat', sizeCm: 3 },
  /* SA 11   */ { emoji: '🫒', label: 'olive', sizeCm: 4 },
  /* SA 12   */ { emoji: '🍑', label: 'prune', sizeCm: 5.5 },
  /* SA 13   */ { emoji: '🍋', label: 'citron', sizeCm: 7 },
  /* SA 14   */ { emoji: '🍊', label: 'nectarine', sizeCm: 8.5 },
  /* SA 15   */ { emoji: '🍎', label: 'pomme', sizeCm: 10 },
  /* SA 16   */ { emoji: '🥑', label: 'avocat', sizeCm: 11.5 },
  /* SA 17   */ { emoji: '🍐', label: 'poire', sizeCm: 13 },
  /* SA 18   */ { emoji: '🫑', label: 'poivron', sizeCm: 14 },
  /* SA 19   */ { emoji: '🥭', label: 'mangue', sizeCm: 15 },
  /* SA 20   */ { emoji: '🍌', label: 'banane', sizeCm: 16.5 },
  /* SA 21   */ { emoji: '🥕', label: 'carotte', sizeCm: 26.5 },
  /* SA 22   */ { emoji: '🌽', label: 'épi de maïs', sizeCm: 27.5 },
  /* SA 23   */ { emoji: '🥝', label: 'grosse mangue', sizeCm: 28.5 },
  /* SA 24   */ { emoji: '🌽', label: 'épi de maïs', sizeCm: 30 },
  /* SA 25   */ { emoji: '🫛', label: 'rutabaga', sizeCm: 34.5 },
  /* SA 26   */ { emoji: '🥬', label: 'laitue', sizeCm: 35.5 },
  /* SA 27   */ { emoji: '🥦', label: 'chou-fleur', sizeCm: 36.5 },
  /* SA 28   */ { emoji: '🍆', label: 'aubergine', sizeCm: 37.5 },
  /* SA 29   */ { emoji: '🎃', label: 'courge butternut', sizeCm: 38.5 },
  /* SA 30   */ { emoji: '🥥', label: 'noix de coco', sizeCm: 40 },
  /* SA 31   */ { emoji: '🍍', label: 'ananas', sizeCm: 41 },
  /* SA 32   */ { emoji: '🍍', label: 'ananas', sizeCm: 42 },
  /* SA 33   */ { emoji: '🍍', label: 'ananas', sizeCm: 43.5 },
  /* SA 34   */ { emoji: '🍈', label: 'melon cantaloup', sizeCm: 45 },
  /* SA 35   */ { emoji: '🍈', label: 'melon', sizeCm: 46 },
  /* SA 36   */ { emoji: '🥬', label: 'romaine', sizeCm: 47 },
  /* SA 37   */ { emoji: '🥬', label: 'blette', sizeCm: 48.5 },
  /* SA 38   */ { emoji: '🍉', label: 'mini pastèque', sizeCm: 49.5 },
  /* SA 39   */ { emoji: '🍉', label: 'pastèque', sizeCm: 50 },
  /* SA 40   */ { emoji: '🎃', label: 'citrouille', sizeCm: 51 },
  /* SA 41+  */ { emoji: '🎃', label: 'citrouille', sizeCm: 51 },
];

export function getFruitForWeek(week: number): string {
  const idx = Math.min(Math.max(0, week), PREGNANCY_FRUITS.length - 1);
  return PREGNANCY_FRUITS[idx].emoji;
}

export function getSizeForWeek(week: number): number {
  const idx = Math.min(Math.max(0, week), PREGNANCY_FRUITS.length - 1);
  return PREGNANCY_FRUITS[idx].sizeCm;
}
