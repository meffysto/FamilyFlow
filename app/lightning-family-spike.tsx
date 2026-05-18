/**
 * lightning-family-spike.tsx — Playground du spike 004
 *
 * Modèle « wallet famille parent + sub-wallets enfants » sur LNbits BYO.
 *
 * Ce qui est validé ici :
 *   1. Stockage d'une config famille (URL + family invoice/admin + N children invoice).
 *   2. Lecture parallèle des balances famille + chaque enfant.
 *   3. Simulation « tâche complétée par X » → invoice 100 sats sur le wallet X
 *      → pay-out depuis le wallet famille (admin key gated FaceID) → balances rafraîchies.
 *   4. Mapping profileId → child wallet, alimenté depuis useVault().profiles.
 *
 * Hors scope spike : binding aux vraies tâches du vault, batching, encaissement
 * out vers wallet externe enfant. Itérations futures (cf. /gsd:plan-phase).
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import {
  ArrowLeft,
  Bitcoin,
  CheckCircle2,
  Plus,
  RefreshCw,
  ShieldCheck,
  Trash2,
  Users,
} from 'lucide-react-native';
import { useVault } from '../contexts/VaultContext';
import { useThemeColors } from '../contexts/ThemeContext';
import { Button } from '../components/ui/Button';
import { Spacing, Radius } from '../constants/spacing';
import { FontSize, FontWeight } from '../constants/typography';
import { Shadows } from '../constants/shadows';
import {
  authenticatePayOut,
  clearFamilyConfig,
  isLightningEnabled,
  LnbitsClient,
  LnbitsError,
  loadFamilyConfig,
  saveFamilyConfig,
  type ChildWalletMapping,
  type FamilyLightningConfig,
} from '../lib/lightning';

const TASK_REWARD_SATS = 100;

type ChildBalance = {
  loading: boolean;
  sats: number | null;
  error: string | null;
};

export default function LightningFamilySpikeScreen() {
  const router = useRouter();
  const { primary, colors } = useThemeColors();
  const { profiles } = useVault();

  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [config, setConfig] = useState<FamilyLightningConfig | null>(null);
  const [setupModalOpen, setSetupModalOpen] = useState(false);

  const [familyBalance, setFamilyBalance] = useState<number | null>(null);
  const [familyError, setFamilyError] = useState<string | null>(null);
  const [familyLoading, setFamilyLoading] = useState(false);
  const [childBalances, setChildBalances] = useState<Record<string, ChildBalance>>({});
  const [paying, setPaying] = useState<Record<string, boolean>>({});

  // Client famille — instancié avec l'invoice key (lecture). Admin key passée
  // explicitement à payInvoice() après auth biométrique.
  const familyClient = useMemo(() => {
    if (!config) return null;
    return new LnbitsClient({
      baseUrl: config.baseUrl,
      invoiceKey: config.family.invoiceKey,
    });
  }, [config]);

  // Charge config + flag
  useEffect(() => {
    (async () => {
      const [flag, cfg] = await Promise.all([
        isLightningEnabled(),
        loadFamilyConfig(),
      ]);
      setEnabled(flag);
      setConfig(cfg);
    })();
  }, []);

  const refreshFamilyBalance = useCallback(async () => {
    if (!familyClient) return;
    setFamilyLoading(true);
    setFamilyError(null);
    try {
      const w = await familyClient.getWallet();
      setFamilyBalance(w.balanceSats);
    } catch (err) {
      setFamilyError(err instanceof LnbitsError ? err.message : 'Erreur');
    } finally {
      setFamilyLoading(false);
    }
  }, [familyClient]);

  const refreshChildBalance = useCallback(async (child: ChildWalletMapping) => {
    if (!config) return;
    setChildBalances((prev) => ({
      ...prev,
      [child.profileId]: { loading: true, sats: prev[child.profileId]?.sats ?? null, error: null },
    }));
    try {
      const client = new LnbitsClient({
        baseUrl: config.baseUrl,
        invoiceKey: child.invoiceKey,
      });
      const w = await client.getWallet();
      setChildBalances((prev) => ({
        ...prev,
        [child.profileId]: { loading: false, sats: w.balanceSats, error: null },
      }));
    } catch (err) {
      setChildBalances((prev) => ({
        ...prev,
        [child.profileId]: {
          loading: false,
          sats: prev[child.profileId]?.sats ?? null,
          error: err instanceof LnbitsError ? err.message : 'Erreur',
        },
      }));
    }
  }, [config]);

  const refreshAll = useCallback(() => {
    refreshFamilyBalance();
    config?.children.forEach(refreshChildBalance);
  }, [config, refreshFamilyBalance, refreshChildBalance]);

  useEffect(() => {
    if (familyClient) refreshAll();
  }, [familyClient, refreshAll]);

  // Pay-out : task completed → 100 sats vers le sub-wallet de l'enfant
  const handleTaskComplete = useCallback(async (child: ChildWalletMapping) => {
    if (!config || !familyClient) return;
    if (paying[child.profileId]) return;

    // Gate biométrique
    const auth = await authenticatePayOut({
      reason: `Verser ${TASK_REWARD_SATS} sats à ${child.displayName} ?`,
    });
    if (!auth.success) {
      if (auth.error !== 'user_cancel') {
        Alert.alert('Authentification refusée', `Pay-out annulé (${auth.error ?? 'erreur'}).`);
      }
      return;
    }

    setPaying((p) => ({ ...p, [child.profileId]: true }));
    try {
      // 1) Créer invoice 100 sats sur le sub-wallet enfant
      const childClient = new LnbitsClient({
        baseUrl: config.baseUrl,
        invoiceKey: child.invoiceKey,
      });
      const invoice = await childClient.createInvoice(
        TASK_REWARD_SATS,
        `FamilyFlow — tâche complétée par ${child.displayName}`,
      );

      // 2) Payer cette invoice depuis le wallet famille (admin key)
      await familyClient.payInvoice(invoice.bolt11, config.family.adminKey);

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      // 3) Rafraîchir les 2 balances
      await Promise.all([
        refreshFamilyBalance(),
        refreshChildBalance(child),
      ]);
    } catch (err) {
      const msg = err instanceof LnbitsError ? err.message : 'Erreur inconnue';
      Alert.alert('Pay-out échoué', msg);
    } finally {
      setPaying((p) => ({ ...p, [child.profileId]: false }));
    }
  }, [config, familyClient, paying, refreshFamilyBalance, refreshChildBalance]);

  const handleClearAll = useCallback(() => {
    Alert.alert(
      'Effacer la config famille ?',
      'Supprime tous les wallets enregistrés (famille + enfants). Les wallets dans LNbits ne sont pas affectés.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Effacer',
          style: 'destructive',
          onPress: async () => {
            await clearFamilyConfig();
            setConfig(null);
            setFamilyBalance(null);
            setChildBalances({});
          },
        },
      ],
    );
  }, []);

  // ─── Empty states ───────────────────────────────────────────────────
  if (enabled === null) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]}>
        <ActivityIndicator color={primary} />
      </SafeAreaView>
    );
  }

  if (!enabled) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]}>
        <Header onBack={() => router.back()} title="Famille · Lightning" colors={colors} />
        <View style={[styles.emptyCard, Shadows.sm, { backgroundColor: colors.card, margin: Spacing['3xl'] }]}>
          <Text style={[styles.emptyTitle, { color: colors.text }]}>Lightning désactivé</Text>
          <Text style={[styles.emptyText, { color: colors.textSub }]}>
            Active d'abord Lightning dans Réglages → Labo → Lightning Wallet.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!config) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]}>
        <Header onBack={() => router.back()} title="Famille · Lightning" colors={colors} />
        <View style={[styles.emptyCard, Shadows.sm, { backgroundColor: colors.card, margin: Spacing['3xl'] }]}>
          <Users size={28} color={colors.textMuted} />
          <Text style={[styles.emptyTitle, { color: colors.text }]}>Aucune configuration famille</Text>
          <Text style={[styles.emptyText, { color: colors.textSub }]}>
            Crée plusieurs wallets dans ton instance LNbits (1 « Famille » + 1 par enfant),
            puis configure-les ici.
          </Text>
          <Button label="Configurer la famille" onPress={() => setSetupModalOpen(true)} variant="primary" />
        </View>
        <SetupModal
          visible={setupModalOpen}
          onClose={() => setSetupModalOpen(false)}
          profiles={profiles}
          existingConfig={null}
          onSave={async (cfg) => {
            await saveFamilyConfig(cfg);
            setConfig(cfg);
            setSetupModalOpen(false);
          }}
        />
      </SafeAreaView>
    );
  }

  // ─── Playground avec config OK ──────────────────────────────────────
  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]}>
      <Header
        onBack={() => router.back()}
        title="Famille · Lightning"
        colors={colors}
        rightAction={
          <TouchableOpacity onPress={refreshAll} hitSlop={12} accessibilityLabel="Rafraîchir tout">
            <RefreshCw size={20} color={colors.text} />
          </TouchableOpacity>
        }
      />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Wallet famille */}
        <View style={[styles.familyCard, Shadows.md, { backgroundColor: colors.card }]}>
          <View style={styles.row}>
            <Bitcoin size={20} color={primary} />
            <Text style={[styles.cardLabel, { color: colors.textSub }]}>Wallet famille</Text>
          </View>
          <Text style={[styles.familyName, { color: colors.text }]}>{config.family.name}</Text>
          {familyLoading && familyBalance === null ? (
            <ActivityIndicator color={primary} />
          ) : familyError ? (
            <Text style={[styles.errorText, { color: colors.error }]}>{familyError}</Text>
          ) : (
            <Text style={[styles.familyBalance, { color: colors.text }]}>
              {(familyBalance ?? 0).toLocaleString('fr-FR')} <Text style={[styles.unit, { color: colors.textSub }]}>sats</Text>
            </Text>
          )}
          <View style={styles.tip}>
            <ShieldCheck size={12} color={colors.textFaint} />
            <Text style={[styles.tipText, { color: colors.textFaint }]}>
              Admin key derrière FaceID — utilisée uniquement pour pay-out.
            </Text>
          </View>
        </View>

        {/* Sub-wallets enfants */}
        <Text style={[styles.sectionTitle, { color: colors.textSub }]}>
          Wallets enfants ({config.children.length})
        </Text>

        {config.children.length === 0 ? (
          <View style={[styles.emptyCard, Shadows.sm, { backgroundColor: colors.card }]}>
            <Text style={[styles.emptyText, { color: colors.textSub }]}>
              Aucun enfant configuré. Tape « Modifier la config » pour en ajouter.
            </Text>
          </View>
        ) : (
          config.children.map((child) => {
            const profile = profiles.find((p) => p.id === child.profileId);
            const bal = childBalances[child.profileId];
            const isPaying = paying[child.profileId];
            return (
              <View key={child.profileId} style={[styles.childCard, Shadows.sm, { backgroundColor: colors.card }]}>
                <View style={styles.rowBetween}>
                  <View style={styles.row}>
                    <Text style={styles.avatar}>{profile?.avatar ?? '👤'}</Text>
                    <View>
                      <Text style={[styles.childName, { color: colors.text }]}>{child.displayName}</Text>
                      <Text style={[styles.childSub, { color: colors.textFaint }]}>
                        {profile?.role === 'enfant' ? 'Enfant' : profile?.role === 'ado' ? 'Ado' : 'Profil'}
                      </Text>
                    </View>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    {bal?.loading && bal.sats === null ? (
                      <ActivityIndicator color={primary} size="small" />
                    ) : bal?.error ? (
                      <Text style={[styles.errorText, { color: colors.error, fontSize: FontSize.label }]}>{bal.error}</Text>
                    ) : (
                      <Text style={[styles.childBalance, { color: colors.text }]}>
                        {(bal?.sats ?? 0).toLocaleString('fr-FR')} <Text style={[styles.unitSmall, { color: colors.textSub }]}>sats</Text>
                      </Text>
                    )}
                  </View>
                </View>
                <Button
                  label={isPaying ? 'Pay-out...' : `Tâche complétée → +${TASK_REWARD_SATS} sats`}
                  onPress={() => handleTaskComplete(child)}
                  variant="primary"
                  size="md"
                  disabled={isPaying || !!familyError}
                  fullWidth
                />
              </View>
            );
          })
        )}

        <View style={styles.actionsRow}>
          <Button label="Modifier la config" onPress={() => setSetupModalOpen(true)} variant="secondary" size="sm" />
          <TouchableOpacity onPress={handleClearAll} accessibilityLabel="Effacer la config famille">
            <View style={styles.row}>
              <Trash2 size={14} color={colors.error} />
              <Text style={[styles.clearText, { color: colors.error }]}>Effacer</Text>
            </View>
          </TouchableOpacity>
        </View>

        <Text style={[styles.hint, { color: colors.textFaint }]}>
          ⚡️ Spike 004 — la liaison aux vraies tâches (auto-trigger sur completion) arrivera
          en phase planifiée. Pour l'instant : simulation manuelle.
        </Text>
      </ScrollView>

      <SetupModal
        visible={setupModalOpen}
        onClose={() => setSetupModalOpen(false)}
        profiles={profiles}
        existingConfig={config}
        onSave={async (cfg) => {
          await saveFamilyConfig(cfg);
          setConfig(cfg);
          setSetupModalOpen(false);
          refreshAll();
        }}
      />
    </SafeAreaView>
  );
}

