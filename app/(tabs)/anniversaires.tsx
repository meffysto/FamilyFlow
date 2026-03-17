/**
 * anniversaires.tsx — Écran gestion des anniversaires
 *
 * SectionList groupée par mois prochain (le prochain anniversaire en premier).
 * Swipe-to-delete, tap pour éditer, import depuis contacts iCloud.
 */

import { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SectionList,
  RefreshControl,
} from 'react-native';
import { useRefresh } from '../../hooks/useRefresh';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useVault } from '../../contexts/VaultContext';
import { useThemeColors } from '../../contexts/ThemeContext';
import { useToast } from '../../contexts/ToastContext';
import { Spacing, Radius } from '../../constants/spacing';
import { FontSize, FontWeight } from '../../constants/typography';
import { Shadows } from '../../constants/shadows';
import { Chip } from '../../components/ui/Chip';
import { Button } from '../../components/ui/Button';
import { SwipeToDelete } from '../../components/SwipeToDelete';
import { AnniversaryEditor } from '../../components/AnniversaryEditor';
import { ContactImporter } from '../../components/ContactImporter';
import { CalendarImporter } from '../../components/CalendarImporter';
import type { Anniversary } from '../../lib/types';

const MONTH_NAMES = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
];

/** Calcule le nombre de jours avant le prochain anniversaire */
function daysUntilBirthday(dateStr: string): number {
  const [mm, dd] = dateStr.split('-').map(Number);
  const today = new Date();
  const thisYear = today.getFullYear();
  let next = new Date(thisYear, mm - 1, dd);
  // Si la date est passée cette année, prendre l'année prochaine
  if (next < new Date(today.getFullYear(), today.getMonth(), today.getDate())) {
    next = new Date(thisYear + 1, mm - 1, dd);
  }
  const diff = next.getTime() - new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  return Math.round(diff / (1000 * 60 * 60 * 24));
}

/** Calcule l'âge à venir (ou actuel si l'anniversaire n'est pas encore passé) */
function computeAge(dateStr: string, birthYear?: number): number | undefined {
  if (!birthYear) return undefined;
  const [mm, dd] = dateStr.split('-').map(Number);
  const today = new Date();
  const thisYear = today.getFullYear();
  const birthdayThisYear = new Date(thisYear, mm - 1, dd);
  // Si l'anniversaire n'est pas encore passé cette année, l'âge qu'il/elle va avoir
  if (birthdayThisYear >= new Date(today.getFullYear(), today.getMonth(), today.getDate())) {
    return thisYear - birthYear;
  }
  // Anniversaire déjà passé cette année → âge actuel
  return thisYear - birthYear;
}

/** Format le countdown de manière lisible */
function formatCountdown(days: number): string {
  if (days === 0) return "Aujourd'hui !";
  if (days === 1) return 'Demain';
  if (days <= 7) return `Dans ${days} jours`;
  if (days <= 30) {
    const weeks = Math.floor(days / 7);
    return `Dans ${weeks} sem.`;
  }
  const months = Math.floor(days / 30);
  return `Dans ${months} mois`;
}

interface SectionData {
  title: string;
  data: (Anniversary & { daysUntil: number; age?: number })[];
}

