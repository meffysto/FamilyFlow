/**
 * app/lightning-wallet.tsx — Écran "Ma cagnotte" (UI-SPEC Surface 3).
 *
 * Plan 53-03b — route hors tabs, déclarée dans app/_layout.tsx.
 *
 * Contenu :
 *   - Header back + titre "Ma cagnotte"
 *   - BalanceCard hero (Plan 03a) avec balance + timestamp + bouton Encaisser
 *   - Section "Historique" avec liste des 10 dernières AuditLogItem filtrées
 *     sur activeProfile.id (T-53-03b-05 — isolation audit par profil)
 *   - Bouton "Effacer l'historique" (REQ-7, Alert.alert confirmation)
 *
 * Refresh balance (D-05 — event-driven, pas de polling) :
 *   - Au mount
 *   - Sur AppState 'active' (retour foreground)
 *   - Sur onPayoutSuccess (bus d'événements Plan 01) — refresh balance + audit
 *
 * Encaissement (REQ-9 + REQ-10) :
 *   - canCashOut = !!member?.adminKey
 *   - Tap Encaisser → CashOutModal (gated FaceID en interne)
 *   - onSuccess → refresh balance + reload audit
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  AppState,
  type AppStateStatus,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { ChevronLeft, Zap } from 'lucide-react-native';

import {
  clearAudit,
  loadAudit,
  loadFamilyConfig,
  LnbitsClient,
  onPayoutSuccess,
  type AuditEntry,
  type FamilyLightningConfig,
  type MemberWalletMapping,
} from '../lib/lightning';
import { useVault } from '../contexts/VaultContext';
import { useThemeColors } from '../contexts/ThemeContext';
import { BalanceCard } from '../components/lightning/BalanceCard';
import { AuditLogItem } from '../components/lightning/AuditLogItem';
import { CashOutModal } from '../components/lightning/CashOutModal';
import { Spacing, Radius } from '../constants/spacing';
import { FontSize, FontWeight, FontFamily } from '../constants/typography';

export default function LightningWalletScreen() {
  const router = useRouter();
  const { colors, primary } = useThemeColors();
  const { profiles, activeProfile, tasks } = useVault();

  const [config, setConfig] = useState<FamilyLightningConfig | null>(null);
  const [member, setMember] = useState<MemberWalletMapping | null>(null);
  const [balanceSats, setBalanceSats] = useState<number | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | undefined>(undefined);
  const [balanceError, setBalanceError] = useState<string | undefined>(undefined);
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [showCashOut, setShowCashOut] = useState(false);

  // Charge config + member à chaque changement de profil actif.
  useEffect(() => {
    let alive = true;
    loadFamilyConfig().then((cfg) => {
      if (!alive) return;
      setConfig(cfg);
      if (cfg && activeProfile) {
        const m = cfg.members.find((mm) => mm.profileId === activeProfile.id);
        setMember(m ?? null);
      } else {
        setMember(null);
      }
    });
    return () => {
      alive = false;
    };
  }, [activeProfile?.id]);

  const refreshBalance = useCallback(async () => {
    if (!config || !member) {
      setBalanceSats(null);
      return;
    }
    setBalanceError(undefined);
    try {
      const client = new LnbitsClient({
        baseUrl: config.baseUrl,
        invoiceKey: member.invoiceKey,
      });
      const info = await client.getWallet();
      setBalanceSats(info.balanceSats);
      setLastUpdatedAt(new Date());
    } catch (err) {
      if (__DEV__) console.warn('[lightning-wallet] balance refresh failed:', err);
      setBalanceError('Solde indisponible — vérifiez votre connexion.');
    }
  }, [config, member]);

  const reloadAudit = useCallback(async () => {
    if (!activeProfile) {
      setAudit([]);
      return;
    }
    const all = await loadAudit();
    // T-53-03b-05 — filtre sur profileId actif + 10 dernières entrées.
    const filtered = all
      .filter((e) => e.profileId === activeProfile.id)
      .slice(-10)
      .reverse(); // plus récent en haut
    setAudit(filtered);
  }, [activeProfile?.id]);

  // Mount + chaque changement config/member → refresh balance + audit.
  useEffect(() => {
    refreshBalance();
    reloadAudit();
  }, [refreshBalance, reloadAudit]);

  // D-05 — subscribe onPayoutSuccess pour refresh event-driven.
  useEffect(() => {
    const unsub = onPayoutSuccess(() => {
      refreshBalance();
      reloadAudit();
    });
    return unsub;
  }, [refreshBalance, reloadAudit]);

  // D-05 — AppState 'active' → refresh balance (retour foreground).
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state === 'active') {
        refreshBalance();
      }
    });
    return () => sub.remove();
  }, [refreshBalance]);

  const handleCashOut = useCallback(() => {
    setShowCashOut(true);
  }, []);

  const handleCloseCashOut = useCallback(() => {
    setShowCashOut(false);
  }, []);

  const handleCashOutSuccess = useCallback(() => {
    refreshBalance();
    reloadAudit();
  }, [refreshBalance, reloadAudit]);

  const handleClearHistory = useCallback(() => {
    Alert.alert(
      "Effacer l'historique ?",
      'Toutes les entrées seront supprimées définitivement.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Effacer',
          style: 'destructive',
          onPress: async () => {
            await clearAudit();
            setAudit([]);
          },
        },
      ],
    );
  }, []);

  // Pré-résolution titres tâches pour AuditLogItem.
  const resolveTaskTitle = useCallback(
    (taskId: string): string => {
      if (taskId === '(cash_out)') return 'Encaissement vers wallet externe';
      const t = tasks.find((tk) => tk.id === taskId);
      return t?.text ?? '—';
    },
    [tasks],
  );

  const resolveProfileName = useCallback(
    (profileId: string): string => {
      const p = profiles.find((pp) => pp.id === profileId);
      return p?.name ?? '—';
    },
    [profiles],
  );

  const canCashOut = !!member?.adminKey;

  return (
    <SafeAreaView edges={['top']} style={[styles.safe, { backgroundColor: colors.bg }]}>
      <Stack.Screen options={{ headerShown: false, title: 'Ma cagnotte' }} />

      {/* Header back + titre */}
      <View style={[styles.header, { borderBottomColor: colors.borderLight }]}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backBtn}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityLabel="Retour"
          accessibilityRole="button"
        >
          <ChevronLeft size={24} color={colors.text} strokeWidth={2} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.text }]}>Ma cagnotte</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero balance (BalanceCard Plan 03a) */}
        <BalanceCard
          balanceSats={balanceSats}
          lastUpdatedAt={lastUpdatedAt}
          canCashOut={canCashOut}
          onCashOut={handleCashOut}
          errorMessage={balanceError}
        />

        {/* Section Historique */}
        <View style={styles.section}>
          <Text
            style={[styles.sectionTitle, { color: colors.text }]}
            accessibilityRole="header"
          >
            Historique
          </Text>

          {audit.length === 0 ? (
            <View style={styles.emptyState}>
              <Zap size={40} color={colors.textFaint} strokeWidth={1.5} />
              <Text style={[styles.emptyTitle, { color: colors.textMuted }]}>
                Aucun paiement pour l'instant
              </Text>
              <Text style={[styles.emptyBody, { color: colors.textFaint }]}>
                Les pay-outs apparaîtront ici au fil des tâches.
              </Text>
            </View>
          ) : (
            <View style={styles.auditList}>
              {audit.map((entry, idx) => (
                <View key={`${entry.ts}-${idx}`}>
                  <AuditLogItem
                    entry={entry}
                    profileName={resolveProfileName(entry.profileId)}
                    taskTitle={resolveTaskTitle(entry.taskId)}
                  />
                  {idx < audit.length - 1 && (
                    <View
                      style={[
                        styles.separator,
                        { backgroundColor: colors.separator },
                      ]}
                    />
                  )}
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Bouton Effacer l'historique */}
        {audit.length > 0 && (
          <TouchableOpacity
            onPress={handleClearHistory}
            style={styles.clearBtn}
            accessibilityRole="button"
            accessibilityLabel="Effacer l'historique"
          >
            <Text style={[styles.clearLabel, { color: colors.error }]}>
              Effacer l'historique
            </Text>
          </TouchableOpacity>
        )}
      </ScrollView>

      {/* Modal Encaisser */}
      {member && config && (
        <CashOutModal
          visible={showCashOut}
          member={member}
          config={config}
          onClose={handleCloseCashOut}
          onSuccess={handleCashOutSuccess}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing['2xl'],
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.xl,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: {
    padding: Spacing.xs,
    marginLeft: -Spacing.xs,
    width: 32,
  },
  headerSpacer: {
    width: 32,
  },
  title: {
    fontSize: FontSize.title,
    fontWeight: FontWeight.semibold,
    flex: 1,
    textAlign: 'center',
  },
  scroll: {
    padding: Spacing['2xl'],
    paddingBottom: Spacing['5xl'],
    gap: Spacing['3xl'],
  },
  section: {
    gap: Spacing.xl,
  },
  sectionTitle: {
    fontFamily: FontFamily.serif,
    fontSize: FontSize.heading,
  },
  auditList: {
    gap: 0,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    marginVertical: Spacing.xs,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: Spacing['5xl'],
    gap: Spacing.md,
  },
  emptyTitle: {
    fontSize: FontSize.body,
  },
  emptyBody: {
    fontSize: FontSize.label,
    textAlign: 'center',
  },
  clearBtn: {
    alignSelf: 'center',
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing['2xl'],
    marginTop: Spacing['2xl'],
  },
  clearLabel: {
    fontSize: FontSize.label,
    fontWeight: FontWeight.semibold,
  },
});
