/**
 * sharing.ts — Abstraction multi-canal pour le partage grands-parents
 *
 * Supporte Telegram (envoi auto), WhatsApp/iMessage (Share sheet natif → groupes OK).
 * Les message builders existants (telegram.ts) sont réutilisés.
 */

import { Platform } from 'react-native';

// react-native-share ne supporte pas le web
const RNShare = Platform.OS === 'web'
  ? { open: async (_opts: any) => ({}) }
  : require('react-native-share').default;
import * as SecureStore from 'expo-secure-store';
import { sendTelegram, sendWeeklyRecap } from './telegram';

// ─── Types ──────────────────────────────────────────────────────────────────

export type SharingChannel = 'telegram' | 'whatsapp' | 'imessage';

export interface GrandparentContact {
  id: string;
  name: string;
  channel: SharingChannel;
  /** Chat ID Telegram (peut être négatif pour un groupe) */
  chatId?: string;
}

export interface SendResult {
  sent: boolean;
  /** true si l'utilisateur doit confirmer l'envoi (WhatsApp/iMessage) */
  manual: boolean;
  error?: string;
}

const CONTACTS_KEY = 'gp_contacts_v1';
const LEGACY_GP_KEY = 'telegram_gp_chat_id';

// ─── Persistence ────────────────────────────────────────────────────────────

export async function loadGrandparentContacts(): Promise<GrandparentContact[]> {
  const existing = await SecureStore.getItemAsync(CONTACTS_KEY);
  if (existing) {
    try { return JSON.parse(existing); } catch { return []; }
  }

  // Migrer depuis l'ancien format (single telegram chat ID)
  const legacyId = await SecureStore.getItemAsync(LEGACY_GP_KEY);
  if (legacyId) {
    const migrated: GrandparentContact[] = [{
      id: 'migrated-telegram',
      name: 'Grands-parents',
      channel: 'telegram',
      chatId: legacyId,
    }];
    await saveGrandparentContacts(migrated);
    await SecureStore.deleteItemAsync(LEGACY_GP_KEY);
    return migrated;
  }

  return [];
}

export async function saveGrandparentContacts(contacts: GrandparentContact[]): Promise<void> {
  await SecureStore.setItemAsync(CONTACTS_KEY, JSON.stringify(contacts));
}

// ─── Formatage texte par canal ──────────────────────────────────────────────

/** Convertit HTML → WhatsApp markdown (*bold*, _italic_) */
export function stripHtmlToWhatsApp(html: string): string {
  return html
    .replace(/<b>(.*?)<\/b>/gi, '*$1*')
    .replace(/<i>(.*?)<\/i>/gi, '_$1_')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '');
}

/** Convertit HTML → texte brut (iMessage) */
export function stripHtmlToPlain(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '');
}

/** Formate le texte selon le canal */
export function formatTextForChannel(html: string, channel: SharingChannel): string {
  switch (channel) {
    case 'telegram': return html;
    case 'whatsapp': return stripHtmlToWhatsApp(html);
    case 'imessage': return stripHtmlToPlain(html);
  }
}

// ─── Envoi message ──────────────────────────────────────────────────────────

/**
 * Envoie un message texte (+ photos optionnelles) via le canal approprié.
 * - Telegram : envoi automatique via Bot API (texte puis photos en album)
 * - WhatsApp/iMessage : un seul Share sheet avec texte + photos groupés
 */
export async function sendViaChannel(
  contact: GrandparentContact,
  htmlText: string,
  telegramToken?: string,
  photoUris?: string[],
): Promise<SendResult> {
  try {
    switch (contact.channel) {
      case 'telegram': {
        if (!telegramToken || !contact.chatId) {
          return { sent: false, manual: false, error: 'Token ou Chat ID manquant' };
        }
        const ok = await sendTelegram(telegramToken, contact.chatId, htmlText);
        if (photoUris && photoUris.length > 0) {
          await sendWeeklyRecap(telegramToken, contact.chatId, '', photoUris);
        }
        return { sent: ok, manual: false, error: ok ? undefined : 'Échec envoi Telegram' };
      }

      case 'whatsapp':
      case 'imessage': {
        const text = formatTextForChannel(htmlText, contact.channel);
        const urls = (photoUris ?? []).map((uri) => {
          let fileUri = decodeURIComponent(uri);
          if (!fileUri.startsWith('file://')) fileUri = `file://${fileUri}`;
          return fileUri;
        });

        if (urls.length > 0) {
          // Un seul Share sheet : texte + toutes les photos
          await RNShare.open({ message: text, urls, failOnCancel: false });
        } else {
          // Texte seul
          await RNShare.open({ message: text, failOnCancel: false });
        }
        return { sent: true, manual: true };
      }
    }
  } catch (e) {
    if (String(e).includes('dismiss') || String(e).includes('cancel')) {
      return { sent: false, manual: true };
    }
    return { sent: false, manual: false, error: String(e) };
  }
}

/**
 * Envoie un message test au contact.
 */
export async function testContact(
  contact: GrandparentContact,
  telegramToken?: string,
): Promise<SendResult> {
  const html = '✅ <b>Family Flow</b> — Connexion réussie ! Vous recevrez les recaps ici. 👴👵';
  return sendViaChannel(contact, html, telegramToken);
}

// ─── Channel metadata ───────────────────────────────────────────────────────

export const CHANNEL_META: Record<SharingChannel, { label: string; emoji: string; color: string; description: string }> = {
  telegram: { label: 'Telegram', emoji: '📲', color: '#0088cc', description: 'Envoi automatique via bot' },
  whatsapp: { label: 'WhatsApp', emoji: '💬', color: '#25D366', description: 'Partage vers un groupe ou contact' },
  imessage: { label: 'iMessage', emoji: '💌', color: '#34C759', description: 'Partage vers un groupe ou contact' },
};
