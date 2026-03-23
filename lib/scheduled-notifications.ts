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
};

const STORAGE_KEY = 'notif_schedule_config_v2';

const CAT_RDV_VEILLE = 'rdv-veille';
const CAT_RDV_MATIN = 'rdv-matin';
const CAT_RDV_AVANT = 'rdv-avant';
const CAT_TASK = 'task-due';
const CAT_MENAGE = 'menage-weekly';
const CAT_COURSES = 'courses-stock';
const CAT_GENERAL = 'general-daily';
const CAT_GROSSESSE = 'grossesse-weekly';
const CAT_GRATITUDE = 'gratitude-daily';
const CAT_WEEKLY_AI = 'weekly-ai-summary';

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

function formatDate(d: string): string {
  const [y, m, day] = d.split('-');
  return `${day}/${m}/${y}`;
}

// ─── 1. RDV ──────────────────────────────────────────────────────────────────

export async function scheduleRDVAlerts(
  rdvs: RDV[],
  config: NotifScheduleConfig
): Promise<number> {
  await cancelByCategory(CAT_RDV_VEILLE);
  await cancelByCategory(CAT_RDV_MATIN);
  await cancelByCategory(CAT_RDV_AVANT);

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
    const typeLabel = rdv.type_rdv || 'RDV';
    const enfantLabel = rdv.enfant ? ` ${rdv.enfant}` : '';
    const lieuLabel = rdv.lieu ? ` — ${rdv.lieu}` : '';

    // Veille à 20h
    const veilleDate = new Date(year, month - 1, day - 1, config.rdvVeilleHour, 0);
    if (veilleDate > now) {
      await Notifications.scheduleNotificationAsync({
        identifier: `${CAT_RDV_VEILLE}-${rdv.sourceFile}`,
        content: {
          title: `🏥 Demain : ${typeLabel}${enfantLabel}`,
          body: `À ${rdv.heure}${lieuLabel}`,
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
          title: `🏥 Aujourd'hui : ${typeLabel}${enfantLabel}`,
          body: `À ${rdv.heure}${lieuLabel}`,
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
          body: `Dans ${config.rdvAvantMinutes} min · ${rdv.heure}${lieuLabel}`,
          sound: true,
        },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: avantDate },
      });
      scheduled++;
    }
  }

  return scheduled;
}

// ─── 2. Tâches avec échéance ─────────────────────────────────────────────────

export async function scheduleTaskAlerts(
  tasks: Task[],
  config: NotifScheduleConfig
): Promise<number> {
  await cancelByCategory(CAT_TASK);

  if (!config.taskEnabled) return 0;

  const now = new Date();
  let scheduled = 0;

  const dueTasks = tasks.filter(t => !t.completed && t.dueDate);

  for (const task of dueTasks) {
    const [year, month, day] = task.dueDate!.split('-').map(Number);
    if (isNaN(year)) continue;

    // Jour J
    const jourJ = new Date(year, month - 1, day, config.taskHour, config.taskMinute);
    if (jourJ > now) {
      await Notifications.scheduleNotificationAsync({
        identifier: `${CAT_TASK}-${task.id}`,
        content: {
          title: '📋 Tâche à faire aujourd\'hui',
          body: task.text.replace(/📅.*$/, '').replace(/#\w+/g, '').trim(),
          sound: true,
        },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: jourJ },
      });
      scheduled++;
    }

    // Veille
    if (config.taskVeille) {
      const veille = new Date(year, month - 1, day - 1, config.rdvVeilleHour, 0);
      if (veille > now) {
        await Notifications.scheduleNotificationAsync({
          identifier: `${CAT_TASK}-veille-${task.id}`,
          content: {
            title: '📋 Tâche demain',
            body: task.text.replace(/📅.*$/, '').replace(/#\w+/g, '').trim(),
            sound: true,
          },
          trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: veille },
        });
        scheduled++;
      }
    }
  }

  return scheduled;
}

// ─── 3. Ménage hebdomadaire ──────────────────────────────────────────────────

