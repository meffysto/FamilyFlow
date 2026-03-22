/**
 * ContactImporter.tsx — Modal import d'anniversaires depuis les contacts iCloud
 *
 * Présentation pageSheet. Demande la permission contacts, filtre ceux
 * qui ont un anniversaire, permet la sélection multiple + import batch.
 *
 * ATTENTION : birthday.month est 0-indexed (0 = janvier) — converti en 1-indexed.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  FlatList,
  TouchableOpacity,
  Image,
  Linking,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Contacts from 'expo-contacts';
import * as Haptics from 'expo-haptics';
import { useThemeColors } from '../contexts/ThemeContext';
import { useToast } from '../contexts/ToastContext';
import { Spacing, Radius } from '../constants/spacing';
import { FontSize, FontWeight } from '../constants/typography';
import { Shadows } from '../constants/shadows';
import { ModalHeader } from './ui/ModalHeader';
import { Button } from './ui/Button';
import { useTranslation } from 'react-i18next';
import type { Anniversary } from '../lib/types';

interface ContactWithBirthday {
  id: string;
  firstName: string;
  lastName: string;
  birthday: { month: number; day: number; year?: number }; // month 0-indexed from expo-contacts
  imageUri?: string;
  alreadyImported: boolean;
}

interface ContactImporterProps {
  visible: boolean;
  onClose: () => void;
  onImport: (items: Omit<Anniversary, 'sourceFile'>[]) => Promise<void>;
  /** Anniversaires déjà existants (pour déduplication) */
  existingAnniversaries: Anniversary[];
}

