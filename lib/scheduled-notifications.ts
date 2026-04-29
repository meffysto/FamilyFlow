/**
 * scheduled-notifications.ts — Notifications locales contextuelles
 *
 * 5 catégories :
 * 1. RDV — veille (20h) + jour J (matin 7h30) + 1h avant
 * 2. Tâches — jour J pour les tâches avec échéance
 * 3. Ménage — rappel récurrent configurable
 * 4. Courses — stock bas (rappel quotidien configurable)
 * 5. Général — rappel quotidien "ouvrir l'app"
 * 6. Grossesse — rappel hebdomadaire (si profil grossesse)
 */

import * as Notifications from 'expo-notifications';
import { RDV, Task, StockItem } from './types';
import type { LoveNote } from './types';
import * as SecureStore from 'expo-secure-store';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface NotifScheduleConfig {
  // RDV
  rdvEnabled: boolean;
  rdvVeilleHour: number;       // notif veille à cette heure (default 20)
  rdvMatinHour: number;        // notif jour J matin (default 7)
  rdvMatinMinute: number;      // default 30
  rdvAvantMinutes: number;     // minutes avant le RDV (default 60)
  // Tâches
  taskEnabled: boolean;
  taskHour: number;            // heure du rappel (default 8)
  taskMinute: number;          // default 0
  taskVeille: boolean;         // aussi la veille ? (default false)
  // Ménage
  menageEnabled: boolean;
  menageHour: number;          // default 9
  menageMinute: number;        // default 0
  menageDay: number;           // 1=dimanche … 7=samedi (iOS weekday), default 7 (samedi)
  // Courses / stock bas
  coursesEnabled: boolean;
  coursesHour: number;         // default 10
  coursesMinute: number;       // default 0
  // Général — ouvrir l'app
  generalEnabled: boolean;
  generalHour: number;         // default 8
  generalMinute: number;       // default 30
  // Grossesse
  grossesseEnabled: boolean;
  grossesseDay: number;        // 1=dimanche … 7=samedi (iOS weekday), default 2 (lundi)
  grossesseHour: number;       // default 9
  grossesseMinute: number;     // default 0
  // Gratitude — rappel quotidien (soir)
  gratitudeEnabled: boolean;
  gratitudeHour: number;         // default 21
  gratitudeMinute: number;       // default 0
  // Résumé hebdo IA (dimanche soir, envoi Telegram)
  weeklyAISummaryEnabled: boolean;
  weeklyAISummaryHour: number;   // default 20
  weeklyAISummaryMinute: number; // default 0
  // Défis — notif locale quand un nouveau défi est détecté (sync)
  defiEnabled: boolean;
}

export const DEFAULT_CONFIG: NotifScheduleConfig = {
  rdvEnabled: true,
  rdvVeilleHour: 20,
  rdvMatinHour: 7,
  rdvMatinMinute: 30,
  rdvAvantMinutes: 60,
  taskEnabled: true,
  taskHour: 8,
  taskMinute: 0,
  taskVeille: false,
  menageEnabled: true,
  menageHour: 9,
  menageMinute: 0,
  menageDay: 7, // samedi
  coursesEnabled: true,
  coursesHour: 10,
  coursesMinute: 0,
  generalEnabled: false,
  generalHour: 8,
  generalMinute: 30,
  grossesseEnabled: false,
  grossesseDay: 2, // lundi
  grossesseHour: 9,
  grossesseMinute: 0,
  gratitudeEnabled: true,
  gratitudeHour: 21,
  gratitudeMinute: 0,
  weeklyAISummaryEnabled: false,
  weeklyAISummaryHour: 20,
  weeklyAISummaryMinute: 0,
  defiEnabled: true,
};

const STORAGE_KEY = 'notif_schedule_config_v2';

const CAT_RDV_VEILLE = 'rdv-veille';
const CAT_RDV_MATIN = 'rdv-matin';
const CAT_RDV_AVANT = 'rdv-avant';
const CAT_RDV_CUSTOM = 'rdv-custom';

