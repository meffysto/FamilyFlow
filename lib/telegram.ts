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

import { Profile, LootBox, Memory } from './types';
import { formatDateForDisplay } from './parser';

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

/** @deprecated Use dispatchNotification with 'task_completed' instead */
export function formatTaskCompletedMessage(profile: Profile, taskText: string, points: number): string {
  return `${profile.avatar} <b>${profile.name}</b> a terminé une tâche !\n\n` +
    `📋 <i>${taskText}</i>\n` +
    `+${points} points → Total : <b>${profile.points} pts</b> (Niveau ${profile.level})` +
    (profile.lootBoxesAvailable > 0
      ? `\n\n🎁 <b>Loot box disponible !</b> Ouvre l'app pour l'ouvrir.`
      : '');
}

/** @deprecated Use dispatchNotification with 'loot_box_opened' instead */
export function formatLootBoxMessage(profile: Profile, box: LootBox): string {
  const rarityEmojis: Record<string, string> = {
    commun: '⭐',
    rare: '💙',
    épique: '💜',
    légendaire: '🌟',
  };

  return `${rarityEmojis[box.rarity]} <b>${profile.name}</b> a ouvert une loot box !\n\n` +
    `${box.emoji} <b>${box.rarity.toUpperCase()}</b>\n` +
    `🎁 ${box.reward}` +
    (box.bonusPoints > 0 ? `\n+${box.bonusPoints} points bonus !` : '') +
    (box.requiresParent ? '\n\n👨‍👩‍👧 <i>Récompense à valider par un parent !</i>' : '');
}

/** @deprecated Use dispatchNotification with 'all_tasks_done' instead */
export function formatAllTasksDoneMessage(completedCount: number, profiles: Profile[]): string {
  const sorted = [...profiles].sort((a, b) => b.points - a.points);
  const medals = ['🥇', '🥈', '🥉'];
  const lines = sorted.map((p, i) =>
    `${medals[i] ?? '  '} ${p.avatar} <b>${p.name}</b> — ${p.points} pts`
  );

  return `🎉 <b>Journée terminée !</b>\n\n` +
    `✅ ${completedCount} tâche(s) complétée(s) aujourd'hui\n\n` +
    `🏆 <b>Classement</b>\n${lines.join('\n')}\n\n` +
    `Bravo à toute la famille ! 💪`;
}

/** @deprecated Use dispatchNotification with 'leaderboard' instead */
export function formatLeaderboardMessage(profiles: Profile[]): string {
  const medals = ['🥇', '🥈', '🥉'];
  const lines = profiles.map((p, i) =>
    `${medals[i] ?? '  '} ${p.avatar} <b>${p.name}</b> — ${p.points} pts | Niv. ${p.level} | 🔥 ${p.streak}j`
  );

  return `🏆 <b>Classement Famille</b>\n\n${lines.join('\n')}`;
}

/** @deprecated Use dispatchNotification with 'daily_summary' instead */
export function formatDailySummaryMessage(
  pendingCount: number,
  completedCount: number,
  profiles: Profile[]
): string {
  const top = profiles[0];
  return `📋 <b>Résumé du jour</b>\n\n` +
    `✅ ${completedCount} tâche(s) terminée(s)\n` +
    `⏳ ${pendingCount} tâche(s) restante(s)\n\n` +
    (top ? `🏆 Leader du jour : ${top.avatar} <b>${top.name}</b> (${top.points} pts)` : '');
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
      lines.push(`  • <b>${m.title}</b> — ${m.enfant} (${formatDateForDisplay(m.date)})`);
      if (m.description) lines.push(`    <i>${m.description}</i>`);
    }
    lines.push('');
  }

  // Moments forts
  const moments = data.memories.filter((m) => m.type === 'moment-fort');
  if (moments.length > 0) {
    lines.push('💛 <b>Moments forts</b>');
    for (const m of moments) {
      lines.push(`  • <b>${m.title}</b> — ${m.enfant} (${formatDateForDisplay(m.date)})`);
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
 * Send the full weekly recap to grandparents.
 * 1. Sends the text message
 * 2. Sends photos one by one (max 10)
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

  // Send photos (max 10)
  const photosToSend = photoUris.slice(0, 10);
  for (const uri of photosToSend) {
    await sendTelegramPhoto(token, chatId, uri);
  }

  return true;
}