// ─── Header partagé ─────────────────────────────────────────────────
interface HeaderProps {
  onBack: () => void;
  title: string;
  colors: { text: string };
  rightAction?: React.ReactNode;
}
function Header({ onBack, title, colors, rightAction }: HeaderProps) {
  return (
    <View style={styles.header}>
      <TouchableOpacity onPress={onBack} accessibilityLabel="Retour" hitSlop={12}>
        <ArrowLeft size={22} color={colors.text} />
      </TouchableOpacity>
      <Text style={[styles.headerTitle, { color: colors.text }]}>{title}</Text>
      <View style={{ minWidth: 22 }}>{rightAction ?? null}</View>
    </View>
  );
}

// ─── Modal de setup ─────────────────────────────────────────────────
interface SetupModalProps {
  visible: boolean;
  onClose: () => void;
  profiles: { id: string; name: string; avatar: string; role: string }[];
  existingConfig: FamilyLightningConfig | null;
  onSave: (cfg: FamilyLightningConfig) => Promise<void>;
}
function SetupModal({ visible, onClose, profiles, existingConfig, onSave }: SetupModalProps) {
  const { primary, colors } = useThemeColors();

  const [baseUrl, setBaseUrl] = useState('');
  const [familyName, setFamilyName] = useState('Famille');
  const [familyInvoice, setFamilyInvoice] = useState('');
  const [familyAdmin, setFamilyAdmin] = useState('');
  const [children, setChildren] = useState<ChildWalletMapping[]>([]);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);

  // Init depuis existant
  useEffect(() => {
    if (!visible) return;
    if (existingConfig) {
      setBaseUrl(existingConfig.baseUrl);
      setFamilyName(existingConfig.family.name);
      setFamilyInvoice(existingConfig.family.invoiceKey);
      setFamilyAdmin(existingConfig.family.adminKey);
      setChildren(existingConfig.children);
    } else {
      setBaseUrl('https://demo.lnbits.com');
      setFamilyName('Famille');
      setFamilyInvoice('');
      setFamilyAdmin('');
      setChildren([]);
    }
    setTestResult(null);
  }, [visible, existingConfig]);

  const eligibleProfiles = useMemo(() => {
    const usedIds = new Set(children.map((c) => c.profileId));
    return profiles.filter((p) => !usedIds.has(p.id));
  }, [profiles, children]);

  const handleAddChild = useCallback((profileId: string, name: string, avatar: string, invoiceKey: string) => {
    setChildren((prev) => [
      ...prev,
      { profileId, displayName: `${avatar} ${name}`, invoiceKey },
    ]);
  }, []);

  const handleRemoveChild = useCallback((profileId: string) => {
    setChildren((prev) => prev.filter((c) => c.profileId !== profileId));
  }, []);

  const handleTest = useCallback(async () => {
    if (!baseUrl.trim() || !familyInvoice.trim()) {
      Alert.alert('Champs manquants', 'baseUrl et invoice key famille requis.');
      return;
    }
    setTesting(true);
    setTestResult(null);
    try {
      const client = new LnbitsClient({ baseUrl, invoiceKey: familyInvoice });
      const w = await client.getWallet();
      setTestResult(`OK — Wallet « ${w.name} » · ${w.balanceSats} sats`);
    } catch (err) {
      setTestResult(`❌ ${err instanceof LnbitsError ? err.message : 'Erreur'}`);
    } finally {
      setTesting(false);
    }
  }, [baseUrl, familyInvoice]);

  const handleSave = useCallback(async () => {
    if (!baseUrl.trim() || !familyInvoice.trim() || !familyAdmin.trim()) {
      Alert.alert('Famille incomplète', 'URL, invoice key ET admin key famille requis.');
      return;
    }
    await onSave({
      baseUrl,
      family: { name: familyName, invoiceKey: familyInvoice, adminKey: familyAdmin },
      children,
    });
  }, [baseUrl, familyName, familyInvoice, familyAdmin, children, onSave]);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} hitSlop={12}>
            <Text style={[styles.closeText, { color: primary }]}>Annuler</Text>
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Configurer la famille</Text>
          <TouchableOpacity onPress={handleSave} hitSlop={12}>
            <Text style={[styles.closeText, { color: primary, fontWeight: FontWeight.bold }]}>Sauver</Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          {/* Famille */}
          <Text style={[styles.sectionTitle, { color: colors.textSub }]}>Wallet famille</Text>
          <View style={[styles.card, { backgroundColor: colors.card }]}>
            <Text style={[styles.inputLabel, { color: colors.textSub }]}>URL d'instance</Text>
            <TextInput
              style={[styles.input, { borderColor: colors.inputBorder, color: colors.text }]}
              value={baseUrl}
              onChangeText={setBaseUrl}
              placeholder="https://demo.lnbits.com"
              placeholderTextColor={colors.textFaint}
              autoCapitalize="none"
              keyboardType="url"
            />

            <Text style={[styles.inputLabel, { color: colors.textSub }]}>Nom du wallet famille</Text>
            <TextInput
              style={[styles.input, { borderColor: colors.inputBorder, color: colors.text }]}
              value={familyName}
              onChangeText={setFamilyName}
              placeholder="Famille"
              placeholderTextColor={colors.textFaint}
            />

            <Text style={[styles.inputLabel, { color: colors.textSub }]}>Invoice / Read key (lecture)</Text>
            <TextInput
              style={[styles.input, { borderColor: colors.inputBorder, color: colors.text }]}
              value={familyInvoice}
              onChangeText={setFamilyInvoice}
              placeholder="abc..."
              placeholderTextColor={colors.textFaint}
              autoCapitalize="none"
              secureTextEntry
            />

            <Text style={[styles.inputLabel, { color: colors.textSub }]}>Admin key (pay-out — FaceID)</Text>
            <TextInput
              style={[styles.input, { borderColor: colors.inputBorder, color: colors.text }]}
              value={familyAdmin}
              onChangeText={setFamilyAdmin}
              placeholder="xyz..."
              placeholderTextColor={colors.textFaint}
              autoCapitalize="none"
              secureTextEntry
            />

            <View style={styles.btnRow}>
              <Button label={testing ? '...' : 'Tester la connexion'} onPress={handleTest} variant="secondary" size="sm" disabled={testing} />
            </View>
            {testResult && (
              <Text style={[styles.testResult, { color: testResult.startsWith('OK') ? colors.success : colors.error }]}>
                {testResult}
              </Text>
            )}
          </View>

          {/* Enfants */}
          <Text style={[styles.sectionTitle, { color: colors.textSub, marginTop: Spacing['3xl'] }]}>
            Wallets enfants ({children.length})
          </Text>

          {children.map((c) => {
            const profile = profiles.find((p) => p.id === c.profileId);
            return (
              <View key={c.profileId} style={[styles.childRow, { backgroundColor: colors.card }]}>
                <Text style={styles.avatar}>{profile?.avatar ?? '👤'}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.childName, { color: colors.text }]}>{profile?.name ?? c.displayName}</Text>
                  <Text style={[styles.childSub, { color: colors.textFaint }]}>
                    Key : {c.invoiceKey.slice(0, 10)}...
                  </Text>
                </View>
                <TouchableOpacity onPress={() => handleRemoveChild(c.profileId)} hitSlop={8}>
                  <Trash2 size={16} color={colors.error} />
                </TouchableOpacity>
              </View>
            );
          })}

          {eligibleProfiles.length > 0 && (
            <View style={[styles.card, { backgroundColor: colors.cardAlt }]}>
              <Text style={[styles.cardTitle, { color: colors.text }]}>Ajouter un enfant</Text>
              {eligibleProfiles.map((p) => (
                <AddChildRow
                  key={p.id}
                  profile={p}
                  onAdd={(key) => handleAddChild(p.id, p.name, p.avatar, key)}
                />
              ))}
            </View>
          )}

          {eligibleProfiles.length === 0 && profiles.length > 0 && (
            <Text style={[styles.hint, { color: colors.textFaint }]}>
              Tous les profils ont déjà un wallet. Effaces-en un pour le réassigner.
            </Text>
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

interface AddChildRowProps {
  profile: { id: string; name: string; avatar: string };
  onAdd: (invoiceKey: string) => void;
}
function AddChildRow({ profile, onAdd }: AddChildRowProps) {
  const { primary, colors } = useThemeColors();
  const [expanded, setExpanded] = useState(false);
  const [key, setKey] = useState('');

  const handleConfirm = () => {
    if (!key.trim()) return;
    onAdd(key.trim());
    setKey('');
    setExpanded(false);
  };

  if (!expanded) {
    return (
      <TouchableOpacity
        onPress={() => setExpanded(true)}
        style={[styles.addChildRow, { borderColor: colors.border }]}
      >
        <Text style={styles.avatar}>{profile.avatar}</Text>
        <Text style={[styles.childName, { color: colors.text, flex: 1 }]}>{profile.name}</Text>
        <Plus size={16} color={primary} />
      </TouchableOpacity>
    );
  }

  return (
    <View style={[styles.addChildRow, { borderColor: primary, flexDirection: 'column', alignItems: 'stretch', gap: Spacing.md }]}>
      <View style={styles.row}>
        <Text style={styles.avatar}>{profile.avatar}</Text>
        <Text style={[styles.childName, { color: colors.text, flex: 1 }]}>{profile.name}</Text>
        <TouchableOpacity onPress={() => { setExpanded(false); setKey(''); }} hitSlop={6}>
          <Text style={{ color: colors.textSub }}>Annuler</Text>
        </TouchableOpacity>
      </View>
      <TextInput
        style={[styles.input, { borderColor: colors.inputBorder, color: colors.text }]}
        value={key}
        onChangeText={setKey}
        placeholder="Invoice key du wallet de l'enfant"
        placeholderTextColor={colors.textFaint}
        autoCapitalize="none"
        secureTextEntry
      />
      <Button label="Ajouter ce wallet" onPress={handleConfirm} variant="primary" size="sm" disabled={!key.trim()} />
    </View>
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
  headerTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold },
  closeText: { fontSize: FontSize.body, fontWeight: FontWeight.semibold },
  scrollContent: { padding: Spacing['3xl'], gap: Spacing.xl },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  familyCard: { borderRadius: Radius.xl, padding: Spacing['3xl'], gap: Spacing.md, alignItems: 'flex-start' },
  cardLabel: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold },
  familyName: { fontSize: FontSize.lg, fontWeight: FontWeight.bold },
  familyBalance: { fontSize: 30, fontWeight: FontWeight.bold },
  unit: { fontSize: FontSize.body, fontWeight: FontWeight.semibold },
  unitSmall: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold },
  errorText: { fontSize: FontSize.sm },
  sectionTitle: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: Spacing.lg,
  },
  childCard: {
    borderRadius: Radius.xl,
    padding: Spacing['2xl'],
    gap: Spacing.md,
  },
  avatar: { fontSize: 24 },
  childName: { fontSize: FontSize.body, fontWeight: FontWeight.semibold },
  childSub: { fontSize: FontSize.label },
  childBalance: { fontSize: FontSize.lg, fontWeight: FontWeight.bold },
  emptyCard: {
    borderRadius: Radius.xl,
    padding: Spacing['3xl'],
    gap: Spacing.xl,
    alignItems: 'center',
  },
  emptyTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, textAlign: 'center' },
  emptyText: { fontSize: FontSize.sm, lineHeight: 20, textAlign: 'center' },
  tip: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: Spacing.md },
  tipText: { fontSize: FontSize.label },
  card: { borderRadius: Radius.xl, padding: Spacing['2xl'], gap: Spacing.md },
  cardTitle: { fontSize: FontSize.body, fontWeight: FontWeight.bold, marginBottom: Spacing.md },
  inputLabel: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, marginTop: Spacing.md },
  input: { borderWidth: 1.5, borderRadius: Radius.base, padding: Spacing.xl, fontSize: FontSize.body },
  btnRow: { flexDirection: 'row', gap: Spacing.md, marginTop: Spacing.md },
  testResult: { fontSize: FontSize.sm, marginTop: Spacing.md },
  childRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.lg,
    borderRadius: Radius.md,
    marginBottom: Spacing.md,
  },
  addChildRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.lg,
    borderRadius: Radius.md,
    borderWidth: 1,
    marginTop: Spacing.md,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: Spacing.xl,
  },
  clearText: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold },
  hint: { fontSize: FontSize.label, textAlign: 'center', marginTop: Spacing['2xl'], lineHeight: 16 },
});
