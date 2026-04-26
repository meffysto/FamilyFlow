/**
 * useSeason.ts — Hook saison courante avec rafraîchissement quotidien.
 *
 * Reactif aux changements de date (utile si l'app reste ouverte des heures
 * en arrière-plan et passe minuit). Re-render minimal : la saison ne change
 * que ~4 fois par an, l'effet ne s'active qu'aux limites de mois.
 */

import { useEffect, useState } from 'react';
import { SEASON_THEME, getCurrentSeason, type Season, type SeasonTheme } from '../constants/season';

export interface UseSeasonResult {
  season: Season;
  theme: SeasonTheme;
}

export function useSeason(): UseSeasonResult {
  const [season, setSeason] = useState<Season>(() => getCurrentSeason());

  useEffect(() => {
    // Rafraîchit la saison une fois par heure (capte les changements à minuit
    // sans abuser de timers ; précision suffisante pour 4 transitions/an).
    const id = setInterval(() => {
      const next = getCurrentSeason();
      setSeason((prev) => (prev === next ? prev : next));
    }, 60 * 60 * 1000);
    return () => clearInterval(id);
  }, []);

  return { season, theme: SEASON_THEME[season] };
}
