/**
 * CalendarImporter.tsx — Modal import d'anniversaires depuis les calendriers iOS
 *
 * Présentation pageSheet. Demande la permission calendrier, cherche dans TOUS
 * les calendriers : le calendrier natif "Anniversaires" + les événements
 * classiques dont le titre contient "Anniversaire" (ex: "Anniversaire Maman").
 * Récupère sur 1 an, sélection multiple + import batch.
 *
 * Suit exactement le même pattern visuel et UX que ContactImporter.tsx.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  FlatList,
  TouchableOpacity,
  Linking,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Calendar from 'expo-calendar';
import * as Haptics from 'expo-haptics';
import { useThemeColors } from '../contexts/ThemeContext';
import { useToast } from '../contexts/ToastContext';
import { Spacing, Radius } from '../constants/spacing';
import { FontSize, FontWeight } from '../constants/typography';
import { Shadows } from '../constants/shadows';
import { ModalHeader } from './ui/ModalHeader';
import { Button } from './ui/Button';
import type { Anniversary } from '../lib/types';

interface CalendarBirthday {
  id: string;
  name: string;
  date: string; // MM-DD
  birthYear?: number;
  alreadyImported: boolean;
}

interface CalendarImporterProps {
  visible: boolean;
  onClose: () => void;
  onImport: (items: Omit<Anniversary, 'sourceFile'>[]) => Promise<void>;
  /** Anniversaires déjà existants (pour déduplication) */
  existingAnniversaries: Anniversary[];
}

/** Extrait le nom depuis un titre d'événement type "Anniversaire Maman" */
function extractNameFromTitle(title: string): string | null {
  // Patterns courants : "Anniversaire Maman", "Anniv Papa", "Birthday John"
  const patterns = [
    /^anniversaire\s+(?:de\s+)?(.+)/i,
    /^anniv\.?\s+(?:de\s+)?(.+)/i,
    /^birthday\s+(?:of\s+)?(.+)/i,
  ];
  for (const pattern of patterns) {
    const match = title.match(pattern);
    if (match) return match[1].trim();
  }
  return null;
}

/** Vérifie si un titre d'événement ressemble à un anniversaire */
function isBirthdayEvent(title: string): boolean {
  const t = title.toLowerCase();
  return (
    t.startsWith('anniversaire') ||
    t.startsWith('anniv') ||
    t.startsWith('birthday')
  );
}

