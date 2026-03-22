/**
 * notifications.ts — Notification engine
 *
 * Handles:
 * - Built-in notification definitions with default templates
 * - Template rendering with {{variable}} replacement
 * - Context builders per notification event type
 * - Centralized dispatch (check enabled → render → send)
 * - Parse/serialize notifications.md for vault persistence
 */

import * as SecureStore from 'expo-secure-store';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  Profile,
  LootBox,
  NotificationConfig,
  NotificationPreferences,
  NotifEvent,
  TemplateVariable,
} from './types';
import { sendTelegram } from './telegram';
import { SEASONAL_EVENTS } from './gamification';

const TELEGRAM_TOKEN_KEY = 'telegram_token';
const TELEGRAM_CHAT_KEY = 'telegram_chat_id';

// ─── Available variables per event ──────────────────────────────────────────

const TASK_COMPLETED_VARS: TemplateVariable[] = [
  { key: 'profile.name', label: 'Nom', example: 'Papa' },
  { key: 'profile.avatar', label: 'Avatar', example: '👨‍💻' },
  { key: 'profile.points', label: 'Points total', example: '150' },
  { key: 'profile.level', label: 'Niveau', example: '2' },
  { key: 'task.text', label: 'Tâche', example: 'Bain' },
  { key: 'points.gained', label: 'Points gagnés', example: '10' },
];

const LOOT_BOX_VARS: TemplateVariable[] = [
  { key: 'profile.name', label: 'Nom', example: 'Papa' },
  { key: 'profile.avatar', label: 'Avatar', example: '👨‍💻' },
  { key: 'box.rarity', label: 'Rareté', example: 'RARE' },
  { key: 'box.emoji', label: 'Emoji récompense', example: '🦄' },
  { key: 'box.reward', label: 'Récompense', example: 'Badge Licorne' },
  { key: 'box.bonusPoints', label: 'Points bonus', example: '15' },
  { key: 'box.seasonal', label: 'Événement saisonnier', example: '🎃 Halloween' },
];

const ALL_TASKS_DONE_VARS: TemplateVariable[] = [
  { key: 'tasks.completedCount', label: 'Tâches terminées', example: '12' },
  { key: 'leaderboard', label: 'Classement', example: '🥇 👨‍💻 Papa — 150 pts' },
];

const LEADERBOARD_VARS: TemplateVariable[] = [
  { key: 'leaderboard', label: 'Classement', example: '🥇 👨‍💻 Papa — 150 pts' },
];

const DAILY_SUMMARY_VARS: TemplateVariable[] = [
  { key: 'tasks.completedCount', label: 'Terminées', example: '8' },
  { key: 'tasks.pendingCount', label: 'Restantes', example: '4' },
  { key: 'leaderboard', label: 'Classement', example: '🥇 👨‍💻 Papa — 150 pts' },
];

const MANUAL_VARS: TemplateVariable[] = [
  { key: 'profile.name', label: 'Nom', example: 'Papa' },
  { key: 'profile.avatar', label: 'Avatar', example: '👨‍💻' },
  { key: 'date', label: 'Date', example: '06/03/2026' },
  { key: 'time', label: 'Heure', example: '14:30' },
];

// ─── Built-in notification defaults ─────────────────────────────────────────

const DEFAULT_TASK_COMPLETED_TEMPLATE =
  '{{profile.avatar}} <b>{{profile.name}}</b> a terminé une tâche !\n\n📋 <i>{{task.text}}</i>\n+{{points.gained}} pts → Total : <b>{{profile.points}} pts</b>';

const DEFAULT_LOOT_BOX_TEMPLATE =
  '{{box.emoji}} <b>{{profile.name}}</b> a ouvert une loot box !\n\n{{box.emoji}} <b>{{box.rarity}}</b>\n🎁 {{box.reward}}';

const DEFAULT_ALL_TASKS_DONE_TEMPLATE =
  '🎉 <b>Journée terminée !</b>\n\n✅ {{tasks.completedCount}} tâche(s) complétée(s)\n\n🏆 <b>Classement</b>\n{{leaderboard}}\n\nBravo à toute la famille ! 💪';

const DEFAULT_LEADERBOARD_TEMPLATE =
  '🏆 <b>Classement Famille</b>\n\n{{leaderboard}}';

const DEFAULT_DAILY_SUMMARY_TEMPLATE =
  '📋 <b>Résumé du jour</b>\n\n✅ {{tasks.completedCount}} terminée(s)\n⏳ {{tasks.pendingCount}} restante(s)\n\n{{leaderboard}}';

