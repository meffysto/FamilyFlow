/**
 * defis.tsx — Écran Défis familiaux
 *
 * 3 onglets : Actifs, Templates, Historique
 * Modal config pour créer/lancer un défi
 * Modal détail pour voir la progression + check-in
 */

import { useCallback, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Modal,
  TextInput,
  Alert,
  FlatList,
  RefreshControl,
} from 'react-native';
import { useRefresh } from '../../hooks/useRefresh';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useVault } from '../../contexts/VaultContext';
import { useThemeColors } from '../../contexts/ThemeContext';
import { useToast } from '../../contexts/ToastContext';
import { Spacing, Radius } from '../../constants/spacing';
import { FontSize, FontWeight } from '../../constants/typography';
import { Chip } from '../../components/ui';
import { DateInput } from '../../components/ui/DateInput';
import { ModalHeader } from '../../components/ui/ModalHeader';
import {
  DEFI_TEMPLATES,
  DEFI_CATEGORY_LABELS,
  DEFI_REWARDS,
  computeRewardPoints,
  type DefiTemplate,
  type DefiCategory,
} from '../../constants/defiTemplates';
import type { Defi, DefiType } from '../../lib/types';
import { ScreenGuide } from '../../components/help/ScreenGuide';
import { HELP_CONTENT } from '../../lib/help-content';
import { useParentalControls } from '../../contexts/ParentalControlsContext';

type TabId = 'actifs' | 'templates' | 'historique';

// ─── Barre de progression animée ──────────────────────────────────────────

function ProgressBar({ progress, color }: { progress: number; color: string }) {
  const width = useSharedValue(0);
  width.value = withSpring(Math.min(1, Math.max(0, progress)), { damping: 15, stiffness: 100 });
  const animStyle = useAnimatedStyle(() => ({
    width: `${width.value * 100}%`,
  }));
  const { colors } = useThemeColors();
  return (
    <View style={[barStyles.bg, { backgroundColor: colors.cardAlt }]}>
      <Animated.View style={[barStyles.fill, { backgroundColor: color }, animStyle]} />
    </View>
  );
}

const barStyles = StyleSheet.create({
  bg: { height: 8, borderRadius: Radius.full, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: Radius.full },
});

// ─── Carte défi actif ───────────────────────────────────────────────────────

function DefiCard({
  defi,
  profiles,
  onPress,
  onCheckIn,
}: {
  defi: Defi;
  profiles: { id: string; name: string; avatar: string }[];
  onPress: () => void;
  onCheckIn: () => void;
}) {
  const { primary, colors } = useThemeColors();
  const today = new Date().toISOString().slice(0, 10);

  const uniqueCompletedDays = new Set(defi.progress.filter((p) => p.completed).map((p) => p.date)).size;
  const progressRatio = defi.targetDays > 0 ? uniqueCompletedDays / defi.targetDays : 0;

  // Vérifier si le profil courant a déjà check-in aujourd'hui
  const participantAvatars = defi.participants.length > 0
    ? profiles.filter((p) => defi.participants.includes(p.id))
    : profiles;

  const todayCheckedIn = defi.progress.filter((p) => p.date === today && p.completed);
  const allCheckedToday = participantAvatars.length > 0 && todayCheckedIn.length >= participantAvatars.length;

  const diffColor = defi.difficulty === 'facile' ? colors.success : defi.difficulty === 'moyen' ? colors.warning : colors.error;

  return (
    <TouchableOpacity style={[cardStyles.card, { backgroundColor: colors.card }]} onPress={onPress} activeOpacity={0.7}>
      <View style={cardStyles.header}>
        <Text style={cardStyles.emoji}>{defi.emoji}</Text>
        <View style={cardStyles.titleArea}>
          <Text style={[cardStyles.title, { color: colors.text }]} numberOfLines={1}>{defi.title}</Text>
          <Chip label={defi.difficulty} color={diffColor} size="sm" />
        </View>
      </View>

      <ProgressBar progress={progressRatio} color={primary} />

      <View style={cardStyles.meta}>
        <Text style={[cardStyles.counter, { color: colors.textSub }]}>
          {uniqueCompletedDays}/{defi.targetDays} jours
        </Text>
        <View style={cardStyles.avatars}>
          {participantAvatars.slice(0, 4).map((p) => (
            <Text key={p.id} style={cardStyles.avatar}>{p.avatar}</Text>
          ))}
        </View>
      </View>

      {!allCheckedToday && defi.status === 'active' && (
        <TouchableOpacity
          style={[cardStyles.checkInBtn, { backgroundColor: primary }]}
          onPress={(e) => {
            e.stopPropagation?.();
            onCheckIn();
          }}
          activeOpacity={0.7}
        >
          <Text style={[cardStyles.checkInText, { color: colors.onPrimary }]}>Check-in</Text>
        </TouchableOpacity>
      )}
      {allCheckedToday && defi.status === 'active' && (
        <Text style={[cardStyles.doneToday, { color: colors.success }]}>Fait aujourd'hui</Text>
      )}
    </TouchableOpacity>
  );
}