/** Rappels personnalisés disponibles : clé → minutes avant le RDV. */
export const RDV_RAPPEL_OFFSETS: Record<string, number> = {
  '1w': 7 * 24 * 60,
  '3d': 3 * 24 * 60,
  '1d': 24 * 60,
  '3h': 3 * 60,
  '1h': 60,
  '30m': 30,
};
const CAT_TASK = 'task-due';
const CAT_TASK_REMINDER = 'task-reminder';
const CAT_MENAGE = 'menage-weekly';
const CAT_COURSES = 'courses-stock';
const CAT_GENERAL = 'general-daily';
const CAT_GROSSESSE = 'grossesse-weekly';
const CAT_GRATITUDE = 'gratitude-daily';
const CAT_WEEKLY_AI = 'weekly-ai-summary';
const CAT_LOVENOTE = 'lovenote-reveal';
const CAT_AUBERGE_ARRIVAL = 'auberge-visitor-arrival';
const CAT_AUBERGE_REMINDER = 'auberge-visitor-reminder';

// ─── Setup ───────────────────────────────────────────────────────────────────

/** Configure notification handler (call once at app startup) */
export function configureNotifications(): void {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

/** Request notification permissions. Returns true if granted. */
export async function requestNotificationPermissions(): Promise<boolean> {
  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === 'granted') return true;
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

// ─── Config persistence ──────────────────────────────────────────────────────

export async function loadNotifConfig(): Promise<NotifScheduleConfig> {
  try {
    const raw = await SecureStore.getItemAsync(STORAGE_KEY);
    if (raw) return { ...DEFAULT_CONFIG, ...JSON.parse(raw) };
  } catch {}
  return { ...DEFAULT_CONFIG };
}

export async function saveNotifConfig(config: NotifScheduleConfig): Promise<void> {
  await SecureStore.setItemAsync(STORAGE_KEY, JSON.stringify(config));
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function cancelByCategory(prefix: string): Promise<void> {
  const all = await Notifications.getAllScheduledNotificationsAsync();
  for (const notif of all) {
    if (notif.identifier.startsWith(prefix)) {
      await Notifications.cancelScheduledNotificationAsync(notif.identifier);
    }
  }
}

// ─── 1. RDV ──────────────────────────────────────────────────────────────────

function formatRappelLabel(key: string, isFr: boolean): string {
  if (isFr) {
    switch (key) {
      case '1w': return '1 semaine avant';
      case '3d': return '3 jours avant';
      case '1d': return 'la veille';
      case '3h': return '3 h avant';
      case '1h': return '1 h avant';
      case '30m': return '30 min avant';
      default: return 'avant';
    }
  }
  switch (key) {
    case '1w': return '1 week before';
    case '3d': return '3 days before';
    case '1d': return '1 day before';
    case '3h': return '3 h before';
    case '1h': return '1 h before';
    case '30m': return '30 min before';
    default: return 'before';
  }
}

function formatDateFr(d: Date): string {
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

function formatDateEn(d: Date): string {
  return `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}/${d.getFullYear()}`;
}

export async function scheduleRDVAlerts(
  rdvs: RDV[],
  config: NotifScheduleConfig,
  lang: string = 'fr'
): Promise<number> {
  await cancelByCategory(CAT_RDV_VEILLE);
  await cancelByCategory(CAT_RDV_MATIN);
  await cancelByCategory(CAT_RDV_AVANT);
  await cancelByCategory(CAT_RDV_CUSTOM);

  if (!config.rdvEnabled) return 0;

  const now = new Date();
  let scheduled = 0;

  for (const rdv of rdvs) {
    if (rdv.statut !== 'planifié') continue;
    if (!rdv.date_rdv || !rdv.heure) continue;

    const [year, month, day] = rdv.date_rdv.split('-').map(Number);
    const [hour, minute] = rdv.heure.split(':').map(Number);
    if (isNaN(year) || isNaN(hour)) continue;

    const rdvDate = new Date(year, month - 1, day, hour, minute);
    const isFr = lang === 'fr';
    const typeLabel = rdv.type_rdv || (isFr ? 'RDV' : 'Appointment');
    const enfantLabel = rdv.enfant ? ` ${rdv.enfant}` : '';
    const lieuLabel = rdv.lieu ? ` — ${rdv.lieu}` : '';

    // Veille à 20h
    const veilleDate = new Date(year, month - 1, day - 1, config.rdvVeilleHour, 0);
    if (veilleDate > now) {
      await Notifications.scheduleNotificationAsync({
        identifier: `${CAT_RDV_VEILLE}-${rdv.sourceFile}`,
        content: {
          title: isFr
            ? `🏥 Demain : ${typeLabel}${enfantLabel}`
            : `🏥 Tomorrow: ${typeLabel}${enfantLabel}`,
          body: isFr ? `À ${rdv.heure}${lieuLabel}` : `At ${rdv.heure}${lieuLabel}`,
          sound: true,
        },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: veilleDate },
      });
      scheduled++;
    }

    // Jour J matin
    const matinDate = new Date(year, month - 1, day, config.rdvMatinHour, config.rdvMatinMinute);
    if (matinDate > now && matinDate < rdvDate) {
      await Notifications.scheduleNotificationAsync({
        identifier: `${CAT_RDV_MATIN}-${rdv.sourceFile}`,
        content: {
          title: isFr
            ? `🏥 Aujourd'hui : ${typeLabel}${enfantLabel}`
            : `🏥 Today: ${typeLabel}${enfantLabel}`,
          body: isFr ? `À ${rdv.heure}${lieuLabel}` : `At ${rdv.heure}${lieuLabel}`,
          sound: true,
        },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: matinDate },
      });
      scheduled++;
    }

    // 1h (ou X min) avant
    const avantDate = new Date(rdvDate.getTime() - config.rdvAvantMinutes * 60 * 1000);
    if (avantDate > now) {
      await Notifications.scheduleNotificationAsync({
        identifier: `${CAT_RDV_AVANT}-${rdv.sourceFile}`,
        content: {
          title: `🏥 ${typeLabel}${enfantLabel}`,
          body: isFr
            ? `Dans ${config.rdvAvantMinutes} min · ${rdv.heure}${lieuLabel}`
            : `In ${config.rdvAvantMinutes} min · ${rdv.heure}${lieuLabel}`,
          sound: true,
        },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: avantDate },
      });
      scheduled++;
    }

    // Rappels personnalisés (1w / 3d / 1d / 3h / 1h / 30m) — uniques par RDV
    for (const key of rdv.rappels ?? []) {
      const minutes = RDV_RAPPEL_OFFSETS[key];
      if (!minutes) continue;
      const rappelDate = new Date(rdvDate.getTime() - minutes * 60 * 1000);
      if (rappelDate <= now) continue;
      const label = formatRappelLabel(key, isFr);
      await Notifications.scheduleNotificationAsync({
        identifier: `${CAT_RDV_CUSTOM}-${key}-${rdv.sourceFile}`,
        content: {
          title: isFr
            ? `⏰ Rappel ${label} : ${typeLabel}${enfantLabel}`
            : `⏰ Reminder ${label}: ${typeLabel}${enfantLabel}`,
          body: isFr
            ? `${formatDateFr(rdvDate)} à ${rdv.heure}${lieuLabel}`
            : `${formatDateEn(rdvDate)} at ${rdv.heure}${lieuLabel}`,
          sound: true,
        },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: rappelDate },
      });
      scheduled++;
    }
  }

  return scheduled;
}

