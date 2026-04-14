/**
 * farm-theme.ts — Palette "cozy farm game" partagée entre les modals bâtiments
 *
 * Utilisé par : BuildingShopSheet, BuildingDetailSheet,
 * VillageBuildingModal, BuildingsCatalog, AtelierSheet, PortTradeModal, VillageTechSheet
 */

export const Farm = {
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
} as const;