export const BUILTIN_NOTIFICATIONS: NotificationConfig[] = [
  {
    id: 'task_completed',
    label: 'Tâche complétée',
    emoji: '✅',
    enabled: true,
    template: DEFAULT_TASK_COMPLETED_TEMPLATE,
    defaultTemplate: DEFAULT_TASK_COMPLETED_TEMPLATE,
    event: 'task_completed',
    availableVariables: TASK_COMPLETED_VARS,
    isCustom: false,
  },
  {
    id: 'loot_box_opened',
    label: 'Loot box ouverte',
    emoji: '🎁',
    enabled: true,
    template: DEFAULT_LOOT_BOX_TEMPLATE,
    defaultTemplate: DEFAULT_LOOT_BOX_TEMPLATE,
    event: 'loot_box_opened',
    availableVariables: LOOT_BOX_VARS,
    isCustom: false,
  },
  {
    id: 'all_tasks_done',
    label: 'Journée terminée',
    emoji: '🎉',
    enabled: true,
    template: DEFAULT_ALL_TASKS_DONE_TEMPLATE,
    defaultTemplate: DEFAULT_ALL_TASKS_DONE_TEMPLATE,
    event: 'all_tasks_done',
    availableVariables: ALL_TASKS_DONE_VARS,
    isCustom: false,
  },
  {
    id: 'leaderboard',
    label: 'Classement',
    emoji: '🏆',
    enabled: false,
    template: DEFAULT_LEADERBOARD_TEMPLATE,
    defaultTemplate: DEFAULT_LEADERBOARD_TEMPLATE,
    event: 'leaderboard',
    availableVariables: LEADERBOARD_VARS,
    isCustom: false,
  },
  {
    id: 'daily_summary',
    label: 'Résumé du jour',
    emoji: '📋',
    enabled: false,
    template: DEFAULT_DAILY_SUMMARY_TEMPLATE,
    defaultTemplate: DEFAULT_DAILY_SUMMARY_TEMPLATE,
    event: 'daily_summary',
    availableVariables: DAILY_SUMMARY_VARS,
    isCustom: false,
  },
];

// ─── Template rendering ─────────────────────────────────────────────────────

/** Replace all {{var}} placeholders in a template string */
export function renderTemplate(
  template: string,
  context: Record<string, string>
): string {
  return template.replace(/\{\{(\w+(?:\.\w+)*)\}\}/g, (_match, key) => {
    return context[key] ?? _match;
  });
}

// ─── Context builders ───────────────────────────────────────────────────────

export function buildLeaderboardText(profiles: Profile[]): string {
  const sorted = [...profiles].sort((a, b) => b.points - a.points);
  const medals = ['🥇', '🥈', '🥉'];
  return sorted
    .map((p, i) => `${medals[i] ?? '  '} ${p.avatar} <b>${p.name}</b> — ${p.points} pts`)
    .join('\n');
}

export function buildTaskCompletedContext(
  profile: Profile,
  taskText: string,
  pointsGained: number
): Record<string, string> {
  return {
    'profile.name': profile.name,
    'profile.avatar': profile.avatar,
    'profile.points': String(profile.points),
    'profile.level': String(profile.level),
    'task.text': taskText,
    'points.gained': String(pointsGained),
  };
}

export function buildLootBoxContext(
  profile: Profile,
  box: LootBox
): Record<string, string> {
  // Résoudre le nom de l'événement saisonnier si présent
  let seasonalLabel = '';
  if (box.seasonal) {
    const event = SEASONAL_EVENTS.find((e) => e.id === box.seasonal);
    seasonalLabel = event ? `${event.emoji} ${event.name}` : '';
  }
  return {
    'profile.name': profile.name,
    'profile.avatar': profile.avatar,
    'box.rarity': box.rarity.toUpperCase(),
    'box.emoji': box.emoji,
    'box.reward': box.reward,
    'box.bonusPoints': String(box.bonusPoints),
    'box.seasonal': seasonalLabel,
  };
}

export function buildAllTasksDoneContext(
  completedCount: number,
  profiles: Profile[]
): Record<string, string> {
  return {
    'tasks.completedCount': String(completedCount),
    'leaderboard': buildLeaderboardText(profiles),
  };
}

export function buildLeaderboardContext(
  profiles: Profile[]
): Record<string, string> {
  return {
    'leaderboard': buildLeaderboardText(profiles),
  };
}

export function buildDailySummaryContext(
  pendingCount: number,
  completedCount: number,
  profiles: Profile[]
): Record<string, string> {
  return {
    'tasks.pendingCount': String(pendingCount),
    'tasks.completedCount': String(completedCount),
    'leaderboard': buildLeaderboardText(profiles),
  };
}

export function buildManualContext(
  profile: Profile | null
): Record<string, string> {
  const now = new Date();
  return {
    'profile.name': profile?.name ?? '',
    'profile.avatar': profile?.avatar ?? '',
    'date': format(now, 'dd/MM/yyyy'),
    'time': format(now, 'HH:mm'),
  };
}

