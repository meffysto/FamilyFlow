/**
 * PayoutQueueModal — Validation batch parent (UI-SPEC Surface 4).
 *
 * Plan 53-03b — modal pageSheet drag-to-dismiss.
 *
 * Flow (D-08 + D-09) :
 *   1. Au mount visible : loadQueue() filtrée sur reason === 'review'
 *   2. Liste verticale PayoutQueueItem (Plan 03a) avec avatar + prénom + sats
 *   3. Bouton bas plein largeur "Valider les N pay-outs (N×100 sats)"
 *   4. Tap → FaceID gate UNE SEULE FOIS (D-08 — consentement parental groupé)
 *   5. Boucle for…of : pour chaque item, executePayout({ source: 'flush-review',
 *      bypassBiometric: true }) — bypassBiometric évite N prompts FaceID
 *      séquentiels dans la boucle
 *   6. Items réussis → removeFromQueue + paid++
 *   7. Items échoués → incrementAttempt + remaining++ (restent en queue)
 *   8. Toast résumé final (3 cas D-09) + close
 *
 * Sécurité : le bypassBiometric: true est UNIQUEMENT propagé depuis ce
 * composant. Le listener instant + flush-offline + flush-review individuel
 * (non implémenté en Plan 03b) passent toujours par leur propre FaceID.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  authenticatePayOut,
  executePayout,
  incrementAttempt,
  loadFamilyConfig,
  loadQueue,
  removeFromQueue,
  type FamilyLightningConfig,
  type PayoutQueueItem as PayoutQueueItemData,
} from '../../lib/lightning';
import { useThemeColors } from '../../contexts/ThemeContext';
import { useToast } from '../../contexts/ToastContext';
import type { Profile, Task } from '../../lib/types';
import { ModalHeader } from '../ui/ModalHeader';
import { Spacing, Radius } from '../../constants/spacing';
import { FontSize, FontWeight } from '../../constants/typography';

import { PayoutQueueItem } from './PayoutQueueItem';

interface PayoutQueueModalProps {
  visible: boolean;
  /** Liste profils du vault — utilisée pour rendre l'avatar + prénom. */
  profiles: Profile[];
  /** Liste tasks du vault — utilisée pour résoudre `taskTitle` (taskId → text). */
  tasks: Task[];
  onClose: () => void;
  /** Callback déclenché après le batch (succès ou échec) — l'écran appelant
   *  peut rafraîchir le compteur de queue. */
  onBatchComplete?: () => void;
}