export default function AnniversairesScreen() {
  const { primary, tint, colors } = useThemeColors();
  const { showToast } = useToast();
  const {
    anniversaries,
    addAnniversary,
    updateAnniversary,
    removeAnniversary,
    importAnniversaries,
    refresh,
  } = useVault();

  const { refreshing, onRefresh } = useRefresh(refresh);

  const [editorVisible, setEditorVisible] = useState(false);
  const [editingAnniversary, setEditingAnniversary] = useState<Anniversary | undefined>();
  const [importerVisible, setImporterVisible] = useState(false);
  const [calendarImporterVisible, setCalendarImporterVisible] = useState(false);

  // Grouper par mois prochain, trié par nombre de jours restants
  const sections: SectionData[] = useMemo(() => {
    const enriched = anniversaries.map((a) => ({
      ...a,
      daysUntil: daysUntilBirthday(a.date),
      age: computeAge(a.date, a.birthYear),
    }));

    // Trier par jours restants
    enriched.sort((a, b) => a.daysUntil - b.daysUntil);

    // Grouper par mois de l'anniversaire (en commençant par le mois courant)
    const grouped = new Map<string, typeof enriched>();
    for (const item of enriched) {
      const [mm] = item.date.split('-').map(Number);
      const monthLabel = MONTH_NAMES[mm - 1];
      if (!grouped.has(monthLabel)) grouped.set(monthLabel, []);
      grouped.get(monthLabel)!.push(item);
    }

    return Array.from(grouped.entries()).map(([title, data]) => ({
      title,
      data,
    }));
  }, [anniversaries]);

  const handleAdd = useCallback(() => {
    setEditingAnniversary(undefined);
    setEditorVisible(true);
    Haptics.selectionAsync();
  }, []);

  const handleEdit = useCallback((anniversary: Anniversary) => {
    setEditingAnniversary(anniversary);
    setEditorVisible(true);
    Haptics.selectionAsync();
  }, []);

  const handleSave = useCallback(
    async (data: Omit<Anniversary, 'sourceFile'>) => {
      if (editingAnniversary) {
        await updateAnniversary(editingAnniversary.name, data);
      } else {
        await addAnniversary(data);
      }
    },
    [editingAnniversary, updateAnniversary, addAnniversary],
  );

  const handleDelete = useCallback(
    async (name: string) => {
      await removeAnniversary(name);
      showToast('Anniversaire supprimé');
    },
    [removeAnniversary, showToast],
  );

  const handleImport = useCallback(
    async (items: Omit<Anniversary, 'sourceFile'>[]) => {
      await importAnniversaries(items);
    },
    [importAnniversaries],
  );

  const renderItem = useCallback(
    ({ item }: { item: Anniversary & { daysUntil: number; age?: number } }) => {
      const [mm, dd] = item.date.split('-').map(Number);
      const dateDisplay = `${String(dd).padStart(2, '0')}/${String(mm).padStart(2, '0')}`;
      const isToday = item.daysUntil === 0;
      const isSoon = item.daysUntil <= 7;

      return (
        <SwipeToDelete
          onDelete={() => handleDelete(item.name)}
          confirmTitle="Supprimer cet anniversaire ?"
          confirmMessage={`L'anniversaire de ${item.name} sera supprimé.`}
          hintId="anniversaires"
        >
          <TouchableOpacity
            style={[styles.card, { backgroundColor: colors.card }]}
            onPress={() => handleEdit(item)}
            activeOpacity={0.7}
          >
            <View style={styles.cardLeft}>
              <Text style={styles.cardEmoji}>{isToday ? '🎉' : '🎂'}</Text>
              <View style={styles.cardInfo}>
                <Text style={[styles.cardName, { color: colors.text }]} numberOfLines={1}>
                  {item.name}
                </Text>
                <View style={styles.cardMeta}>
                  <Text style={[styles.cardDate, { color: colors.textMuted }]}>
                    {dateDisplay}
                  </Text>
                  {item.age != null && (
                    <Text style={[styles.cardAge, { color: colors.textFaint }]}>
                      {' \u2022 '}{item.age} ans
                    </Text>
                  )}
                </View>
              </View>
            </View>

            <View style={styles.cardRight}>
              {item.category ? (
                <Chip label={item.category} size="sm" />
              ) : null}
              <Text
                style={[
                  styles.countdown,
                  {
                    color: isToday ? colors.success : isSoon ? colors.warning : colors.textMuted,
                    fontWeight: isToday || isSoon ? FontWeight.bold : FontWeight.normal,
                  },
                ]}
              >
                {formatCountdown(item.daysUntil)}
              </Text>
            </View>
          </TouchableOpacity>
        </SwipeToDelete>
      );
    },
    [colors, handleDelete, handleEdit],
  );

  const renderSectionHeader = useCallback(
    ({ section }: { section: SectionData }) => (
      <Text style={[styles.sectionHeader, { color: colors.textMuted }]}>
        {section.title}
      </Text>
    ),
    [colors],
  );

  const renderEmpty = useCallback(
    () => (
      <View style={[styles.emptyState, { backgroundColor: colors.card }]}>
        <Text style={styles.emptyEmoji}>{'🎂'}</Text>
        <Text style={[styles.emptyTitle, { color: colors.text }]}>
          Aucun anniversaire
        </Text>
        <Text style={[styles.emptyDesc, { color: colors.textMuted }]}>
          Importez des anniversaires depuis vos contacts ou ajoutez-en manuellement.
        </Text>
        <View style={styles.emptyActions}>
          <Button
            label="Importer mes contacts"
            onPress={() => setImporterVisible(true)}
            variant="primary"
            icon="📇"
          />
          <Button
            label="Importer du calendrier"
            onPress={() => setCalendarImporterVisible(true)}
            variant="primary"
            icon="📅"
          />
          <Button
            label="Ajouter manuellement"
            onPress={handleAdd}
            variant="secondary"
            icon="✏️"
          />
        </View>
      </View>
    ),
    [colors, handleAdd],
  );

  // Prochain anniversaire pour le badge compteur
  const upcomingSoon = useMemo(
    () => anniversaries.filter((a) => daysUntilBirthday(a.date) <= 7).length,
    [anniversaries],
  );

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]} edges={['top']}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.bg }]}>
        <View style={styles.headerLeft}>
          <Text style={[styles.title, { color: colors.text }]}>Anniversaires</Text>
          {upcomingSoon > 0 && (
            <View style={[styles.soonBadge, { backgroundColor: colors.warningBg }]}>
              <Text style={[styles.soonBadgeText, { color: colors.warningText }]}>
                {upcomingSoon} cette semaine
              </Text>
            </View>
          )}
        </View>
        <TouchableOpacity
          style={[styles.addBtn, { backgroundColor: primary }]}
          onPress={handleAdd}
          activeOpacity={0.7}
          accessibilityLabel="Ajouter un anniversaire"
          accessibilityRole="button"
        >
          <Text style={[styles.addBtnText, { color: colors.onPrimary }]}>+</Text>
        </TouchableOpacity>
      </View>

      {/* Boutons import */}
      {anniversaries.length > 0 && (
        <View style={styles.importRow}>
          <TouchableOpacity
            style={[styles.importBar, styles.importBarHalf, { backgroundColor: tint, borderColor: primary + '30' }]}
            onPress={() => setImporterVisible(true)}
            activeOpacity={0.7}
          >
            <Text style={styles.importEmoji}>{'📇'}</Text>
            <Text style={[styles.importText, { color: primary }]}>
              Contacts
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.importBar, styles.importBarHalf, { backgroundColor: tint, borderColor: primary + '30' }]}
            onPress={() => setCalendarImporterVisible(true)}
            activeOpacity={0.7}
          >
            <Text style={styles.importEmoji}>{'📅'}</Text>
            <Text style={[styles.importText, { color: primary }]}>
              Calendrier
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Liste */}
      {anniversaries.length === 0 ? (
        renderEmpty()
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => `${item.name}-${item.date}`}
          renderItem={renderItem}
          renderSectionHeader={renderSectionHeader}
          contentContainerStyle={styles.listContent}
          ItemSeparatorComponent={() => <View style={styles.itemSeparator} />}
          stickySectionHeadersEnabled={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={primary} />}
        />
      )}

      {/* Modal éditeur */}
      <AnniversaryEditor
        visible={editorVisible}
        onClose={() => setEditorVisible(false)}
        onSave={handleSave}
        onDelete={
          editingAnniversary
            ? () => handleDelete(editingAnniversary.name).then(() => setEditorVisible(false))
            : undefined
        }
        existing={editingAnniversary}
      />

      {/* Modal import contacts */}
      <ContactImporter
        visible={importerVisible}
        onClose={() => setImporterVisible(false)}
        onImport={handleImport}
        existingAnniversaries={anniversaries}
      />

      {/* Modal import calendrier */}
      <CalendarImporter
        visible={calendarImporterVisible}
        onClose={() => setCalendarImporterVisible(false)}
        onImport={handleImport}
        existingAnniversaries={anniversaries}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing['3xl'],
    paddingVertical: Spacing.xl,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.lg,
    flex: 1,
  },
  title: {
    fontSize: FontSize.titleLg,
    fontWeight: FontWeight.heavy,
  },
  soonBadge: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.full,
  },
  soonBadgeText: {
    fontSize: FontSize.caption,
    fontWeight: FontWeight.bold,
  },
  addBtn: {
    width: 36,
    height: 36,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addBtnText: {
    fontSize: FontSize.title,
    fontWeight: FontWeight.bold,
    lineHeight: 22,
  },
  importRow: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginHorizontal: Spacing['2xl'],
    marginTop: Spacing['2xl'],
  },
  importBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.xl,
    borderRadius: Radius.lg,
    borderWidth: 1,
  },
  importBarHalf: {
    flex: 1,
  },
  importEmoji: {
    fontSize: FontSize.lg,
  },
  importText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
  },
  listContent: {
    padding: Spacing['2xl'],
    paddingBottom: 90,
  },
  sectionHeader: {
    fontSize: FontSize.label,
    fontWeight: FontWeight.bold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: Spacing.xl,
    marginBottom: Spacing.md,
    paddingHorizontal: Spacing.xs,
  },
  itemSeparator: { height: Spacing.md },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing['2xl'],
    borderRadius: Radius.lg,
    ...Shadows.sm,
  },
  cardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xl,
    flex: 1,
  },
  cardEmoji: {
    fontSize: FontSize.icon,
  },
  cardInfo: {
    flex: 1,
    gap: Spacing.xxs,
  },
  cardName: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.semibold,
  },
  cardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardDate: {
    fontSize: FontSize.caption,
  },
  cardAge: {
    fontSize: FontSize.caption,
  },
  cardRight: {
    alignItems: 'flex-end',
    gap: Spacing.sm,
  },
  countdown: {
    fontSize: FontSize.caption,
  },
  // Empty state
  emptyState: {
    margin: Spacing['2xl'],
    padding: Spacing['3xl'],
    borderRadius: Radius.lg,
    alignItems: 'center',
    gap: Spacing['2xl'],
    ...Shadows.sm,
  },
  emptyEmoji: { fontSize: 48 },
  emptyTitle: {
    fontSize: FontSize.heading,
    fontWeight: FontWeight.heavy,
  },
  emptyDesc: {
    fontSize: FontSize.body,
    textAlign: 'center',
    lineHeight: 22,
  },
  emptyActions: {
    gap: Spacing.lg,
    alignItems: 'center',
  },
});