// ─── 2. Tâches avec échéance ─────────────────────────────────────────────────
// Une seule notification groupée par jour (pas une par tâche).

function cleanTaskText(text: string): string {
  return text.replace(/📅.*$/, '').replace(/#\w+/g, '').trim();
}

export async function scheduleTaskAlerts(
  tasks: Task[],
  config: NotifScheduleConfig,
  lang: string = 'fr'
): Promise<number> {
  await cancelByCategory(CAT_TASK);
  await cancelByCategory(CAT_TASK_REMINDER);

  if (!config.taskEnabled) return 0;

  const now = new Date();
  let scheduled = 0;

  const dueTasks = tasks.filter(t => !t.completed && t.dueDate);

  // Regrouper les tâches par date d'échéance
  const byDate = new Map<string, Task[]>();
  for (const task of dueTasks) {
    if (!byDate.has(task.dueDate!)) byDate.set(task.dueDate!, []);
    byDate.get(task.dueDate!)!.push(task);
  }

  const isFr = lang === 'fr';

  for (const [dateStr, dateTasks] of byDate) {
    const [year, month, day] = dateStr.split('-').map(Number);
    if (isNaN(year)) continue;

    const count = dateTasks.length;
    const title = isFr
      ? `📋 ${count} tâche${count > 1 ? 's' : ''} à faire aujourd'hui`
      : `📋 ${count} task${count > 1 ? 's' : ''} due today`;
    const body = count <= 3
      ? dateTasks.map(t => cleanTaskText(t.text)).join(', ')
      : isFr
        ? `${dateTasks.slice(0, 3).map(t => cleanTaskText(t.text)).join(', ')} et ${count - 3} autre${count - 3 > 1 ? 's' : ''}`
        : `${dateTasks.slice(0, 3).map(t => cleanTaskText(t.text)).join(', ')} and ${count - 3} more`;

    // Jour J — une seule notif groupée
    const jourJ = new Date(year, month - 1, day, config.taskHour, config.taskMinute);
    if (jourJ > now) {
      await Notifications.scheduleNotificationAsync({
        identifier: `${CAT_TASK}-${dateStr}`,
        content: { title, body, sound: true },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: jourJ },
      });
      scheduled++;
    }

    // Veille — une seule notif groupée
    if (config.taskVeille) {
      const veilleTitle = isFr
        ? `📋 ${count} tâche${count > 1 ? 's' : ''} demain`
        : `📋 ${count} task${count > 1 ? 's' : ''} due tomorrow`;
      const veille = new Date(year, month - 1, day - 1, config.rdvVeilleHour, 0);
      if (veille > now) {
        await Notifications.scheduleNotificationAsync({
          identifier: `${CAT_TASK}-veille-${dateStr}`,
          content: { title: veilleTitle, body, sound: true },
          trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: veille },
        });
        scheduled++;
      }
    }
  }

  // ── Rappels individuels par tâche (⏰ HH:MM) ──
  const reminderTasks = tasks.filter(t => !t.completed && t.reminderTime);
  for (const task of reminderTasks) {
    const [h, m] = task.reminderTime!.split(':').map(Number);
    if (isNaN(h) || isNaN(m)) continue;

    const taskName = cleanTaskText(task.text);
    const title = isFr ? `⏰ Rappel` : `⏰ Reminder`;
    const body = taskName;

    if (task.recurrence && /every\s+day/i.test(task.recurrence)) {
      // Récurrente quotidienne → trigger DAILY
      await Notifications.scheduleNotificationAsync({
        identifier: `${CAT_TASK_REMINDER}-${task.sourceFile}:${task.lineIndex}`,
        content: { title, body, sound: true },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour: h, minute: m },
      });
      scheduled++;
    } else if (task.recurrence && /every\s+week/i.test(task.recurrence)) {
      // Récurrente hebdo → trigger WEEKLY (basé sur le jour de dueDate ou aujourd'hui)
      const refDate = task.dueDate ? new Date(task.dueDate + 'T12:00:00') : new Date();
      const weekday = refDate.getDay() === 0 ? 7 : refDate.getDay(); // 1=lun..7=dim
      await Notifications.scheduleNotificationAsync({
        identifier: `${CAT_TASK_REMINDER}-${task.sourceFile}:${task.lineIndex}`,
        content: { title, body, sound: true },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.WEEKLY, hour: h, minute: m, weekday },
      });
      scheduled++;
    } else if (task.dueDate) {
      // Tâche non-récurrente avec date → trigger DATE unique
      const [year, month, day] = task.dueDate.split('-').map(Number);
      if (!isNaN(year)) {
        const reminderDate = new Date(year, month - 1, day, h, m);
        if (reminderDate > now) {
          await Notifications.scheduleNotificationAsync({
            identifier: `${CAT_TASK_REMINDER}-${task.sourceFile}:${task.lineIndex}`,
            content: { title, body, sound: true },
            trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: reminderDate },
          });
          scheduled++;
        }
      }
    }
  }

  return scheduled;
}

