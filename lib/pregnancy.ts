/**
 * Fruit comparatif par semaine d'aménorrhée (SA) — taille estimée du bébé
 *
 * SA 4–13 : longueur cranio-caudale (CRL)
 * SA 14+  : taille totale estimée (tête aux pieds)
 * Sources : courbes Hadlock, CNGOF, OMS (50e percentile)
 */
const PREGNANCY_FRUITS: { emoji: string; label: string; sizeCm: number }[] = [
  /* SA 0    */ { emoji: '🌰', label: 'graine de pavot', sizeCm: 0 },
  /* SA 1    */ { emoji: '🌰', label: 'graine de pavot', sizeCm: 0 },
  /* SA 2    */ { emoji: '🌰', label: 'graine de pavot', sizeCm: 0 },
  /* SA 3    */ { emoji: '🌰', label: 'graine de pavot', sizeCm: 0 },
  /* SA 4    */ { emoji: '🌰', label: 'graine de pavot', sizeCm: 0.1 },
  /* SA 5    */ { emoji: '🫘', label: 'graine de sésame', sizeCm: 0.2 },
  /* SA 6    */ { emoji: '🫐', label: 'lentille', sizeCm: 0.4 },
  /* SA 7    */ { emoji: '🫐', label: 'myrtille', sizeCm: 1 },
  /* SA 8    */ { emoji: '🫘', label: 'haricot sec', sizeCm: 1.6 },
  /* SA 9    */ { emoji: '🍇', label: 'grain de raisin', sizeCm: 2.3 },
  /* SA 10   */ { emoji: '🫒', label: 'olive', sizeCm: 3 },
  /* SA 11   */ { emoji: '🍓', label: 'fraise', sizeCm: 4 },
  /* SA 12   */ { emoji: '🍋', label: 'citron vert', sizeCm: 5.5 },
  /* SA 13   */ { emoji: '🥝', label: 'kiwi', sizeCm: 7 },
  /* SA 14   */ { emoji: '🍋', label: 'citron', sizeCm: 14.5 },
  /* SA 15   */ { emoji: '🍊', label: 'clémentine', sizeCm: 17 },
  /* SA 16   */ { emoji: '🥑', label: 'avocat', sizeCm: 18.5 },
  /* SA 17   */ { emoji: '🍐', label: 'poire', sizeCm: 20.5 },
  /* SA 18   */ { emoji: '🫑', label: 'poivron', sizeCm: 22 },
  /* SA 19   */ { emoji: '🥭', label: 'mangue', sizeCm: 24 },
  /* SA 20   */ { emoji: '🍌', label: 'banane', sizeCm: 25.5 },
  /* SA 21   */ { emoji: '🥕', label: 'carotte', sizeCm: 27 },
  /* SA 22   */ { emoji: '🌽', label: 'épi de maïs', sizeCm: 28 },
  /* SA 23   */ { emoji: '🍆', label: 'aubergine', sizeCm: 29 },
  /* SA 24   */ { emoji: '🥒', label: 'concombre', sizeCm: 30 },
  /* SA 25   */ { emoji: '🥦', label: 'brocoli', sizeCm: 34 },
  /* SA 26   */ { emoji: '🥬', label: 'laitue', sizeCm: 35.5 },
  /* SA 27   */ { emoji: '🥥', label: 'noix de coco', sizeCm: 36.5 },
  /* SA 28   */ { emoji: '🍆', label: 'grande aubergine', sizeCm: 37.5 },
  /* SA 29   */ { emoji: '🎃', label: 'petite courge', sizeCm: 39 },
  /* SA 30   */ { emoji: '🥬', label: 'chou', sizeCm: 40 },
  /* SA 31   */ { emoji: '🥥', label: 'grosse noix de coco', sizeCm: 41 },
  /* SA 32   */ { emoji: '🍍', label: 'ananas', sizeCm: 42.5 },
  /* SA 33   */ { emoji: '🍍', label: 'gros ananas', sizeCm: 43.5 },
  /* SA 34   */ { emoji: '🎃', label: 'courge butternut', sizeCm: 45 },
  /* SA 35   */ { emoji: '🍈', label: 'melon', sizeCm: 46 },
  /* SA 36   */ { emoji: '🥬', label: 'romaine', sizeCm: 47 },
  /* SA 37   */ { emoji: '🥒', label: 'poireau', sizeCm: 48 },
  /* SA 38   */ { emoji: '🎃', label: 'citrouille', sizeCm: 49 },
  /* SA 39   */ { emoji: '🍉', label: 'petit melon d\'eau', sizeCm: 50 },
  /* SA 40   */ { emoji: '🍉', label: 'melon d\'eau', sizeCm: 51 },
  /* SA 41+  */ { emoji: '🍉', label: 'gros melon d\'eau', sizeCm: 52 },
];

export function getFruitForWeek(week: number): string {
  const idx = Math.min(Math.max(0, week), PREGNANCY_FRUITS.length - 1);
  return PREGNANCY_FRUITS[idx].emoji;
}

export function getSizeForWeek(week: number): number {
  const idx = Math.min(Math.max(0, week), PREGNANCY_FRUITS.length - 1);
  return PREGNANCY_FRUITS[idx].sizeCm;
}
