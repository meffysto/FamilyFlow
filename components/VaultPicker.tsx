/**
 * VaultPicker.tsx — Vault folder selection UI
 *
 * iOS: pick a .md file → extract parent directory as vault path
 * Android: SAF folder picker
 * Mac: manual text input + coffre quick-fill
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
} from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as DocumentPicker from 'expo-document-picker';
import { VaultManager } from '../lib/vault';
import { useThemeColors } from '../contexts/ThemeContext';
import { SetupWizard } from './SetupWizard';

interface VaultPickerProps {
  currentPath?: string | null;
  onPathSelected: (path: string) => void;
  onCancel?: () => void;
}

export function VaultPicker({ currentPath, onPathSelected, onCancel }: VaultPickerProps) {
  const { primary, tint, colors } = useThemeColors();
  const [path, setPath] = useState(currentPath ?? '');
  const [isValidating, setIsValidating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [showWizard, setShowWizard] = useState(false);
  const [syncProgress, setSyncProgress] = useState('');
  const [macIp, setMacIp] = useState('');
  const COFFRE_DEFAULT = '/Users/USER/Documents/coffre';

  const syncFromMac = async () => {
    const ip = macIp.trim();
    if (!ip) {
      setError('Entrez l\'adresse IP de votre Mac (ex: 192.168.1.42)');
      return;
    }
    const MAC_SERVER = `http://${ip}:8765`;
    setSyncProgress('Connexion au Mac...');
    setError(null);

    try {
      // 1. Fetch manifest
      const manifestRes = await fetch(`${MAC_SERVER}/manifest.json`);
      if (!manifestRes.ok) throw new Error('Serveur non trouvé. Lancez serve-vault.py sur le Mac.');
      const { files } = await manifestRes.json() as { files: string[] };

      const localVault = `${FileSystem.documentDirectory}coffre`;

      // 2. Download each file
      let downloaded = 0;
      for (const relPath of files) {
        setSyncProgress(`${downloaded + 1}/${files.length} — ${relPath}`);

        const fileUrl = `${MAC_SERVER}/file/${encodeURIComponent(relPath)}`;
        const localPath = `${localVault}/${relPath}`;

        // Ensure parent dir exists
        const parentDir = localPath.substring(0, localPath.lastIndexOf('/'));
        const dirInfo = await FileSystem.getInfoAsync(parentDir);
        if (!dirInfo.exists) {
          await FileSystem.makeDirectoryAsync(parentDir, { intermediates: true });
        }

        // Download file
        await FileSystem.downloadAsync(fileUrl, localPath);
        downloaded++;
      }

      setSyncProgress(`✅ ${downloaded} fichiers synchronisés`);
      setPath(localVault);

      // Laisser le JS engine respirer avant le rechargement du vault
      await new Promise((r) => setTimeout(r, 1500));
      setSyncProgress('');
      onPathSelected(localVault);
    } catch (e: any) {
      setSyncProgress('');
      setError(`Sync échouée : ${e.message}\n\nVérifiez que serve-vault.py tourne sur le Mac.`);
    }
  };

  const copyVaultToLocal = async (sourceDir: string): Promise<string> => {
    const localVault = `${FileSystem.documentDirectory}coffre`;

    // Recursive copy
    const copyDir = async (srcDir: string, destDir: string) => {
      const destInfo = await FileSystem.getInfoAsync(destDir);
      if (!destInfo.exists) {
        await FileSystem.makeDirectoryAsync(destDir, { intermediates: true });
      }
      const entries = await FileSystem.readDirectoryAsync(srcDir);
      for (const entry of entries) {
        if (entry.startsWith('.')) continue; // Skip hidden files
        const srcPath = `${srcDir}/${entry}`;
        const destPath = `${destDir}/${entry}`;
        const info = await FileSystem.getInfoAsync(srcPath);
        if ('isDirectory' in info && info.isDirectory) {
          await copyDir(srcPath, destPath);
        } else {
          await FileSystem.copyAsync({ from: srcPath, to: destPath });
        }
      }
    };

    setSyncProgress('Copie du vault en cours...');
    await copyDir(sourceDir, localVault);
    setSyncProgress('');
    return localVault;
  };

  const pickFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        copyToCacheDirectory: false,
      });

      if (result.canceled || !result.assets?.[0]) return;

      const fileUri = result.assets[0].uri;
      const fileName = result.assets[0].name;
      const dirUri = fileUri.substring(0, fileUri.lastIndexOf('/'));

      if (Platform.OS === 'ios') {
        // iOS: le dossier source est en lecture seule (sandbox)
        // → copier le vault dans documentDirectory
        Alert.alert(
          'Vault détecté',
          `Fichier : ${fileName}\n\nLe vault sera copié dans l'espace de l'app pour pouvoir y écrire.`,
          [
            {
              text: 'Copier et utiliser',
              onPress: async () => {
                try {
                  const localPath = await copyVaultToLocal(dirUri);
                  setPath(localPath);
                  setError(null);
                  onPathSelected(localPath);
                } catch (e: any) {
                  setSyncProgress('');
                  setError(`Copie échouée : ${e.message}`);
                }
              },
            },
            { text: 'Annuler', style: 'cancel' },
          ],
        );
      } else {
        // Android / Mac: accès direct
        setPath(decodeURIComponent(dirUri));
        setError(null);
        onPathSelected(dirUri);
      }
    } catch (e: any) {
      setError(`Erreur lors de la sélection : ${e.message}`);
    }
  };

  const validate = async (vaultPath: string) => {
    if (!vaultPath.trim()) {
      setError('Le chemin ne peut pas être vide.');
      return;
    }

    setIsValidating(true);
    setError(null);

    const trimmed = vaultPath.trim();
    const isValid = await VaultManager.validate(trimmed);

    if (!isValid) {
      setError(`Dossier introuvable : "${trimmed}"\nVérifiez que le chemin existe et que l'app y a accès.`);
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
        Alert.alert('Non disponible', 'Le sélecteur de dossier n\'est pas disponible.');
        return;
      }
      const result = await SAF.requestDirectoryPermissionsAsync();
      if (!result.granted) return;
      setPath(result.directoryUri);
      setError(null);
    } catch (e) {
      Alert.alert('Erreur', `Impossible d'ouvrir le sélecteur : ${e}`);
    }
  };

  // Show wizard instead of picker when creating a new vault
  if (showWizard) {
    return (
      <SetupWizard
        onComplete={(newPath) => {
          setShowWizard(false);
          onPathSelected(newPath);
        }}
        onCancel={() => setShowWizard(false)}
      />
    );
  }

  return (
    <View style={styles.container}>
      {/* Create new vault button */}
      <TouchableOpacity
        style={[styles.createBtn, { backgroundColor: primary }]}
        onPress={() => setShowWizard(true)}
      >
        <Text style={styles.createBtnText}>✨ Créer un nouveau vault</Text>
        <Text style={styles.createBtnSub}>Pas besoin d'Obsidian — tout est créé automatiquement</Text>
      </TouchableOpacity>

      <View style={styles.separator}>
        <View style={[styles.separatorLine, { backgroundColor: colors.separator }]} />
        <Text style={[styles.separatorText, { color: colors.textFaint }]}>ou connecter un vault existant</Text>
        <View style={[styles.separatorLine, { backgroundColor: colors.separator }]} />
      </View>

      <Text style={[styles.label, { color: colors.textSub }]}>Chemin du vault</Text>

      <TextInput
        style={[styles.input, { borderColor: colors.inputBorder, color: colors.text, backgroundColor: colors.inputBg }, error ? styles.inputError : null]}
        value={path}
        onChangeText={(t) => { setPath(t); setError(null); }}
        placeholder="/chemin/vers/mon-vault"
        placeholderTextColor={colors.textFaint}
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="done"
        onSubmitEditing={() => validate(path)}
        multiline
      />

      {error && <Text style={styles.errorText}>{error}</Text>}

      {/* Sync from Mac — download vault via HTTP */}
      <View style={styles.syncSection}>
        <TextInput
          style={[styles.ipInput, { borderColor: colors.inputBorder, color: colors.text, backgroundColor: colors.inputBg }]}
          value={macIp}
          onChangeText={(t) => { setMacIp(t); setError(null); }}
          placeholder="IP du Mac (ex: 192.168.1.42)"
          placeholderTextColor={colors.textFaint}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="numbers-and-punctuation"
          returnKeyType="go"
          onSubmitEditing={syncFromMac}
        />
      </View>
      <TouchableOpacity
        style={[styles.syncBtn, { backgroundColor: tint }]}
        onPress={syncFromMac}
        disabled={!!syncProgress}
      >
        <Text style={[styles.syncBtnText, { color: primary }]}>💻 Sync depuis le Mac</Text>
        <Text style={[styles.syncBtnSub, { color: colors.textMuted }]}>Télécharge le vault via Wi-Fi</Text>
      </TouchableOpacity>

      {!!syncProgress && (
        <View style={[styles.progressBox, { backgroundColor: colors.bg }]}>
          <ActivityIndicator size="small" color={primary} />
          <Text style={[styles.progressText, { color: colors.textSub }]}>{syncProgress}</Text>
        </View>
      )}

      {/* File picker — pick a .md then use parent dir */}
      <TouchableOpacity style={styles.pickerBtn} onPress={pickFile}>
        <Text style={styles.pickerBtnText}>📂 Sélectionner un fichier du vault</Text>
        <Text style={styles.pickerBtnSub}>Choisissez un .md à la racine du vault</Text>
      </TouchableOpacity>

      {/* Quick fill for coffre — Mac */}
      {Platform.OS !== 'ios' && (
        <TouchableOpacity
          style={[styles.quickFillBtn, { backgroundColor: tint }]}
          onPress={() => { setPath(COFFRE_DEFAULT); setError(null); }}
        >
          <Text style={[styles.quickFillText, { color: primary }]}>📁 Utiliser le vault coffre</Text>
          <Text style={[styles.quickFillSub, { color: colors.textMuted }]}>{COFFRE_DEFAULT}</Text>
        </TouchableOpacity>
      )}

      {/* Android SAF picker */}
      {Platform.OS === 'android' && (
        <TouchableOpacity style={styles.safBtn} onPress={useSAF}>
          <Text style={styles.safBtnText}>📂 Sélecteur Android (SAF)</Text>
        </TouchableOpacity>
      )}

      <View style={styles.actions}>
        {onCancel && (
          <TouchableOpacity style={[styles.cancelBtn, { borderColor: colors.separator }]} onPress={onCancel}>
            <Text style={[styles.cancelText, { color: colors.textMuted }]}>Annuler</Text>
          </TouchableOpacity>
        )}

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
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  createBtnSub: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
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
    fontSize: 12,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
  },
  input: {
    borderWidth: 1.5,
    borderRadius: 10,
    padding: 12,
    fontSize: 13,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    minHeight: 60,
  },
  inputError: {
    borderColor: '#EF4444',
  },
  errorText: {
    fontSize: 13,
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
    fontSize: 14,
  },
  syncBtn: {
    borderRadius: 10,
    padding: 14,
    gap: 2,
  },
  syncBtnText: {
    fontSize: 14,
    fontWeight: '700',
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
    fontSize: 12,
    flex: 1,
  },
  pickerBtn: {
    backgroundColor: '#DBEAFE',
    borderRadius: 10,
    padding: 14,
    gap: 2,
  },
  pickerBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1D4ED8',
  },
  pickerBtnSub: {
    fontSize: 11,
    color: '#3B82F6',
  },
  quickFillBtn: {
    borderRadius: 10,
    padding: 12,
    gap: 2,
  },
  quickFillText: {
    fontSize: 14,
    fontWeight: '600',
  },
  quickFillSub: {
    fontSize: 11,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  safBtn: {
    backgroundColor: '#DBEAFE',
    borderRadius: 10,
    padding: 12,
    alignItems: 'center',
  },
  safBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1D4ED8',
  },
  iosHint: {
    backgroundColor: '#FEF3C7',
    borderRadius: 10,
    padding: 12,
    gap: 6,
  },
  hintTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#92400E',
  },
  hintText: {
    fontSize: 12,
    color: '#78350F',
    lineHeight: 18,
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
    fontSize: 15,
    fontWeight: '600',
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
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