// ─── 3. Ménage hebdomadaire ──────────────────────────────────────────────────

export async function setupMenageReminder(config: NotifScheduleConfig, lang: string = 'fr'): Promise<void> {
  await cancelByCategory(CAT_MENAGE);

  if (!config.menageEnabled) return;

  const isFr = lang === 'fr';
  await Notifications.scheduleNotificationAsync({
    identifier: `${CAT_MENAGE}-weekly`,
    content: {
      title: isFr ? '🧹 C\'est le jour du ménage !' : '🧹 Cleaning day!',
      body: isFr ? 'Ouvre Family Flow pour voir les tâches ménage' : 'Open Family Flow to see your cleaning tasks',
      sound: true,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
      weekday: config.menageDay,
      hour: config.menageHour,
      minute: config.menageMinute,
    },
  });
}

// ─── 4. Courses / stock bas ──────────────────────────────────────────────────

export async function scheduleCoursesAlert(
  stock: StockItem[],
  config: NotifScheduleConfig,
  lang: string = 'fr'
): Promise<void> {
  await cancelByCategory(CAT_COURSES);

  if (!config.coursesEnabled) return;

  const lowItems = stock.filter(s => s.tracked !== false && s.seuil > 0 && s.quantite <= s.seuil);
  if (lowItems.length === 0) return;

  const isFr = lang === 'fr';
  const n = lowItems.length;
  const body = n <= 3
    ? lowItems.map(s => s.produit).join(', ')
    : isFr
      ? `${lowItems.slice(0, 3).map(s => s.produit).join(', ')} et ${n - 3} autre${n - 3 > 1 ? 's' : ''}`
      : `${lowItems.slice(0, 3).map(s => s.produit).join(', ')} and ${n - 3} more`;

  await Notifications.scheduleNotificationAsync({
    identifier: `${CAT_COURSES}-daily`,
    content: {
      title: isFr
        ? `🛒 ${n} produit${n > 1 ? 's' : ''} en stock bas`
        : `🛒 ${n} item${n > 1 ? 's' : ''} running low`,
      body,
      sound: true,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour: config.coursesHour,
      minute: config.coursesMinute,
    },
  });
}

