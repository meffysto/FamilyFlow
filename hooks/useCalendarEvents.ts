/**
 * useCalendarEvents.ts — Hook qui agrège les données vault en événements calendrier
 */

import { useEffect, useMemo, useState } from 'react';
import { format, startOfMonth, endOfMonth, startOfWeek, addWeeks, parseISO, eachDayOfInterval } from 'date-fns';
import { useVault } from '../contexts/VaultContext';
import { aggregateCalendarEvents, resolveMealsForRange, indexByDate, type AggregatorInput, type DateRange } from '../lib/calendar-aggregator';
import type { CalendarEvent } from '../lib/calendar-types';
import type { MealItem } from '../lib/types';

interface UseCalendarEventsResult {
  events: CalendarEvent[];
  eventsByDate: Record<string, CalendarEvent[]>;
  isLoadingMeals: boolean;
  vacationDates: Set<string>;
}

export function useCalendarEvents(displayMonth: Date): UseCalendarEventsResult {
  const {
    rdvs, tasks, anniversaries, meals, vacationConfig,
    defis, memories, moods, quotes, loadMealsForWeek,
  } = useVault();

  const [extraMeals, setExtraMeals] = useState<{ mondayDate: string; meals: MealItem[] }[]>([]);
  const [isLoadingMeals, setIsLoadingMeals] = useState(false);

  // Stabiliser la clé du mois pour éviter les re-fires inutiles
  const monthKey = useMemo(() => format(displayMonth, 'yyyy-MM'), [displayMonth]);

  // Plage : mois affiché
  const range: DateRange = useMemo(() => {
    const s = startOfMonth(displayMonth);
    const e = endOfMonth(displayMonth);
    return {
      start: format(s, 'yyyy-MM-dd'),
      end: format(e, 'yyyy-MM-dd'),
    };
  }, [monthKey]);

  // Charger les repas de toutes les semaines qui chevauchent le mois
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setIsLoadingMeals(true);
      const weeks: { mondayDate: string; meals: MealItem[] }[] = [];
      let current = startOfWeek(startOfMonth(displayMonth), { weekStartsOn: 1 });
      const monthEnd = endOfMonth(displayMonth);
      while (current <= monthEnd) {
        const mondayStr = format(current, 'yyyy-MM-dd');
        try {
          const weekMeals = await loadMealsForWeek(current);
          if (!cancelled) {
            weeks.push({ mondayDate: mondayStr, meals: weekMeals });
          }
        } catch { /* semaine sans fichier */ }
        current = addWeeks(current, 1);
      }
      if (!cancelled) {
        setExtraMeals(weeks);
      }
      setIsLoadingMeals(false);
    })();
    return () => { cancelled = true; setIsLoadingMeals(false); };
  }, [monthKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // Repas semaine courante (pas de mémorisation vide — recalculé à chaque render, c'est cheap)
  const currentWeekMonday = format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd');

  const allResolvedMeals = useMemo(() => {
    const currentWeekMeals = meals.length > 0
      ? [{ mondayDate: currentWeekMonday, meals }]
      : [];
    const allWeeks = [...currentWeekMeals];
    for (const w of extraMeals) {
      if (!allWeeks.some(a => a.mondayDate === w.mondayDate)) {
        allWeeks.push(w);
      }
    }
    return resolveMealsForRange(allWeeks);
  }, [meals, extraMeals, currentWeekMonday]);

  // Vacations dates set — dérivé des events agrégés pour éviter la double expansion
  const input: AggregatorInput = useMemo(() => ({
    rdvs, tasks, anniversaries,
    resolvedMeals: allResolvedMeals,
    vacationConfig, defis, memories, moods, quotes,
  }), [rdvs, tasks, anniversaries, allResolvedMeals, vacationConfig, defis, memories, moods, quotes]);

  const events = useMemo(
    () => aggregateCalendarEvents(input, range),
    [input, range],
  );

  const byDate = useMemo(() => indexByDate(events), [events]);

  // Dériver vacationDates depuis les events agrégés (pas de double expansion)
  const vacationDates = useMemo(() => {
    const set = new Set<string>();
    for (const e of events) {
      if (e.type === 'vacation') set.add(e.date);
    }
    return set;
  }, [events]);

  return { events, eventsByDate: byDate, isLoadingMeals, vacationDates };
}
