/**
 * farm-theme.ts — Palette "cozy farm game" partagée entre les modals bâtiments
 *
 * Utilisé par : BuildingShopSheet, BuildingDetailSheet, VillageBuildingModal,
 * BuildingsCatalog, AtelierSheet, PortTradeModal, VillageTechSheet, MarketSheet,
 * SunriseReport, HarvestCardToast, app/(tabs)/tree.tsx, app/(tabs)/village.tsx
 *
 * Mode sombre = "Soir au village" : bleus nuit pour le parchemin, bois nocturne,
 * dorés intacts/amplifiés pour évoquer la lueur des lanternes.
 *
 * Usage idiomatique avec StyleSheet :
 *   const makeStyles = (farm: FarmPalette) => StyleSheet.create({ ... });
 *   const farm = useFarmPalette();
 *   const styles = useMemo(() => makeStyles(farm), [farm]);
 */

import { useMemo } from 'react';
import { useThemeColors } from '../contexts/ThemeContext';

export interface FarmPalette {
  woodDark: string;
  woodMed: string;
  woodLight: string;
  woodHighlight: string;
  parchment: string;
  parchmentDark: string;
  awningGreen: string;
  awningCream: string;
  awningStripeCount: number;
  brownText: string;
  brownTextSub: string;
  greenBtn: string;
  greenBtnShadow: string;
  greenBtnHighlight: string;
  woodBtn: string;
  woodBtnShadow: string;
  woodBtnHighlight: string;
  gold: string;
  goldText: string;
  orange: string;
  orangeShadow: string;
  progressGold: string;
  progressBg: string;
}

const FarmLight: FarmPalette = {
  // Bois
  woodDark: '#6B4226',
  woodMed: '#8B6914',
  woodLight: '#A0784C',
  woodHighlight: '#C4A265',
  // Parchemin
  parchment: '#FFF8EC',
  parchmentDark: '#F5E6C8',
  // Auvent
  awningGreen: '#6B9E4C',
  awningCream: '#F5E6C8',
  awningStripeCount: 9,
  // Texte brun
  brownText: '#5C3D1A',
  brownTextSub: '#7B5B35',
  // Bouton vert
  greenBtn: '#6AAE4E',
  greenBtnShadow: '#4E8A3A',
  greenBtnHighlight: '#8BC86A',
  // Bouton bois
  woodBtn: '#A0784C',
  woodBtnShadow: '#6B4226',
  woodBtnHighlight: '#C4A265',
  // Doré
  gold: '#FFD700',
  goldText: '#7B5300',
  // Orange réparation
  orange: '#E8943A',
  orangeShadow: '#B86E20',
  // Barre progression
  progressGold: '#E8C858',
  progressBg: '#E8DCC8',
};

const FarmDark: FarmPalette = {
  // Bois — nocturne (quasi-noir avec nuance chaude)
  woodDark: '#0F0A06',
  woodMed: '#3A2A18',
  woodLight: '#5C3F22',
  woodHighlight: '#7A5430',
  // Parchemin — bleu nuit (nouveau "papier" du soir)
  parchment: '#1F2A3A',
  parchmentDark: '#2A3850',
  // Auvent — vert mousse profond + bleu nuit clair
  awningGreen: '#3A6B2E',
  awningCream: '#2A3850',
  awningStripeCount: 9,
  // Texte — parchemin chaud (lisible sur bleu nuit)
  brownText: '#E8D4B0',
  brownTextSub: '#A89070',
  // Bouton vert (légèrement assombri pour rester lisible)
  greenBtn: '#5A9A3E',
  greenBtnShadow: '#3A6B2A',
  greenBtnHighlight: '#7AB85E',
  // Bouton bois
  woodBtn: '#5C3F22',
  woodBtnShadow: '#0F0A06',
  woodBtnHighlight: '#7A5430',
  // Doré — intact (lanterne). goldText = texte SUR fond doré → reste sombre
  // pour contraste lisible (dans les deux modes). Pour du texte doré sur fond
  // sombre, utiliser directement `gold`.
  gold: '#FFD700',
  goldText: '#5C3D1A',
  // Orange réparation (légèrement plus chaud pour ressortir)
  orange: '#F0A050',
  orangeShadow: '#A85A1A',
  // Barre progression
  progressGold: '#F0D060',
  progressBg: '#1A2030',
};

/** Palette claire — accès direct rétrocompat (legacy `Farm.x`). */
export const Farm = FarmLight;

/** Palette sombre — accès direct si besoin (rare). */
export const FarmDarkPalette = FarmDark;

/**
 * Hook : retourne la palette farm adaptée au thème courant + flag isDark.
 *
 * Pattern de consommation idiomatique avec StyleSheet précalculé :
 *   const makeStyles = (farm: FarmPalette) => StyleSheet.create({ ... });
 *   const stylesLight = makeStyles(Farm);
 *   const stylesDark = makeStyles(FarmDarkPalette);
 *   // dans le composant :
 *   const { farm, isDark } = useFarmTheme();
 *   const styles = isDark ? stylesDark : stylesLight;
 */
export function useFarmTheme(): { farm: FarmPalette; isDark: boolean } {
  const { isDark } = useThemeColors();
  return useMemo(
    () => ({ farm: isDark ? FarmDark : FarmLight, isDark }),
    [isDark],
  );
}
