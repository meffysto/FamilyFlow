/**
 * SettingsGrandparents.tsx — Partage multi-canal grands-parents
 *
 * Liste de contacts (Telegram / WhatsApp / iMessage).
 * Envoi recap hebdo, bilan mensuel, suivi grossesse.
 */

import React, { useState, useCallback, useEffect } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, Alert, Modal, ScrollView } from 'react-native';
import { useTranslation } from 'react-i18next';
import { buildWeeklyRecapText, buildMonthlyRecapText, buildGrossesseUpdateText } from '../../lib/telegram';
import {
  loadGrandparentContacts,
  saveGrandparentContacts,
  sendViaChannel,
  testContact,
  CHANNEL_META,
  type GrandparentContact,
  type SharingChannel,
} from '../../lib/sharing';
import { useThemeColors } from '../../contexts/ThemeContext';
import { useToast } from '../../contexts/ToastContext';
import { Button } from '../ui/Button';
import { Chip } from '../ui/Chip';
import { ModalHeader } from '../ui/ModalHeader';
import { Spacing, Radius } from '../../constants/spacing';
import { FontSize, FontWeight } from '../../constants/typography';
import { Shadows } from '../../constants/shadows';

interface SettingsGrandparentsProps {
  telegramToken: string;
  profiles: any[];
  memories: any[];
  photoDates: Record<string, string[]>;
  getPhotoUri: (name: string, date: string) => string | null;
}