const cardStyles = StyleSheet.create({
  card: {
    borderRadius: Radius.lg,
    padding: Spacing['2xl'],
    gap: Spacing.lg,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.lg },
  emoji: { fontSize: 28 },
  titleArea: { flex: 1, gap: Spacing.xs, flexDirection: 'row', alignItems: 'center' },
  title: { fontSize: FontSize.body, fontWeight: FontWeight.bold, flex: 1 },
  meta: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  counter: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold },
  avatars: { flexDirection: 'row', gap: 2 },
  avatar: { fontSize: 18 },
  checkInBtn: {
    paddingVertical: Spacing.md,
    borderRadius: Radius.md,
    alignItems: 'center',
  },
  checkInText: { fontSize: FontSize.sm, fontWeight: FontWeight.bold },
  doneToday: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, textAlign: 'center' },
});

// ─── Modal configuration ────────────────────────────────────────────────────

function DefiConfigModal({
  template,
  profiles,
  onSave,
  onClose,
}: {
  template?: DefiTemplate;
  profiles: { id: string; name: string; avatar: string }[];
  onSave: (defi: Omit<Defi, 'progress' | 'status'>) => void;
  onClose: () => void;
}) {
  const { primary, colors } = useThemeColors();

  const today = new Date().toISOString().slice(0, 10);
  const in7d = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);

  const [title, setTitle] = useState(template?.title ?? '');
  const [description, setDescription] = useState(template?.description ?? '');
  const [emoji, setEmoji] = useState(template?.emoji ?? '🏅');
  const [type, setType] = useState<DefiType>(template?.type ?? 'daily');
  const [difficulty, setDifficulty] = useState<'facile' | 'moyen' | 'difficile'>(template?.difficulty ?? 'moyen');
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(template ? new Date(Date.now() + template.targetDays * 86400000).toISOString().slice(0, 10) : in7d);
  const [targetMetric, setTargetMetric] = useState(template?.targetMetric?.toString() ?? '');
  const [metricUnit, setMetricUnit] = useState(template?.metricUnit ?? '');
  const [selectedProfiles, setSelectedProfiles] = useState<Set<string>>(new Set());

  const targetDays = Math.max(1, Math.ceil((new Date(endDate).getTime() - new Date(startDate).getTime()) / 86400000) + 1);
  const reward = computeRewardPoints(difficulty, targetDays);
  const lootBoxes = DEFI_REWARDS[difficulty].lootBoxes;

  const handleSave = () => {
    if (!title.trim()) {
      Alert.alert('Titre requis', 'Donnez un titre au défi');
      return;
    }
    const id = `defi_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`;
    onSave({
      id,
      title: title.trim(),
      description: description.trim(),
      type,
      startDate,
      endDate,
      targetDays,
      targetMetric: targetMetric ? parseInt(targetMetric, 10) : undefined,
      metricUnit: metricUnit || undefined,
      emoji,
      difficulty,
      participants: Array.from(selectedProfiles),
      rewardPoints: reward,
      rewardLootBoxes: lootBoxes,
      templateId: template?.id,
    });
  };

  const toggleProfile = (id: string) => {
    setSelectedProfiles((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <SafeAreaView style={[configStyles.safe, { backgroundColor: colors.bg }]} edges={['top']}>
      <ModalHeader
        title={template ? 'Lancer le défi' : 'Nouveau défi'}
        onClose={onClose}
        rightLabel="Créer"
        onRight={handleSave}
      />
      <ScrollView style={configStyles.scroll} contentContainerStyle={configStyles.content}>
        {/* Titre + Emoji */}
        <View style={configStyles.row}>
          <TouchableOpacity
            style={[configStyles.emojiPicker, { backgroundColor: colors.cardAlt }]}
            onPress={() => {
              const emojis = ['🏅', '📵', '👨‍🍳', '📖', '🏃', '🧹', '🌿', '🎲', '💪', '⭐', '🔥', '🎯'];
              const idx = emojis.indexOf(emoji);
              setEmoji(emojis[(idx + 1) % emojis.length]);
            }}
          >
            <Text style={configStyles.emojiText}>{emoji}</Text>
          </TouchableOpacity>
          <TextInput
            style={[configStyles.input, configStyles.titleInput, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.text }]}
            value={title}
            onChangeText={setTitle}
            placeholder="Titre du défi"
            placeholderTextColor={colors.textFaint}
          />
        </View>

        {/* Description */}
        <TextInput
          style={[configStyles.input, configStyles.descInput, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.text }]}
          value={description}
          onChangeText={setDescription}
          placeholder="Description (optionnel)"
          placeholderTextColor={colors.textFaint}
          multiline
        />

        {/* Type */}
        <Text style={[configStyles.label, { color: colors.textMuted }]}>Type</Text>
        <View style={configStyles.chipRow}>
          {(['daily', 'abstinence', 'cumulative'] as const).map((t) => {
            const labels: Record<DefiType, string> = { daily: 'Quotidien', abstinence: 'Abstinence', cumulative: 'Cumulatif' };
            return (
              <Chip key={t} label={labels[t]} color={type === t ? primary : colors.textMuted} onPress={() => setType(t)} />
            );
          })}
        </View>

        {/* Dates */}
        <View style={configStyles.dateRow}>
          <View style={configStyles.dateCol}>
            <Text style={[configStyles.label, { color: colors.textMuted }]}>Début</Text>
            <DateInput value={startDate} onChange={setStartDate} />
          </View>
          <View style={configStyles.dateCol}>
            <Text style={[configStyles.label, { color: colors.textMuted }]}>Fin</Text>
            <DateInput value={endDate} onChange={setEndDate} />
          </View>
        </View>
        <Text style={[configStyles.hint, { color: colors.textFaint }]}>{targetDays} jours</Text>

        {/* Métrique (cumulative) */}
        {type === 'cumulative' && (
          <View style={configStyles.dateRow}>
            <View style={configStyles.dateCol}>
              <Text style={[configStyles.label, { color: colors.textMuted }]}>Objectif total</Text>
              <TextInput
                style={[configStyles.input, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.text }]}
                value={targetMetric}
                onChangeText={setTargetMetric}
                placeholder="ex: 210"
                placeholderTextColor={colors.textFaint}
                keyboardType="numeric"
              />
            </View>
            <View style={configStyles.dateCol}>
              <Text style={[configStyles.label, { color: colors.textMuted }]}>Unité</Text>
              <TextInput
                style={[configStyles.input, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.text }]}
                value={metricUnit}
                onChangeText={setMetricUnit}
                placeholder="min, pas, pages"
                placeholderTextColor={colors.textFaint}
              />
            </View>
          </View>
        )}

        {/* Difficulté */}
        <Text style={[configStyles.label, { color: colors.textMuted }]}>Difficulté</Text>
        <View style={configStyles.chipRow}>
          {(['facile', 'moyen', 'difficile'] as const).map((d) => {
            const c = d === 'facile' ? colors.success : d === 'moyen' ? colors.warning : colors.error;
            return (
              <Chip key={d} label={d} color={difficulty === d ? c : colors.textMuted} onPress={() => setDifficulty(d)} />
            );
          })}
        </View>

        {/* Participants */}
        <Text style={[configStyles.label, { color: colors.textMuted }]}>Participants (vide = toute la famille)</Text>
        <View style={configStyles.chipRow}>
          {profiles.map((p) => (
            <TouchableOpacity
              key={p.id}
              style={[configStyles.profileChip, {
                backgroundColor: selectedProfiles.has(p.id) ? primary + '20' : colors.cardAlt,
                borderColor: selectedProfiles.has(p.id) ? primary : colors.border,
              }]}
              onPress={() => toggleProfile(p.id)}
            >
              <Text style={configStyles.profileAvatar}>{p.avatar}</Text>
              <Text style={[configStyles.profileName, { color: selectedProfiles.has(p.id) ? primary : colors.textSub }]}>{p.name}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Aperçu récompense */}
        <View style={[configStyles.rewardPreview, { backgroundColor: colors.cardAlt }]}>
          <Text style={[configStyles.rewardTitle, { color: colors.text }]}>Récompense estimée</Text>
          <Text style={[configStyles.rewardValue, { color: primary }]}>
            {reward} pts{lootBoxes > 0 ? ` + ${lootBoxes} loot box${lootBoxes > 1 ? 'es' : ''}` : ''}
          </Text>
          {targetDays > 14 && (
            <Text style={[configStyles.hint, { color: colors.success }]}>Bonus ×1.5 (durée {'>'} 14j)</Text>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const configStyles = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { flex: 1 },
  content: { padding: Spacing['2xl'], gap: Spacing.xl, paddingBottom: 40 },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.lg },
  emojiPicker: {
    width: 52, height: 52, borderRadius: Radius.lg,
    alignItems: 'center', justifyContent: 'center',
  },
  emojiText: { fontSize: 28 },
  input: {
    borderWidth: 1, borderRadius: Radius.md,
    paddingHorizontal: Spacing.xl, paddingVertical: Spacing.lg,
    fontSize: FontSize.body,
  },
  titleInput: { flex: 1 },
  descInput: { minHeight: 60, textAlignVertical: 'top' },
  label: { fontSize: FontSize.label, fontWeight: FontWeight.bold, textTransform: 'uppercase', letterSpacing: 0.5 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md },
  dateRow: { flexDirection: 'row', gap: Spacing.xl },
  dateCol: { flex: 1, gap: Spacing.sm },
  hint: { fontSize: FontSize.sm },
  profileChip: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md,
    borderRadius: Radius.full, borderWidth: 1,
  },
  profileAvatar: { fontSize: 18 },
  profileName: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold },
  rewardPreview: {
    padding: Spacing['2xl'], borderRadius: Radius.lg,
    alignItems: 'center', gap: Spacing.sm,
  },
  rewardTitle: { fontSize: FontSize.sm, fontWeight: FontWeight.bold },
  rewardValue: { fontSize: FontSize.titleLg, fontWeight: FontWeight.heavy },
});