export async function setupMenageReminder(config: NotifScheduleConfig): Promise<void> {
  await cancelByCategory(CAT_MENAGE);

  if (!config.menageEnabled) return;

  await Notifications.scheduleNotificationAsync({
    identifier: `${CAT_MENAGE}-weekly`,
    content: {
      title: '🧹 C\'est le jour du ménage !',
      body: 'Ouvre Family Flow pour voir les tâches ménage',
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
  config: NotifScheduleConfig
): Promise<void> {
  await cancelByCategory(CAT_COURSES);

  if (!config.coursesEnabled) return;

  const lowItems = stock.filter(s => s.tracked !== false && s.seuil > 0 && s.quantite <= s.seuil);
  if (lowItems.length === 0) return;

  const body = lowItems.length <= 3
    ? lowItems.map(s => s.produit).join(', ')
    : `${lowItems.slice(0, 3).map(s => s.produit).join(', ')} et ${lowItems.length - 3} autre${lowItems.length - 3 > 1 ? 's' : ''}`;

  await Notifications.scheduleNotificationAsync({
    identifier: `${CAT_COURSES}-daily`,
    content: {
      title: `🛒 ${lowItems.length} produit${lowItems.length > 1 ? 's' : ''} en stock bas`,
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

export async function setupGeneralReminder(config: NotifScheduleConfig): Promise<void> {
  await cancelByCategory(CAT_GENERAL);

  if (!config.generalEnabled) return;

  await Notifications.scheduleNotificationAsync({
    identifier: `${CAT_GENERAL}-daily`,
    content: {
      title: '📱 Family Flow',
      body: 'Ouvre l\'app pour voir ton résumé du jour',
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

export async function setupGrossesseWeekly(config: NotifScheduleConfig): Promise<void> {
  await cancelByCategory(CAT_GROSSESSE);

  if (!config.grossesseEnabled) return;

  await Notifications.scheduleNotificationAsync({
    identifier: `${CAT_GROSSESSE}-weekly`,
    content: {
      title: '🤰 Suivi grossesse',
      body: 'Ouvre Family Flow pour envoyer la mise à jour hebdo',
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

const GRATITUDE_MESSAGES = [
  { title: '🌙 Moment gratitude', body: 'Prends 1 minute pour noter ce qui t\'a rendu heureux aujourd\'hui' },
  { title: '✨ Avant de dormir…', body: 'Qu\'est-ce qui t\'a fait sourire aujourd\'hui ?' },
  { title: '🙏 Gratitude du soir', body: '3 petites choses positives de ta journée ?' },
  { title: '💛 Un instant pour toi', body: 'Note un moment de bonheur avant de fermer les yeux' },
  { title: '🌟 Ta dose de gratitude', body: 'De quoi es-tu reconnaissant(e) ce soir ?' },
];

export async function setupGratitudeReminder(config: NotifScheduleConfig): Promise<void> {
  await cancelByCategory(CAT_GRATITUDE);

  if (!config.gratitudeEnabled) return;

  // Choisir un message aléatoire basé sur le jour
  const dayIndex = new Date().getDay();
  const msg = GRATITUDE_MESSAGES[dayIndex % GRATITUDE_MESSAGES.length];

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

export async function setupWeeklyAISummaryReminder(config: NotifScheduleConfig): Promise<void> {
  await cancelByCategory(CAT_WEEKLY_AI);

  if (!config.weeklyAISummaryEnabled) return;

  await Notifications.scheduleNotificationAsync({
    identifier: `${CAT_WEEKLY_AI}-weekly`,
    content: {
      title: '📬 Résumé hebdo',
      body: 'Ouvre Family Flow pour envoyer le digest de la semaine',
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

  await Promise.all([
    scheduleRDVAlerts(data.rdvs, config),
    scheduleTaskAlerts(data.tasks, config),
    setupMenageReminder(config),
    scheduleCoursesAlert(data.stock, config),
    setupGeneralReminder(config),
    data.hasGrossesse ? setupGrossesseWeekly(config) : cancelByCategory(CAT_GROSSESSE),
    setupGratitudeReminder(config),
    setupWeeklyAISummaryReminder(config),
  ]);

  return { permitted, config };
}