// ─── 5. Rappel général ───────────────────────────────────────────────────────

export async function setupGeneralReminder(config: NotifScheduleConfig, lang: string = 'fr'): Promise<void> {
  await cancelByCategory(CAT_GENERAL);

  if (!config.generalEnabled) return;

  const isFr = lang === 'fr';
  await Notifications.scheduleNotificationAsync({
    identifier: `${CAT_GENERAL}-daily`,
    content: {
      title: '📱 Family Flow',
      body: isFr ? 'Ouvre l\'app pour voir ton résumé du jour' : 'Open the app to see your daily summary',
      sound: true,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour: config.generalHour,
      minute: config.generalMinute,
    },
  });
}

// ─── 6. Grossesse hebdomadaire ───────────────────────────────────────────────

export async function setupGrossesseWeekly(config: NotifScheduleConfig, lang: string = 'fr'): Promise<void> {
  await cancelByCategory(CAT_GROSSESSE);

  if (!config.grossesseEnabled) return;

  const isFr = lang === 'fr';
  await Notifications.scheduleNotificationAsync({
    identifier: `${CAT_GROSSESSE}-weekly`,
    content: {
      title: isFr ? '🤰 Suivi grossesse' : '🤰 Pregnancy tracker',
      body: isFr ? 'Ouvre Family Flow pour envoyer la mise à jour hebdo' : 'Open Family Flow for your weekly update',
      sound: true,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
      weekday: config.grossesseDay,
      hour: config.grossesseHour,
      minute: config.grossesseMinute,
    },
  });
}

// ─── 7. Gratitude quotidienne ────────────────────────────────────────────────

const GRATITUDE_MESSAGES: Record<string, Array<{ title: string; body: string }>> = {
  fr: [
    { title: '🌙 Moment gratitude', body: 'Prends 1 minute pour noter ce qui t\'a rendu heureux aujourd\'hui' },
    { title: '✨ Avant de dormir…', body: 'Qu\'est-ce qui t\'a fait sourire aujourd\'hui ?' },
    { title: '🙏 Gratitude du soir', body: '3 petites choses positives de ta journée ?' },
    { title: '💛 Un instant pour toi', body: 'Note un moment de bonheur avant de fermer les yeux' },
    { title: '🌟 Ta dose de gratitude', body: 'De quoi es-tu reconnaissant(e) ce soir ?' },
  ],
  en: [
    { title: '🌙 Gratitude moment', body: 'Take 1 minute to note what made you happy today' },
    { title: '✨ Before you sleep…', body: 'What made you smile today?' },
    { title: '🙏 Evening gratitude', body: '3 good things about your day?' },
    { title: '💛 A moment for you', body: 'Write down a happy moment before closing your eyes' },
    { title: '🌟 Your daily gratitude', body: 'What are you grateful for tonight?' },
  ],
};

