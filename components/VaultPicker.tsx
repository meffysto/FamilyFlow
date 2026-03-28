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
  const COFFRE_DEFAULT = '/Users/USER/Documents/coffre';

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
      {/* iCloud Drive — primary option (iOS) */}
      {Platform.OS === 'ios' && (
        <TouchableOpacity
          style={[styles.createBtn, { backgroundColor: primary }]}
          onPress={createInICloud}
        >
          <Text style={[styles.createBtnText, { color: colors.onPrimary }]}>{t('vaultPicker.createICloud')}</Text>
          <Text style={styles.createBtnSub}>{t('vaultPicker.createICloudSub')}</Text>
        </TouchableOpacity>
      )}

      {/* Google Drive / Dropbox — primary option (Android) */}
      {Platform.OS === 'android' && (
        <TouchableOpacity
          style={[styles.createBtn, { backgroundColor: primary }]}
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
              Alert.alert(t('vaultPicker.alert.error'), `${e.message}`);
            }
          }}
        >
          <Text style={[styles.createBtnText, { color: colors.onPrimary }]}>{t('vaultPicker.createAndroid')}</Text>
          <Text style={styles.createBtnSub}>{t('vaultPicker.createAndroidSub')}</Text>
        </TouchableOpacity>
      )}

      {/* Create locally — secondary option */}
      <TouchableOpacity
        style={[styles.icloudBtn, { backgroundColor: tint }]}
        onPress={() => { setWizardTargetPath(undefined); setShowWizard(true); }}
      >
        <Text style={[styles.icloudBtnText, { color: primary }]}>{t('vaultPicker.createNew')}</Text>
        <Text style={[styles.icloudBtnSub, { color: colors.textMuted }]}>{t('vaultPicker.createNewSub')}</Text>
      </TouchableOpacity>

      <View style={styles.separator}>
        <View style={[styles.separatorLine, { backgroundColor: colors.separator }]} />
        <Text style={[styles.separatorText, { color: colors.textFaint }]}>{t('vaultPicker.orExisting')}</Text>
        <View style={[styles.separatorLine, { backgroundColor: colors.separator }]} />
      </View>

      {/* iOS: folder picker */}
      {Platform.OS === 'ios' && (
        <TouchableOpacity
          style={[styles.pickerBtn, { backgroundColor: colors.infoBg }]}
          onPress={pickFolder}
        >
          <Text style={[styles.pickerBtnText, { color: colors.info || '#1D4ED8' }]}>{t('vaultPicker.chooseFolder')}</Text>
          <Text style={[styles.pickerBtnSub, { color: colors.textMuted }]}>{t('vaultPicker.fromFilesIos')}</Text>
        </TouchableOpacity>
      )}

      {/* Android SAF picker */}
      {Platform.OS === 'android' && (
        <TouchableOpacity
          style={[styles.pickerBtn, { backgroundColor: colors.infoBg }]}
          onPress={useSAF}
        >
          <Text style={[styles.pickerBtnText, { color: colors.info || '#1D4ED8' }]}>{t('vaultPicker.chooseFolder')}</Text>
          <Text style={[styles.pickerBtnSub, { color: colors.textMuted }]}>{t('vaultPicker.fromFilesAndroid')}</Text>
        </TouchableOpacity>
      )}

      {error && <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>}

      {/* Desktop: manual path input */}
      {Platform.OS !== 'ios' && Platform.OS !== 'android' && (
        <>
          <Text style={[styles.label, { color: colors.textSub }]}>{t('vaultPicker.folderLocation')}</Text>
          <TextInput
            style={[styles.input, { borderColor: colors.inputBorder, color: colors.text, backgroundColor: colors.inputBg }, error ? { borderColor: colors.error } : null]}
            value={path}
            onChangeText={(t) => { setPath(t); setError(null); }}
            placeholder={t('vaultPicker.pathPlaceholder')}
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
            <Text style={[styles.quickFillText, { color: primary }]}>{t('vaultPicker.useDefaultFolder')}</Text>
            <Text style={[styles.quickFillSub, { color: colors.textMuted }]}>{COFFRE_DEFAULT}</Text>
          </TouchableOpacity>
        </>
      )}

      <View style={styles.actions}>
        {onCancel && (
          <TouchableOpacity style={[styles.cancelBtn, { borderColor: colors.separator }]} onPress={onCancel}>
            <Text style={[styles.cancelText, { color: colors.textMuted }]}>{t('vaultPicker.cancel')}</Text>
          </TouchableOpacity>
        )}

        {Platform.OS !== 'ios' && Platform.OS !== 'android' && (
          <TouchableOpacity
            style={[styles.confirmBtn, { backgroundColor: isValidating ? primary + '99' : primary }]}
            onPress={() => validate(path)}
            disabled={isValidating}
          >
            {isValidating ? (
              <ActivityIndicator color={colors.onPrimary} size="small" />
            ) : (
              <Text style={[styles.confirmText, { color: colors.onPrimary }]}>{t('vaultPicker.confirm')}</Text>
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
  inputError: {},
  errorText: {
    fontSize: FontSize.label,
    lineHeight: 18,
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
  confirmBtnDisabled: {},
  confirmText: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.bold,
  },
});
