/**
 * types.ts — Interface commune pour les composants dashboard
 */

import type { Task } from '../../lib/types';
import type { Insight } from '../../lib/insights';

export interface DashboardSectionProps {
  isChildMode: boolean;
  vaultFileExists: Record<string, boolean>;
  activateCardTemplate: (cardId: string) => Promise<void>;
  /** Insights pré-calculés (évite le double calcul) */
  insights?: Insight[];
}

export interface DashboardSectionWithTaskToggleProps extends DashboardSectionProps {
  handleTaskToggle: (task: Task, completed: boolean) => void;
}