export async function setupGratitudeReminder(config: NotifScheduleConfig, lang: string = 'fr'): Promise<void> {
  await cancelByCategory(CAT_GRATITUDE);

  if (!config.gratitudeEnabled) return;

  // Choisir un message aléatoire basé sur le jour
  const messages = GRATITUDE_MESSAGES[lang] || GRATITUDE_MESSAGES.fr;
  const dayIndex = new Date().getDay();
  const msg = messages[dayIndex % messages.length];

  await Notifications.scheduleNotificationAsync({
    identifier: `${CAT_GRATITUDE}-daily`,
    content: {
      title: msg.title,
      body: msg.body,
      sound: true,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour: config.gratitudeHour,
      minute: config.gratitudeMinute,
    },
  });
}

// ─── 8. Résumé hebdo IA ─────────────────────────────────────────────────────

export async function setupWeeklyAISummaryReminder(config: NotifScheduleConfig, lang: string = 'fr'): Promise<void> {
  await cancelByCategory(CAT_WEEKLY_AI);

  if (!config.weeklyAISummaryEnabled) return;

  const isFr = lang === 'fr';
  await Notifications.scheduleNotificationAsync({
    identifier: `${CAT_WEEKLY_AI}-weekly`,
    content: {
      title: isFr ? '📬 Résumé hebdo' : '📬 Weekly summary',
      body: isFr ? 'Ouvre Family Flow pour envoyer le digest de la semaine' : 'Open Family Flow to send your weekly digest',
      sound: true,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
      weekday: 1, // dimanche (iOS weekday: 1=dimanche)
      hour: config.weeklyAISummaryHour,
      minute: config.weeklyAISummaryMinute,
    },
  });
}

// ─── Master setup ────────────────────────────────────────────────────────────

export interface NotifData {
  rdvs: RDV[];
  tasks: Task[];
  stock: StockItem[];
  hasGrossesse: boolean;
  lang?: string;
}

/**
 * Planifie toutes les notifications locales selon la config et les données.
 * Appeler au chargement du vault et quand les données changent.
 */
export async function setupAllNotifications(data: NotifData): Promise<{
  permitted: boolean;
  config: NotifScheduleConfig;
}> {
  const permitted = await requestNotificationPermissions();
  if (!permitted) {
    return { permitted: false, config: DEFAULT_CONFIG };
  }

  const config = await loadNotifConfig();
  const lang = data.lang || 'fr';

  await Promise.all([
    scheduleRDVAlerts(data.rdvs, config, lang),
    scheduleTaskAlerts(data.tasks, config, lang),
    setupMenageReminder(config, lang),
    scheduleCoursesAlert(data.stock, config, lang),
    setupGeneralReminder(config, lang),
    data.hasGrossesse ? setupGrossesseWeekly(config, lang) : cancelByCategory(CAT_GROSSESSE),
    setupGratitudeReminder(config, lang),
    setupWeeklyAISummaryReminder(config, lang),
  ]);

  return { permitted, config };
}

// ─── 9. Love Notes — reveal au revealAt (Phase 36) ──────────────────────────

function loveNoteIdentifier(sourceFile: string): string {
  // Sanitize / et . pour identifier sur
  return `${CAT_LOVENOTE}-${sourceFile.replace(/[/.]/g, '_')}`;
}

/**
 * Programme une notification locale silencieuse au revealAt de la note.
 * Idempotent : cancel precedente avant schedule.
 * Returns false si permission refusee OU revealAt deja passe (Pitfall 3).
 */