export function PayoutQueueModal({
  visible,
  profiles,
  tasks,
  onClose,
  onBatchComplete,
}: PayoutQueueModalProps) {
  const { colors, primary } = useThemeColors();
  const { showToast } = useToast();

  const [queue, setQueue] = useState<PayoutQueueItemData[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [validating, setValidating] = useState(false);

  // Charge la queue à l'ouverture — filtrée sur reason === 'review'.
  useEffect(() => {
    if (!visible) return;
    setLoadingList(true);
    loadQueue()
      .then((items) => {
        setQueue(items.filter((i) => i.reason === 'review'));
      })
      .catch(() => {
        setQueue([]);
      })
      .finally(() => {
        setLoadingList(false);
      });
  }, [visible]);

  const total = queue.length;
  const totalSats = total * 100;

  const handleValidateBatch = useCallback(async () => {
    if (total === 0 || validating) return;
    setValidating(true);

    // FaceID gate UNE SEULE FOIS avant la boucle (D-08).
    const auth = await authenticatePayOut({
      reason: 'Valider les pay-outs Lightning',
      allowDevicePasscode: __DEV__,
    });
    if (!auth.success) {
      setValidating(false);
      showToast('Validation annulée', 'info');
      return;
    }

    const config = await loadFamilyConfig();
    if (!config) {
      setValidating(false);
      showToast('Configuration manquante', 'error');
      return;
    }

    let paid = 0;
    let remaining = 0;

    // Snapshot de la queue au moment du clic (la modale ne reload pas en
    // pleine action). Pour chaque item, executePayout avec source 'flush-review'
    // ET bypassBiometric: true (D-08 — caller a déjà gate).
    for (const item of queue) {
      const wallet = config.members.find((m) => m.profileId === item.profileId);
      const profile = profiles.find((p) => p.id === item.profileId);

      if (!wallet || !profile) {
        // Orphelin (membre retiré / profil supprimé) → cleanup silencieux.
        await removeFromQueue(item.taskId, item.profileId);
        remaining++;
        continue;
      }

      // Reconstruire un Task minimal pour le payload executePayout (le réel
      // a été oublié au moment de l'enqueue — seuls taskId/sats/profileId
      // sont persistés en queue).
      const fakeTask: Task = {
        id: item.taskId,
        text: '(validation batch)',
        completed: true,
        mentions: [],
      } as Task;

      try {
        await executePayout({
          task: fakeTask,
          recipient: {
            profileId: item.profileId,
            profile,
            wallet,
          },
          config,
          source: 'flush-review',
          // D-08 — 1 seul FaceID au début du batch, on bypass ici.
          bypassBiometric: true,
        });
        await removeFromQueue(item.taskId, item.profileId);
        paid++;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        await incrementAttempt(item.taskId, item.profileId, msg);
        remaining++;
      }
    }

    // Toast résumé final (D-09) — 3 cas.
    if (paid === total) {
      showToast(
        `${paid} pay-out${paid > 1 ? 's' : ''} validé${paid > 1 ? 's' : ''} · ${paid * 100} sats envoyés`,
        'success',
      );
    } else if (paid === 0) {
      showToast("Aucun pay-out n'a abouti — tous en attente", 'error');
    } else {
      showToast(
        `${paid}/${total} pay-outs réussis · ${remaining} en attente de retry`,
        'info',
      );
    }

    setValidating(false);
    onBatchComplete?.();
    onClose();
  }, [queue, total, validating, profiles, showToast, onClose, onBatchComplete]);

  // Pré-résolution des titres de tâches (taskId → text).
  const taskTitles = useMemo(() => {
    const map = new Map<string, string>();
    for (const t of tasks) {
      map.set(t.id, t.text);
    }
    return map;
  }, [tasks]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]}>
        <ModalHeader title="Pay-outs en attente" onClose={onClose} />

        {loadingList ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator color={primary} />
          </View>
        ) : queue.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={[styles.emptyTitle, { color: colors.textMuted }]}>
              Aucun pay-out en attente
            </Text>
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.list}>
            {queue.map((item) => (
              <PayoutQueueItem
                key={`${item.taskId}-${item.profileId}`}
                item={item}
                profile={profiles.find((p) => p.id === item.profileId)}
                taskTitle={taskTitles.get(item.taskId) ?? '—'}
              />
            ))}
          </ScrollView>
        )}

        {/* Bouton bas plein largeur — D-08 batch validate. */}
        {total > 0 && (
          <View
            style={[
              styles.footer,
              { borderTopColor: colors.border, backgroundColor: colors.bg },
            ]}
          >
            <TouchableOpacity
              style={[
                styles.batchBtn,
                {
                  backgroundColor: primary,
                  opacity: validating ? 0.7 : 1,
                },
              ]}
              onPress={handleValidateBatch}
              disabled={validating}
              accessibilityRole="button"
              accessibilityLabel={`Valider ${total} pay-outs, ${totalSats} sats`}
              accessibilityState={{ disabled: validating }}
            >
              {validating ? (
                <ActivityIndicator color={colors.onPrimary} />
              ) : (
                <Text style={[styles.batchLabel, { color: colors.onPrimary }]}>
                  {`Valider ${total} pay-out${total > 1 ? 's' : ''} (${totalSats} sats)`}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        )}
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },
  list: {
    padding: Spacing['2xl'],
    gap: Spacing.md,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing['3xl'],
  },
  emptyTitle: {
    fontSize: FontSize.body,
    textAlign: 'center',
  },
  footer: {
    borderTopWidth: StyleSheet.hairlineWidth,
    padding: Spacing['2xl'],
    paddingBottom: Spacing['4xl'],
  },
  batchBtn: {
    height: 52,
    borderRadius: Radius.xl,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing['2xl'],
  },
  batchLabel: {
    fontSize: FontSize.subtitle,
    fontWeight: FontWeight.semibold,
  },
});
