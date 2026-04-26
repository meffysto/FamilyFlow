/**
 * DashboardCompanion.tsx — Bulle compagnon inline sur le dashboard (D-06).
 *
 * Affiche un message proactif du compagnon en haut du dashboard.
 * Seuls morning_greeting et weekly_recap sont déclenchés ici (D-05).
 * gentle_nudge et comeback restent sur tree.tsx.
 *
 * Phase 24 — COMPANION-01, COMPANION-02.
 */

import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import * as SecureStore from 'expo-secure-store';
import { useVault } from '../../contexts/VaultContext';
import { useThemeColors } from '../../contexts/ThemeContext';
import { useAI } from '../../contexts/AIContext';
import { callCompanionMessage } from '../../lib/ai-service';
import { CompanionAvatarMini } from '../mascot/CompanionAvatarMini';
import {
  detectProactiveEvent,
  pickCompanionMessage,
  generateCompanionAIMessage,
} from '../../lib/mascot/companion-engine';
import { calculateLevel } from '../../lib/gamification';
import {
  loadCompanionMessages,
  saveCompanionMessages,
  type PersistedCompanionMessage,
} from '../../lib/mascot/companion-storage';
import { loadWeekStats } from '../../lib/semantic/coupling-overrides';
import { SectionErrorBoundary } from '../SectionErrorBoundary';
import type { DashboardSectionProps } from './types';
import type { CompanionEvent } from '../../lib/mascot/companion-types';
import { Spacing, Radius } from '../../constants/spacing';
import { FontSize, FontFamily } from '../../constants/typography';
import { GlassView } from '../ui/GlassView';

// ─── Clé SecureStore (partagée avec tree.tsx) ──────────────────────────────

const LAST_VISIT_KEY = 'companion_last_visit';

// ─── Composant interne ────────────────────────────────────────────────────────

