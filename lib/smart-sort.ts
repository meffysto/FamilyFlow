/**
 * smart-sort.ts — Tri intelligent contextuel des sections dashboard
 *
 * Réordonne automatiquement les sections visibles en fonction du contexte :
 * heure, données disponibles, urgences, **volume de données**.
 *
 * Les scores sont proportionnels à la pression réelle :
 * plus il y a de tâches en retard / ménage à faire / courses restantes,
 * plus la section monte — pas juste "a des données oui/non".
 */

import type { SectionPref } from '../components/DashboardPrefsModal';

export interface SmartSortContext {
  hour: number;
  hasBaby: boolean;
  isVacationActive: boolean;
  /** IDs des sections qui ont des données à afficher */
  activeSections: Set<string>;
  /** Métriques quantitatives — toutes optionnelles pour rétrocompat */
  counts?: {
    overdue?: number;         // tâches en retard
    menagePending?: number;   // tâches ménage non faites
    coursesRemaining?: number; // articles courses restants
    rdvToday?: number;        // RDV aujourd'hui
    rdvMinutesUntilNext?: number; // minutes avant le prochain RDV
    mealsPlanned?: number;    // repas planifiés aujourd'hui
    insightsCount?: number;   // suggestions actives
    defisActive?: number;     // défis actifs
    dayOfWeek?: number;       // 0=dimanche, 6=samedi
  };
}

/** Clamp un score entre min et max */
function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Score de pertinence contextuelle pour chaque section.
 * Plus le score est élevé, plus la section monte dans le dashboard.
 *
 * Tiers de score :
 *   90-100 = urgence critique (nuit+bébé, RDV imminent, 5+ retards)
 *    70-89 = urgence forte (retards, vacances, ménage chargé le matin)
 *    40-69 = contexte temporel (repas à l'heure, gratitude le soir)
 *    15-39 = données disponibles (rdvs, rewards, stock, etc.)
 *     5-14 = données secondaires
 *     <0   = pas de données → descend
 */
function getContextScore(id: string, ctx: SmartSortContext): number {
  const { hour, hasBaby, isVacationActive, activeSections, counts = {} } = ctx;
  const isNight = hour >= 20 || hour < 8;
  const isMealTime = (hour >= 11 && hour < 14) || (hour >= 18 && hour < 21);
  const isMorning = hour >= 6 && hour < 11;
  const isEvening = hour >= 18;
  const isSunday = counts.dayOfWeek === 0;
  const hasData = activeSections.has(id);

  switch (id) {
    case 'insights':
      if (!hasData) return -20;
      // Plus il y a de suggestions, plus c'est pertinent
      return clamp(60 + (counts.insightsCount ?? 1) * 5, 60, 80);

    case 'nightMode':
      if (isNight && hasBaby) return 100;
      return -50;

    case 'overdue': {
      const n = counts.overdue ?? 0;
      if (n === 0) return -30;
      // 1 retard = 75, 3+ = 85, 5+ = 95 — pression croissante
      return clamp(70 + n * 5, 75, 95);
    }

    case 'vacation':
      return isVacationActive ? 70 : -30;

    case 'menage': {
      const n = counts.menagePending ?? 0;
      if (n === 0) return -20;
      // Matin = moment ménage, score amplifié par le volume
      if (isMorning) return clamp(45 + n * 5, 50, 75);
      // Après-midi/soir : monte si beaucoup reste à faire
      return clamp(20 + n * 4, 25, 55);
    }

    case 'meals': {
      const n = counts.mealsPlanned ?? 0;
      if (n === 0) return -20;
      // Aux heures repas : score fort
      if (isMealTime) return clamp(55 + n * 5, 60, 75);
      return clamp(15 + n * 3, 15, 30);
    }

    case 'rdvs': {
      const n = counts.rdvToday ?? 0;
      if (n === 0) return -15;
      const minUntil = counts.rdvMinutesUntilNext ?? Infinity;
      // RDV dans moins de 2h = urgence
      if (minUntil <= 120) return clamp(80 + Math.round((120 - minUntil) / 12), 80, 95);
      // RDV aujourd'hui, proportionnel au nombre
      return clamp(25 + n * 10, 25, 50);
    }

    case 'courses': {
      const n = counts.coursesRemaining ?? 0;
      if (n === 0) return -10;
      // Plus la liste est longue, plus c'est pertinent
      return clamp(10 + n * 2, 15, 40);
    }

    case 'rewards':
      return hasData ? 20 : -10;

    case 'leaderboard':
      return hasData ? 15 : -10;

    case 'photos':
      return hasData ? 10 : -10;

    case 'weeklyStats':
      // Dimanche = résumé de la semaine, score boosté
      if (isSunday && hasData) return 50;
      return hasData ? 10 : -10;

    case 'lootProgress':
      return hasData ? 10 : -5;

    case 'budget':
      return -10;

    case 'quicknotifs':
      return hasData ? 5 : -10;

    case 'recipes':
      return hasData ? 5 : -10;

    case 'defis': {
      const n = counts.defisActive ?? 0;
      if (n === 0) return -10;
      return clamp(15 + n * 5, 20, 40);
    }

    case 'gratitude':
      // Le soir (18h+), la gratitude monte — c'est le moment d'écrire
      if (hasData) return isEvening ? 40 : 15;
      return isEvening ? 25 : -5;

    case 'wishlist':
      return hasData ? 5 : -10;

    case 'anniversaires':
      return hasData ? 30 : -10;

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

  // Regrouper les cartes half en paires consécutives
  const sorted = scored.map((s) => s.section);
  const result = clusterHalfCards(sorted);

  return [...result, ...hidden];
}

/**
 * Regroupe les cartes size='half' en paires consécutives.
 * Quand une carte half est isolée entre des full, on cherche la prochaine half
 * et on la remonte juste après pour former une paire.
 */
function clusterHalfCards(sections: SectionPref[]): SectionPref[] {
  const result = [...sections];
  let i = 0;
  while (i < result.length) {
    if (result[i].size === 'half') {
      // Déjà une paire ?
      if (i + 1 < result.length && result[i + 1].size === 'half') {
        i += 2;
        continue;
      }
      // Chercher la prochaine half plus loin
      let j = i + 2;
      while (j < result.length && result[j].size !== 'half') {
        j++;
      }
      if (j < result.length) {
        // Remonter result[j] juste après result[i]
        const [moved] = result.splice(j, 1);
        result.splice(i + 1, 0, moved);
        i += 2;
      } else {
        // Pas de partenaire — affichée seule en full
        i++;
      }
    } else {
      i++;
    }
  }
  return result;
}
