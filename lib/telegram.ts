/**
 * telegram.ts — Send messages to Telegram
 *
 * The app sends messages TO Telegram (no webhook/listener needed).
 * Token + chatId are stored in expo-secure-store.
 *
 * Commands supported (sent as messages, not bot commands):
 * - Task completed notification
 * - Loot box result
 * - Daily summary
 * - Score/leaderboard
 */

import { Profile, Memory, RDV } from './types';
import { formatDateLocalized } from './date-locale';

const TELEGRAM_API = 'https://api.telegram.org';

export async function sendTelegram(
  token: string,
  chatId: string,
  text: string,
  parseMode: 'HTML' | 'Markdown' = 'HTML'
): Promise<boolean> {
  try {
    const res = await fetch(`${TELEGRAM_API}/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: parseMode,
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function testTelegram(token: string, chatId: string): Promise<boolean> {
  return sendTelegram(
    token,
    chatId,
    '✅ <b>Family Vault</b> connecté ! Les notifications Telegram fonctionnent.'
  );
}

// ─── Weekly AI Summary ──────────────────────────────────────────────────────

import * as SecureStore from 'expo-secure-store';
import { generateWeeklyBilan, type AIConfig } from './ai-service';
import { buildWeeklyRecapData, formatRecapForAI } from './weekly-recap';
import type { Task, MealItem, MoodEntry, ChildQuote, Defi, StockItem } from './types';

const WEEKLY_SUMMARY_LAST_SENT_KEY = 'weekly_summary_last_sent';
const AI_API_KEY = 'ai_api_key';
const AI_MODEL_KEY = 'ai_model';
const TELEGRAM_TOKEN_KEY_T = 'telegram_token';
const TELEGRAM_CHAT_KEY_T = 'telegram_chat_id';

/**
 * Vérifie si le résumé hebdo doit être envoyé (dimanche, pas encore envoyé cette semaine).
 */
export async function shouldSendWeeklySummary(): Promise<boolean> {
  const now = new Date();
  if (now.getDay() !== 0) return false; // Pas dimanche

  const lastSent = await SecureStore.getItemAsync(WEEKLY_SUMMARY_LAST_SENT_KEY);
  if (!lastSent) return true;

  // Déjà envoyé aujourd'hui ?
  const todayStr = now.toISOString().slice(0, 10);
  return lastSent !== todayStr;
}

/**
 * Génère le bilan de semaine via IA et l'envoie sur Telegram.
 * Utilise le même pipeline que la carte in-app (buildWeeklyRecapData + generateWeeklyBilan).
 */
export async function buildAndSendWeeklySummary(data: {
  tasks: Task[];
  meals: MealItem[];
  moods: MoodEntry[];
  quotes: ChildQuote[];
  defis: Defi[];
  profiles: Profile[];
  stock: StockItem[];
}): Promise<{ sent: boolean; error?: string }> {
  // 1. Vérifier la clé API Claude
  const apiKey = await SecureStore.getItemAsync(AI_API_KEY);
  const model = (await SecureStore.getItemAsync(AI_MODEL_KEY)) || 'claude-haiku-4-5-20251001';
  if (!apiKey) return { sent: false, error: 'Clé API Claude non configurée' };

  // 2. Vérifier Telegram
  const token = await SecureStore.getItemAsync(TELEGRAM_TOKEN_KEY_T);
  const chatId = await SecureStore.getItemAsync(TELEGRAM_CHAT_KEY_T);
  if (!token || !chatId) return { sent: false, error: 'Telegram non configuré' };

  // 3. Agréger les données de la semaine et générer le bilan IA
  const recap = buildWeeklyRecapData(
    data.tasks, data.tasks.filter(t => t.section != null && t.section.toLowerCase().includes('ménage')), data.meals, data.moods,
    data.quotes, data.defis, data.profiles, data.stock,
  );
  const recapText = formatRecapForAI(recap);
  const config: AIConfig = { apiKey, model };
  const response = await generateWeeklyBilan(config, recapText);
  if (response.error) return { sent: false, error: response.error };
  if (!response.text) return { sent: false, error: 'Résumé vide' };

  // 4. Envoyer sur Telegram
  const header = '📬 <b>Bilan de semaine — Family Vault</b>\n\n';
  const ok = await sendTelegram(token, chatId, header + response.text);
  if (!ok) return { sent: false, error: 'Échec envoi Telegram' };

  // 5. Marquer comme envoyé
  const todayStr = new Date().toISOString().slice(0, 10);
  await SecureStore.setItemAsync(WEEKLY_SUMMARY_LAST_SENT_KEY, todayStr);

  return { sent: true };
}

// ─── Grossesse Weekly Update ────────────────────────────────────────────────

/** Fruit size comparison by week of pregnancy (SA = semaines d'aménorrhée) */
const FRUIT_BY_WEEK: Record<number, { fruit: string; emoji: string; taille: string }> = {
  4: { fruit: 'graine de pavot', emoji: '🫘', taille: '1 mm' },
  5: { fruit: 'grain de sésame', emoji: '🫘', taille: '2 mm' },
  6: { fruit: 'lentille', emoji: '🫘', taille: '4 mm' },
  7: { fruit: 'myrtille', emoji: '🫐', taille: '1 cm' },
  8: { fruit: 'framboise', emoji: '🫐', taille: '1.5 cm' },
  9: { fruit: 'cerise', emoji: '🍒', taille: '2.5 cm' },
  10: { fruit: 'fraise', emoji: '🍓', taille: '3 cm' },
  11: { fruit: 'figue', emoji: '🫒', taille: '4 cm' },
  12: { fruit: 'citron vert', emoji: '🍋', taille: '5.5 cm' },
  13: { fruit: 'kiwi', emoji: '🥝', taille: '7 cm' },
  14: { fruit: 'citron', emoji: '🍋', taille: '8.5 cm' },
  15: { fruit: 'pomme', emoji: '🍎', taille: '10 cm' },
  16: { fruit: 'avocat', emoji: '🥑', taille: '11.5 cm' },
  17: { fruit: 'poire', emoji: '🍐', taille: '13 cm' },
  18: { fruit: 'poivron', emoji: '🫑', taille: '14 cm' },
  19: { fruit: 'tomate', emoji: '🍅', taille: '15 cm' },
  20: { fruit: 'banane', emoji: '🍌', taille: '25 cm' },
  21: { fruit: 'carotte', emoji: '🥕', taille: '26 cm' },
  22: { fruit: 'épi de maïs', emoji: '🌽', taille: '27 cm' },
  23: { fruit: 'mangue', emoji: '🥭', taille: '28 cm' },
  24: { fruit: 'grenade', emoji: '🫒', taille: '30 cm' },
  25: { fruit: 'chou-fleur', emoji: '🥦', taille: '34 cm' },
  26: { fruit: 'laitue', emoji: '🥬', taille: '35 cm' },
  27: { fruit: 'brocoli', emoji: '🥦', taille: '36 cm' },
  28: { fruit: 'aubergine', emoji: '🍆', taille: '37 cm' },
  29: { fruit: 'courge butternut', emoji: '🎃', taille: '38 cm' },
  30: { fruit: 'concombre', emoji: '🥒', taille: '40 cm' },
  31: { fruit: 'noix de coco', emoji: '🥥', taille: '41 cm' },
  32: { fruit: 'chou chinois', emoji: '🥬', taille: '42 cm' },
  33: { fruit: 'ananas', emoji: '🍍', taille: '43 cm' },
  34: { fruit: 'melon cantaloup', emoji: '🍈', taille: '45 cm' },
  35: { fruit: 'melon miel', emoji: '🍈', taille: '46 cm' },
  36: { fruit: 'papaye', emoji: '🫒', taille: '47 cm' },
  37: { fruit: 'courge spaghetti', emoji: '🎃', taille: '48 cm' },
  38: { fruit: 'poireau', emoji: '🥬', taille: '49 cm' },
  39: { fruit: 'mini pastèque', emoji: '🍉', taille: '50 cm' },
  40: { fruit: 'pastèque', emoji: '🍉', taille: '51 cm' },
  41: { fruit: 'citrouille', emoji: '🎃', taille: '52 cm' },
};

/** Get the closest fruit for a given SA week */
function getFruitForWeek(sa: number): { fruit: string; emoji: string; taille: string } {
  if (sa < 4) return FRUIT_BY_WEEK[4];
  if (sa > 41) return FRUIT_BY_WEEK[41];
  // Find closest key
  const keys = Object.keys(FRUIT_BY_WEEK).map(Number).sort((a, b) => a - b);
  for (let i = keys.length - 1; i >= 0; i--) {
    if (sa >= keys[i]) return FRUIT_BY_WEEK[keys[i]];
  }
  return FRUIT_BY_WEEK[4];
}

/**
 * Build the weekly grossesse update text.
 */
export function buildGrossesseUpdateText(profiles: Array<{ name: string; dateTerme?: string; statut?: string }>): string {
  const grossesses = profiles.filter((p) => p.statut === 'grossesse' && p.dateTerme);
  if (grossesses.length === 0) return '';

  const lines: string[] = ['🤰 <b>Suivi grossesse — mise à jour hebdo</b>\n'];

  for (const p of grossesses) {
    const terme = new Date(p.dateTerme!);
    const now = new Date();
    const daysLeft = Math.ceil((terme.getTime() - now.getTime()) / 86400000);
    // SA = semaines d'aménorrhée (terme = 41 SA, so current SA = 41 - weeksLeft)
    const weeksLeft = Math.ceil(daysLeft / 7);
    const sa = Math.max(4, 41 - weeksLeft);
    const { fruit, emoji, taille } = getFruitForWeek(sa);

    lines.push(`👶 <b>${p.name}</b>`);
    lines.push(`📅 Terme prévu : ${p.dateTerme}`);
    lines.push(`⏳ ${daysLeft > 0 ? `J-${daysLeft} (${weeksLeft} semaines)` : daysLeft === 0 ? "C'est pour aujourd'hui !" : `J+${Math.abs(daysLeft)} — bébé se fait désirer !`}`);
    lines.push(`📏 Semaine ${sa} SA — environ ${taille}`);
    lines.push(`${emoji} Bébé a la taille d'${fruit.match(/^[aeiouyéèêë]/i) ? 'un·e ' : 'un·e '}${fruit}\n`);
  }

  return lines.join('\n');
}

// ─── Monthly Recap ──────────────────────────────────────────────────────────

export function buildMonthlyRecapText(data: {
  profiles: Profile[];
  memories: Memory[];
  rdvs: RDV[];
  photoCount: number;
  completedTasksCount: number;
  month: string;
}): string {
  const lines: string[] = [`📊 <b>Bilan du mois — ${data.month}</b>\n`];

  if (data.profiles.length > 0) {
    lines.push('🏆 <b>Points du mois</b>');
    const sorted = [...data.profiles].sort((a, b) => b.points - a.points);
    const medals = ['🥇', '🥈', '🥉'];
    for (let i = 0; i < sorted.length; i++) {
      const p = sorted[i];
      lines.push(`  ${medals[i] ?? '  '} ${p.avatar} <b>${p.name}</b> — ${p.points} pts · Niv. ${p.level} · 🔥 ${p.streak}j`);
    }
    lines.push('');
  }

  if (data.completedTasksCount > 0) {
    lines.push(`✅ <b>${data.completedTasksCount} tâche(s)</b> accomplies ce mois`);
  }

  const doneRdvs = data.rdvs.filter((r) => r.statut === 'fait');
  if (doneRdvs.length > 0) {
    lines.push(`📅 <b>${doneRdvs.length} rendez-vous</b> effectué(s)`);
    for (const rdv of doneRdvs) {
      lines.push(`  • ${rdv.type_rdv} — ${rdv.enfant} (${formatDateLocalized(rdv.date_rdv)})`);
    }
    lines.push('');
  }

  if (data.photoCount > 0) {
    lines.push(`📸 <b>${data.photoCount} photo(s)</b> enregistrée(s)`);
  }

  if (data.memories.length > 0) {
    lines.push('');
    lines.push('🌟 <b>Souvenirs du mois</b>');
    for (const m of data.memories) {
      lines.push(`  • <b>${m.title}</b> — ${m.enfant} (${formatDateLocalized(m.date)})`);
      if (m.description) lines.push(`    <i>${m.description}</i>`);
    }
  }

  if (data.memories.length === 0 && data.photoCount === 0 && data.completedTasksCount === 0) {
    lines.push('Un mois calme — mais tout va bien ! 😊');
  }

  return lines.join('\n');
}

// ─── Photo sending ──────────────────────────────────────────────────────────

/**
 * Send a single photo to Telegram.
 * Uses React Native's FormData with { uri, type, name } — the standard
 * pattern for file uploads in RN/Expo Go (no native modules needed).
 */
export async function sendTelegramPhoto(
  token: string,
  chatId: string,
  photoUri: string,
  caption?: string
): Promise<boolean> {
  try {
    // Normalize URI — decode %20 back to spaces, ensure file:// prefix
    let fileUri = decodeURIComponent(photoUri);
    if (!fileUri.startsWith('file://')) {
      fileUri = `file://${fileUri}`;
    }

    // React Native FormData accepts { uri, type, name } objects as file references
    const formData = new FormData();
    formData.append('chat_id', chatId);
    formData.append('photo', {
      uri: fileUri,
      type: 'image/jpeg',
      name: 'photo.jpg',
    } as any);
    if (caption) {
      formData.append('caption', caption);
      formData.append('parse_mode', 'HTML');
    }

    const res = await fetch(`${TELEGRAM_API}/bot${token}/sendPhoto`, {
      method: 'POST',
      body: formData,
    });
    return res.ok;
  } catch {
    return false;
  }
}

// ─── Weekly Recap ───────────────────────────────────────────────────────────

/**
 * Build the weekly recap text message for grandparents.
 */
export function buildWeeklyRecapText(data: {
  memories: Memory[];
  photoCount: number;
  enfantNames: string[];
}): string {
  const lines: string[] = ['📬 <b>Recap de la semaine</b>\n'];

  // Premières fois
  const firsts = data.memories.filter((m) => m.type === 'premières-fois');
  if (firsts.length > 0) {
    lines.push('🌟 <b>Premières fois</b>');
    for (const m of firsts) {
      lines.push(`  • <b>${m.title}</b> — ${m.enfant} (${formatDateLocalized(m.date)})`);
      if (m.description) lines.push(`    <i>${m.description}</i>`);
    }
    lines.push('');
  }

  // Moments forts
  const moments = data.memories.filter((m) => m.type === 'moment-fort');
  if (moments.length > 0) {
    lines.push('💛 <b>Moments forts</b>');
    for (const m of moments) {
      lines.push(`  • <b>${m.title}</b> — ${m.enfant} (${formatDateLocalized(m.date)})`);
      if (m.description) lines.push(`    <i>${m.description}</i>`);
    }
    lines.push('');
  }

  // Photo count
  if (data.photoCount > 0) {
    lines.push(`📸 <b>${data.photoCount} photo${data.photoCount > 1 ? 's' : ''}</b> cette semaine`);
  }

  if (data.memories.length === 0 && data.photoCount === 0) {
    lines.push('Pas de nouveaux souvenirs cette semaine — mais tout va bien ! 😊');
  }

  return lines.join('\n');
}

/**
 * Send a group of photos as an album via sendMediaGroup.
 * Telegram accepts max 10 photos per group.
 * Uses RN FormData with { uri, type, name } for each file.
 */
export async function sendTelegramMediaGroup(
  token: string,
  chatId: string,
  photoUris: string[],
  caption?: string
): Promise<boolean> {
  if (photoUris.length === 0) return true;
  const batch = photoUris.slice(0, 10);

  try {
    const formData = new FormData();
    formData.append('chat_id', chatId);

    // Build media JSON array — each item references an attached file by field name
    const media = batch.map((_, i) => {
      const item: Record<string, string> = {
        type: 'photo',
        media: `attach://photo${i}`,
      };
      // Caption on first photo only
      if (i === 0 && caption) {
        item.caption = caption;
        item.parse_mode = 'HTML';
      }
      return item;
    });
    formData.append('media', JSON.stringify(media));

    // Attach each photo file
    for (let i = 0; i < batch.length; i++) {
      let fileUri = decodeURIComponent(batch[i]);
      if (!fileUri.startsWith('file://')) {
        fileUri = `file://${fileUri}`;
      }
      formData.append(`photo${i}`, {
        uri: fileUri,
        type: 'image/jpeg',
        name: `photo${i}.jpg`,
      } as any);
    }

    const res = await fetch(`${TELEGRAM_API}/bot${token}/sendMediaGroup`, {
      method: 'POST',
      body: formData,
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Send the full weekly recap to grandparents.
 * 1. Sends the text message
 * 2. Sends photos grouped as albums (max 10 per album)
 */
export async function sendWeeklyRecap(
  token: string,
  chatId: string,
  text: string,
  photoUris: string[]
): Promise<boolean> {
  // Send text message first
  const textOk = await sendTelegram(token, chatId, text);
  if (!textOk) return false;

  // Send photos: single photo via sendPhoto, multiple via sendMediaGroup (min 2)
  if (photoUris.length === 1) {
    await sendTelegramPhoto(token, chatId, photoUris[0]);
  } else {
    for (let i = 0; i < photoUris.length; i += 10) {
      const batch = photoUris.slice(i, i + 10);
      await sendTelegramMediaGroup(token, chatId, batch);
    }
  }

  return true;
}
