/**
 * types.ts — Interface commune pour les composants dashboard
 */

import type { Task } from '../../lib/types';

export interface DashboardSectionProps {
  isChildMode: boolean;
  vaultFileExists: Record<string, boolean>;
  activateCardTemplate: (cardId: string) => Promise<void>;
}

export interface DashboardSectionWithTaskToggleProps extends DashboardSectionProps {
  handleTaskToggle: (task: Task, completed: boolean) => void;
}