export async function scheduleLoveNoteReveal(note: LoveNote): Promise<boolean> {
  const permitted = await requestNotificationPermissions();
  if (!permitted) return false;

  // Cancel precedente (idempotence)
  await cancelLoveNoteReveal(note.sourceFile);

  // Parse revealAt en heure locale (ISO sans Z, cf types.ts:585)
  const [datePart, timePart] = note.revealAt.split('T');
  const [y, m, d] = datePart.split('-').map(Number);
  const [hh, mm, ss] = (timePart ?? '00:00:00').split(':').map(Number);
  const revealDate = new Date(y, m - 1, d, hh, mm, ss);

  if (revealDate.getTime() <= Date.now()) return false; // Pitfall 3

  try {
    await Notifications.scheduleNotificationAsync({
      identifier: loveNoteIdentifier(note.sourceFile),
      content: {
        title: '💌 Nouvelle love note',
        body: 'Une note vient d\'arriver dans ta boite aux lettres',
        sound: false,
        data: { route: '/(tabs)/lovenotes', sourceFile: note.sourceFile },
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: revealDate },
    });
    return true;
  } catch (e) {
    if (__DEV__) console.warn('[scheduleLoveNoteReveal]', e);
    return false;
  }
}

/** Annule la notif programmee pour cette love note. Idempotent (no-op si absente). */
export async function cancelLoveNoteReveal(sourceFile: string): Promise<void> {
  try {
    await Notifications.cancelScheduledNotificationAsync(loveNoteIdentifier(sourceFile));
  } catch {
    // Idempotent
  }
}

// ─── 10. Auberge — Visiteurs (Phase 46) ──────────────────────────────────────

/**
 * Schedule la notif "arrivée immédiate" du visiteur (trigger null).
 * Idempotent : cancel précédente avant schedule. Silencieux si permission refusée.
 */
export async function scheduleAubergeVisitorArrival(
  instanceId: string,
  visitorName: string,
  emoji: string,
  deadlineHours: number,
): Promise<void> {
  const permitted = await requestNotificationPermissions();
  if (!permitted) return;
  await cancelAubergeVisitorNotifs(instanceId);
  try {
    await Notifications.scheduleNotificationAsync({
      identifier: `${CAT_AUBERGE_ARRIVAL}-${instanceId}`,
      content: {
        title: `${emoji} ${visitorName} pousse la porte`,
        body: `Une commande l'attend — ${deadlineHours}h pour l'honorer.`,
        sound: true,
        data: { type: 'auberge_visitor_arrival', instanceId },
      },
      trigger: null,
    });
  } catch (e) {
    if (__DEV__) console.warn('[scheduleAubergeVisitorArrival]', e);
  }
}

/**
 * Schedule la notif "rappel H-4" — trigger DATE = deadlineAt - 4h.
 * Skip silencieux si reminderDate est déjà passé. Idempotent.
 */
export async function scheduleAubergeVisitorReminder(
  instanceId: string,
  visitorName: string,
  emoji: string,
  deadlineAt: Date,
): Promise<void> {
  const permitted = await requestNotificationPermissions();
  if (!permitted) return;
  const reminderDate = new Date(deadlineAt.getTime() - 4 * 60 * 60 * 1000);
  if (reminderDate.getTime() <= Date.now()) return;
  try {
    await Notifications.scheduleNotificationAsync({
      identifier: `${CAT_AUBERGE_REMINDER}-${instanceId}`,
      content: {
        title: `⏰ ${emoji} ${visitorName} s'impatiente`,
        body: `Plus que 4h avant son départ — la commande t'attend toujours.`,
        sound: true,
        data: { type: 'auberge_visitor_reminder', instanceId },
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: reminderDate },
    });
  } catch (e) {
    if (__DEV__) console.warn('[scheduleAubergeVisitorReminder]', e);
  }
}

/** Cancel toutes les notifs (arrival + reminder) d'un visiteur. Idempotent. */
export async function cancelAubergeVisitorNotifs(instanceId: string): Promise<void> {
  try {
    const all = await Notifications.getAllScheduledNotificationsAsync();
    for (const notif of all) {
      if (
        notif.identifier === `${CAT_AUBERGE_ARRIVAL}-${instanceId}` ||
        notif.identifier === `${CAT_AUBERGE_REMINDER}-${instanceId}`
      ) {
        await Notifications.cancelScheduledNotificationAsync(notif.identifier).catch(() => {});
      }
    }
  } catch (e) {
    if (__DEV__) console.warn('[cancelAubergeVisitorNotifs]', e);
  }
}
