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

import { Profile, LootBox } from './types';

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
