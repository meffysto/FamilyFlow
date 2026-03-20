/**
 * night-mode.tsx — Mode nuit bébé
 *
 * Interface OLED ultra-sombre pour les tétées/biberons nocturnes.
 * Chrono count-up, sélection côté/volume, historique de la nuit.
 * Luminosité auto réduite à l'ouverture, restaurée à la fermeture.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { format } from 'date-fns';
import * as Brightness from 'expo-brightness';
import { useVault } from '../../contexts/VaultContext';
import {
  todayJournalPath,
  generateJournalTemplate,
  parseNightFeeds,
  insertAlimentationRow,
} from '../../lib/parser';
import TimerRing from '../../components/TimerRing';
import { NightColors } from '../../constants/nightMode';
import { isBabyProfile } from '../../lib/types';
import type { FeedType, BreastSide, NightFeedEntry, Profile } from '../../lib/types';
import { FontSize, FontWeight } from '../../constants/typography';
import {
  startFeedingActivity,
  updateFeedingActivity,
  stopFeedingActivity,
  pauseWidgetFeeding,
  resumeWidgetFeeding,
  stopWidgetFeeding,
} from '../../modules/vault-access/src/index';

// ─── Constantes ──────────────────────────────────────────────────────────────

const VOLUME_OPTIONS = [90, 120, 150, 180, 210];
const MAX_TIMER_SECONDS = 30 * 60; // 30 min pour le ring progress

type NightState = 'idle' | 'timing' | 'paused';

// ─── Composant principal ─────────────────────────────────────────────────────

export default function NightModeScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ startLive?: string }>();
  const { profiles, vault } = useVault();

  // Bébés = profils bébé (ageCategory ou birthdate < 2 ans)
  const babies = useMemo(
    () => profiles.filter(isBabyProfile),
    [profiles],
  );

  const [selectedBaby, setSelectedBaby] = useState<Profile | null>(null);
  const [state, setState] = useState<NightState>('idle');
  const [feedType, setFeedType] = useState<FeedType | null>(null);
  const [side, setSide] = useState<BreastSide>('gauche');
  const [volumeMl, setVolumeMl] = useState(150);
  const [elapsed, setElapsed] = useState(0);
  const [feeds, setFeeds] = useState<NightFeedEntry[]>([]);
  const [savedMessage, setSavedMessage] = useState('');

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const pausedElapsedRef = useRef(0);
  const originalBrightnessRef = useRef<number | null>(null);

  // Auto-sélection si un seul bébé
  useEffect(() => {
    if (babies.length === 1 && !selectedBaby) {
      setSelectedBaby(babies[0]);
    }
  }, [babies, selectedBaby]);

  // Luminosité auto
  useEffect(() => {
    (async () => {
      try {
        const current = await Brightness.getBrightnessAsync();
        originalBrightnessRef.current = current;
        await Brightness.setBrightnessAsync(0.15);
      } catch {
        // Permissions non accordées — on continue sans
      }
    })();

    return () => {
      if (originalBrightnessRef.current !== null) {
        Brightness.setBrightnessAsync(originalBrightnessRef.current).catch(() => {});
      }
    };
  }, []);

  // Charger l'historique des tétées du jour
  const loadFeeds = useCallback(async () => {
    if (!vault || !selectedBaby) return;
    try {
      const path = todayJournalPath(selectedBaby.name);
      const content = await vault.readFile(path);
      const parsed = parseNightFeeds(content, selectedBaby.name, selectedBaby.id);
      setFeeds(parsed);
    } catch {
      setFeeds([]);
    }
  }, [vault, selectedBaby]);

  useEffect(() => { loadFeeds(); }, [loadFeeds]);

  // Timer — shared tick logic
  const startTick = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    startTimeRef.current = Date.now();
    timerRef.current = setInterval(() => {
      if (startTimeRef.current === null) return;
      const diff = Math.floor((Date.now() - startTimeRef.current) / 1000) + pausedElapsedRef.current;
      setElapsed(diff);
    }, 1000);
  }, []);

  const startTimer = useCallback(() => {
    pausedElapsedRef.current = 0;
    setElapsed(0);
    setState('timing');
    startTick();

    // Lancer le Live Activity (Dynamic Island + Lock Screen)
    if (selectedBaby && feedType) {
      const sideLabel = feedType === 'allaitement' ? (side === 'gauche' ? 'G' : 'D') : null;
      const vol = feedType === 'biberon' ? volumeMl : null;
      startFeedingActivity(
        selectedBaby.name,
        selectedBaby.avatar || '👶',
        feedType,
        sideLabel,
        vol,
      ).catch(() => {}); // Silencieux si pas supporté
    }
  }, [startTick, selectedBaby, feedType, side, volumeMl]);

  // Si on arrive via le widget (startLive=1), lancer le Live Activity
  useEffect(() => {
    if (params.startLive !== '1') return;
    if (babies.length === 0) return;
    // Déjà en cours → ne pas relancer
    if (state === 'timing') return;

    const baby = selectedBaby || babies[0];
    if (!baby) return;

    setSelectedBaby(baby);
    setFeedType('allaitement');
    setState('timing');
    pausedElapsedRef.current = 0;
    setElapsed(0);
    startTick();

    startFeedingActivity(baby.name, baby.avatar || '👶', 'allaitement', 'G', null).catch(() => {});

    // Nettoyer le param pour permettre un prochain lancement
    router.setParams({ startLive: undefined });
  }, [params.startLive, babies]);

  const pauseTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    // Compute elapsed from refs (avoids dep on elapsed state)
    if (startTimeRef.current !== null) {
      pausedElapsedRef.current += Math.floor((Date.now() - startTimeRef.current) / 1000);
    }
    startTimeRef.current = null;
    setElapsed(pausedElapsedRef.current);
    setState('paused');

    // Mettre à jour le Live Activity
    const sideLabel = feedType === 'allaitement' ? (side === 'gauche' ? 'G' : 'D') : null;
    const vol = feedType === 'biberon' ? volumeMl : null;
    updateFeedingActivity(true, sideLabel, vol).catch(() => {});
    pauseWidgetFeeding().catch(() => {});
  }, [feedType, side, volumeMl]);

  const resumeTimer = useCallback(() => {
    setState('timing');
    startTick();

    // Reprendre le Live Activity
    const sideLabel = feedType === 'allaitement' ? (side === 'gauche' ? 'G' : 'D') : null;
    const vol = feedType === 'biberon' ? volumeMl : null;
    updateFeedingActivity(false, sideLabel, vol).catch(() => {});
    resumeWidgetFeeding().catch(() => {});
  }, [startTick, feedType, side, volumeMl]);

  // Cleanup timer au unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // Auto-dismiss saved message
  useEffect(() => {
    if (!savedMessage) return;
    const t = setTimeout(() => setSavedMessage(''), 2500);
    return () => clearTimeout(t);
  }, [savedMessage]);

  // Sauvegarder l'entrée dans le journal
  const saveEntry = useCallback(async () => {
    if (!vault || !selectedBaby || !feedType) return;

    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;

    // Arrêter le Live Activity + le timer du widget
    stopFeedingActivity().catch(() => {});
    stopWidgetFeeding().catch(() => {});

    const startedAt = format(new Date(Date.now() - elapsed * 1000), 'HH:mm');
    const durationMin = Math.max(1, Math.round(elapsed / 60));
    const type: 'Tétée' | 'Biberon' = feedType === 'allaitement' ? 'Tétée' : 'Biberon';
    const detail = feedType === 'allaitement'
      ? `${side === 'gauche' ? 'Gauche' : 'Droite'} — ${durationMin} min`
      : `${volumeMl} ml — ${durationMin} min`;

    try {
      const path = todayJournalPath(selectedBaby.name);
      let content: string;
      try {
        content = await vault.readFile(path);
      } catch {
        content = generateJournalTemplate(selectedBaby.name, { propre: selectedBaby.propre });
      }

      const updated = insertAlimentationRow(content, startedAt, type, detail);
      await vault.writeFile(path, updated);

      setSavedMessage('Enregistré ✓');

      // Reset
      setState('idle');
      setFeedType(null);
      setElapsed(0);
      pausedElapsedRef.current = 0;
      startTimeRef.current = null;

      // Recharger l'historique
      await loadFeeds();
    } catch {
      setSavedMessage('Erreur de sauvegarde');
    }
  }, [vault, selectedBaby, feedType, side, volumeMl, elapsed, loadFeeds]);

  const handleClose = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    stopFeedingActivity().catch(() => {});
    stopWidgetFeeding().catch(() => {});
    router.back();
  }, [router]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // ─── Pas de bébé ───────────────────────────────────────────────────────────
  if (babies.length === 0) {
    return (
      <SafeAreaView style={s.safe}>
        <StatusBar hidden />
        <View style={s.center}>
          <Text style={s.emptyText}>Aucun profil bébé configuré</Text>
          <TouchableOpacity style={s.closeBtn} onPress={handleClose} accessibilityLabel="Fermer le mode nuit" accessibilityRole="button">
            <Text style={s.closeBtnText}>Fermer</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ─── Rendu principal ───────────────────────────────────────────────────────
  return (
    <SafeAreaView style={s.safe}>
      <StatusBar hidden />

      {/* Header */}
      <View style={s.header}>
        {/* Sélecteur bébé si plusieurs */}
        {babies.length > 1 ? (
          <View style={s.babyPicker}>
            {babies.map((b) => (
              <TouchableOpacity
                key={b.id}
                style={[s.babyChip, selectedBaby?.id === b.id && s.babyChipActive]}
                onPress={() => setSelectedBaby(b)}
                accessibilityLabel={b.name}
                accessibilityRole="tab"
                accessibilityState={{ selected: selectedBaby?.id === b.id }}
              >
                <Text style={s.babyChipText}>{b.avatar} {b.name}</Text>
              </TouchableOpacity>
            ))}
          </View>
        ) : (
          <Text style={s.babyName}>{selectedBaby?.avatar} {selectedBaby?.name}</Text>
        )}

        <TouchableOpacity style={s.closeX} onPress={handleClose} accessibilityLabel="Fermer le mode nuit" accessibilityRole="button">
          <Text style={s.closeXText}>✕</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={s.scroll} contentContainerStyle={s.scrollContent}>
        {/* ─── État IDLE : sélection type ─── */}
        {state === 'idle' && (
          <View style={s.idleContainer}>
            {/* Chrono 00:00 */}
            <Text style={s.idleTimer}>00:00</Text>

            {/* Boutons type */}
            <View style={s.typeRow}>
              <TouchableOpacity
                style={[s.typeBtn, feedType === 'allaitement' && s.typeBtnActive]}
                onPress={() => setFeedType('allaitement')}
                accessibilityLabel="Allaitement"
                accessibilityRole="tab"
                accessibilityState={{ selected: feedType === 'allaitement' }}
              >
                <Text style={s.typeBtnEmoji}>🤱</Text>
                <Text style={s.typeBtnLabel}>Allaitement</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[s.typeBtn, feedType === 'biberon' && s.typeBtnActive]}
                onPress={() => setFeedType('biberon')}
                accessibilityLabel="Biberon"
                accessibilityRole="tab"
                accessibilityState={{ selected: feedType === 'biberon' }}
              >
                <Text style={s.typeBtnEmoji}>🍼</Text>
                <Text style={s.typeBtnLabel}>Biberon</Text>
              </TouchableOpacity>
            </View>

            {/* Options contextuelles */}
            {feedType === 'allaitement' && (
              <View style={s.optionRow}>
                <TouchableOpacity
                  style={[s.sideBtn, side === 'gauche' && s.sideBtnActive]}
                  onPress={() => setSide('gauche')}
                  accessibilityLabel="Côté gauche"
                  accessibilityRole="tab"
                  accessibilityState={{ selected: side === 'gauche' }}
                >
                  <Text style={s.sideBtnText}>G</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[s.sideBtn, side === 'droite' && s.sideBtnActive]}
                  onPress={() => setSide('droite')}
                  accessibilityLabel="Côté droit"
                  accessibilityRole="tab"
                  accessibilityState={{ selected: side === 'droite' }}
                >
                  <Text style={s.sideBtnText}>D</Text>
                </TouchableOpacity>
              </View>
            )}

            {feedType === 'biberon' && (
              <View style={s.volumeRow}>
                {VOLUME_OPTIONS.map((ml) => (
                  <TouchableOpacity
                    key={ml}
                    style={[s.volumeChip, volumeMl === ml && s.volumeChipActive]}
                    onPress={() => setVolumeMl(ml)}
                    accessibilityLabel={`${ml} millilitres`}
                    accessibilityRole="tab"
                    accessibilityState={{ selected: volumeMl === ml }}
                  >
                    <Text style={[s.volumeChipText, volumeMl === ml && s.volumeChipTextActive]}>
                      {ml}
                    </Text>
                  </TouchableOpacity>
                ))}
                <Text style={s.volumeUnit}>ml</Text>
              </View>
            )}

            {/* Bouton démarrer */}
            {feedType && (
              <TouchableOpacity style={s.startBtn} onPress={startTimer} accessibilityLabel="Démarrer le chronomètre" accessibilityRole="button">
                <Text style={s.startBtnText}>▶ Démarrer</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* ─── État TIMING / PAUSED : chrono actif ─── */}
        {(state === 'timing' || state === 'paused') && (
          <View style={s.timingContainer}>
            <TimerRing
              progress={Math.min(elapsed / MAX_TIMER_SECONDS, 1)}
              remaining={9999}
              size={200}
              colorNormal={NightColors.accentBright}
              colorWarning={NightColors.accentBright}
              colorDanger={NightColors.accentBright}
              trackColor={NightColors.border}
              bgColor={NightColors.bg}
            >
              <Text style={s.timerText}>{formatTime(elapsed)}</Text>
            </TimerRing>

            <Text style={s.timerLabel}>
              {feedType === 'allaitement'
                ? `Allaitement · ${side === 'gauche' ? 'Gauche' : 'Droite'}`
                : `Biberon · ${volumeMl} ml`}
            </Text>

            <View style={s.actionRow}>
              {state === 'timing' ? (
                <TouchableOpacity style={s.actionBtn} onPress={pauseTimer} accessibilityLabel="Mettre en pause" accessibilityRole="button">
                  <Text style={s.actionBtnText}>⏸ Pause</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity style={s.actionBtn} onPress={resumeTimer} accessibilityLabel="Reprendre le chronomètre" accessibilityRole="button">
                  <Text style={s.actionBtnText}>▶ Reprendre</Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity style={[s.actionBtn, s.stopBtn]} onPress={saveEntry} accessibilityLabel="Terminer et enregistrer" accessibilityRole="button">
                <Text style={s.actionBtnText}>⏹ Terminer</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Message de sauvegarde */}
        {savedMessage !== '' && (
          <Text style={s.savedMsg}>{savedMessage}</Text>
        )}

        {/* ─── Historique des tétées de la nuit ─── */}
        {feeds.length > 0 && (
          <View style={s.historySection}>
            <Text style={s.historyTitle}>Tétées de cette nuit</Text>
            {feeds.map((f, i) => (
              <View key={f.id + '-' + i} style={s.historyRow}>
                <Text style={s.historyTime}>{f.startedAt}</Text>
                <Text style={s.historyEmoji}>{f.type === 'allaitement' ? '🤱' : '🍼'}</Text>
                <Text style={s.historyDetail}>
                  {f.type === 'allaitement'
                    ? `${f.side === 'gauche' ? 'G' : f.side === 'droite' ? 'D' : '?'}`
                    : `${f.volumeMl ?? '?'} ml`}
                </Text>
                <Text style={s.historyDuration}>
                  {Math.round(f.durationSeconds / 60)} min
                </Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: NightColors.bg,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  emptyText: {
    color: NightColors.text,
    fontSize: FontSize.heading,
    textAlign: 'center',
    marginBottom: 24,
  },
  closeBtn: {
    backgroundColor: NightColors.buttonBg,
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 12,
  },
  closeBtnText: {
    color: NightColors.text,
    fontSize: FontSize.lg,
    fontWeight: FontWeight.semibold,
  },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  babyName: {
    color: NightColors.text,
    fontSize: FontSize.title,
    fontWeight: FontWeight.bold,
  },
  babyPicker: {
    flexDirection: 'row',
    gap: 8,
  },
  babyChip: {
    backgroundColor: NightColors.buttonBg,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: NightColors.border,
  },
  babyChipActive: {
    borderColor: NightColors.accentBright,
    backgroundColor: NightColors.accent + '40',
  },
  babyChipText: {
    color: NightColors.text,
    fontSize: FontSize.body,
    fontWeight: FontWeight.semibold,
  },
  closeX: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: NightColors.buttonBg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeXText: {
    color: NightColors.textSub,
    fontSize: FontSize.title,
    fontWeight: FontWeight.semibold,
  },

  // Scroll
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 90,
    alignItems: 'center',
  },

  // IDLE
  idleContainer: {
    alignItems: 'center',
    paddingTop: 40,
    gap: 28,
  },
  idleTimer: {
    color: NightColors.timer,
    fontSize: 56,
    fontWeight: FontWeight.normal,
    fontVariant: ['tabular-nums'],
  },
  typeRow: {
    flexDirection: 'row',
    gap: 16,
  },
  typeBtn: {
    backgroundColor: NightColors.buttonBg,
    borderRadius: 16,
    paddingVertical: 20,
    paddingHorizontal: 28,
    alignItems: 'center',
    minWidth: 140,
    borderWidth: 2,
    borderColor: NightColors.border,
  },
  typeBtnActive: {
    borderColor: NightColors.accentBright,
    backgroundColor: NightColors.accent + '30',
  },
  typeBtnEmoji: {
    fontSize: 36,
    marginBottom: 8,
  },
  typeBtnLabel: {
    color: NightColors.text,
    fontSize: FontSize.body,
    fontWeight: FontWeight.semibold,
  },
  optionRow: {
    flexDirection: 'row',
    gap: 16,
  },
  sideBtn: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: NightColors.buttonBg,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: NightColors.border,
  },
  sideBtnActive: {
    borderColor: NightColors.accentBright,
    backgroundColor: NightColors.accent + '40',
  },
  sideBtnText: {
    color: NightColors.text,
    fontSize: FontSize.titleLg,
    fontWeight: FontWeight.bold,
  },
  volumeRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  volumeChip: {
    backgroundColor: NightColors.buttonBg,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: NightColors.border,
  },
  volumeChipActive: {
    borderColor: NightColors.accentBright,
    backgroundColor: NightColors.accent + '40',
  },
  volumeChipText: {
    color: NightColors.textSub,
    fontSize: FontSize.lg,
    fontWeight: FontWeight.semibold,
  },
  volumeChipTextActive: {
    color: NightColors.timer,
  },
  volumeUnit: {
    color: NightColors.textSub,
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
    marginLeft: 4,
  },
  startBtn: {
    backgroundColor: NightColors.accent,
    paddingHorizontal: 48,
    paddingVertical: 18,
    borderRadius: 16,
    marginTop: 8,
  },
  startBtnText: {
    color: NightColors.timer,
    fontSize: FontSize.title,
    fontWeight: FontWeight.bold,
  },

  // TIMING
  timingContainer: {
    alignItems: 'center',
    paddingTop: 40,
    gap: 24,
  },
  timerText: {
    color: NightColors.timer,
    fontSize: 42,
    fontWeight: FontWeight.normal,
    fontVariant: ['tabular-nums'],
  },
  timerLabel: {
    color: NightColors.textSub,
    fontSize: FontSize.lg,
    fontWeight: FontWeight.medium,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 8,
  },
  actionBtn: {
    backgroundColor: NightColors.buttonBg,
    paddingHorizontal: 32,
    paddingVertical: 18,
    borderRadius: 16,
    minWidth: 140,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: NightColors.border,
  },
  stopBtn: {
    borderColor: NightColors.accent,
  },
  actionBtnText: {
    color: NightColors.text,
    fontSize: FontSize.heading,
    fontWeight: FontWeight.bold,
  },

  // Saved message
  savedMsg: {
    color: NightColors.success,
    fontSize: FontSize.lg,
    fontWeight: FontWeight.semibold,
    marginTop: 16,
    textAlign: 'center',
  },

  // History
  historySection: {
    width: '100%',
    marginTop: 40,
    borderTopWidth: 1,
    borderTopColor: NightColors.border,
    paddingTop: 20,
  },
  historyTitle: {
    color: NightColors.textSub,
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
    textAlign: 'center',
  },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 8,
    gap: 12,
    backgroundColor: NightColors.card,
    borderRadius: 10,
    marginBottom: 6,
  },
  historyTime: {
    color: NightColors.timer,
    fontSize: FontSize.lg,
    fontWeight: FontWeight.semibold,
    fontVariant: ['tabular-nums'],
    width: 50,
  },
  historyEmoji: {
    fontSize: FontSize.heading,
  },
  historyDetail: {
    color: NightColors.text,
    fontSize: FontSize.body,
    fontWeight: FontWeight.medium,
    flex: 1,
  },
  historyDuration: {
    color: NightColors.textSub,
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
  },
});
