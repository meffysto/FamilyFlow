/**
 * SettingsLightning — Configuration du wallet Lightning (LNbits BYO, family-only)
 *
 * Phase 53 Plan 04 — Final shape :
 *   - Toggle « Activer Lightning » (par défaut OFF, gate sur `familyConfig !== null`)
 *   - TriggerModeSelector (3 modes — REQ-3)
 *   - Input dailyCapPerMember (clamp 100-10000 — REQ-4)
 *   - Entrée conditionnelle "Pay-outs en attente (N)" → PayoutQueueModal (D-06)
 *   - Wizard inline (baseUrl + family wallet + map members) — la config family
 *     n'a plus besoin d'un playground externe, tout se fait depuis cet écran.
 *
 * Garanties :
 *   - Aucun appel réseau LN si l'interrupteur est OFF (SPEC Constraint #1).
 *   - Creds vivent en SecureStore via `lightning_family_config_v1`,
 *     JAMAIS dans le vault Markdown.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Clock, Lightbulb, Settings as SettingsIcon, Zap } from 'lucide-react-native';
import { useThemeColors } from '../../contexts/ThemeContext';
import { useVault } from '../../contexts/VaultContext';
import { SectionHeader } from '../ui/SectionHeader';
import { AvatarIcon } from '../ui/AvatarIcon';
import { getTheme } from '../../constants/themes';
import { Spacing, Radius } from '../../constants/spacing';
import { FontSize, FontWeight } from '../../constants/typography';
import { Shadows } from '../../constants/shadows';
import {
  DEFAULT_HYBRID_THRESHOLD_SATS,
  HYBRID_THRESHOLD_MIN_SATS,
  LnbitsClient,
  isLightningEnabled,
  loadFamilyConfig,
  loadQueue,
  saveFamilyConfig,
  setLightningEnabled,
  type FamilyLightningConfig,
  type MemberWalletMapping,
} from '../../lib/lightning';
import { TriggerModeSelector, type TriggerMode } from '../lightning/TriggerModeSelector';
import { PayoutQueueModal } from '../lightning/PayoutQueueModal';

const DAILY_CAP_MIN = 100;
const DAILY_CAP_MAX = 10000;
const DAILY_CAP_DEFAULT = 1000;

function clampDailyCap(value: number): number {
  if (!Number.isFinite(value)) return DAILY_CAP_DEFAULT;
  return Math.max(DAILY_CAP_MIN, Math.min(DAILY_CAP_MAX, Math.floor(value)));
}

function clampHybridThreshold(value: number, dailyCap: number): number {
  if (!Number.isFinite(value)) return DEFAULT_HYBRID_THRESHOLD_SATS;
  return Math.max(HYBRID_THRESHOLD_MIN_SATS, Math.min(dailyCap, Math.floor(value)));
}

type MemberFormEntry = { invoiceKey: string; adminKey: string };

function makeEmptyMemberForm(): Record<string, MemberFormEntry> {
  return {};
}

export function SettingsLightning() {
  const { primary, colors } = useThemeColors();
  const { profiles, tasks } = useVault();

  const [enabled, setEnabled] = useState(false);

  // Phase 53 — TriggerMode + dailyCap + queue entry
  const [familyConfig, setFamilyConfig] = useState<FamilyLightningConfig | null>(null);
  const [triggerMode, setTriggerMode] = useState<TriggerMode>('instant');
  const [dailyCapInput, setDailyCapInput] = useState<string>(String(DAILY_CAP_DEFAULT));
  const [hybridThresholdInput, setHybridThresholdInput] = useState<string>(
    String(DEFAULT_HYBRID_THRESHOLD_SATS),
  );
  const [pendingCount, setPendingCount] = useState(0);
  const [showQueueModal, setShowQueueModal] = useState(false);

  // Wizard inline — saisie config family LNbits
  const [editing, setEditing] = useState(false);
  const [formBaseUrl, setFormBaseUrl] = useState('');
  const [formFamilyName, setFormFamilyName] = useState('Famille');
  const [formFamilyInvoiceKey, setFormFamilyInvoiceKey] = useState('');
  const [formFamilyAdminKey, setFormFamilyAdminKey] = useState('');
  const [formMembers, setFormMembers] = useState<Record<string, MemberFormEntry>>(
    makeEmptyMemberForm(),
  );
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);

  // Membres éligibles : tous les profils famille (enfant, ado, adulte)
  const eligibleProfiles = useMemo(
    () => profiles.filter((p) => p.role === 'enfant' || p.role === 'ado' || p.role === 'adulte'),
    [profiles],
  );

  const refreshQueueCount = useCallback(async () => {
    try {
      const queue = await loadQueue();
      setPendingCount(queue.filter((i) => i.reason === 'review').length);
    } catch {
      setPendingCount(0);
    }
  }, []);

  useEffect(() => {
    (async () => {
      const [flag, family] = await Promise.all([
        isLightningEnabled(),
        loadFamilyConfig(),
      ]);
      setEnabled(flag);
      if (family) {
        setFamilyConfig(family);
        setTriggerMode(family.triggerMode);
        setDailyCapInput(String(family.dailyCapPerMember));
        setHybridThresholdInput(String(family.hybridThresholdSats));
      }
      await refreshQueueCount();
    })();
  }, [refreshQueueCount]);

  const handleToggle = useCallback(async (value: boolean) => {
    if (value && familyConfig === null) {
      Alert.alert(
        'Configurer d\'abord',
        'Aucune configuration family Lightning détectée. Tape « Configurer maintenant » pour saisir ton instance LNbits et tes wallets famille.',
      );
      return;
    }
    setEnabled(value);
    await setLightningEnabled(value);
  }, [familyConfig]);

  // Wizard — ouvre le formulaire (pré-rempli avec config existante si présente)
  const handleStartEdit = useCallback(() => {
    if (familyConfig) {
      setFormBaseUrl(familyConfig.baseUrl);
      setFormFamilyName(familyConfig.family.name);
      setFormFamilyInvoiceKey(familyConfig.family.invoiceKey);
      setFormFamilyAdminKey(familyConfig.family.adminKey);
      const map: Record<string, MemberFormEntry> = {};
      for (const m of familyConfig.members) {
        map[m.profileId] = { invoiceKey: m.invoiceKey, adminKey: m.adminKey ?? '' };
      }
      setFormMembers(map);
    } else {
      setFormBaseUrl('');
      setFormFamilyName('Famille');
      setFormFamilyInvoiceKey('');
      setFormFamilyAdminKey('');
      setFormMembers(makeEmptyMemberForm());
    }
    setEditing(true);
  }, [familyConfig]);

  const handleCancelEdit = useCallback(() => {
    setEditing(false);
  }, []);

  const handleUpdateMember = useCallback(
    (profileId: string, patch: Partial<MemberFormEntry>) => {
      setFormMembers((prev) => ({
        ...prev,
        [profileId]: {
          invoiceKey: patch.invoiceKey ?? prev[profileId]?.invoiceKey ?? '',
          adminKey: patch.adminKey ?? prev[profileId]?.adminKey ?? '',
        },
      }));
    },
    [],
  );

  const handleTestConnection = useCallback(async () => {
    const baseUrl = formBaseUrl.trim();
    const invoiceKey = formFamilyInvoiceKey.trim();
    if (!baseUrl || !invoiceKey) {
      Alert.alert('Champs requis', 'Renseigne au moins l\'URL LNbits et la clé invoice family.');
      return;
    }
    setTesting(true);
    try {
      const client = new LnbitsClient({ baseUrl, invoiceKey });
      const info = await client.getWallet();
      Alert.alert(
        'Connexion OK',
        `Wallet : ${info.name}\nSolde : ${info.balanceSats} sats`,
      );
    } catch (err) {
      const reason = err instanceof Error ? err.message : 'Erreur inconnue';
      Alert.alert('Connexion échouée', reason);
    } finally {
      setTesting(false);
    }
  }, [formBaseUrl, formFamilyInvoiceKey]);

  const handleSaveConfig = useCallback(async () => {
    const baseUrl = formBaseUrl.trim();
    const familyName = formFamilyName.trim() || 'Famille';
    const familyInvoiceKey = formFamilyInvoiceKey.trim();
    const familyAdminKey = formFamilyAdminKey.trim();
    if (!baseUrl) {
      Alert.alert('URL LNbits requise', 'Saisis l\'URL de ton instance LNbits.');
      return;
    }
    if (!familyInvoiceKey || !familyAdminKey) {
      Alert.alert(
        'Clés family requises',
        'Saisis la clé invoice ET la clé admin du wallet family (les deux sont disponibles dans la page wallet LNbits).',
      );
      return;
    }
    const members: MemberWalletMapping[] = eligibleProfiles
      .map((p) => {
        const entry = formMembers[p.id];
        const invoice = entry?.invoiceKey.trim() ?? '';
        const admin = entry?.adminKey.trim() ?? '';
        if (!invoice) return null;
        return {
          profileId: p.id,
          displayName: p.name,
          invoiceKey: invoice,
          ...(admin ? { adminKey: admin } : {}),
        } satisfies MemberWalletMapping;
      })
      .filter((m): m is MemberWalletMapping => m !== null);

    if (members.length === 0) {
      Alert.alert(
        'Au moins un membre',
        'Configure la clé invoice d\'au moins un membre famille pour recevoir des sats.',
      );
      return;
    }

    setSaving(true);
    try {
      const nextDailyCap = familyConfig?.dailyCapPerMember ?? DAILY_CAP_DEFAULT;
      const config: FamilyLightningConfig = {
        baseUrl,
        family: { name: familyName, invoiceKey: familyInvoiceKey, adminKey: familyAdminKey },
        members,
        triggerMode: familyConfig?.triggerMode ?? 'instant',
        dailyCapPerMember: nextDailyCap,
        hybridThresholdSats: clampHybridThreshold(
          familyConfig?.hybridThresholdSats ?? DEFAULT_HYBRID_THRESHOLD_SATS,
          nextDailyCap,
        ),
      };
      await saveFamilyConfig(config);
      setFamilyConfig(config);
      setTriggerMode(config.triggerMode);
      setDailyCapInput(String(config.dailyCapPerMember));
      setEditing(false);
      Alert.alert('Config enregistrée', `${members.length} wallet${members.length > 1 ? 's' : ''} membre configuré${members.length > 1 ? 's' : ''}.`);
    } catch (err) {
      const reason = err instanceof Error ? err.message : 'Erreur inconnue';
      Alert.alert('Sauvegarde échouée', reason);
    } finally {
      setSaving(false);
    }
  }, [
    formBaseUrl,
    formFamilyName,
    formFamilyInvoiceKey,
    formFamilyAdminKey,
    formMembers,
    eligibleProfiles,
    familyConfig,
  ]);

  // Phase 53 — persist triggerMode (REQ-3).
  const handleChangeTriggerMode = useCallback(
    async (mode: TriggerMode) => {
      setTriggerMode(mode);
      if (!familyConfig) return;
      const updated: FamilyLightningConfig = { ...familyConfig, triggerMode: mode };
      await saveFamilyConfig(updated);
      setFamilyConfig(updated);
    },
    [familyConfig],
  );

  // Phase 53 — persist dailyCapPerMember (REQ-4).
  const handleSaveDailyCap = useCallback(async () => {
    if (!familyConfig) return;
    const num = parseInt(dailyCapInput, 10);
    const clamped = clampDailyCap(num);
    setDailyCapInput(String(clamped));
    // Si le nouveau plafond est < seuil hybrid actuel, on re-clamp aussi le seuil.
    const reclampedThreshold = clampHybridThreshold(
      familyConfig.hybridThresholdSats,
      clamped,
    );
    if (reclampedThreshold !== familyConfig.hybridThresholdSats) {
      setHybridThresholdInput(String(reclampedThreshold));
    }
    const updated: FamilyLightningConfig = {
      ...familyConfig,
      dailyCapPerMember: clamped,
      hybridThresholdSats: reclampedThreshold,
    };
    await saveFamilyConfig(updated);
    setFamilyConfig(updated);
  }, [familyConfig, dailyCapInput]);

  // Seuil hybrid configurable (post-Phase-53 fix — défaut 100 inutilisable).
  const handleSaveHybridThreshold = useCallback(async () => {
    if (!familyConfig) return;
    const num = parseInt(hybridThresholdInput, 10);
    const clamped = clampHybridThreshold(num, familyConfig.dailyCapPerMember);
    setHybridThresholdInput(String(clamped));
    const updated: FamilyLightningConfig = {
      ...familyConfig,
      hybridThresholdSats: clamped,
    };
    await saveFamilyConfig(updated);
    setFamilyConfig(updated);
  }, [familyConfig, hybridThresholdInput]);

  const handleOpenQueue = useCallback(() => {
    setShowQueueModal(true);
  }, []);

  const handleCloseQueue = useCallback(() => {
    setShowQueueModal(false);
    refreshQueueCount();
  }, [refreshQueueCount]);

  if (editing) {
    return (
      <View>
        <SectionHeader
          title="Configurer le wallet Lightning"
          icon={<SettingsIcon size={16} strokeWidth={1.75} color={primary} />}
          flush
        />

        {/* URL LNbits */}
        <View style={[styles.card, Shadows.sm, { backgroundColor: colors.card }]}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>Serveur LNbits</Text>
          <Text style={[styles.rowSub, { color: colors.textSub }]}>
            URL complète de ton instance (ex : https://demo.lnbits.com).
          </Text>
          <TextInput
            style={[
              styles.fieldInput,
              {
                borderColor: colors.inputBorder,
                color: colors.text,
                backgroundColor: colors.inputBg,
              },
            ]}
            value={formBaseUrl}
            onChangeText={setFormBaseUrl}
            placeholder="https://..."
            placeholderTextColor={colors.textFaint}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            accessibilityLabel="URL serveur LNbits"
          />
        </View>

        {/* Wallet famille */}
        <View
          style={[
            styles.card,
            Shadows.sm,
            { backgroundColor: colors.card, marginTop: Spacing.lg },
          ]}
        >
          <Text style={[styles.cardTitle, { color: colors.text }]}>Wallet famille</Text>
          <Text style={[styles.rowSub, { color: colors.textSub }]}>
            Le wallet qui paie. Sa clé admin déclenche les pay-outs vers les membres.
          </Text>
          <TextInput
            style={[
              styles.fieldInput,
              {
                borderColor: colors.inputBorder,
                color: colors.text,
                backgroundColor: colors.inputBg,
                marginTop: Spacing.md,
              },
            ]}
            value={formFamilyName}
            onChangeText={setFormFamilyName}
            placeholder="Nom du wallet (ex: Famille)"
            placeholderTextColor={colors.textFaint}
            autoCorrect={false}
            accessibilityLabel="Nom wallet famille"
          />
          <TextInput
            style={[
              styles.fieldInput,
              {
                borderColor: colors.inputBorder,
                color: colors.text,
                backgroundColor: colors.inputBg,
                marginTop: Spacing.md,
              },
            ]}
            value={formFamilyInvoiceKey}
            onChangeText={setFormFamilyInvoiceKey}
            placeholder="Clé invoice/read family"
            placeholderTextColor={colors.textFaint}
            autoCapitalize="none"
            autoCorrect={false}
            accessibilityLabel="Clé invoice family"
          />
          <TextInput
            style={[
              styles.fieldInput,
              {
                borderColor: colors.inputBorder,
                color: colors.text,
                backgroundColor: colors.inputBg,
                marginTop: Spacing.md,
              },
            ]}
            value={formFamilyAdminKey}
            onChangeText={setFormFamilyAdminKey}
            placeholder="Clé admin family"
            placeholderTextColor={colors.textFaint}
            autoCapitalize="none"
            autoCorrect={false}
            secureTextEntry
            accessibilityLabel="Clé admin family"
          />
          <TouchableOpacity
            style={[
              styles.testBtn,
              {
                borderColor: colors.border,
                backgroundColor: colors.cardAlt,
                opacity: testing ? 0.5 : 1,
              },
            ]}
            onPress={handleTestConnection}
            disabled={testing}
            accessibilityRole="button"
            accessibilityLabel="Tester la connexion LNbits"
          >
            <Text style={[styles.testBtnText, { color: colors.text }]}>
              {testing ? 'Test en cours…' : 'Tester la connexion'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Map members */}
        <View
          style={[
            styles.card,
            Shadows.sm,
            { backgroundColor: colors.card, marginTop: Spacing.lg },
          ]}
        >
          <Text style={[styles.cardTitle, { color: colors.text }]}>Wallets membres</Text>
          <Text style={[styles.rowSub, { color: colors.textSub }]}>
            Pour chaque membre, saisis la clé invoice de son sub-wallet LNbits. La clé admin est
            optionnelle — elle débloque l'encaissement vers un wallet externe.
          </Text>
          {eligibleProfiles.length === 0 ? (
            <Text style={[styles.rowSub, { color: colors.textSub, marginTop: Spacing.md }]}>
              Aucun profil famille détecté.
            </Text>
          ) : (
            eligibleProfiles.map((p) => {
              const entry = formMembers[p.id] ?? { invoiceKey: '', adminKey: '' };
              return (
                <View key={p.id} style={{ marginTop: Spacing.md, gap: Spacing.xs }}>
                  <View style={styles.memberLabelRow}>
                    <AvatarIcon name={p.avatar} color={getTheme(p.theme).primary} size={24} />
                    <Text style={[styles.memberLabel, { color: colors.text }]}>
                      {p.name}
                    </Text>
                  </View>
                  <TextInput
                    style={[
                      styles.fieldInput,
                      {
                        borderColor: colors.inputBorder,
                        color: colors.text,
                        backgroundColor: colors.inputBg,
                      },
                    ]}
                    value={entry.invoiceKey}
                    onChangeText={(v) => handleUpdateMember(p.id, { invoiceKey: v })}
                    placeholder="Clé invoice"
                    placeholderTextColor={colors.textFaint}
                    autoCapitalize="none"
                    autoCorrect={false}
                    accessibilityLabel={`Clé invoice de ${p.name}`}
                  />
                  <TextInput
                    style={[
                      styles.fieldInput,
                      {
                        borderColor: colors.inputBorder,
                        color: colors.text,
                        backgroundColor: colors.inputBg,
                      },
                    ]}
                    value={entry.adminKey}
                    onChangeText={(v) => handleUpdateMember(p.id, { adminKey: v })}
                    placeholder="Clé admin (optionnel)"
                    placeholderTextColor={colors.textFaint}
                    autoCapitalize="none"
                    autoCorrect={false}
                    secureTextEntry
                    accessibilityLabel={`Clé admin optionnelle de ${p.name}`}
                  />
                </View>
              );
            })
          )}
        </View>

        {/* Actions */}
        <View style={styles.actionRow}>
          <TouchableOpacity
            style={[
              styles.actionBtn,
              { borderColor: colors.border, backgroundColor: colors.cardAlt },
            ]}
            onPress={handleCancelEdit}
            accessibilityRole="button"
            accessibilityLabel="Annuler la configuration"
          >
            <Text style={[styles.actionBtnText, { color: colors.text }]}>Annuler</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.actionBtn,
              {
                backgroundColor: primary,
                borderColor: primary,
                opacity: saving ? 0.5 : 1,
              },
            ]}
            onPress={handleSaveConfig}
            disabled={saving}
            accessibilityRole="button"
            accessibilityLabel="Enregistrer la configuration"
          >
            <Text style={[styles.actionBtnText, { color: colors.onPrimary ?? '#fff' }]}>
              {saving ? 'Enregistrement…' : 'Enregistrer'}
            </Text>
          </TouchableOpacity>
        </View>

        <View
          style={[
            styles.tip,
            {
              backgroundColor: colors.cardAlt,
              borderColor: colors.border,
              marginTop: Spacing.xl,
            },
          ]}
        >
          <Lightbulb size={14} strokeWidth={1.75} color={colors.textSub} style={{ marginTop: 2 }} />
          <Text style={[styles.tipText, { color: colors.textSub, flex: 1 }]}>
            <Text style={styles.bold}>Stockage local sécurisé.</Text> Les clés vivent dans
            SecureStore iOS, jamais dans le vault Markdown. Personne hors de ton iPhone ne les voit.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View>
      <SectionHeader
        title="Lightning Wallet (BYO)"
        icon={<Zap size={16} strokeWidth={1.75} color={primary} />}
        flush
      />

      {/* Statut + toggle */}
      <View style={[styles.card, Shadows.sm, { backgroundColor: colors.card }]}>
        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.rowLabel, { color: colors.text }]}>Activer Lightning</Text>
            <Text style={[styles.rowSub, { color: colors.textSub }]}>
              {familyConfig !== null
                ? enabled
                  ? 'Actif — appels réseau autorisés vers ton instance LNbits family.'
                  : 'Family config présente mais désactivée — aucun appel réseau.'
                : 'Aucune config family détectée. Tape « Configurer maintenant » pour saisir ton instance LNbits.'}
            </Text>
          </View>
          <Switch
            value={enabled}
            onValueChange={handleToggle}
            trackColor={{ false: colors.border, true: primary }}
            accessibilityLabel="Activer Lightning"
          />
        </View>
      </View>

      {/* Bouton Configurer / Modifier */}
      <TouchableOpacity
        style={[
          styles.card,
          Shadows.sm,
          { backgroundColor: colors.card, marginTop: Spacing.md },
        ]}
        onPress={handleStartEdit}
        accessibilityRole="button"
        accessibilityLabel={familyConfig ? 'Modifier la configuration' : 'Configurer le wallet'}
      >
        <View style={styles.row}>
          <SettingsIcon size={18} strokeWidth={1.75} color={primary} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.cardTitle, { color: colors.text }]}>
              {familyConfig ? 'Modifier la configuration' : 'Configurer maintenant'}
            </Text>
            <Text style={[styles.rowSub, { color: colors.textSub }]}>
              {familyConfig
                ? `${familyConfig.members.length} wallet${familyConfig.members.length > 1 ? 's' : ''} membre · ${familyConfig.baseUrl}`
                : 'URL LNbits + wallet famille + sub-wallets membres'}
            </Text>
          </View>
        </View>
      </TouchableOpacity>

      {/* Phase 53 — Mode de déclenchement (REQ-3, UI-SPEC Surface 6) */}
      {familyConfig && (
        <>
          <View style={{ marginTop: Spacing['2xl'] }}>
            <SectionHeader
              title="Déclenchement des pay-outs"
              icon={<Clock size={16} strokeWidth={1.75} color={primary} />}
              flush
            />
            <TriggerModeSelector
              value={triggerMode}
              onChange={handleChangeTriggerMode}
              hybridThresholdSats={familyConfig.hybridThresholdSats}
            />
          </View>

          {/* Phase 53 — Plafond quotidien par membre (REQ-4) */}
          <View
            style={[
              styles.card,
              Shadows.sm,
              { backgroundColor: colors.card, marginTop: Spacing.xl },
            ]}
          >
            <Text style={[styles.cardTitle, { color: colors.text }]}>
              Plafond quotidien (sats)
            </Text>
            <Text style={[styles.rowSub, { color: colors.textSub }]}>
              Par défaut 1000. Plage : 100–10 000.
            </Text>
            <View style={styles.dailyCapRow}>
              <TextInput
                style={[
                  styles.dailyCapInput,
                  {
                    borderColor: colors.inputBorder,
                    color: colors.text,
                    backgroundColor: colors.inputBg,
                  },
                ]}
                value={dailyCapInput}
                onChangeText={setDailyCapInput}
                onBlur={handleSaveDailyCap}
                keyboardType="number-pad"
                placeholder={String(DAILY_CAP_DEFAULT)}
                placeholderTextColor={colors.textFaint}
                accessibilityLabel="Plafond quotidien en sats"
                returnKeyType="done"
                onSubmitEditing={handleSaveDailyCap}
              />
            </View>
          </View>

          {/* Seuil hybrid configurable — visible uniquement en mode hybrid */}
          {triggerMode === 'hybrid' && (
            <View
              style={[
                styles.card,
                Shadows.sm,
                { backgroundColor: colors.card, marginTop: Spacing.md },
              ]}
            >
              <Text style={[styles.cardTitle, { color: colors.text }]}>
                Seuil hybrid (sats)
              </Text>
              <Text style={[styles.rowSub, { color: colors.textSub }]}>
                Au-delà de ce cumul journalier, les pay-outs basculent en queue.
                Plage : {HYBRID_THRESHOLD_MIN_SATS}–{familyConfig.dailyCapPerMember}.
                Défaut {DEFAULT_HYBRID_THRESHOLD_SATS}.
              </Text>
              <View style={styles.dailyCapRow}>
                <TextInput
                  style={[
                    styles.dailyCapInput,
                    {
                      borderColor: colors.inputBorder,
                      color: colors.text,
                      backgroundColor: colors.inputBg,
                    },
                  ]}
                  value={hybridThresholdInput}
                  onChangeText={setHybridThresholdInput}
                  onBlur={handleSaveHybridThreshold}
                  keyboardType="number-pad"
                  placeholder={String(DEFAULT_HYBRID_THRESHOLD_SATS)}
                  placeholderTextColor={colors.textFaint}
                  accessibilityLabel="Seuil hybrid en sats"
                  returnKeyType="done"
                  onSubmitEditing={handleSaveHybridThreshold}
                />
              </View>
            </View>
          )}

          {/* Phase 53 — Entrée Pay-outs en attente (D-06) — conditionnelle */}
          {pendingCount > 0 && (
            <TouchableOpacity
              style={[
                styles.card,
                Shadows.sm,
                { backgroundColor: colors.card, marginTop: Spacing.md },
              ]}
              onPress={handleOpenQueue}
              accessibilityRole="button"
              accessibilityLabel={`Pay-outs en attente, ${pendingCount} paiement${pendingCount > 1 ? 's' : ''} à valider`}
            >
              <View style={styles.rowBetween}>
                <View style={styles.row}>
                  <Clock size={18} strokeWidth={1.75} color={primary} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.cardTitle, { color: colors.text }]}>
                      Pay-outs en attente
                    </Text>
                    <Text style={[styles.rowSub, { color: colors.textSub }]}>
                      {`${pendingCount} pay-out${pendingCount > 1 ? 's' : ''} à valider · ${pendingCount * 100} sats`}
                    </Text>
                  </View>
                </View>
              </View>
            </TouchableOpacity>
          )}
        </>
      )}

      <View
        style={[
          styles.tip,
          {
            backgroundColor: colors.cardAlt,
            borderColor: colors.border,
            marginTop: Spacing.xl,
          },
        ]}
      >
        <Lightbulb size={14} strokeWidth={1.75} color={colors.textSub} style={{ marginTop: 2 }} />
        <Text style={[styles.tipText, { color: colors.textSub, flex: 1 }]}>
          <Text style={styles.bold}>Labo.</Text> Feature expérimentale, désactivée par défaut.
          Ton instance LNbits = ta garde de tes sats. FamilyFlow n'héberge rien et ne voit
          aucune clé privée.
        </Text>
      </View>

      {/* Modal PayoutQueueModal — Plan 03b */}
      <PayoutQueueModal
        visible={showQueueModal}
        profiles={profiles}
        tasks={tasks}
        onClose={handleCloseQueue}
        onBatchComplete={refreshQueueCount}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: Radius.xl, padding: Spacing['2xl'], gap: Spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.lg },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.lg },
  rowLabel: { fontSize: FontSize.body, fontWeight: FontWeight.semibold },
  rowSub: { fontSize: FontSize.sm, lineHeight: 20, marginTop: 2 },
  cardTitle: { fontSize: FontSize.body, fontWeight: FontWeight.bold },
  tip: {
    padding: Spacing.lg,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  tipText: { fontSize: FontSize.label, lineHeight: 18 },
  bold: { fontWeight: FontWeight.bold },
  dailyCapRow: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    marginTop: Spacing.md,
  },
  dailyCapInput: {
    width: 120,
    height: 40,
    borderWidth: 1.5,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.lg,
    fontSize: FontSize.body,
    textAlign: 'center',
  },
  fieldInput: {
    height: 44,
    borderWidth: 1.5,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.lg,
    fontSize: FontSize.body,
  },
  testBtn: {
    marginTop: Spacing.md,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: Radius.md,
    borderWidth: 1.5,
    alignItems: 'center',
  },
  testBtnText: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.semibold,
  },
  memberLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  memberLabel: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.semibold,
  },
  actionRow: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginTop: Spacing.xl,
  },
  actionBtn: {
    flex: 1,
    paddingVertical: Spacing.lg,
    borderRadius: Radius.md,
    borderWidth: 1.5,
    alignItems: 'center',
  },
  actionBtnText: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.bold,
  },
});