export function ContactImporter({
  visible,
  onClose,
  onImport,
  existingAnniversaries,
}: ContactImporterProps) {
  const { t } = useTranslation();
  const { primary, tint, colors } = useThemeColors();
  const { showToast } = useToast();

  const [permissionStatus, setPermissionStatus] = useState<'loading' | 'granted' | 'denied'>('loading');
  const [contacts, setContacts] = useState<ContactWithBirthday[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [importing, setImporting] = useState(false);
  const [loadingContacts, setLoadingContacts] = useState(false);

  // Demander permission et charger les contacts
  useEffect(() => {
    if (!visible) {
      setPermissionStatus('loading');
      setContacts([]);
      setSelected(new Set());
      return;
    }

    (async () => {
      const { status } = await Contacts.requestPermissionsAsync();
      if (status !== 'granted') {
        setPermissionStatus('denied');
        return;
      }
      setPermissionStatus('granted');
      setLoadingContacts(true);

      try {
        const { data } = await Contacts.getContactsAsync({
          fields: [
            Contacts.Fields.Birthday,
            Contacts.Fields.FirstName,
            Contacts.Fields.LastName,
            Contacts.Fields.Image,
          ],
        });

        // Construire le set des contactIds déjà importés
        const existingContactIds = new Set(
          existingAnniversaries.filter((a) => a.contactId).map((a) => a.contactId),
        );

        // Filtrer ceux qui ont un anniversaire valide
        const withBirthday: ContactWithBirthday[] = data
          .filter((c) => c.birthday && c.birthday.day != null && c.birthday.month != null)
          .map((c) => ({
            id: c.id!,
            firstName: c.firstName ?? '',
            lastName: c.lastName ?? '',
            birthday: {
              month: c.birthday!.month!, // 0-indexed
              day: c.birthday!.day!,
              year: c.birthday!.year ?? undefined,
            },
            imageUri: c.image?.uri ?? undefined,
            alreadyImported: existingContactIds.has(c.id!),
          }))
          .sort((a, b) => {
            const nameA = `${a.firstName} ${a.lastName}`.trim().toLowerCase();
            const nameB = `${b.firstName} ${b.lastName}`.trim().toLowerCase();
            return nameA.localeCompare(nameB, 'fr');
          });

        setContacts(withBirthday);

        // Pré-sélectionner tous ceux qui ne sont pas déjà importés
        const initialSelected = new Set(
          withBirthday.filter((c) => !c.alreadyImported).map((c) => c.id),
        );
        setSelected(initialSelected);
      } catch {
        showToast(t('contactImporter.toast.loadError'), 'error');
      } finally {
        setLoadingContacts(false);
      }
    })();
  }, [visible, existingAnniversaries, showToast]);

  const selectableCount = useMemo(
    () => contacts.filter((c) => !c.alreadyImported).length,
    [contacts],
  );

  const selectedCount = selected.size;

  const toggleContact = useCallback((id: string) => {
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
      // Tout désélectionner
      setSelected(new Set());
    } else {
      // Tout sélectionner
      setSelected(new Set(contacts.filter((c) => !c.alreadyImported).map((c) => c.id)));
    }
    Haptics.selectionAsync();
  }, [selectedCount, selectableCount, contacts]);

  const handleImport = useCallback(async () => {
    if (selectedCount === 0) return;
    setImporting(true);
    try {
      const items: Omit<Anniversary, 'sourceFile'>[] = contacts
        .filter((c) => selected.has(c.id))
        .map((c) => {
          // ATTENTION : month est 0-indexed dans expo-contacts
          const realMonth = c.birthday.month + 1;
          const dateStr = `${String(realMonth).padStart(2, '0')}-${String(c.birthday.day).padStart(2, '0')}`;
          const fullName = `${c.firstName} ${c.lastName}`.trim();
          return {
            name: fullName,
            date: dateStr,
            birthYear: c.birthday.year ?? undefined,
            contactId: c.id,
            category: undefined,
            notes: undefined,
          };
        });

      await onImport(items);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      showToast(t('contactImporter.toast.imported', { count: items.length }));
      onClose();
    } catch {
      showToast(t('contactImporter.toast.importError'), 'error');
    } finally {
      setImporting(false);
    }
  }, [selectedCount, contacts, selected, onImport, onClose, showToast]);

  const formatBirthday = (c: ContactWithBirthday): string => {
    const realMonth = c.birthday.month + 1;
    const dayStr = String(c.birthday.day).padStart(2, '0');
    const monthStr = String(realMonth).padStart(2, '0');
    if (c.birthday.year) return `${dayStr}/${monthStr}/${c.birthday.year}`;
    return `${dayStr}/${monthStr}`;
  };

  const renderContact = useCallback(
    ({ item }: { item: ContactWithBirthday }) => {
      const isSelected = selected.has(item.id);
      const fullName = `${item.firstName} ${item.lastName}`.trim();

      return (
        <TouchableOpacity
          style={[
            styles.contactRow,
            { backgroundColor: colors.card },
            item.alreadyImported && { opacity: 0.5 },
          ]}
          onPress={() => !item.alreadyImported && toggleContact(item.id)}
          activeOpacity={0.7}
          disabled={item.alreadyImported}
        >
          {/* Photo ou initiale */}
          {item.imageUri ? (
            <Image source={{ uri: item.imageUri }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatarFallback, { backgroundColor: tint }]}>
              <Text style={[styles.avatarInitial, { color: primary }]}>
                {fullName.charAt(0).toUpperCase()}
              </Text>
            </View>
          )}

          {/* Infos */}
          <View style={styles.contactInfo}>
            <Text style={[styles.contactName, { color: colors.text }]}>{fullName}</Text>
            <Text style={[styles.contactDate, { color: colors.textMuted }]}>
              {formatBirthday(item)}
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
    [selected, colors, primary, tint, toggleContact],
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
          title="Importer des contacts"
          onClose={onClose}
        />

        {permissionStatus === 'loading' || loadingContacts ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={primary} />
            <Text style={[styles.loadingText, { color: colors.textMuted }]}>
              Chargement des contacts...
            </Text>
          </View>
        ) : permissionStatus === 'denied' ? (
          <View style={styles.centered}>
            <Text style={styles.deniedEmoji}>{'🔒'}</Text>
            <Text style={[styles.deniedTitle, { color: colors.text }]}>
              Accès aux contacts refusé
            </Text>
            <Text style={[styles.deniedDesc, { color: colors.textMuted }]}>
              Pour importer les anniversaires depuis vos contacts, autorisez l'accès dans les réglages de votre appareil.
            </Text>
            <Button
              label="Ouvrir les réglages"
              onPress={() => Linking.openSettings()}
              variant="secondary"
              icon="⚙️"
            />
          </View>
        ) : contacts.length === 0 ? (
          <View style={styles.centered}>
            <Text style={styles.deniedEmoji}>{'📇'}</Text>
            <Text style={[styles.deniedTitle, { color: colors.text }]}>
              Aucun contact avec anniversaire
            </Text>
            <Text style={[styles.deniedDesc, { color: colors.textMuted }]}>
              Ajoutez des dates d'anniversaire dans votre carnet de contacts pour pouvoir les importer.
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
                {contacts.length} contact{contacts.length > 1 ? 's' : ''} avec anniversaire
              </Text>
            </View>

            <FlatList
              data={contacts}
              keyExtractor={(item) => item.id}
              renderItem={renderContact}
              contentContainerStyle={styles.listContent}
              ItemSeparatorComponent={() => <View style={styles.separator} />}
            />

            {/* Bouton import en bas */}
            <View style={[styles.footer, { backgroundColor: colors.card, borderTopColor: colors.border }]}>
              <Button
                label={
                  selectedCount === 0
                    ? 'Sélectionnez des contacts'
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
  avatar: {
    width: 44,
    height: 44,
    borderRadius: Radius.full,
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
