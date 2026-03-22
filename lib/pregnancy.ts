import { t } from 'i18next';

/**
 * Fruit comparatif par semaine d'aménorrhée (SA) — taille estimée du bébé
 *
 * SA 4–13 : longueur cranio-caudale (CRL)
 * SA 14+  : taille totale estimée (tête aux pieds)
 * Sources : courbes Hadlock, CNGOF, OMS (50e percentile)
 */
const PREGNANCY_FRUITS: { emoji: string; labelKey: string; sizeCm: number }[] = [
  /* SA 0    */ { emoji: '🌱', labelKey: 'pregnancy.fruits.sa0', sizeCm: 0 },
  /* SA 1    */ { emoji: '🌱', labelKey: 'pregnancy.fruits.sa1', sizeCm: 0 },
  /* SA 2    */ { emoji: '🌱', labelKey: 'pregnancy.fruits.sa2', sizeCm: 0 },
  /* SA 3    */ { emoji: '🌱', labelKey: 'pregnancy.fruits.sa3', sizeCm: 0 },
  /* SA 4    */ { emoji: '🌱', labelKey: 'pregnancy.fruits.sa4', sizeCm: 0.1 },
  /* SA 5    */ { emoji: '🍚', labelKey: 'pregnancy.fruits.sa5', sizeCm: 0.2 },
  /* SA 6    */ { emoji: '🫐', labelKey: 'pregnancy.fruits.sa6', sizeCm: 0.4 },
  /* SA 7    */ { emoji: '🫐', labelKey: 'pregnancy.fruits.sa7', sizeCm: 1 },
  /* SA 8    */ { emoji: '🫘', labelKey: 'pregnancy.fruits.sa8', sizeCm: 1.6 },
  /* SA 9    */ { emoji: '🍇', labelKey: 'pregnancy.fruits.sa9', sizeCm: 2.3 },
  /* SA 10   */ { emoji: '🫒', labelKey: 'pregnancy.fruits.sa10', sizeCm: 3 },
  /* SA 11   */ { emoji: '🍓', labelKey: 'pregnancy.fruits.sa11', sizeCm: 4 },
  /* SA 12   */ { emoji: '🍋‍🟩', labelKey: 'pregnancy.fruits.sa12', sizeCm: 5.5 },
  /* SA 13   */ { emoji: '🥝', labelKey: 'pregnancy.fruits.sa13', sizeCm: 7 },
  /* SA 14   */ { emoji: '🍋', labelKey: 'pregnancy.fruits.sa14', sizeCm: 14.5 },
  /* SA 15   */ { emoji: '🍊', labelKey: 'pregnancy.fruits.sa15', sizeCm: 17 },
  /* SA 16   */ { emoji: '🥑', labelKey: 'pregnancy.fruits.sa16', sizeCm: 18.5 },
  /* SA 17   */ { emoji: '🍐', labelKey: 'pregnancy.fruits.sa17', sizeCm: 20.5 },
  /* SA 18   */ { emoji: '🫑', labelKey: 'pregnancy.fruits.sa18', sizeCm: 22 },
  /* SA 19   */ { emoji: '🥭', labelKey: 'pregnancy.fruits.sa19', sizeCm: 24 },
  /* SA 20   */ { emoji: '🍌', labelKey: 'pregnancy.fruits.sa20', sizeCm: 25.5 },
  /* SA 21   */ { emoji: '🥕', labelKey: 'pregnancy.fruits.sa21', sizeCm: 27 },
  /* SA 22   */ { emoji: '🌽', labelKey: 'pregnancy.fruits.sa22', sizeCm: 28 },
  /* SA 23   */ { emoji: '🍆', labelKey: 'pregnancy.fruits.sa23', sizeCm: 29 },
  /* SA 24   */ { emoji: '🥒', labelKey: 'pregnancy.fruits.sa24', sizeCm: 30 },
  /* SA 25   */ { emoji: '🥦', labelKey: 'pregnancy.fruits.sa25', sizeCm: 34 },
  /* SA 26   */ { emoji: '🥬', labelKey: 'pregnancy.fruits.sa26', sizeCm: 35.5 },
  /* SA 27   */ { emoji: '🥥', labelKey: 'pregnancy.fruits.sa27', sizeCm: 36.5 },
  /* SA 28   */ { emoji: '🍠', labelKey: 'pregnancy.fruits.sa28', sizeCm: 37.5 },
  /* SA 29   */ { emoji: '🎃', labelKey: 'pregnancy.fruits.sa29', sizeCm: 39 },
  /* SA 30   */ { emoji: '🥬', labelKey: 'pregnancy.fruits.sa30', sizeCm: 40 },
  /* SA 31   */ { emoji: '🥥', labelKey: 'pregnancy.fruits.sa31', sizeCm: 41 },
  /* SA 32   */ { emoji: '🍍', labelKey: 'pregnancy.fruits.sa32', sizeCm: 42.5 },
  /* SA 33   */ { emoji: '🥒', labelKey: 'pregnancy.fruits.sa33', sizeCm: 43.5 },
  /* SA 34   */ { emoji: '🎃', labelKey: 'pregnancy.fruits.sa34', sizeCm: 45 },
  /* SA 35   */ { emoji: '🍈', labelKey: 'pregnancy.fruits.sa35', sizeCm: 46 },
  /* SA 36   */ { emoji: '🥬', labelKey: 'pregnancy.fruits.sa36', sizeCm: 47 },
  /* SA 37   */ { emoji: '🍐', labelKey: 'pregnancy.fruits.sa37', sizeCm: 48 },
  /* SA 38   */ { emoji: '🎃', labelKey: 'pregnancy.fruits.sa38', sizeCm: 49 },
  /* SA 39   */ { emoji: '🍉', labelKey: 'pregnancy.fruits.sa39', sizeCm: 50 },
  /* SA 40   */ { emoji: '🍉', labelKey: 'pregnancy.fruits.sa40', sizeCm: 51 },
  /* SA 41+  */ { emoji: '🍉', labelKey: 'pregnancy.fruits.sa41', sizeCm: 52 },
];

export function getFruitForWeek(week: number): string {
  const idx = Math.min(Math.max(0, week), PREGNANCY_FRUITS.length - 1);
  return PREGNANCY_FRUITS[idx].emoji;
}

export function getSizeForWeek(week: number): number {
  const idx = Math.min(Math.max(0, week), PREGNANCY_FRUITS.length - 1);
  return PREGNANCY_FRUITS[idx].sizeCm;
}

export function getFruitLabel(week: number): string {
  const idx = Math.min(Math.max(0, week), PREGNANCY_FRUITS.length - 1);
  return t(PREGNANCY_FRUITS[idx].labelKey);
}

export function getFruitLabelKey(week: number): string {
  const idx = Math.min(Math.max(0, week), PREGNANCY_FRUITS.length - 1);
  return PREGNANCY_FRUITS[idx].labelKey;
}
