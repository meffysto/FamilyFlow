/**
 * smart-sort.ts — Tri intelligent contextuel des sections dashboard
 *
 * Réordonne automatiquement les sections visibles en fonction du contexte :
 * heure, données disponibles, urgences, etc.
 */

import type { SectionPref } from '../components/DashboardPrefsModal';

export interface SmartSortContext {
  hour: number;
  hasBaby: boolean;
  hasOverdue: boolean;
  isVacationActive: boolean;
  /** IDs des sections qui ont des données à afficher */
  activeSections: Set<string>;
}

/**
 * Score de pertinence contextuelle pour chaque section.
 * Plus le score est élevé, plus la section monte dans le dashboard.
 *
 * Tiers de score :
 *   100  = urgence contextuelle (nuit + bébé)
 *    80  = urgence données (retard)
 *  60-70 = contexte temporel fort (vacances, repas à l'heure, ménage le matin)
 *  15-30 = données disponibles (rdvs, rewards, stock, etc.)
 *   5-10 = données secondaires
 *  <0    = pas de données → descend
 */
function getContextScore(id: string, ctx: SmartSortContext): number {
  const { hour, hasBaby, hasOverdue, isVacationActive, activeSections } = ctx;
  const isNight = hour >= 20 || hour < 8;
  const isMealTime = (hour >= 11 && hour < 14) || (hour >= 18 && hour < 21);
  const isMorning = hour >= 6 && hour < 11;
  const hasData = activeSections.has(id);

  switch (id) {
    case 'insights':
      return hasData ? 75 : -20;

    case 'nightMode':
      if (isNight && hasBaby) return 100;
      return -50;

    case 'overdue':
      return hasOverdue ? 80 : -30;

    case 'vacation':
      return isVacationActive ? 70 : -30;

    case 'menage':
      if (hasData && isMorning) return 60;
      return hasData ? 30 : -20;

    case 'meals':
      if (hasData && isMealTime) return 65;
      return hasData ? 20 : -20;

    case 'rdvs':
      return hasData ? 25 : -15;

    case 'rewards':
      return hasData ? 20 : -10;

    case 'courses':
      return hasData ? 15 : -10;

    case 'stock':
      return hasData ? 15 : -10;

    case 'leaderboard':
      return hasData ? 15 : -10;

    case 'photos':
      return hasData ? 10 : -10;

    case 'weeklyStats':
      return hasData ? 10 : -10;

    case 'lootProgress':
      return hasData ? 10 : -5;

    case 'budget':
      return 5;

    case 'quicknotifs':
      return hasData ? 5 : -10;

    case 'recipes':
      return hasData ? 5 : -10;

    case 'defis':
      return hasData ? 20 : -10;

    case 'gratitude':
      // Le soir (18h+), la gratitude monte — c'est le moment d'écrire
      if (hasData) return hour >= 18 ? 40 : 15;
      return hour >= 18 ? 25 : -5;

    default:
      return 0;
  }
}

/**
 * Trie les sections visibles par score contextuel décroissant.
 * Les sections masquées conservent leur position relative (en fin de liste).
 */
export function smartSortSections(
  sections: SectionPref[],
  ctx: SmartSortContext,
): SectionPref[] {
  const visible = sections.filter((s) => s.visible);
  const hidden = sections.filter((s) => !s.visible);

  const scored = visible.map((s, i) => ({
    section: s,
    score: getContextScore(s.id, ctx),
    index: i,
  }));

  // Tri stable : score décroissant, index original en cas d'égalité
  scored.sort((a, b) => b.score - a.score || a.index - b.index);

  return [...scored.map((s) => s.section), ...hidden];
}
