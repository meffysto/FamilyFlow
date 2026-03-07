/**
 * journal.tsx — Baby journal screen
 *
 * View today's journal for Maxence or Enfant 2.
 * If journal doesn't exist: create from template.
 * Quick-add buttons: + Biberon, + Couche, + Sieste.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Alert,
  TextInput,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useVault } from '../../hooks/useVault';
import { todayJournalPath, generateJournalTemplate } from '../../lib/parser';
import { Profile } from '../../lib/types';
import { useThemeColors } from '../../contexts/ThemeContext';

interface QuickAddModal {
  type: 'Biberon' | 'Couche' | 'Sieste';
  visible: boolean;
}

export default function JournalScreen() {
  const { vault, profiles } = useVault();
  const { primary, tint } = useThemeColors();

  // Build enfant list dynamically from profiles
  const enfants = useMemo(
    () => profiles.filter((p) => p.role === 'enfant'),
    [profiles]
  );
  const [selectedEnfantId, setSelectedEnfantId] = useState<string | null>(null);
  const selectedEnfant = useMemo(
    () => enfants.find((e) => e.id === selectedEnfantId) ?? enfants[0] ?? null,
    [enfants, selectedEnfantId]
  );
  const selectedEnfantName = selectedEnfant?.name ?? '';
  const [journalContent, setJournalContent] = useState<string | null>(null);
  const [journalExists, setJournalExists] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [quickAdd, setQuickAdd] = useState<QuickAddModal>({ type: 'Biberon', visible: false });
  const [quickInput, setQuickInput] = useState('');

  const today = format(new Date(), 'EEEE dd MMMM yyyy', { locale: fr });
  const todayPath = selectedEnfantName ? todayJournalPath(selectedEnfantName) : '';

  const loadJournal = useCallback(async () => {
    if (!vault || !todayPath) return;
    try {
      const exists = await vault.exists(todayPath);
      setJournalExists(exists);
      if (exists) {
        const content = await vault.readFile(todayPath);
        setJournalContent(content);
      } else {
        setJournalContent(null);
      }
    } catch (e) {
      setJournalContent(null);
      setJournalExists(false);
    }
  }, [vault, todayPath]);

  useEffect(() => {
    loadJournal();
  }, [loadJournal]);

  const createJournal = useCallback(async () => {
    if (!vault || !selectedEnfantName || !todayPath) return;
    setIsCreating(true);
    try {
      const template = generateJournalTemplate(selectedEnfantName);
      await vault.writeFile(todayPath, template);
      setJournalContent(template);
      setJournalExists(true);
    } catch (e) {
      Alert.alert('Erreur', `Impossible de créer le journal : ${e}`);
    } finally {
      setIsCreating(false);
    }
  }, [vault, selectedEnfantName, todayPath]);

  const handleQuickAdd = useCallback(
    async (type: 'Biberon' | 'Couche' | 'Sieste', detail: string) => {
      if (!vault || !journalExists) return;
      const now = format(new Date(), 'HH:mm');

      let tableSection = '';
      let newRow = '';

      if (type === 'Biberon') {
        tableSection = 'Alimentation';
        const ml = detail.trim() ? `${detail} ml` : '';
        newRow = `| ${now} | Biberon | ${ml} | |`;
      } else if (type === 'Couche') {
        tableSection = 'Couches';
        newRow = `| ${now} | ${detail.trim() || 'Mouillée'} | |`;
      } else {
        tableSection = 'Sommeil';
        newRow = `| ${now} |  |  | ${detail.trim()} |`;
      }

      try {
        const content = await vault.readFile(todayPath);
        const lines = content.split('\n');
        const sectionIdx = lines.findIndex((l) => l.startsWith('## ') && l.includes(tableSection));

        if (sectionIdx === -1) {
          Alert.alert('Section introuvable', `Section "${tableSection}" non trouvée dans le journal.`);
          return;
        }

        // Find the last non-empty line in the table (before next section or end)
        let insertAt = sectionIdx + 1;
        for (let i = sectionIdx + 1; i < lines.length; i++) {
          if (lines[i].startsWith('## ') || lines[i].startsWith('### ')) break;
          if (lines[i].startsWith('|')) insertAt = i + 1;
        }

        lines.splice(insertAt, 0, newRow);
        await vault.writeFile(todayPath, lines.join('\n'));
        setJournalContent(lines.join('\n'));
      } catch (e) {
        Alert.alert('Erreur', String(e));
      }
    },
    [vault, journalExists, todayPath]
  );

  const openQuickAdd = (type: 'Biberon' | 'Couche' | 'Sieste') => {
    setQuickInput('');
    setQuickAdd({ type, visible: true });
  };

  const confirmQuickAdd = async () => {
    setQuickAdd((q) => ({ ...q, visible: false }));
    await handleQuickAdd(quickAdd.type, quickInput);
  };

  // Render table from markdown content
  const renderTables = (content: string) => {
    const sections = content.split(/^## /m).filter(Boolean);
    return sections.map((section, idx) => {
      const [heading, ...rest] = section.split('\n');
      const tableLines = rest.filter((l) => l.trim().startsWith('|'));
      if (tableLines.length === 0) return null;

      const [header, separator, ...rows] = tableLines;
      const cols = header
        .split('|')
        .filter(Boolean)
        .map((c) => c.trim());

      return (
        <View key={idx} style={styles.tableSection}>
          <Text style={styles.tableSectionTitle}>{heading.trim()}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator>
            <View>
              {/* Header */}
              <View style={[styles.tableRow, { backgroundColor: tint }]}>
                {cols.map((col, ci) => (
                  <Text key={ci} style={styles.tableHeader}>
                    {col}
                  </Text>
                ))}
              </View>
              {/* Data rows (filter empty / separator rows) */}
              {rows
                .filter((r) => r.trim() && !r.includes('---'))
                .map((row, ri) => {
                  const cells = row
                    .split('|')
                    .filter(Boolean)
                    .map((c) => c.trim());
                  const hasContent = cells.some((c) => c);
                  if (!hasContent) return null;
                  return (
                    <View key={ri} style={[styles.tableRow, ri % 2 === 1 && styles.tableRowAlt]}>
                      {cells.map((cell, ci) => (
                        <Text key={ci} style={styles.tableCell}>
                          {cell}
                        </Text>
                      ))}
                    </View>
                  );
                })}
            </View>
          </ScrollView>
        </View>
      );
    });
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>📖 Journal bébé</Text>
        <Text style={styles.dateText}>{today}</Text>
      </View>

      {/* Enfant selector */}
      <View style={styles.tabs}>
        {enfants.map((enfant) => (
          <TouchableOpacity
            key={enfant.id}
            style={[styles.tab, selectedEnfant?.id === enfant.id && { borderBottomColor: primary }]}
            onPress={() => setSelectedEnfantId(enfant.id)}
          >
            <Text style={styles.tabEmoji}>{enfant.avatar}</Text>
            <Text style={[styles.tabText, selectedEnfant?.id === enfant.id && { color: primary }]}>
              {enfant.name}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Quick add buttons */}
      {journalExists && (
        <View style={styles.quickAddRow}>
          {(['Biberon', 'Couche', 'Sieste'] as const).map((type) => (
            <TouchableOpacity
              key={type}
              style={[styles.quickBtn, { backgroundColor: tint }]}
              onPress={() => openQuickAdd(type)}
            >
              <Text style={styles.quickBtnEmoji}>
                {type === 'Biberon' ? '🍼' : type === 'Couche' ? '🚼' : '😴'}
              </Text>
              <Text style={[styles.quickBtnText, { color: primary }]}>+ {type}</Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity style={[styles.quickBtn, { backgroundColor: tint }]} onPress={loadJournal}>
            <Text style={styles.quickBtnEmoji}>🔄</Text>
            <Text style={[styles.quickBtnText, { color: primary }]}>Rafraîchir</Text>
          </TouchableOpacity>
        </View>
      )}

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        {!journalExists ? (
          <View style={styles.createContainer}>
            <Text style={styles.createEmoji}>{selectedEnfant?.avatar ?? '👶'}</Text>
            <Text style={styles.createTitle}>
              Pas encore de journal pour {selectedEnfantName} aujourd'hui
            </Text>
            <Text style={styles.createSubtitle}>
              Créez le journal du {format(new Date(), 'dd/MM/yyyy')} pour commencer à suivre
              l'alimentation, les couches et le sommeil.
            </Text>
            <TouchableOpacity
              style={[styles.createBtn, { backgroundColor: primary }, isCreating && styles.createBtnDisabled]}
              onPress={createJournal}
              disabled={isCreating}
            >
              <Text style={styles.createBtnText}>
                {isCreating ? 'Création...' : `📝 Créer le journal du jour`}
              </Text>
            </TouchableOpacity>
          </View>
        ) : journalContent ? (
          <View style={styles.journalContent}>
            {renderTables(journalContent)}
          </View>
        ) : null}
      </ScrollView>

      {/* Quick Add Modal */}
      <Modal
        visible={quickAdd.visible}
        transparent
        animationType="slide"
        onRequestClose={() => setQuickAdd((q) => ({ ...q, visible: false }))}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <TouchableOpacity
            style={styles.modalDismiss}
            activeOpacity={1}
            onPress={() => setQuickAdd((q) => ({ ...q, visible: false }))}
          />
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              {quickAdd.type === 'Biberon'
                ? '🍼 Ajouter un biberon'
                : quickAdd.type === 'Couche'
                ? '🚼 Ajouter une couche'
                : '😴 Ajouter une sieste'}
            </Text>
            <TextInput
              style={styles.modalInput}
              placeholder={
                quickAdd.type === 'Biberon'
                  ? 'Quantité (ex: 180)'
                  : quickAdd.type === 'Couche'
                  ? 'Type (Mouillée / Souillée)'
                  : 'Note (ex: 1h30)'
              }
              value={quickInput}
              onChangeText={setQuickInput}
              keyboardType={quickAdd.type === 'Biberon' ? 'numeric' : 'default'}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={confirmQuickAdd}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancel}
                onPress={() => setQuickAdd((q) => ({ ...q, visible: false }))}
              >
                <Text style={styles.modalCancelText}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalConfirm, { backgroundColor: primary }]} onPress={confirmQuickAdd}>
                <Text style={styles.modalConfirmText}>Ajouter</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const COL_WIDTH = 120;

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F3F4F6' },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  title: { fontSize: 20, fontWeight: '800', color: '#111827' },
  dateText: { fontSize: 13, color: '#6B7280', marginTop: 2, textTransform: 'capitalize' },
  tabs: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 6,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabEmoji: { fontSize: 18 },
  tabText: { fontSize: 14, fontWeight: '600', color: '#9CA3AF' },
  quickAddRow: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  quickBtn: {
    flex: 1,
    alignItems: 'center',
    borderRadius: 10,
    paddingVertical: 8,
    gap: 2,
  },
  quickBtnEmoji: { fontSize: 18 },
  quickBtnText: { fontSize: 11, fontWeight: '600' },
  scroll: { flex: 1 },
  content: { padding: 16, paddingBottom: 40 },
  createContainer: {
    alignItems: 'center',
    paddingVertical: 48,
    gap: 16,
  },
  createEmoji: { fontSize: 64 },
  createTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#374151',
    textAlign: 'center',
  },
  createSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 300,
  },
  createBtn: {
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 14,
    marginTop: 8,
  },
  createBtnDisabled: { backgroundColor: '#A78BFA' },
  createBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  journalContent: { gap: 16 },
  tableSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  tableSectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
    padding: 12,
    backgroundColor: '#F9FAFB',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  tableRowAlt: { backgroundColor: '#FAFAFA' },
  tableHeader: {
    width: COL_WIDTH,
    padding: 8,
    fontSize: 12,
    fontWeight: '700',
    color: '#5B21B6',
  },
  tableCell: {
    width: COL_WIDTH,
    padding: 8,
    fontSize: 13,
    color: '#374151',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalDismiss: {
    flex: 1,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    gap: 16,
  },
  modalTitle: { fontSize: 18, fontWeight: '800', color: '#111827' },
  modalInput: {
    borderWidth: 1.5,
    borderColor: '#D1D5DB',
    borderRadius: 10,
    padding: 12,
    fontSize: 15,
    color: '#111827',
  },
  modalActions: { flexDirection: 'row', gap: 10 },
  modalCancel: {
    flex: 1,
    padding: 14,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#D1D5DB',
    alignItems: 'center',
  },
  modalCancelText: { fontSize: 15, fontWeight: '600', color: '#6B7280' },
  modalConfirm: {
    flex: 2,
    padding: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  modalConfirmText: { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },
});