// ─── Digest builders (morning/evening summaries) ────────────────────────────

import { Task, RDV, StockItem } from './types';

export function buildMorningDigest(data: {
  tasks: Task[];
  rdvs: RDV[];
  stock: StockItem[];
}): string {
  const today = format(new Date(), 'dd/MM/yyyy');
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const lines: string[] = [`☀️ <b>Bonjour ! Résumé du ${today}</b>\n`];

  // Today's tasks
  const todayTasks = data.tasks.filter(
    (t) => !t.completed && t.dueDate === todayStr
  );
  if (todayTasks.length > 0) {
    lines.push(`📋 <b>${todayTasks.length} tâche(s) du jour</b>`);
    todayTasks.slice(0, 5).forEach((t) => lines.push(`  • ${t.text}`));
    if (todayTasks.length > 5) lines.push(`  ... et ${todayTasks.length - 5} de plus`);
    lines.push('');
  }

  // Ménage (filtré par section)
  const pendingMenage = data.tasks.filter((t) =>
    t.section != null && t.section.toLowerCase().includes('ménage') && !t.completed
  );
  if (pendingMenage.length > 0) {
    lines.push(`🧹 <b>${pendingMenage.length} tâche(s) ménage</b>`);
    pendingMenage.forEach((t) => lines.push(`  • ${t.text}`));
    lines.push('');
  }

  // Overdue
  const overdue = data.tasks.filter(
    (t) => !t.completed && t.dueDate && t.dueDate < todayStr
  );
  if (overdue.length > 0) {
    lines.push(`⚠️ <b>${overdue.length} tâche(s) en retard</b>`);
    overdue.slice(0, 3).forEach((t) => lines.push(`  • ${t.text} (📅 ${t.dueDate})`));
    lines.push('');
  }

  // Upcoming RDVs
  const in7Days = format(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd');
  const upcoming = data.rdvs.filter(
    (r) => r.statut === 'planifié' && r.date_rdv >= todayStr && r.date_rdv <= in7Days
  );
  if (upcoming.length > 0) {
    lines.push(`📅 <b>RDV à venir</b>`);
    upcoming.forEach((r) => {
      lines.push(`  • ${r.date_rdv} ${r.heure ?? ''} — ${r.type_rdv} ${r.enfant}`);
    });
    lines.push('');
  }

  // Low stock
  const lowStock = data.stock.filter((s) => s.quantite <= s.seuil);
  if (lowStock.length > 0) {
    lines.push(`📦 <b>${lowStock.length} produit(s) en stock bas</b>`);
    lowStock.forEach((s) => {
      lines.push(`  • ${s.produit} : ${s.quantite} restant(s)`);
    });
  }

  if (lines.length === 1) {
    lines.push('✨ Rien de spécial aujourd\'hui. Bonne journée !');
  }

  return lines.join('\n');
}

export function buildEveningDigest(data: {
  tasks: Task[];
}): string {
  const today = format(new Date(), 'dd/MM/yyyy');
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const lines: string[] = [`🌙 <b>Bilan du ${today}</b>\n`];

  const completedToday = data.tasks.filter(
    (t) => t.completed && t.completedDate === todayStr
  );
  const pendingToday = data.tasks.filter(
    (t) => !t.completed && t.dueDate === todayStr
  );

  lines.push(`✅ ${completedToday.length} tâche(s) terminée(s)`);
  if (pendingToday.length > 0) {
    lines.push(`⏳ ${pendingToday.length} restante(s)`);
  }

  // Tomorrow preview
  const tomorrowStr = format(new Date(Date.now() + 24 * 60 * 60 * 1000), 'yyyy-MM-dd');
  const tomorrowTasks = data.tasks.filter(
    (t) => !t.completed && t.dueDate === tomorrowStr
  );
  if (tomorrowTasks.length > 0) {
    lines.push('');
    lines.push(`📋 <b>Demain : ${tomorrowTasks.length} tâche(s)</b>`);
    tomorrowTasks.slice(0, 3).forEach((t) => lines.push(`  • ${t.text}`));
  }

  return lines.join('\n');
}

// ─── Dispatch ───────────────────────────────────────────────────────────────

/**
 * Central notification dispatcher.
 * 1. Finds the notification config by id
 * 2. Checks if enabled
 * 3. Renders the template with context
 * 4. Sends via Telegram (fire-and-forget)
 */
export async function dispatchNotification(
  notifId: string,
  context: Record<string, string>,
  prefs: NotificationPreferences
): Promise<boolean> {
  const config = prefs.notifications.find((n) => n.id === notifId);
  if (!config || !config.enabled) return false;

  const message = renderTemplate(config.template, context);

  try {
    const token = await SecureStore.getItemAsync(TELEGRAM_TOKEN_KEY);
    const chatId = await SecureStore.getItemAsync(TELEGRAM_CHAT_KEY);
    if (!token || !chatId) return false;
    return await sendTelegram(token, chatId, message);
  } catch {
    return false;
  }
}

/** Fire-and-forget wrapper — never throws, never blocks */
export function dispatchNotificationAsync(
  notifId: string,
  context: Record<string, string>,
  prefs: NotificationPreferences
): void {
  dispatchNotification(notifId, context, prefs).catch(() => {});
}

// ─── Parse / Serialize notifications.md ─────────────────────────────────────

/**
 * Parse notifications.md content into NotificationPreferences.
 * Format: sections ## id with key: value pairs.
 */
export function parseNotificationPrefs(content: string): NotificationPreferences {
  const notifications: NotificationConfig[] = [];
  const lines = content.split('\n');

  let currentId: string | null = null;
  let currentData: Record<string, string> = {};

  const flush = () => {
    if (!currentId || Object.keys(currentData).length === 0) return;

    // Find matching builtin for defaults
    const builtin = BUILTIN_NOTIFICATIONS.find((b) => b.id === currentId);
    const isCustom = currentData['isCustom'] === 'true' || !builtin;
    const event = (currentData['event'] ?? builtin?.event ?? 'manual') as NotifEvent;

    const config: NotificationConfig = {
      id: currentId,
      label: currentData['label'] ?? builtin?.label ?? currentId,
      emoji: currentData['emoji'] ?? builtin?.emoji ?? '📌',
      enabled: currentData['enabled'] !== 'false',
      template: currentData['template'] ?? builtin?.template ?? '',
      defaultTemplate: builtin?.defaultTemplate ?? currentData['template'] ?? '',
      event,
      availableVariables: builtin?.availableVariables ?? MANUAL_VARS,
      isCustom,
    };

    notifications.push(config);
  };

  for (const line of lines) {
    if (line.startsWith('## ')) {
      flush();
      currentId = line.slice(3).trim();
      currentData = {};
    } else if (currentId && line.includes(': ')) {
      const colonIdx = line.indexOf(': ');
      const key = line.slice(0, colonIdx).trim();
      let value = line.slice(colonIdx + 2).trim();
      // Restore escaped newlines from serialized templates
      if (key === 'template') {
        value = value.replace(/\\n/g, '\n');
      }
      if (key && value !== undefined) {
        currentData[key] = value;
      }
    }
  }
  flush();

  // Merge with builtins: ensure all builtins exist even if not in file
  for (const builtin of BUILTIN_NOTIFICATIONS) {
    if (!notifications.find((n) => n.id === builtin.id)) {
      notifications.push({ ...builtin });
    }
  }

  // Sort: builtins first (in order), then customs
  const builtinOrder = BUILTIN_NOTIFICATIONS.map((b) => b.id);
  notifications.sort((a, b) => {
    const aIdx = builtinOrder.indexOf(a.id);
    const bIdx = builtinOrder.indexOf(b.id);
    if (aIdx !== -1 && bIdx !== -1) return aIdx - bIdx;
    if (aIdx !== -1) return -1;
    if (bIdx !== -1) return 1;
    return 0;
  });

  return { version: 1, notifications };
}

/**
 * Serialize NotificationPreferences to notifications.md content.
 */
export function serializeNotificationPrefs(prefs: NotificationPreferences): string {
  const lines: string[] = [
    '---',
    'tags:',
    '  - notifications',
    '---',
    '# Notifications',
    '',
    '<!-- Family Vault — configuration des notifications. -->',
    '',
  ];

  for (const notif of prefs.notifications) {
    lines.push(`## ${notif.id}`);
    lines.push(`label: ${notif.label}`);
    lines.push(`emoji: ${notif.emoji}`);
    lines.push(`enabled: ${notif.enabled}`);
    // Escape newlines in template for single-line storage
    lines.push(`template: ${notif.template.replace(/\n/g, '\\n')}`);
    if (notif.isCustom) {
      lines.push(`isCustom: true`);
      lines.push(`event: ${notif.event}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Get default NotificationPreferences (when notifications.md doesn't exist).
 */
export function getDefaultNotificationPrefs(): NotificationPreferences {
  return {
    version: 1,
    notifications: BUILTIN_NOTIFICATIONS.map((b) => ({ ...b })),
  };
}

/**
 * Create a new custom notification config with a unique id.
 */
export function createCustomNotification(
  label: string,
  emoji: string,
  template: string
): NotificationConfig {
  const id = `custom_${Date.now()}`;
  return {
    id,
    label,
    emoji,
    enabled: true,
    template,
    defaultTemplate: template,
    event: 'manual',
    availableVariables: MANUAL_VARS,
    isCustom: true,
  };
}