export function SettingsGrandparents({ telegramToken, profiles, memories, photoDates, getPhotoUri }: SettingsGrandparentsProps) {
  const { t } = useTranslation();
  const { primary, tint, colors } = useThemeColors();
  const { showToast } = useToast();

  const [contacts, setContacts] = useState<GrandparentContact[]>([]);
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [sending, setSending] = useState<string | null>(null);

  // Add form state
  const [newName, setNewName] = useState('');
  const [newChannel, setNewChannel] = useState<SharingChannel>('whatsapp');
  const [newChatId, setNewChatId] = useState('');

  // Load contacts on mount
  useEffect(() => {
    loadGrandparentContacts().then(setContacts);
  }, []);

  const save = useCallback(async (updated: GrandparentContact[]) => {
    setContacts(updated);
    await saveGrandparentContacts(updated);
  }, []);

  // ─── CRUD ─────────────────────────────────────────────────────────────────

  const handleAdd = useCallback(async () => {
    const name = newName.trim();
    if (!name) { showToast(t('settings.grandparents.nameRequired'), 'error'); return; }
    if (newChannel === 'telegram' && !newChatId.trim()) { showToast(t('settings.grandparents.chatIdRequired'), 'error'); return; }

    const contact: GrandparentContact = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name,
      channel: newChannel,
      chatId: newChannel === 'telegram' ? newChatId.trim() : undefined,
    };
    await save([...contacts, contact]);
    setNewName('');
    setNewChatId('');
    setAddModalVisible(false);
    showToast(t('settings.grandparents.contactAdded', { name }));
  }, [newName, newChannel, newChatId, contacts, save, showToast]);

  const handleDelete = useCallback((id: string) => {
    const contact = contacts.find((c) => c.id === id);
    Alert.alert(t('settings.grandparents.deleteTitle'), t('settings.grandparents.deleteMessage', { name: contact?.name ?? '' }), [
      { text: t('settings.grandparents.cancel'), style: 'cancel' },
      { text: t('settings.grandparents.delete'), style: 'destructive', onPress: () => save(contacts.filter((c) => c.id !== id)) },
    ]);
  }, [contacts, save]);

  const handleTest = useCallback(async (contact: GrandparentContact) => {
    const result = await testContact(contact, telegramToken);
    if (result.manual) {
      showToast(t('settings.grandparents.testManual'));
    } else if (result.sent) {
      showToast(t('settings.grandparents.testSent'));
    } else {
      showToast(result.error ?? t('settings.grandparents.failure'), 'error');
    }
  }, [telegramToken, showToast]);

  // ─── Envoi contenus ───────────────────────────────────────────────────────

  const buildWeekData = useCallback(() => {
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const weekAgoStr = `${weekAgo.getFullYear()}-${String(weekAgo.getMonth() + 1).padStart(2, '0')}-${String(weekAgo.getDate()).padStart(2, '0')}`;
    const weekMemories = memories.filter((m: any) => m.date >= weekAgoStr);
    const enfantNames = profiles.filter((p: any) => p.role === 'enfant').map((p: any) => p.name);
    const weekPhotoUris: string[] = [];
    for (const name of enfantNames) {
      const id = name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '-');
      const dates = photoDates[id] ?? [];
      for (const d of dates) {
        if (d >= weekAgoStr) {
          const uri = getPhotoUri(name, d);
          if (uri) weekPhotoUris.push(uri);
        }
      }
    }
    const text = buildWeeklyRecapText({ memories: weekMemories, photoCount: weekPhotoUris.length, enfantNames });
    return { text, photoUris: weekPhotoUris, count: weekMemories.length };
  }, [memories, profiles, photoDates, getPhotoUri]);

  const handleSendRecap = useCallback(async (contact: GrandparentContact) => {
    setSending(`recap-${contact.id}`);
    const { text, photoUris, count } = buildWeekData();
    const result = await sendViaChannel(contact, text, telegramToken, photoUris);
    if (result.manual) {
      showToast(t('settings.grandparents.recapReady'));
    } else if (result.sent) {
      showToast(t('settings.grandparents.recapSent', { count }));
    } else {
      showToast(result.error ?? t('settings.grandparents.failure'), 'error');
    }
    setSending(null);
  }, [buildWeekData, telegramToken, showToast]);

  const handleSendMonthly = useCallback(async (contact: GrandparentContact) => {
    setSending(`monthly-${contact.id}`);
    const now = new Date();
    const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    const monthLabel = now.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
    const monthMemories = memories.filter((m: any) => m.date >= monthStart);
    const enfantNames = profiles.filter((p: any) => p.role === 'enfant').map((p: any) => p.name);
    let photoCount = 0;
    for (const name of enfantNames) {
      const id = name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '-');
      photoCount += (photoDates[id] ?? []).filter((d: string) => d >= monthStart).length;
    }
    const text = buildMonthlyRecapText({ profiles, memories: monthMemories, rdvs: [], photoCount, completedTasksCount: 0, month: monthLabel });
    const result = await sendViaChannel(contact, text, telegramToken);
    if (result.manual) {
      showToast(t('settings.grandparents.monthlyReady'));
    } else if (result.sent) {
      showToast(t('settings.grandparents.monthlySent', { month: monthLabel }));
    } else {
      showToast(result.error ?? t('settings.grandparents.failure'), 'error');
    }
    setSending(null);
  }, [memories, profiles, photoDates, telegramToken, showToast]);

  const handleSendGrossesse = useCallback(async (contact: GrandparentContact) => {
    const text = buildGrossesseUpdateText(profiles);
    if (!text) return;
    setSending(`grossesse-${contact.id}`);
    const result = await sendViaChannel(contact, text, telegramToken);
    if (result.manual) {
      showToast(t('settings.grandparents.grossesseReady'));
    } else if (result.sent) {
      showToast(t('settings.grandparents.grossesseSent'));
    } else {
      showToast(result.error ?? t('settings.grandparents.failure'), 'error');
    }
    setSending(null);
  }, [profiles, telegramToken, showToast]);

  // Envoi à tous
  const handleSendToAll = useCallback(async (type: 'recap' | 'monthly' | 'grossesse') => {
    if (contacts.length === 0) { showToast(t('settings.grandparents.noContacts'), 'error'); return; }
    for (const contact of contacts) {
      if (type === 'recap') await handleSendRecap(contact);
      else if (type === 'monthly') await handleSendMonthly(contact);
      else if (type === 'grossesse') await handleSendGrossesse(contact);
    }
  }, [contacts, handleSendRecap, handleSendMonthly, handleSendGrossesse, showToast]);

  const hasGrossesse = profiles.some((p: any) => p.statut === 'grossesse' && p.dateTerme);

  // ─── Rendu ────────────────────────────────────────────────────────────────

  return (
    <View style={styles.section} accessibilityRole="summary" accessibilityLabel={t('settings.grandparents.sectionA11y')}>
      <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>{t('settings.grandparents.sectionTitle')}</Text>

      <View style={[styles.card, Shadows.sm, { backgroundColor: colors.card }]}>
        <Text style={[styles.hint, { color: colors.textFaint }]}>
          {t('settings.grandparents.hint')}
        </Text>

        {/* Liste des contacts */}
        {contacts.map((contact) => {
          const meta = CHANNEL_META[contact.channel];
          return (
            <View key={contact.id} style={[styles.contactCard, { backgroundColor: colors.cardAlt, borderColor: colors.borderLight }]}>
              {/* En-tête contact */}
              <View style={styles.contactHeader}>
                <View style={[styles.channelBadge, { backgroundColor: meta.color + '20' }]}>
                  <Text style={styles.channelEmoji}>{meta.emoji}</Text>
                </View>
                <View style={styles.contactInfo}>
                  <Text style={[styles.contactName, { color: colors.text }]}>{contact.name}</Text>
                  <Text style={[styles.contactDetail, { color: colors.textMuted }]}>
                    {contact.channel === 'telegram'
                      ? `Telegram · ${contact.chatId}`
                      : `${meta.label} · ${meta.description}`}
                  </Text>
                </View>
                <TouchableOpacity onPress={() => handleDelete(contact.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Text style={{ fontSize: FontSize.heading, opacity: 0.4 }}>✕</Text>
                </TouchableOpacity>
              </View>

              {/* Actions */}
              <View style={styles.contactActions}>
                <Button
                  label={sending === `recap-${contact.id}` ? '...' : t('settings.grandparents.weekBtn')}
                  onPress={() => handleSendRecap(contact)}
                  variant="secondary" size="sm"
                  disabled={sending !== null}
                />
                <Button
                  label={sending === `monthly-${contact.id}` ? '...' : t('settings.grandparents.monthBtn')}
                  onPress={() => handleSendMonthly(contact)}
                  variant="secondary" size="sm"
                  disabled={sending !== null}
                />
                <Button
                  label={t('settings.grandparents.testBtn')}
                  onPress={() => handleTest(contact)}
                  variant="secondary" size="sm"
                  disabled={sending !== null}
                />
              </View>
              {hasGrossesse && (
                <Button
                  label={sending === `grossesse-${contact.id}` ? '...' : t('settings.grandparents.grossesseBtn')}
                  onPress={() => handleSendGrossesse(contact)}
                  variant="secondary" size="sm" fullWidth
                  disabled={sending !== null}
                />
              )}
              {contact.channel !== 'telegram' && (
                <Text style={[styles.manualHint, { color: colors.textFaint }]}>
                  {t('settings.grandparents.shareSheetHint')}
                </Text>
              )}
            </View>
          );
        })}

        {/* Bouton ajouter */}
        <Button label={t('settings.grandparents.addContact')} onPress={() => setAddModalVisible(true)} variant="secondary" fullWidth />

        {/* Envoi groupé */}
        {contacts.length > 1 && (
          <View style={styles.bulkSection}>
            <Text style={[styles.bulkTitle, { color: colors.textSub }]}>{t('settings.grandparents.sendToAll')}</Text>
            <View style={styles.contactActions}>
              <Button label={t('settings.grandparents.weekBtn')} onPress={() => handleSendToAll('recap')} variant="secondary" size="sm" disabled={sending !== null} />
              <Button label={t('settings.grandparents.monthBtn')} onPress={() => handleSendToAll('monthly')} variant="secondary" size="sm" disabled={sending !== null} />
              {hasGrossesse && (
                <Button label="🤰" onPress={() => handleSendToAll('grossesse')} variant="secondary" size="sm" disabled={sending !== null} />
              )}
            </View>
          </View>
        )}
      </View>

      {/* Modal ajout contact */}
      <Modal visible={addModalVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setAddModalVisible(false)}>
        <View style={[styles.modalContainer, { backgroundColor: colors.card }]}>
          <ModalHeader title={t('settings.grandparents.newContactTitle')} onClose={() => setAddModalVisible(false)} rightLabel={t('settings.grandparents.addBtn')} onRight={handleAdd} />

          <ScrollView style={styles.modalScroll} contentContainerStyle={styles.modalContent}>
            <Text style={[styles.fieldLabel, { color: colors.textSub }]}>{t('settings.grandparents.nameLabel')}</Text>
            <TextInput
              style={[styles.input, { borderColor: colors.inputBorder, color: colors.text, backgroundColor: colors.inputBg }]}
              value={newName}
              onChangeText={setNewName}
              placeholder={t('settings.grandparents.namePlaceholder')}
              placeholderTextColor={colors.textFaint}
              autoFocus
            />

            <Text style={[styles.fieldLabel, { color: colors.textSub }]}>{t('settings.grandparents.channelLabel')}</Text>
            <View style={styles.channelRow}>
              {(['whatsapp', 'imessage', 'telegram'] as SharingChannel[]).map((ch) => (
                <Chip
                  key={ch}
                  label={`${CHANNEL_META[ch].emoji} ${CHANNEL_META[ch].label}`}
                  selected={newChannel === ch}
                  onPress={() => setNewChannel(ch)}
                />
              ))}
            </View>

            {newChannel === 'telegram' && (
              <>
                <Text style={[styles.fieldLabel, { color: colors.textSub }]}>{t('settings.grandparents.chatIdLabel')}</Text>
                <TextInput
                  style={[styles.input, { borderColor: colors.inputBorder, color: colors.text, backgroundColor: colors.inputBg }]}
                  value={newChatId}
                  onChangeText={setNewChatId}
                  placeholder={t('settings.grandparents.chatIdPlaceholder')}
                  placeholderTextColor={colors.textFaint}
                  keyboardType="numbers-and-punctuation"
                />
                <Text style={[styles.helperText, { color: colors.textFaint }]}>
                  {t('settings.grandparents.chatIdHelper')}
                </Text>
              </>
            )}

            {newChannel !== 'telegram' && (
              <Text style={[styles.helperText, { color: colors.textFaint }]}>
                {t('settings.grandparents.shareSheetHelper', { channel: CHANNEL_META[newChannel].label })}
              </Text>
            )}
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginBottom: Spacing['3xl'] },
  sectionTitle: { fontSize: FontSize.label, fontWeight: FontWeight.bold, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: Spacing.md },
  card: { borderRadius: Radius.xl, padding: Spacing['2xl'], gap: Spacing.lg },
  hint: { fontSize: FontSize.caption, lineHeight: 17 },

  contactCard: {
    borderRadius: Radius.lg,
    borderWidth: 1,
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  contactHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  channelBadge: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  channelEmoji: { fontSize: FontSize.heading },
  contactInfo: { flex: 1 },
  contactName: { fontSize: FontSize.body, fontWeight: FontWeight.bold },
  contactDetail: { fontSize: FontSize.caption, marginTop: 1 },
  contactActions: { flexDirection: 'row', gap: Spacing.sm, flexWrap: 'wrap' },
  manualHint: { fontSize: FontSize.code, fontStyle: 'italic' },

  bulkSection: {
    paddingTop: Spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(0,0,0,0.08)',
    gap: Spacing.sm,
  },
  bulkTitle: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold },

  modalContainer: { flex: 1 },
  modalScroll: { flex: 1 },
  modalContent: { padding: Spacing['3xl'], gap: Spacing.lg },
  fieldLabel: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold },
  input: {
    borderWidth: 1.5,
    borderRadius: Radius.base,
    padding: Spacing.xl,
    fontSize: FontSize.body,
  },
  channelRow: { flexDirection: 'row', gap: Spacing.sm, flexWrap: 'wrap' },
  helperText: { fontSize: FontSize.caption, lineHeight: 17 },
});
