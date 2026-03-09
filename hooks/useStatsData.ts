/**
 * useStatsData.ts — Chargement données historiques pour les stats
 *
 * Charge en parallèle :
 * - 30 jours de journal bébé (sommeil)
 * - 6 mois de budget
 */

import { useEffect, useMemo, useState } from 'react';
import { useVault } from '../contexts/VaultContext';
import { parseJournalStats, JournalStats } from '../lib/journal-stats';
import { parseBudgetMonth } from '../lib/budget';
import { journalPathForDate } from '../lib/parser';
import type { BudgetEntry } from '../lib/types';

interface SleepDay {
  date: string;
  stats: JournalStats;
}

interface BudgetMonth {
  month: string;
  entries: BudgetEntry[];
}

interface StatsData {
  sleepByChild: Record<string, SleepDay[]>;
  budgetTrend: BudgetMonth[];
  isLoading: boolean;
}

export function useStatsData(enfantNames: string[]): StatsData {
  const { vault } = useVault();
  const [sleepByChild, setSleepByChild] = useState<Record<string, SleepDay[]>>({});
  const [budgetTrend, setBudgetTrend] = useState<BudgetMonth[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!vault) return;

    let cancelled = false;

    async function load() {
      setIsLoading(true);

      // 30 derniers jours pour le sommeil
      const sleepPromises: Promise<{ child: string; days: SleepDay[] }>[] = enfantNames.map(
        async (name) => {
          const days: SleepDay[] = [];
          const today = new Date();
          const promises: Promise<void>[] = [];

          for (let i = 0; i < 30; i++) {
            const d = new Date(today);
            d.setDate(d.getDate() - i);
            const dateStr = d.toISOString().slice(0, 10);
            const path = journalPathForDate(name, dateStr);

            promises.push(
              vault!.readFile(path).then((content) => {
                const stats = parseJournalStats(content);
                if (stats.sommeilTotal) {
                  days.push({ date: dateStr, stats });
                }
              }).catch(() => {
                // Fichier inexistant → on ignore
              }),
            );
          }

          await Promise.all(promises);
          days.sort((a, b) => a.date.localeCompare(b.date));
          return { child: name, days };
        },
      );

      // 6 derniers mois pour le budget
      const budgetPromise = (async () => {
        const months: BudgetMonth[] = [];
        const today = new Date();

        const promises = Array.from({ length: 6 }, (_, i) => {
          const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
          const month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
          const path = `05 - Budget/${month}.md`;

          return vault!.readFile(path).then((content) => {
            const entries = parseBudgetMonth(content);
            if (entries.length > 0) {
              months.push({ month, entries });
            }
          }).catch(() => {
            // Pas de fichier budget pour ce mois
          });
        });

        await Promise.all(promises);
        months.sort((a, b) => a.month.localeCompare(b.month));
        return months;
      })();

      const [sleepResults, budgetResults] = await Promise.all([
        Promise.all(sleepPromises),
        budgetPromise,
      ]);

      if (cancelled) return;

      const sleepMap: Record<string, SleepDay[]> = {};
      for (const { child, days } of sleepResults) {
        if (days.length > 0) sleepMap[child] = days;
      }

      setSleepByChild(sleepMap);
      setBudgetTrend(budgetResults);
      setIsLoading(false);
    }

    load();
    return () => { cancelled = true; };
  }, [vault, enfantNames.join(',')]);

  return { sleepByChild, budgetTrend, isLoading };
}
