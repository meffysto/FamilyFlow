// components/pdf/BookExportModal.tsx
// Modal pageSheet drag-to-dismiss qui orchestre l'export d'un livre PDF
// (sélection histoire → génération → aperçu) — Phase 51-01.
//
// State machine 4 phases : select → generating → ready → post-export.
// Phase post-export laissée à null (TODO Plan 51-03).
//
// Aperçu PDF natif via Print.printAsync({ uri }) (iOS QLPreviewController) ou
// Linking.openURL (Android). Aucune dépendance react-native-pdf ni WebView.

import React, { useEffect, useReducer, useCallback, useState } from 'react';
import {
  Modal,
  View,
  Text,
  ActivityIndicator,
  Pressable,
  Alert,
  Platform,
  Linking,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Print from 'expo-print';
import * as Haptics from 'expo-haptics';
import { useTranslation } from 'react-i18next';
import {
  generateBookPdf,
  persistBookPdf,
  LULU_FORMAT_LABEL,
  PAGE_COUNT,
} from '../../lib/pdf';
import type { BedtimeStory } from '../../lib/types';
import { useVault } from '../../contexts/VaultContext';
import { useThemeColors } from '../../contexts/ThemeContext';
import { ModalHeader } from '../ui';
import { Spacing, Radius } from '../../constants/spacing';
import { FontSize, FontWeight } from '../../constants/typography';
import {
  exportPhaseReducer,
  INITIAL_PHASE,
  type ExportPhase,
} from './exportPhase';

// Constantes module — convention CLAUDE.md.
const STEPS_DURATION = [
  { key: 'assets' as const, ms: 1500 },
  { key: 'render' as const, ms: 800 },
  { key: 'hash' as const, ms: 200 },
  { key: 'print' as const, ms: 2000 },
];

interface Props {
  visible: boolean;
  onClose: () => void;
  /**
   * Histoire pré-sélectionnée (depuis future entry-point contextuel).
   * Si absent, l'utilisateur choisit dans la liste vault.stories.
   */
  story?: BedtimeStory;
  /** Callback succès : navigue vers post-export (rendu UI Plan 51-03). */
  onSuccess: (uri: string, storyTitle: string) => void;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getPhaseTitle(phase: ExportPhase, t: any): string {
  switch (phase.kind) {
    case 'select':
      return t('impressions.export.modal.selectTitle', {
        defaultValue: 'Choisir une histoire',
      });
    case 'generating':
      return t('impressions.export.modal.generating.title', {
        defaultValue: 'Création du livre…',
      });
    case 'ready':
      return t('impressions.export.modal.ready.title', {
        defaultValue: 'Livre prêt',
      });
    case 'post-export':
      return t('impressions.export.modal.postExport.title', {
        defaultValue: 'Et ensuite ?',
      });
  }
}

function getStepLabel(
  step: 'assets' | 'render' | 'hash' | 'print',
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  t: any,
): string {
  const fallbacks: Record<typeof step, string> = {
    assets: 'Préparation des illustrations…',
    render: 'Mise en page du livre…',
    hash: 'Calcul de l\'empreinte…',
    print: 'Génération du PDF…',
  };
  return t(`impressions.export.modal.generating.step.${step}`, {
    defaultValue: fallbacks[step],
  });
}

function BookExportModalImpl({ visible, onClose, story, onSuccess }: Props) {
  const { vault, stories } = useVault();
  const { colors, primary } = useThemeColors();
  const { t } = useTranslation();
  const [phase, dispatch] = useReducer(exportPhaseReducer, INITIAL_PHASE);
  const [selectedStory, setSelectedStory] = useState<BedtimeStory | null>(
    story ?? null,
  );

  // Reset à chaque ouverture / synchro avec prop `story`.
  useEffect(() => {
    if (visible) {
      dispatch({ type: 'RESET' });
      setSelectedStory(story ?? null);
    }
  }, [visible, story]);

  // Cascade STEP_ADVANCE pendant la génération (RESEARCH §7 Approche A).
  useEffect(() => {
    if (phase.kind !== 'generating') return;
    let cancelled = false;
    let acc = 0;
    const timeouts: ReturnType<typeof setTimeout>[] = [];
    STEPS_DURATION.forEach((s) => {
      acc += s.ms;
      timeouts.push(
        setTimeout(() => {
          if (!cancelled) dispatch({ type: 'STEP_ADVANCE', step: s.key });
        }, acc),
      );
    });
    return () => {
      cancelled = true;
      timeouts.forEach(clearTimeout);
    };
  }, [phase.kind]);

  const handleGenerate = useCallback(async () => {
    if (!vault || !selectedStory) return;
    dispatch({ type: 'START_GENERATION' });
    try {
      const result = await generateBookPdf({
        story: selectedStory,
        allStories: stories,
      });
      const persisted = await persistBookPdf(vault, result.uri, result.entry);
      if (__DEV__) {
        // eslint-disable-next-line no-console
        console.log('[BookExportModal] perf', result.perf);
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      dispatch({
        type: 'GENERATION_DONE',
        uri: result.uri,
        perfMs: result.perf.totalMs,
        entry: persisted,
      });
    } catch (err) {
      if (__DEV__) {
        // eslint-disable-next-line no-console
        console.warn('[BookExportModal] generation error', err);
      }
      dispatch({ type: 'GENERATION_ERROR' });
      Alert.alert(
        t('impressions.errors.generationTitle', {
          defaultValue: 'Erreur de génération',
        }),
        t('impressions.errors.generationBody', {
          defaultValue:
            'Impossible de générer le livre. Réessaie dans un instant.',
        }),
      );
    }
  }, [vault, selectedStory, stories, t]);

  const handlePreview = useCallback(async () => {
    if (phase.kind !== 'ready') return;
    Haptics.selectionAsync();
    try {
      if (Platform.OS === 'ios') {
        await Print.printAsync({ uri: phase.uri });
      } else {
        await Linking.openURL(phase.uri);
      }
    } catch (err) {
      if (__DEV__) {
        // eslint-disable-next-line no-console
        console.warn('[BookExportModal] preview error', err);
      }
    }
  }, [phase]);

  const handleContinue = useCallback(() => {
    if (phase.kind !== 'ready' || !selectedStory) return;
    dispatch({
      type: 'GO_POST_EXPORT',
      uri: phase.uri,
      storyTitle: selectedStory.titre,
    });
    onSuccess(phase.uri, selectedStory.titre);
  }, [phase, selectedStory, onSuccess]);

  // Drag-to-dismiss bloqué pendant `generating` (RESEARCH Pitfall 7).
  const handleRequestClose = phase.kind === 'generating' ? () => {} : onClose;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleRequestClose}
    >
      <SafeAreaView
        edges={['top']}
        style={[styles.safe, { backgroundColor: colors.bg }]}
      >
        <ModalHeader
          title={getPhaseTitle(phase, t)}
          onClose={phase.kind === 'generating' ? undefined : onClose}
        />

        {/* Phase select : liste des histoires + bouton Générer */}
        {phase.kind === 'select' && (
          <View style={styles.flex}>
            <ScrollView
              contentContainerStyle={styles.scrollContent}
              keyboardShouldPersistTaps="handled"
            >
              {stories.length === 0 ? (
                <Text style={[styles.empty, { color: colors.textMuted }]}>
                  {t('impressions.export.modal.empty', {
                    defaultValue:
                      'Aucune histoire dans le vault. Génère une histoire d\'abord.',
                  })}
                </Text>
              ) : (
                stories.map((s) => {
                  const isSel = selectedStory?.id === s.id;
                  return (
                    <Pressable
                      key={s.id}
                      onPress={() => {
                        Haptics.selectionAsync();
                        setSelectedStory(s);
                      }}
                      style={[
                        styles.storyCard,
                        {
                          backgroundColor: colors.card,
                          borderColor: isSel ? primary : colors.border,
                          borderWidth: isSel ? 2 : 1,
                        },
                      ]}
                    >
                      <Text
                        style={[styles.storyTitle, { color: colors.text }]}
                        numberOfLines={2}
                      >
                        {s.titre}
                      </Text>
                    </Pressable>
                  );
                })
              )}
            </ScrollView>

            <View
              style={[styles.footer, { borderTopColor: colors.border }]}
            >
              <Pressable
                onPress={handleGenerate}
                disabled={!selectedStory || !vault}
                style={[
                  styles.cta,
                  {
                    backgroundColor:
                      selectedStory && vault ? primary : colors.border,
                  },
                ]}
              >
                <Text style={[styles.ctaText, { color: '#FFFFFF' }]}>
                  {t('impressions.export.modal.generateCta', {
                    defaultValue: 'Générer le livre',
                  })}
                </Text>
              </Pressable>
            </View>
          </View>
        )}

        {/* Phase generating : spinner + label étape */}
        {phase.kind === 'generating' && (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={primary} />
            <Text style={[styles.stepLabel, { color: colors.text }]}>
              {getStepLabel(phase.step, t)}
            </Text>
            <Text style={[styles.stepHint, { color: colors.textMuted }]}>
              {t('impressions.export.modal.generating.hint', {
                defaultValue: 'Création de ton livre…',
              })}
            </Text>
          </View>
        )}

        {/* Phase ready : récap + boutons aperçu / continuer */}
        {phase.kind === 'ready' && (
          <View style={styles.flex}>
            <ScrollView contentContainerStyle={styles.scrollContent}>
              <View
                style={[
                  styles.recap,
                  {
                    backgroundColor: colors.card,
                    borderColor: colors.border,
                  },
                ]}
              >
                <Text style={[styles.recapTitle, { color: colors.text }]}>
                  {selectedStory?.titre ?? ''}
                </Text>
                <View style={styles.recapRow}>
                  <Text
                    style={[styles.recapLabel, { color: colors.textMuted }]}
                  >
                    {t('impressions.export.modal.ready.format', {
                      defaultValue: 'Format',
                    })}
                  </Text>
                  <Text style={[styles.recapValue, { color: colors.text }]}>
                    {LULU_FORMAT_LABEL}
                  </Text>
                </View>
                <View style={styles.recapRow}>
                  <Text
                    style={[styles.recapLabel, { color: colors.textMuted }]}
                  >
                    {t('impressions.export.modal.ready.pages', {
                      defaultValue: 'Pages',
                    })}
                  </Text>
                  <Text style={[styles.recapValue, { color: colors.text }]}>
                    {PAGE_COUNT}
                  </Text>
                </View>
                {__DEV__ && (
                  <View style={styles.recapRow}>
                    <Text
                      style={[styles.recapLabel, { color: colors.textMuted }]}
                    >
                      {t('impressions.export.modal.ready.duration', {
                        defaultValue: 'Généré en',
                      })}
                    </Text>
                    <Text style={[styles.recapValue, { color: colors.text }]}>
                      {phase.perfMs} ms
                    </Text>
                  </View>
                )}
              </View>
            </ScrollView>

            <View
              style={[styles.footer, { borderTopColor: colors.border }]}
            >
              <Pressable
                onPress={handlePreview}
                style={[
                  styles.ctaSecondary,
                  { borderColor: primary, backgroundColor: colors.bg },
                ]}
              >
                <Text style={[styles.ctaSecondaryText, { color: primary }]}>
                  {t('impressions.export.modal.ready.preview', {
                    defaultValue: 'Aperçu du PDF',
                  })}
                </Text>
              </Pressable>
              <Pressable
                onPress={handleContinue}
                style={[styles.cta, { backgroundColor: primary }]}
              >
                <Text style={[styles.ctaText, { color: '#FFFFFF' }]}>
                  {t('impressions.export.modal.ready.continue', {
                    defaultValue: 'Continuer',
                  })}
                </Text>
              </Pressable>
            </View>
          </View>
        )}

        {/* Phase post-export : rendu UI ajouté par le Plan 51-03. */}
        {phase.kind === 'post-export' && null /* TODO 51-03 : rendu post-export ici */}
      </SafeAreaView>
    </Modal>
  );
}

export const BookExportModal = React.memo(BookExportModalImpl);

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing['2xl'],
    gap: Spacing.xl,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing['4xl'],
    gap: Spacing.xl,
  },
  empty: {
    fontSize: FontSize.body,
    textAlign: 'center',
    paddingVertical: Spacing['5xl'],
  },
  storyCard: {
    padding: Spacing['3xl'],
    borderRadius: Radius.md,
  },
  storyTitle: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.semibold,
  },
  footer: {
    padding: Spacing['2xl'],
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: Spacing.xl,
  },
  cta: {
    paddingVertical: Spacing['3xl'],
    borderRadius: Radius.md,
    alignItems: 'center',
  },
  ctaText: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.semibold,
  },
  ctaSecondary: {
    paddingVertical: Spacing['3xl'],
    borderRadius: Radius.md,
    alignItems: 'center',
    borderWidth: 1,
  },
  ctaSecondaryText: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.semibold,
  },
  stepLabel: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.semibold,
    textAlign: 'center',
    marginTop: Spacing['2xl'],
  },
  stepHint: {
    fontSize: FontSize.sm,
    textAlign: 'center',
  },
  recap: {
    padding: Spacing['3xl'],
    borderRadius: Radius.md,
    borderWidth: 1,
    gap: Spacing.xl,
  },
  recapTitle: {
    fontSize: FontSize.title,
    fontWeight: FontWeight.bold,
  },
  recapRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  recapLabel: {
    fontSize: FontSize.sm,
  },
  recapValue: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.semibold,
  },
});