// ─── Modal détail ──────────────────────────────────────────────────────────

function DefiDetailModal({
  defi,
  profiles,
  onCheckIn,
  onComplete,
  onDelete,
  onClose,
}: {
  defi: Defi;
  profiles: { id: string; name: string; avatar: string }[];
  onCheckIn: (profileId: string, completed: boolean, value?: number, note?: string) => void;
  onComplete: () => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const { primary, colors } = useThemeColors();
  const today = new Date().toISOString().slice(0, 10);
  const [checkInValue, setCheckInValue] = useState('');
  const [checkInNote, setCheckInNote] = useState('');

  const participantList = defi.participants.length > 0
    ? profiles.filter((p) => defi.participants.includes(p.id))
    : profiles;

  // Grille calendrier : jours du défi
  const days: string[] = [];
  const start = new Date(defi.startDate + 'T00:00:00');
  const end = new Date(defi.endDate + 'T00:00:00');
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    days.push(d.toISOString().slice(0, 10));
  }

  const uniqueCompletedDays = new Set(defi.progress.filter((p) => p.completed).map((p) => p.date)).size;
  const progressRatio = defi.targetDays > 0 ? uniqueCompletedDays / defi.targetDays : 0;

  // Cumulative total
  const cumulativeTotal = defi.type === 'cumulative'
    ? defi.progress.reduce((sum, p) => sum + (p.value ?? 0), 0)
    : 0;

  return (
    <SafeAreaView style={[detailStyles.safe, { backgroundColor: colors.bg }]} edges={['top']}>
      <ModalHeader title={`${defi.emoji} ${defi.title}`} onClose={onClose} />
      <ScrollView style={detailStyles.scroll} contentContainerStyle={detailStyles.content}>
        {/* Progression résumé */}
        <View style={detailStyles.summaryRow}>
          <Text style={[detailStyles.summaryText, { color: colors.text }]}>
            {uniqueCompletedDays}/{defi.targetDays} jours
          </Text>
          {defi.type === 'cumulative' && defi.targetMetric && (
            <Text style={[detailStyles.summaryText, { color: primary }]}>
              {cumulativeTotal}/{defi.targetMetric} {defi.metricUnit ?? ''}
            </Text>
          )}
        </View>
        <ProgressBar progress={progressRatio} color={primary} />

        {/* Grille calendrier */}
        <Text style={[detailStyles.sectionTitle, { color: colors.textMuted }]}>Calendrier</Text>
        <View style={detailStyles.calendarGrid}>
          {days.map((day) => {
            const dayEntries = defi.progress.filter((p) => p.date === day);
            const allDone = dayEntries.length > 0 && dayEntries.every((p) => p.completed);
            const hasFail = dayEntries.some((p) => !p.completed);
            const isFuture = day > today;
            const isToday = day === today;
            const bg = isFuture ? colors.cardAlt : allDone ? colors.successBg : hasFail ? colors.errorBg : colors.cardAlt;
            const border = isToday ? primary : 'transparent';
            const dayNum = parseInt(day.slice(8), 10);
            return (
              <View key={day} style={[detailStyles.calendarDay, { backgroundColor: bg, borderColor: border }]}>
                <Text style={[detailStyles.calendarDayNum, { color: isFuture ? colors.textFaint : allDone ? colors.success : hasFail ? colors.error : colors.textMuted }]}>
                  {dayNum}
                </Text>
                {allDone && <Text style={detailStyles.calendarIcon}>✓</Text>}
                {hasFail && <Text style={detailStyles.calendarIcon}>✗</Text>}
              </View>
            );
          })}
        </View>

        {/* Progression par participant */}
        <Text style={[detailStyles.sectionTitle, { color: colors.textMuted }]}>Par participant</Text>
        {participantList.map((p) => {
          const entries = defi.progress.filter((e) => e.profileId === p.id);
          const completed = entries.filter((e) => e.completed).length;
          const todayDone = entries.some((e) => e.date === today && e.completed);
          return (
            <View key={p.id} style={[detailStyles.participantRow, { backgroundColor: colors.card }]}>
              <Text style={detailStyles.participantAvatar}>{p.avatar}</Text>
              <View style={detailStyles.participantInfo}>
                <Text style={[detailStyles.participantName, { color: colors.text }]}>{p.name}</Text>
                <Text style={[detailStyles.participantMeta, { color: colors.textMuted }]}>
                  {completed} jour{completed > 1 ? 's' : ''} complété{completed > 1 ? 's' : ''}
                  {todayDone ? ' · Fait aujourd\'hui' : ''}
                </Text>
              </View>
            </View>
          );
        })}

        {/* Formulaire check-in du jour */}
        {defi.status === 'active' && (
          <>
            <Text style={[detailStyles.sectionTitle, { color: colors.textMuted }]}>Check-in du jour</Text>
            {defi.type === 'cumulative' && (
              <View style={detailStyles.checkInRow}>
                <TextInput
                  style={[detailStyles.checkInInput, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.text }]}
                  value={checkInValue}
                  onChangeText={setCheckInValue}
                  placeholder={`Valeur (${defi.metricUnit ?? 'unités'})`}
                  placeholderTextColor={colors.textFaint}
                  keyboardType="numeric"
                />
              </View>
            )}
            <TextInput
              style={[detailStyles.checkInInput, detailStyles.noteInput, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.text }]}
              value={checkInNote}
              onChangeText={setCheckInNote}
              placeholder="Note (optionnel)"
              placeholderTextColor={colors.textFaint}
            />
            <View style={detailStyles.checkInButtons}>
              {participantList.map((p) => {
                const todayDone = defi.progress.some((e) => e.date === today && e.profileId === p.id && e.completed);
                return (
                  <TouchableOpacity
                    key={p.id}
                    style={[detailStyles.checkInBtn, {
                      backgroundColor: todayDone ? colors.successBg : primary,
                      borderColor: todayDone ? colors.success : primary,
                    }]}
                    onPress={() => {
                      if (todayDone) return;
                      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                      const val = checkInValue ? parseFloat(checkInValue) : undefined;
                      onCheckIn(p.id, true, val, checkInNote || undefined);
                      setCheckInValue('');
                      setCheckInNote('');
                    }}
                    disabled={todayDone}
                    activeOpacity={0.7}
                  >
                    <Text style={detailStyles.checkInBtnAvatar}>{p.avatar}</Text>
                    <Text style={[detailStyles.checkInBtnText, { color: todayDone ? colors.success : colors.onPrimary }]}>
                      {todayDone ? 'Fait' : 'Check-in'}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            {defi.type === 'abstinence' && (
              <TouchableOpacity
                style={[detailStyles.failBtn, { backgroundColor: colors.errorBg, borderColor: colors.error }]}
                onPress={() => {
                  Alert.alert('Signaler un échec ?', 'Pour un défi abstinence, un échec met fin au défi.', [
                    { text: 'Annuler', style: 'cancel' },
                    {
                      text: 'Confirmer', style: 'destructive', onPress: () => {
                        participantList.forEach((p) => onCheckIn(p.id, false));
                      },
                    },
                  ]);
                }}
                activeOpacity={0.7}
              >
                <Text style={[detailStyles.failBtnText, { color: colors.error }]}>Signaler un échec</Text>
              </TouchableOpacity>
            )}
          </>
        )}

        {/* Actions */}
        <View style={detailStyles.actions}>
          {defi.status === 'active' && progressRatio >= 1 && (
            <TouchableOpacity
              style={[detailStyles.completeBtn, { backgroundColor: colors.success }]}
              onPress={onComplete}
              activeOpacity={0.7}
            >
              <Text style={[detailStyles.completeBtnText, { color: colors.onPrimary }]}>Valider le défi</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[detailStyles.deleteBtn, { backgroundColor: colors.errorBg }]}
            onPress={() => {
              Alert.alert('Supprimer ce défi ?', 'Cette action est irréversible.', [
                { text: 'Annuler', style: 'cancel' },
                { text: 'Supprimer', style: 'destructive', onPress: onDelete },
              ]);
            }}
            activeOpacity={0.7}
          >
            <Text style={[detailStyles.deleteBtnText, { color: colors.error }]}>Supprimer</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const detailStyles = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { flex: 1 },
  content: { padding: Spacing['2xl'], gap: Spacing.xl, paddingBottom: 40 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between' },
  summaryText: { fontSize: FontSize.titleLg, fontWeight: FontWeight.heavy },
  sectionTitle: {
    fontSize: FontSize.label, fontWeight: FontWeight.bold,
    textTransform: 'uppercase', letterSpacing: 0.5, marginTop: Spacing.lg,
  },
  calendarGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  calendarDay: {
    width: 40, height: 40, borderRadius: Radius.md,
    alignItems: 'center', justifyContent: 'center', borderWidth: 2,
  },
  calendarDayNum: { fontSize: FontSize.sm, fontWeight: FontWeight.bold },
  calendarIcon: { fontSize: 10 },
  participantRow: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.lg,
    padding: Spacing.xl, borderRadius: Radius.md,
  },
  participantAvatar: { fontSize: 24 },
  participantInfo: { flex: 1, gap: 2 },
  participantName: { fontSize: FontSize.body, fontWeight: FontWeight.semibold },
  participantMeta: { fontSize: FontSize.sm },
  checkInRow: { flexDirection: 'row', gap: Spacing.md },
  checkInInput: {
    borderWidth: 1, borderRadius: Radius.md,
    paddingHorizontal: Spacing.xl, paddingVertical: Spacing.lg,
    fontSize: FontSize.body,
  },
  noteInput: {},
  checkInButtons: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md },
  checkInBtn: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    paddingHorizontal: Spacing['2xl'], paddingVertical: Spacing.lg,
    borderRadius: Radius.full, borderWidth: 1,
  },
  checkInBtnAvatar: { fontSize: 18 },
  checkInBtnText: { fontSize: FontSize.sm, fontWeight: FontWeight.bold },
  failBtn: {
    paddingVertical: Spacing.lg, borderRadius: Radius.md,
    alignItems: 'center', borderWidth: 1,
  },
  failBtnText: { fontSize: FontSize.sm, fontWeight: FontWeight.bold },
  actions: { gap: Spacing.md, marginTop: Spacing.xl },
  completeBtn: {
    paddingVertical: Spacing.xl, borderRadius: Radius.md, alignItems: 'center',
  },
  completeBtnText: { fontSize: FontSize.body, fontWeight: FontWeight.bold },
  deleteBtn: {
    paddingVertical: Spacing.lg, borderRadius: Radius.md, alignItems: 'center',
  },
  deleteBtnText: { fontSize: FontSize.sm, fontWeight: FontWeight.bold },
});

// ─── Écran principal ───────────────────────────────────────────────────────

export default function DefisScreen() {
  const { primary, tint, colors } = useThemeColors();
  const { showToast } = useToast();
  const { profiles, defis, createDefi, checkInDefi, completeDefi, deleteDefi, activeProfile, refresh } = useVault();
  const isChildMode = activeProfile?.role === 'enfant' || activeProfile?.role === 'ado';
  const { isAllowed } = useParentalControls();

  // Filtrer les défis : un enfant ne voit que ceux auxquels il participe (sauf si autorisé)
  const visibleDefis = useMemo(() => {
    if (!isChildMode || !activeProfile || isAllowed('defis', activeProfile.role)) return defis;
    return defis.filter((d) =>
      d.participants.length === 0 || d.participants.includes(activeProfile.id),
    );
  }, [defis, isChildMode, activeProfile, isAllowed]);

  const { refreshing, onRefresh } = useRefresh(refresh);

  const [activeTab, setActiveTab] = useState<TabId>('actifs');
  const defisContentRef = useRef<View>(null);
  const [configModal, setConfigModal] = useState<{ visible: boolean; template?: DefiTemplate }>({ visible: false });
  const [detailDefiId, setDetailDefiId] = useState<string | null>(null);
  const detailDefi = detailDefiId ? visibleDefis.find((d) => d.id === detailDefiId) ?? null : null;

  const activeDefis = useMemo(() => visibleDefis.filter((d) => d.status === 'active'), [visibleDefis]);
  const historyDefis = useMemo(() => visibleDefis.filter((d) => d.status !== 'active'), [visibleDefis]);

  const handleCreateDefi = useCallback(async (defi: Omit<Defi, 'progress' | 'status'>) => {
    await createDefi(defi);
    setConfigModal({ visible: false });
    showToast(`Défi "${defi.title}" lancé !`);
  }, [createDefi, showToast]);

  const handleCheckIn = useCallback(async (defiId: string, profileId: string, completed: boolean, value?: number, note?: string) => {
    await checkInDefi(defiId, profileId, completed, value, note);
  }, [checkInDefi]);

  const handleQuickCheckIn = useCallback(async (defi: Defi) => {
    if (!activeProfile) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await checkInDefi(defi.id, activeProfile.id, true);
    showToast(`Check-in ${defi.emoji} ${defi.title}`);
  }, [activeProfile, checkInDefi, showToast]);

  const handleCompleteDefi = useCallback(async (defiId: string) => {
    const defi = defis.find((d) => d.id === defiId);
    await completeDefi(defiId);
    setDetailDefiId(null);
    showToast(`Bravo ! Défi "${defi?.title}" réussi ! ${defi?.rewardPoints} pts + ${defi?.rewardLootBoxes} loot box(es)`);
  }, [completeDefi, defis, showToast]);

  const handleDeleteDefi = useCallback(async (defiId: string) => {
    await deleteDefi(defiId);
    setDetailDefiId(null);
    showToast('Défi supprimé');
  }, [deleteDefi, showToast]);

  // Grouper les templates par catégorie
  const templatesByCategory = useMemo(() => {
    const map = new Map<DefiCategory, DefiTemplate[]>();
    for (const t of DEFI_TEMPLATES) {
      if (!map.has(t.category)) map.set(t.category, []);
      map.get(t.category)!.push(t);
    }
    return map;
  }, []);

  const tabs: { id: TabId; label: string; count?: number }[] = [
    { id: 'actifs', label: 'Actifs', count: activeDefis.length || undefined },
    { id: 'templates', label: 'Templates' },
    { id: 'historique', label: 'Historique', count: historyDefis.length || undefined },
  ];

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]} edges={['top']}>
      <View ref={defisContentRef} style={[styles.header, { backgroundColor: colors.bg }]}>
        <Text style={[styles.title, { color: colors.text }]}>Défis familiaux</Text>
      </View>

      {/* Onglets */}
      <View style={[styles.tabBar, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        {tabs.map((tab) => (
          <TouchableOpacity
            key={tab.id}
            style={[styles.tab, activeTab === tab.id && { borderBottomColor: primary }]}
            onPress={() => setActiveTab(tab.id)}
            activeOpacity={0.7}
          >
            <Text style={[styles.tabLabel, { color: activeTab === tab.id ? primary : colors.textMuted }]}>
              {tab.label}
              {tab.count ? ` (${tab.count})` : ''}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Contenu */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={primary} />}
      >
        {activeTab === 'actifs' && (
          <>
            {activeDefis.length === 0 && (
              <View style={[styles.emptyState, { backgroundColor: colors.card }]}>
                <Text style={styles.emptyEmoji}>🏅</Text>
                <Text style={[styles.emptyTitle, { color: colors.text }]}>Aucun défi en cours</Text>
                <Text style={[styles.emptyDesc, { color: colors.textMuted }]}>
                  Lancez un défi familial depuis les templates !
                </Text>
                <TouchableOpacity
                  style={[styles.emptyBtn, { backgroundColor: primary }]}
                  onPress={() => setActiveTab('templates')}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.emptyBtnText, { color: colors.onPrimary }]}>Voir les templates</Text>
                </TouchableOpacity>
              </View>
            )}
            {activeDefis.map((d) => (
              <DefiCard
                key={d.id}
                defi={d}
                profiles={profiles}
                onPress={() => setDetailDefiId(d.id)}
                onCheckIn={() => handleQuickCheckIn(d)}
              />
            ))}
          </>
        )}

        {activeTab === 'templates' && (
          <>
            {Array.from(templatesByCategory.entries()).map(([cat, templates]) => (
              <View key={cat}>
                <Text style={[styles.categoryTitle, { color: colors.textMuted }]}>
                  {DEFI_CATEGORY_LABELS[cat].emoji} {DEFI_CATEGORY_LABELS[cat].label}
                </Text>
                {templates.map((t) => (
                  <TouchableOpacity
                    key={t.id}
                    style={[styles.templateCard, { backgroundColor: colors.card }]}
                    onPress={() => setConfigModal({ visible: true, template: t })}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.templateEmoji}>{t.emoji}</Text>
                    <View style={styles.templateInfo}>
                      <Text style={[styles.templateTitle, { color: colors.text }]}>{t.title}</Text>
                      <Text style={[styles.templateDesc, { color: colors.textMuted }]} numberOfLines={1}>{t.description}</Text>
                    </View>
                    <Chip
                      label={t.difficulty}
                      color={t.difficulty === 'facile' ? colors.success : t.difficulty === 'moyen' ? colors.warning : colors.error}
                      size="sm"
                    />
                  </TouchableOpacity>
                ))}
              </View>
            ))}
            {/* Bouton défi personnalisé */}
            <TouchableOpacity
              style={[styles.customBtn, { borderColor: primary }]}
              onPress={() => setConfigModal({ visible: true })}
              activeOpacity={0.7}
            >
              <Text style={[styles.customBtnText, { color: primary }]}>+ Créer un défi personnalisé</Text>
            </TouchableOpacity>
          </>
        )}

        {activeTab === 'historique' && (
          <>
            {historyDefis.length === 0 && (
              <View style={[styles.emptyState, { backgroundColor: colors.card }]}>
                <Text style={styles.emptyEmoji}>📜</Text>
                <Text style={[styles.emptyTitle, { color: colors.text }]}>Aucun historique</Text>
                <Text style={[styles.emptyDesc, { color: colors.textMuted }]}>
                  Les défis terminés ou échoués apparaîtront ici.
                </Text>
              </View>
            )}
            {historyDefis.map((d) => {
              const isCompleted = d.status === 'completed';
              return (
                <TouchableOpacity
                  key={d.id}
                  style={[styles.historyCard, { backgroundColor: colors.card }]}
                  onPress={() => setDetailDefiId(d.id)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.historyEmoji}>{d.emoji}</Text>
                  <View style={styles.historyInfo}>
                    <Text style={[styles.historyTitle, { color: colors.text }]}>{d.title}</Text>
                    <Text style={[styles.historyMeta, { color: colors.textMuted }]}>
                      {d.startDate} → {d.endDate}
                    </Text>
                  </View>
                  <Chip
                    label={isCompleted ? 'Réussi' : 'Échoué'}
                    color={isCompleted ? colors.success : colors.error}
                    size="sm"
                  />
                </TouchableOpacity>
              );
            })}
          </>
        )}

        <View style={styles.bottomPad} />
      </ScrollView>

      {/* Modal config */}
      <Modal visible={configModal.visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setConfigModal({ visible: false })}>
        <DefiConfigModal
          template={configModal.template}
          profiles={profiles}
          onSave={handleCreateDefi}
          onClose={() => setConfigModal({ visible: false })}
        />
      </Modal>

      {/* Modal détail */}
      <Modal visible={!!detailDefi} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setDetailDefiId(null)}>
        {detailDefi && (
          <DefiDetailModal
            defi={detailDefi}
            profiles={profiles}
            onCheckIn={(pid, completed, value, note) => handleCheckIn(detailDefi.id, pid, completed, value, note)}
            onComplete={() => handleCompleteDefi(detailDefi.id)}
            onDelete={() => handleDeleteDefi(detailDefi.id)}
            onClose={() => setDetailDefiId(null)}
          />
        )}
      </Modal>

      <ScreenGuide
        screenId="defis"
        targets={[
          { ref: defisContentRef, ...HELP_CONTENT.defis[0] },
        ]}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    paddingHorizontal: Spacing['3xl'],
    paddingVertical: Spacing.xl,
  },
  title: { fontSize: FontSize.titleLg, fontWeight: FontWeight.heavy },
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
  },
  tab: {
    flex: 1,
    paddingVertical: Spacing.xl,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabLabel: { fontSize: FontSize.sm, fontWeight: FontWeight.bold },
  scroll: { flex: 1 },
  content: { padding: Spacing['2xl'], gap: Spacing.xl, paddingBottom: 40 },
  emptyState: {
    padding: Spacing['3xl'],
    borderRadius: Radius.lg,
    alignItems: 'center',
    gap: Spacing.lg,
  },
  emptyEmoji: { fontSize: 48 },
  emptyTitle: { fontSize: FontSize.heading, fontWeight: FontWeight.heavy },
  emptyDesc: { fontSize: FontSize.body, textAlign: 'center' },
  emptyBtn: {
    paddingHorizontal: Spacing['3xl'], paddingVertical: Spacing.xl,
    borderRadius: Radius.md, marginTop: Spacing.lg,
  },
  emptyBtnText: { fontSize: FontSize.body, fontWeight: FontWeight.bold },
  categoryTitle: {
    fontSize: FontSize.label, fontWeight: FontWeight.bold,
    textTransform: 'uppercase', letterSpacing: 0.5,
    marginTop: Spacing.xl, marginBottom: Spacing.md,
    paddingHorizontal: Spacing.xs,
  },
  templateCard: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.lg,
    padding: Spacing['2xl'], borderRadius: Radius.lg,
    marginBottom: Spacing.md,
    shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 }, elevation: 1,
  },
  templateEmoji: { fontSize: 28 },
  templateInfo: { flex: 1, gap: 2 },
  templateTitle: { fontSize: FontSize.body, fontWeight: FontWeight.bold },
  templateDesc: { fontSize: FontSize.sm },
  customBtn: {
    borderWidth: 1.5, borderStyle: 'dashed', borderRadius: Radius.lg,
    paddingVertical: Spacing['2xl'], alignItems: 'center',
    marginTop: Spacing.lg,
  },
  customBtnText: { fontSize: FontSize.body, fontWeight: FontWeight.bold },
  historyCard: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.lg,
    padding: Spacing['2xl'], borderRadius: Radius.lg,
    shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 }, elevation: 1,
  },
  historyEmoji: { fontSize: 24 },
  historyInfo: { flex: 1, gap: 2 },
  historyTitle: { fontSize: FontSize.body, fontWeight: FontWeight.bold },
  historyMeta: { fontSize: FontSize.sm },
  bottomPad: { height: 40 },
});