export function CalendarImporter({
  visible,
  onClose,
  onImport,
  existingAnniversaries,
}: CalendarImporterProps) {
  const { primary, tint, colors } = useThemeColors();
  const { showToast } = useToast();

  const [permissionStatus, setPermissionStatus] = useState<'loading' | 'granted' | 'denied'>('loading');
  const [birthdays, setBirthdays] = useState<CalendarBirthday[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [importing, setImporting] = useState(false);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [noEvents, setNoEvents] = useState(false);

  // Construire un set de clés nom+date pour déduplication
  const existingKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const a of existingAnniversaries) {
      keys.add(`${a.name.toLowerCase().trim()}|${a.date}`);
    }
    return keys;
  }, [existingAnniversaries]);

  // Demander permission et charger les événements
  useEffect(() => {
    if (!visible) {
      setPermissionStatus('loading');
      setBirthdays([]);
      setSelected(new Set());
      setNoEvents(false);
      return;
    }

    (async () => {
      const { status } = await Calendar.requestCalendarPermissionsAsync();
      if (status !== 'granted') {
        setPermissionStatus('denied');
        return;
      }
      setPermissionStatus('granted');
      setLoadingEvents(true);

      try {
        // Récupérer TOUS les calendriers (natif birthdays + calendriers classiques)
        const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
        const calendarIds = calendars.map((c) => c.id);

        if (calendarIds.length === 0) {
          setNoEvents(true);
          return;
        }

        // Récupérer les événements sur 1 an dans tous les calendriers
        const now = new Date();
        const oneYearLater = new Date(now.getFullYear() + 1, now.getMonth(), now.getDate());

        const events = await Calendar.getEventsAsync(
          calendarIds,
          now,
          oneYearLater,
        );

        // Mapper et dédupliquer
        const seen = new Map<string, CalendarBirthday>();
        for (const event of events) {
          if (!event.title || !event.startDate) continue;

          const title = event.title.trim();

          // Vérifier si c'est un événement de type birthdays OU un événement "Anniversaire X"
          const cal = calendars.find((c) => c.id === event.calendarId);
          const isBirthdayCal =
            (cal as any)?.type === 'birthdays' ||
            (cal as any)?.source?.type === 'birthdays';

          let name: string;
          if (isBirthdayCal) {
            // Calendrier natif birthdays → le titre est directement le nom
            name = title;
          } else if (isBirthdayEvent(title)) {
            // Événement classique "Anniversaire Maman" → extraire le nom
            const extracted = extractNameFromTitle(title);
            if (!extracted) continue;
            name = extracted;
          } else {
            // Pas un anniversaire → ignorer
            continue;
          }

          const start = new Date(event.startDate);
          const mm = String(start.getMonth() + 1).padStart(2, '0');
          const dd = String(start.getDate()).padStart(2, '0');
          const dateStr = `${mm}-${dd}`;

          // Dédupliquer par nom+date (même personne)
          const key = `${name.toLowerCase()}|${dateStr}`;
          if (seen.has(key)) continue;

          const alreadyImported = existingKeys.has(key);

          seen.set(key, {
            id: `${name}|${dateStr}`,
            name,
            date: dateStr,
            birthYear: undefined,
            alreadyImported,
          });
        }

        if (seen.size === 0) {
          setNoEvents(true);
        }

        const sorted = Array.from(seen.values()).sort((a, b) =>
          a.name.toLowerCase().localeCompare(b.name.toLowerCase(), 'fr'),
        );

        setBirthdays(sorted);

        // Pré-sélectionner ceux qui ne sont pas déjà importés
        const initialSelected = new Set(
          sorted.filter((b) => !b.alreadyImported).map((b) => b.id),
        );
        setSelected(initialSelected);
      } catch {
        showToast('Erreur lors du chargement du calendrier', 'error');
      } finally {
        setLoadingEvents(false);
      }
    })();
  }, [visible, existingKeys, showToast]);

  const selectableCount = useMemo(
    () => birthdays.filter((b) => !b.alreadyImported).length,
    [birthdays],
  );

  const selectedCount = selected.size;

  const toggleItem = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    Haptics.selectionAsync();
  }, []);

  const toggleAll = useCallback(() => {
    if (selectedCount === selectableCount) {
      setSelected(new Set());
    } else {
      setSelected(new Set(birthdays.filter((b) => !b.alreadyImported).map((b) => b.id)));
    }
    Haptics.selectionAsync();
  }, [selectedCount, selectableCount, birthdays]);

  const handleImport = useCallback(async () => {
    if (selectedCount === 0) return;
    setImporting(true);
    try {
      const items: Omit<Anniversary, 'sourceFile'>[] = birthdays
        .filter((b) => selected.has(b.id))
        .map((b) => ({
          name: b.name,
          date: b.date,
          birthYear: b.birthYear,
          category: 'calendrier',
          contactId: undefined,
          notes: undefined,
        }));

      await onImport(items);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      showToast(`${items.length} anniversaire${items.length > 1 ? 's' : ''} importé${items.length > 1 ? 's' : ''}`);
      onClose();
    } catch {
      showToast("Erreur lors de l'import", 'error');
    } finally {
      setImporting(false);
    }
  }, [selectedCount, birthdays, selected, onImport, onClose, showToast]);

  const formatDate = (dateStr: string): string => {
    const [mm, dd] = dateStr.split('-');
    return `${dd}/${mm}`;
  };

  const renderBirthday = useCallback(
    ({ item }: { item: CalendarBirthday }) => {
      const isSelected = selected.has(item.id);

      return (
        <TouchableOpacity
          style={[
            styles.contactRow,
            { backgroundColor: colors.card },
            item.alreadyImported && { opacity: 0.5 },
          ]}
          onPress={() => !item.alreadyImported && toggleItem(item.id)}
          activeOpacity={0.7}
          disabled={item.alreadyImported}
        >
          {/* Initiale */}
          <View style={[styles.avatarFallback, { backgroundColor: tint }]}>
            <Text style={[styles.avatarInitial, { color: primary }]}>
              {item.name.charAt(0).toUpperCase()}
            </Text>
          </View>

          {/* Infos */}
          <View style={styles.contactInfo}>
            <Text style={[styles.contactName, { color: colors.text }]}>{item.name}</Text>
            <Text style={[styles.contactDate, { color: colors.textMuted }]}>
              {formatDate(item.date)}
              {item.alreadyImported && '  \u2022  Déjà importé'}
            </Text>
          </View>

          {/* Checkbox */}
          {!item.alreadyImported ? (
            <View
              style={[
                styles.checkbox,
                {
                  borderColor: isSelected ? primary : colors.border,
                  backgroundColor: isSelected ? primary : 'transparent',
                },
              ]}
            >
              {isSelected && <Text style={styles.checkmark}>{'✓'}</Text>}
            </View>
          ) : (
            <View style={[styles.importedBadge, { backgroundColor: colors.successBg }]}>
              <Text style={[styles.importedText, { color: colors.successText }]}>{'✓'}</Text>
            </View>
          )}
        </TouchableOpacity>
      );
    },
    [selected, colors, primary, tint, toggleItem],
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]} edges={['top']}>
        <ModalHeader
          title="Importer du calendrier"
          onClose={onClose}
        />

        {permissionStatus === 'loading' || loadingEvents ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={primary} />
            <Text style={[styles.loadingText, { color: colors.textMuted }]}>
              Chargement du calendrier...
            </Text>
          </View>
        ) : permissionStatus === 'denied' ? (
          <View style={styles.centered}>
            <Text style={styles.deniedEmoji}>{'🔒'}</Text>
            <Text style={[styles.deniedTitle, { color: colors.text }]}>
              Accès au calendrier refusé
            </Text>
            <Text style={[styles.deniedDesc, { color: colors.textMuted }]}>
              Pour importer les anniversaires depuis votre calendrier, autorisez l'accès dans les réglages de votre appareil.
            </Text>
            <Button
              label="Ouvrir les réglages"
              onPress={() => Linking.openSettings()}
              variant="secondary"
              icon="⚙️"
            />
          </View>
        ) : noEvents || birthdays.length === 0 ? (
          <View style={styles.centered}>
            <Text style={styles.deniedEmoji}>{'📅'}</Text>
            <Text style={[styles.deniedTitle, { color: colors.text }]}>
              Aucun anniversaire trouvé
            </Text>
            <Text style={[styles.deniedDesc, { color: colors.textMuted }]}>
              Aucun événement d'anniversaire trouvé. Vérifiez que vos événements contiennent « Anniversaire » dans le titre, ou que le calendrier natif Anniversaires est activé.
            </Text>
          </View>
        ) : (
          <>
            {/* Toggle sélection + compteur */}
            <View style={[styles.toolbar, { borderBottomColor: colors.border }]}>
              <TouchableOpacity onPress={toggleAll} activeOpacity={0.7}>
                <Text style={[styles.toggleText, { color: primary }]}>
                  {selectedCount === selectableCount ? 'Tout désélectionner' : 'Tout sélectionner'}
                </Text>
              </TouchableOpacity>
              <Text style={[styles.countText, { color: colors.textMuted }]}>
                {birthdays.length} anniversaire{birthdays.length > 1 ? 's' : ''}
              </Text>
            </View>

            <FlatList
              data={birthdays}
              keyExtractor={(item) => item.id}
              renderItem={renderBirthday}
              contentContainerStyle={styles.listContent}
              ItemSeparatorComponent={() => <View style={styles.separator} />}
            />

            {/* Bouton import en bas */}
            <View style={[styles.footer, { backgroundColor: colors.card, borderTopColor: colors.border }]}>
              <Button
                label={
                  selectedCount === 0
                    ? 'Sélectionnez des anniversaires'
                    : `Importer ${selectedCount} anniversaire${selectedCount > 1 ? 's' : ''}`
                }
                onPress={handleImport}
                variant="primary"
                size="lg"
                fullWidth
                disabled={selectedCount === 0 || importing}
                icon="📥"
              />
            </View>
          </>
        )}
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing['3xl'],
    gap: Spacing['2xl'],
  },
  loadingText: {
    fontSize: FontSize.body,
    marginTop: Spacing.xl,
  },
  deniedEmoji: { fontSize: 48 },
  deniedTitle: {
    fontSize: FontSize.heading,
    fontWeight: FontWeight.heavy,
    textAlign: 'center',
  },
  deniedDesc: {
    fontSize: FontSize.body,
    textAlign: 'center',
    lineHeight: 22,
  },
  toolbar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing['2xl'],
    paddingVertical: Spacing.xl,
    borderBottomWidth: 1,
  },
  toggleText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
  },
  countText: {
    fontSize: FontSize.caption,
  },
  listContent: {
    padding: Spacing['2xl'],
    paddingBottom: 100,
  },
  separator: { height: Spacing.md },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing['2xl'],
    borderRadius: Radius.lg,
    gap: Spacing.xl,
    ...Shadows.xs,
  },
  avatarFallback: {
    width: 44,
    height: 44,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
  },
  contactInfo: {
    flex: 1,
    gap: Spacing.xxs,
  },
  contactName: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.semibold,
  },
  contactDate: {
    fontSize: FontSize.caption,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: Radius.sm,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkmark: {
    color: '#FFFFFF',
    fontSize: FontSize.sm,
    fontWeight: FontWeight.heavy,
  },
  importedBadge: {
    width: 24,
    height: 24,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  importedText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.heavy,
  },
  footer: {
    padding: Spacing['2xl'],
    borderTopWidth: 1,
    ...Shadows.md,
  },
});
