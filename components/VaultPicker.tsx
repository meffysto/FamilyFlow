/**
 * VaultPicker.tsx — Vault folder selection UI
 *
 * iOS: folder picker (public.folder) → copie dans documentDirectory
 * Android: SAF folder picker
 * Desktop: manual text input + coffre quick-fill
 * Tous: sync depuis un ordinateur via serve-vault.py
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Alert,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as DocumentPicker from 'expo-document-picker';
import { VaultManager } from '../lib/vault';
import { useThemeColors } from '../contexts/ThemeContext';
import { SetupWizard, PersonInput, ChildInput } from './SetupWizard';
import { startAccessing } from '../modules/vault-access/src';
import { useTranslation } from 'react-i18next';
import { FontSize, FontWeight } from '../constants/typography';

interface VaultPickerProps {
  currentPath?: string | null;
  onPathSelected: (path: string) => void;
  onCancel?: () => void;
  /** Données famille pré-remplies (depuis l'onboarding) pour éviter de les redemander */
  initialParents?: PersonInput[];
  initialChildren?: ChildInput[];
}

export function VaultPicker({ currentPath, onPathSelected, onCancel, initialParents, initialChildren }: VaultPickerProps) {
  const { t } = useTranslation();
  const { primary, tint, colors } = useThemeColors();
  const [path, setPath] = useState(currentPath ?? '');
  const [isValidating, setIsValidating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [showWizard, setShowWizard] = useState(false);
  const [wizardTargetPath, setWizardTargetPath] = useState<string | undefined>();
  const [syncProgress, setSyncProgress] = useState('');
  const [serverIp, setServerIp] = useState('');
  const COFFRE_DEFAULT = '/Users/USER/Documents/coffre';

  // --- Sync depuis un ordinateur (Python serve-vault.py) ---
  const syncFromServer = async () => {
    const ip = serverIp.trim();
    if (!ip) {
      setError(t('vaultPicker.alert.ipRequired'));
      return;
    }
    const SERVER_URL = `http://${ip}:8765`;
    setSyncProgress('Connexion...');
    setError(null);

    try {
      const manifestRes = await fetch(`${SERVER_URL}/manifest.json`);
      if (!manifestRes.ok) throw new Error('Serveur non trouvé. Lancez serve-vault.py sur l\'ordinateur.');
      const { files } = await manifestRes.json() as { files: string[] };

      const localVault = `${FileSystem.documentDirectory}coffre`;

      let downloaded = 0;
      for (const relPath of files) {
        // Sécurité : rejeter les chemins qui pourraient sortir du vault
        if (
          relPath.includes('..') ||
          relPath.startsWith('/') ||
          relPath.includes('\0')
        ) {
          console.warn(`Chemin ignoré (traversal détecté) : ${relPath}`);
          continue;
        }
        setSyncProgress(`${downloaded + 1}/${files.length} — ${relPath}`);

        const fileUrl = `${SERVER_URL}/file/${encodeURIComponent(relPath)}`;
        const localPath = `${localVault}/${relPath}`;

        const parentDir = localPath.substring(0, localPath.lastIndexOf('/'));
        const dirInfo = await FileSystem.getInfoAsync(parentDir);
        if (!dirInfo.exists) {
          await FileSystem.makeDirectoryAsync(parentDir, { intermediates: true });
        }

        await FileSystem.downloadAsync(fileUrl, localPath);
        downloaded++;
      }

      setSyncProgress(`${downloaded} fichiers synchronisés`);
      setPath(localVault);

      // Laisser le JS engine respirer avant le rechargement du vault
      await new Promise((r) => setTimeout(r, 1500));
      setSyncProgress('');
      onPathSelected(localVault);
    } catch (e: any) {
      setSyncProgress('');
      setError(t('vaultPicker.alert.syncFailed', { error: e.message }));
    }
  };

  // --- iOS: créer un vault dans iCloud Drive via folder picker + SetupWizard ---
  const createInICloud = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'public.folder',
        copyToCacheDirectory: false,
      });

      if (result.canceled || !result.assets?.[0]) return;

      const folderUri = result.assets[0].uri;

      const granted = await startAccessing(folderUri);
      if (!granted) {
        setError(t('vaultPicker.alert.accessDenied'));
        return;
      }

      setWizardTargetPath(folderUri);
      setShowWizard(true);
    } catch (e: any) {
      setError(t('vaultPicker.alert.selectionError', { error: e.message }));
    }
  };

  // --- iOS: picker de dossier (public.folder) — accès direct via security-scoped URL ---
  const pickFolder = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'public.folder',
        copyToCacheDirectory: false,
      });

      if (result.canceled || !result.assets?.[0]) return;

      const folderUri = result.assets[0].uri;

      // Activer l'accès security-scoped + sauvegarder le bookmark
      const granted = await startAccessing(folderUri);
      if (!granted) {
        setError(t('vaultPicker.alert.accessDenied'));
        return;
      }

      setPath(decodeURIComponent(folderUri));
      setError(null);
      onPathSelected(folderUri);
    } catch (e: any) {
      setError(t('vaultPicker.alert.selectionError', { error: e.message }));
    }
  };

  const validate = async (vaultPath: string) => {
    if (!vaultPath.trim()) {
      setError(t('vaultPicker.alert.pathEmpty'));
      return;
    }

    setIsValidating(true);
    setError(null);

    const trimmed = vaultPath.trim();
    const isValid = await VaultManager.validate(trimmed);

    if (!isValid) {
      setError(t('vaultPicker.alert.pathNotFound', { path: trimmed }));
      setIsValidating(false);
      return;
    }

    setIsValidating(false);
    onPathSelected(trimmed);
  };

  const useSAF = async () => {
    try {
      // @ts-ignore — SAF is available in legacy API on Android
      const SAF = (FileSystem as any).StorageAccessFramework;
      if (!SAF) {
        Alert.alert(t('vaultPicker.alert.unavailable'), t('vaultPicker.alert.unavailableMsg'));
        return;
      }
      const result = await SAF.requestDirectoryPermissionsAsync();
      if (!result.granted) return;

      // Prendre la permission persistante via le module natif
      await startAccessing(result.directoryUri);

      setPath(result.directoryUri);
      setError(null);
      onPathSelected(result.directoryUri);
    } catch (e) {
      Alert.alert(t('vaultPicker.alert.error'), t('vaultPicker.alert.errorOpenMsg', { error: String(e) }));
    }
  };

  // Show wizard instead of picker when creating a new vault
  if (showWizard) {
    return (
      <SetupWizard
        targetPath={wizardTargetPath}
        initialParents={initialParents}
        initialChildren={initialChildren}
        onComplete={(newPath) => {
          setShowWizard(false);
          setWizardTargetPath(undefined);
          onPathSelected(newPath);
        }}
        onCancel={() => {
          setShowWizard(false);
          setWizardTargetPath(undefined);
        }}
      />
    );
  }

  return (
    <View style={styles.container}>
      {/* Create new vault button (local) */}
      <TouchableOpacity
        style={[styles.createBtn, { backgroundColor: primary }]}
        onPress={() => { setWizardTargetPath(undefined); setShowWizard(true); }}
      >
        <Text style={styles.createBtnText}>Créer un nouveau dossier famille</Text>
        <Text style={styles.createBtnSub}>Tout est créé automatiquement sur votre appareil</Text>
      </TouchableOpacity>

      {/* Create in iCloud Drive (iOS only) */}
      {Platform.OS === 'ios' && (
        <TouchableOpacity
          style={[styles.icloudBtn, { backgroundColor: tint }]}
          onPress={createInICloud}
        >
          <Text style={[styles.icloudBtnText, { color: primary }]}>Créer dans iCloud Drive</Text>
          <Text style={[styles.icloudBtnSub, { color: colors.textMuted }]}>Sync automatique entre vos appareils Apple</Text>
        </TouchableOpacity>
      )}

      {/* Create in cloud folder (Android) */}
      {Platform.OS === 'android' && (
        <TouchableOpacity
          style={[styles.icloudBtn, { backgroundColor: tint }]}
          onPress={async () => {
            try {
              // @ts-ignore
              const SAF = (FileSystem as any).StorageAccessFramework;
              if (!SAF) return;
              const result = await SAF.requestDirectoryPermissionsAsync();
              if (!result.granted) return;
              await startAccessing(result.directoryUri);
              setWizardTargetPath(result.directoryUri);
              setShowWizard(true);
            } catch (e: any) {
              Alert.alert('Erreur', `${e.message}`);
            }
          }}
        >
          <Text style={[styles.icloudBtnText, { color: primary }]}>Créer dans Google Drive / Dropbox</Text>
          <Text style={[styles.icloudBtnSub, { color: colors.textMuted }]}>Choisissez un dossier cloud syncé localement</Text>
        </TouchableOpacity>
      )}

      <View style={styles.separator}>
        <View style={[styles.separatorLine, { backgroundColor: colors.separator }]} />
        <Text style={[styles.separatorText, { color: colors.textFaint }]}>ou utiliser un dossier existant</Text>
        <View style={[styles.separatorLine, { backgroundColor: colors.separator }]} />
      </View>

      {/* iOS: folder picker */}
      {Platform.OS === 'ios' && (
        <TouchableOpacity
          style={[styles.pickerBtn, { backgroundColor: colors.infoBg }]}
          onPress={pickFolder}
        >
          <Text style={[styles.pickerBtnText, { color: colors.info || '#1D4ED8' }]}>Choisir un dossier</Text>
          <Text style={[styles.pickerBtnSub, { color: colors.textMuted }]}>Depuis Fichiers, iCloud...</Text>
        </TouchableOpacity>
      )}

      {/* Android SAF picker */}
      {Platform.OS === 'android' && (
        <TouchableOpacity
          style={[styles.pickerBtn, { backgroundColor: colors.infoBg }]}
          onPress={useSAF}
        >
          <Text style={[styles.pickerBtnText, { color: colors.info || '#1D4ED8' }]}>Choisir un dossier</Text>
          <Text style={[styles.pickerBtnSub, { color: colors.textMuted }]}>Depuis le stockage, Google Drive, Dropbox...</Text>
        </TouchableOpacity>
      )}

      {/* Sync from any computer */}
      <View style={styles.syncSection}>
        <TextInput
          style={[styles.ipInput, { borderColor: colors.inputBorder, color: colors.text, backgroundColor: colors.inputBg }]}
          value={serverIp}
          onChangeText={(t) => { setServerIp(t); setError(null); }}
          placeholder="IP de l'ordinateur (ex: 192.168.1.42)"
          placeholderTextColor={colors.textFaint}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="numbers-and-punctuation"
          returnKeyType="go"
          onSubmitEditing={syncFromServer}
        />
        <TouchableOpacity
          style={[styles.syncBtn, { backgroundColor: tint }]}
          onPress={syncFromServer}
          disabled={!!syncProgress}
        >
          <Text style={[styles.syncBtnText, { color: primary }]}>Sync depuis un ordinateur</Text>
          <Text style={[styles.syncBtnSub, { color: colors.textMuted }]}>
            Lancez{' '}
            <Text style={{ fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', fontSize: FontSize.micro }}>
              python3 serve-vault.py
            </Text>
            {' '}sur le PC/Mac
          </Text>
        </TouchableOpacity>
      </View>

      {!!syncProgress && (
        <View style={[styles.progressBox, { backgroundColor: colors.bg }]}>
          <ActivityIndicator size="small" color={primary} />
          <Text style={[styles.progressText, { color: colors.textSub }]}>{syncProgress}</Text>
        </View>
      )}

      {error && <Text style={styles.errorText}>{error}</Text>}

      {/* Desktop: manual path input */}
      {Platform.OS !== 'ios' && Platform.OS !== 'android' && (
        <>
          <Text style={[styles.label, { color: colors.textSub }]}>Emplacement du dossier</Text>
          <TextInput
            style={[styles.input, { borderColor: colors.inputBorder, color: colors.text, backgroundColor: colors.inputBg }, error ? styles.inputError : null]}
            value={path}
            onChangeText={(t) => { setPath(t); setError(null); }}
            placeholder="/chemin/vers/mon-dossier"
            placeholderTextColor={colors.textFaint}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="done"
            onSubmitEditing={() => validate(path)}
            multiline
          />
          <TouchableOpacity
            style={[styles.quickFillBtn, { backgroundColor: tint }]}
            onPress={() => { setPath(COFFRE_DEFAULT); setError(null); }}
          >
            <Text style={[styles.quickFillText, { color: primary }]}>Utiliser le dossier par défaut</Text>
            <Text style={[styles.quickFillSub, { color: colors.textMuted }]}>{COFFRE_DEFAULT}</Text>
          </TouchableOpacity>
        </>
      )}

      <View style={styles.actions}>
        {onCancel && (
          <TouchableOpacity style={[styles.cancelBtn, { borderColor: colors.separator }]} onPress={onCancel}>
            <Text style={[styles.cancelText, { color: colors.textMuted }]}>Annuler</Text>
          </TouchableOpacity>
        )}

        {Platform.OS !== 'ios' && Platform.OS !== 'android' && (
          <TouchableOpacity
            style={[styles.confirmBtn, { backgroundColor: primary }, isValidating && styles.confirmBtnDisabled]}
            onPress={() => validate(path)}
            disabled={isValidating}
          >
            {isValidating ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Text style={styles.confirmText}>Confirmer</Text>
            )}
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 12,
  },
  createBtn: {
    borderRadius: 12,
    padding: 16,
    gap: 4,
    alignItems: 'center',
  },
  createBtnText: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    color: '#FFFFFF',
  },
  createBtnSub: {
    fontSize: FontSize.caption,
    color: 'rgba(255,255,255,0.8)',
  },
  icloudBtn: {
    borderRadius: 12,
    padding: 16,
    gap: 4,
    alignItems: 'center',
  },
  icloudBtnText: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
  },
  icloudBtnSub: {
    fontSize: FontSize.caption,
  },
  separator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginVertical: 4,
  },
  separatorLine: {
    flex: 1,
    height: 1,
  },
  separatorText: {
    fontSize: FontSize.caption,
  },
  label: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
  },
  input: {
    borderWidth: 1.5,
    borderRadius: 10,
    padding: 12,
    fontSize: FontSize.label,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    minHeight: 60,
  },
  inputError: {
    borderColor: '#EF4444',
  },
  errorText: {
    fontSize: FontSize.label,
    color: '#EF4444',
    lineHeight: 18,
  },
  syncSection: {
    gap: 8,
  },
  ipInput: {
    borderWidth: 1.5,
    borderRadius: 10,
    padding: 12,
    fontSize: FontSize.sm,
  },
  syncBtn: {
    borderRadius: 10,
    padding: 14,
    gap: 2,
  },
  syncBtnText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
  },
  syncBtnSub: {
    fontSize: 11,
  },
  progressBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 10,
    padding: 12,
  },
  progressText: {
    fontSize: FontSize.caption,
    flex: 1,
  },
  pickerBtn: {
    borderRadius: 10,
    padding: 14,
    gap: 2,
  },
  pickerBtnText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
  },
  pickerBtnSub: {
    fontSize: 11,
  },
  quickFillBtn: {
    borderRadius: 10,
    padding: 12,
    gap: 2,
  },
  quickFillText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
  },
  quickFillSub: {
    fontSize: 11,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
  },
  cancelBtn: {
    flex: 1,
    padding: 14,
    borderRadius: 10,
    borderWidth: 1.5,
    alignItems: 'center',
  },
  cancelText: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.semibold,
  },
  confirmBtn: {
    flex: 2,
    padding: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  confirmBtnDisabled: {
    backgroundColor: '#A78BFA',
  },
  confirmText: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.bold,
    color: '#FFFFFF',
  },
});
