/**
 * scheduled-notifications.ts — Local notifications for Family Vault
 *
 * Uses expo-notifications to schedule recurring reminders and RDV alerts.
 * Works in Expo Go AND TestFlight builds.
 */

import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { RDV } from './types';
import * as SecureStore from 'expo-secure-store';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface NotifScheduleConfig {
  morningEnabled: boolean;
  morningHour: number;    // default 7
  morningMinute: number;  // default 30
  middayEnabled: boolean;
  middayHour: number;     // default 12
  middayMinute: number;   // default 0
  eveningEnabled: boolean;
  eveningHour: number;    // default 20
  eveningMinute: number;  // default 0
  rdvAlertEnabled: boolean;
  rdvAlertMinutes: number; // minutes before RDV, default 60
  grossesseWeeklyEnabled: boolean;
  grossesseWeeklyDay: number; // 1=lundi … 7=dimanche (ISO weekday)
  grossesseWeeklyHour: number;
  grossesseWeeklyMinute: number;
}

const DEFAULT_CONFIG: NotifScheduleConfig = {
  morningEnabled: true,
  morningHour: 7,
  morningMinute: 30,
  middayEnabled: true,
  middayHour: 12,
  middayMinute: 0,
  eveningEnabled: true,
  eveningHour: 20,
  eveningMinute: 0,
  rdvAlertEnabled: true,
  rdvAlertMinutes: 60,
  grossesseWeeklyEnabled: false,
  grossesseWeeklyDay: 1, // lundi
  grossesseWeeklyHour: 9,
  grossesseWeeklyMinute: 0,
};

const STORAGE_KEY = 'notif_schedule_config';
const CATEGORY_MORNING = 'morning-reminder';
const CATEGORY_MIDDAY = 'midday-reminder';
const CATEGORY_EVENING = 'evening-reminder';
const CATEGORY_RDV = 'rdv-alert';
const CATEGORY_GROSSESSE = 'grossesse-weekly';

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

// ─── Daily recurring reminders ───────────────────────────────────────────────

/** Cancel all scheduled notifications for a given category prefix */
async function cancelByCategory(prefix: string): Promise<void> {
  const all = await Notifications.getAllScheduledNotificationsAsync();
  for (const notif of all) {
    if (notif.identifier.startsWith(prefix)) {
      await Notifications.cancelScheduledNotificationAsync(notif.identifier);
    }
  }
}

/** Schedule or update all daily recurring reminders based on config */
export async function setupDailyReminders(config: NotifScheduleConfig): Promise<void> {
  // Cancel existing daily reminders
  await cancelByCategory(CATEGORY_MORNING);
  await cancelByCategory(CATEGORY_MIDDAY);
  await cancelByCategory(CATEGORY_EVENING);

  if (config.morningEnabled) {
    await Notifications.scheduleNotificationAsync({
      identifier: `${CATEGORY_MORNING}-daily`,
      content: {
        title: '☀️ Bonjour !',
        body: 'Ouvre Family Vault pour ton résumé du jour',
        sound: true,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour: config.morningHour,
        minute: config.morningMinute,
      },
    });
  }

  if (config.middayEnabled) {
    await Notifications.scheduleNotificationAsync({
      identifier: `${CATEGORY_MIDDAY}-daily`,
      content: {
        title: '📋 Check du midi',
        body: 'Tâches en cours, journaux à remplir ?',
        sound: true,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour: config.middayHour,
        minute: config.middayMinute,
      },
    });
  }

  if (config.eveningEnabled) {
    await Notifications.scheduleNotificationAsync({
      identifier: `${CATEGORY_EVENING}-daily`,
      content: {
        title: '🌙 Bilan du soir',
        body: 'Bilan de la journée disponible',
        sound: true,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour: config.eveningHour,
        minute: config.eveningMinute,
      },
    });
  }
}

// ─── RDV Alerts ──────────────────────────────────────────────────────────────

/** Schedule alerts for upcoming RDVs (1h before by default) */
export async function scheduleRDVAlerts(
  rdvs: RDV[],
  minutesBefore: number = 60
): Promise<number> {
  // Cancel all existing RDV alerts
  await cancelByCategory(CATEGORY_RDV);

  const now = new Date();
  let scheduled = 0;

  for (const rdv of rdvs) {
    if (rdv.statut !== 'planifié') continue;
    if (!rdv.date_rdv || !rdv.heure) continue;

    // Parse RDV datetime
    const [year, month, day] = rdv.date_rdv.split('-').map(Number);
    const [hour, minute] = rdv.heure.split(':').map(Number);
    if (isNaN(year) || isNaN(hour)) continue;

    const rdvDate = new Date(year, month - 1, day, hour, minute);
    const alertDate = new Date(rdvDate.getTime() - minutesBefore * 60 * 1000);

    // Only schedule future alerts
    if (alertDate <= now) continue;

    const typeLabel = rdv.type_rdv || 'RDV';
    const enfantLabel = rdv.enfant || '';
    const lieuLabel = rdv.lieu ? ` — ${rdv.lieu}` : '';

    await Notifications.scheduleNotificationAsync({
      identifier: `${CATEGORY_RDV}-${rdv.sourceFile}`,
      content: {
        title: `🏥 ${typeLabel} ${enfantLabel}`,
        body: `Dans ${minutesBefore} min · ${rdv.heure}${lieuLabel}`,
        sound: true,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: alertDate,
      },
    });

    scheduled++;
  }

  return scheduled;
}

// ─── Grossesse weekly reminder ───────────────────────────────────────────────

/** Schedule or cancel the weekly pregnancy reminder notification */
export async function setupGrossesseWeekly(config: NotifScheduleConfig): Promise<void> {
  await cancelByCategory(CATEGORY_GROSSESSE);

  if (!config.grossesseWeeklyEnabled) return;

  await Notifications.scheduleNotificationAsync({
    identifier: `${CATEGORY_GROSSESSE}-weekly`,
    content: {
      title: '🤰 Suivi grossesse',
      body: 'Ouvre Family Vault pour envoyer la mise à jour hebdo',
      sound: true,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
      weekday: config.grossesseWeeklyDay,
      hour: config.grossesseWeeklyHour,
      minute: config.grossesseWeeklyMinute,
    },
  });
}

// ─── Master setup ────────────────────────────────────────────────────────────

/**
 * Full notification setup: request permissions, load config, schedule everything.
 * Call this when the app opens and data is loaded.
 */
export async function setupAllNotifications(rdvs: RDV[]): Promise<{
  permitted: boolean;
  config: NotifScheduleConfig;
  rdvScheduled: number;
}> {
  const permitted = await requestNotificationPermissions();
  if (!permitted) {
    return { permitted: false, config: DEFAULT_CONFIG, rdvScheduled: 0 };
  }

  const config = await loadNotifConfig();
  await setupDailyReminders(config);
  await setupGrossesseWeekly(config);
  const rdvScheduled = config.rdvAlertEnabled
    ? await scheduleRDVAlerts(rdvs, config.rdvAlertMinutes)
    : 0;

  return { permitted, config, rdvScheduled };
}
