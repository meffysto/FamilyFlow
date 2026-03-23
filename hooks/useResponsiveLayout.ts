/**
 * useResponsiveLayout.ts — Hook responsive pour adapter les grilles iPad/iPhone
 *
 * Utilise useWindowDimensions (se met a jour a la rotation) au lieu de
 * Dimensions.get('window') (valeur statique).
 */

import { useWindowDimensions } from 'react-native';

export function useResponsiveLayout() {
  const { width, height } = useWindowDimensions();

  const isTablet = width >= 768;

  return {
    width,
    height,
    isTablet,
    // Nombre de colonnes pour les grilles photos (3 sur tel, 5 sur tablette)
    photoColumns: isTablet ? 5 : 3,
    // Largeur max pour contraindre les grilles calendrier sur grand ecran
    contentMaxWidth: 700,
  };
}