function DashboardCompanionInner(_props: DashboardSectionProps) {
  const { colors } = useThemeColors();
  const { activeProfile, tasks } = useVault();
  const { config: aiConfig } = useAI();

  // Construire aiCall de même façon que tree.tsx (sans anonymisation — dashboard sans données perso sensibles)
  const aiCall = React.useMemo(() => {
    if (!aiConfig?.apiKey) return null;
    return async (prompt: string): Promise<string> => {
      return callCompanionMessage(aiConfig, prompt);
    };
  }, [aiConfig]);

  const [message, setMessage] = useState<string | null>(null);
  const [eventType, setEventType] = useState<CompanionEvent | null>(null);

  useEffect(() => {
    const companion = activeProfile?.companion;
    if (!companion || !activeProfile?.id) return;

    let cancelled = false;

    (async () => {
      try {
        // Lire la dernière visite pour détecter première visite du jour
        const today = new Date().toISOString().slice(0, 10);
        const stored = await SecureStore.getItemAsync(LAST_VISIT_KEY);
        const isFirstVisitToday = stored !== today;

        // Calculer hoursSinceLastVisit depuis lastEventAt du compagnon
        let hoursSinceLastVisit = 0;
        if (companion.lastEventAt) {
          const lastMs = new Date(companion.lastEventAt).getTime();
          const nowMs = Date.now();
          hoursSinceLastVisit = (nowMs - lastMs) / (1000 * 60 * 60);
        }

        const currentHour = new Date().getHours();
        const isWeeklyRecapWindow = new Date().getDay() === 0 && currentHour >= 18 && currentHour < 21;

        // Tâches du jour
        const tasksToday = tasks.filter(
          t => t.dueDate === today && t.completed,
        ).length;
        const totalTasksToday = tasks.filter(t => t.dueDate === today).length;

        const proactiveEvent = detectProactiveEvent({
          hoursSinceLastVisit,
          currentHour,
          tasksToday,
          totalTasksToday,
          streak: activeProfile.streak ?? 0,
          hasGratitudeToday: false,
          hasMealsPlanned: false,
          isFirstVisitToday,
          isWeeklyRecapWindow,
        });

        // D-05 : seuls morning_greeting et weekly_recap sont affichés sur le dashboard
        if (
          proactiveEvent !== 'morning_greeting' &&
          proactiveEvent !== 'weekly_recap'
        ) {
          return;
        }

        if (cancelled) return;
        setEventType(proactiveEvent);

        const level = calculateLevel(activeProfile.points ?? 0);

        // Charger les messages récents pour l'anti-répétition IA
        const recentMessages: PersistedCompanionMessage[] =
          await loadCompanionMessages(activeProfile.id);

        // Construire le contexte de message
        const msgContext: import('../../lib/mascot/companion-types').CompanionMessageContext = {
          profileName: activeProfile.name,
          companionName: companion.name,
          companionSpecies: companion.activeSpecies,
          tasksToday,
          streak: activeProfile.streak ?? 0,
          level,
          recentMessages: recentMessages.map(m => m.text),
        };

        // Pour weekly_recap : charger les stats de la semaine
        if (proactiveEvent === 'weekly_recap') {
          const weekStats = await loadWeekStats();
          const totalEffects = Object.values(weekStats.counts).reduce((s, n) => s + n, 0);
          const topCategories = Object.entries(weekStats.counts)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 3)
            .map(([cat]) => cat);
          // Injecter dans recentTasks pour que le prompt IA voie les stats
          msgContext.recentTasks = [
            `Effets sémantiques semaine: ${totalEffects}`,
            ...topCategories.map(c => `Top catégorie: ${c}`),
          ];
        }

        // Afficher le template immédiatement (fallback)
        const templateKey = pickCompanionMessage(proactiveEvent, msgContext);
        if (cancelled) return;
        setMessage(templateKey);

        // Tentative IA en async (remplace le fallback si réussi)
        if (aiCall) {
          generateCompanionAIMessage(proactiveEvent, msgContext, aiCall).then(aiMsg => {
            if (!cancelled && aiMsg) {
              setMessage(aiMsg);
              // Persister fire-and-forget
              const newMsg: PersistedCompanionMessage = {
                text: aiMsg,
                event: proactiveEvent,
                timestamp: new Date().toISOString(),
              };
              saveCompanionMessages(activeProfile.id, [...recentMessages, newMsg]);
            }
          });
        } else {
          // Persister le message template
          const newMsg: PersistedCompanionMessage = {
            text: templateKey,
            event: proactiveEvent,
            timestamp: new Date().toISOString(),
          };
          saveCompanionMessages(activeProfile.id, [...recentMessages, newMsg]);
        }
      } catch {
        // Non-critical — compagnon dashboard silencieux en cas d'erreur
      }
    })();

    return () => { cancelled = true; };
  // Se déclenche une seule fois par profil au mount (D-06)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeProfile?.id]);

  // Ne rien afficher si pas de compagnon ou pas de message proactif pertinent
  if (!activeProfile?.companion || !message || !eventType) return null;

  return (
    <View style={styles.container}>
      <CompanionAvatarMini
        companion={activeProfile.companion}
        level={activeProfile.level}
        fallbackEmoji=""
        size={40}
      />
      <Animated.View entering={FadeIn.duration(400)} style={styles.bubbleWrap}>
        <GlassView
          style={styles.bubble}
          intensity={25}
          borderRadius={Radius.lg}
          tint={colors.brand.parchment}
          tintOpacity={0.85}
        >
          <Text style={[styles.messageText, { color: colors.brand.soil }]}>
            {message}
          </Text>
        </GlassView>
      </Animated.View>
    </View>
  );
}

// ─── Export avec SectionErrorBoundary ────────────────────────────────────────

export function DashboardCompanion(props: DashboardSectionProps) {
  return (
    <SectionErrorBoundary name="DashboardCompanion">
      <DashboardCompanionInner {...props} />
    </SectionErrorBoundary>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing['2xl'],
    paddingHorizontal: Spacing['2xl'],
  },
  bubbleWrap: {
    flex: 1,
    marginLeft: Spacing.xl,
  },
  bubble: {
    paddingHorizontal: Spacing['2xl'],
    paddingVertical: Spacing.xl,
  },
  messageText: {
    fontFamily: FontFamily.handwrite,
    fontSize: FontSize.subtitle,
    lineHeight: FontSize.subtitle * 1.4,
  },
});
