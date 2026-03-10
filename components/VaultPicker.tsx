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
import { SetupWizard } from './SetupWizard';
import { startAccessing } from '../modules/vault-access/src';

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
  const [serverIp, setServerIp] = useState('');
  const COFFRE_DEFAULT = '/Users/USER/Documents/coffre';

  // --- Sync depuis un ordinateur (Python serve-vault.py) ---
  const syncFromServer = async () => {
    const ip = serverIp.trim();
    if (!ip) {
      setError('Entrez l\'adresse IP de votre ordinateur (ex: 192.168.1.42)');
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
      setError(`Sync échouée : ${e.message}\n\nVérifiez que serve-vault.py tourne sur l'ordinateur et que vous êtes sur le même réseau Wi-Fi.`);
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
        setError('Accès refusé au dossier. Réessayez en sélectionnant le dossier.');
        return;
      }

      setPath(decodeURIComponent(folderUri));
      setError(null);
      onPathSelected(folderUri);
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
        <Text style={styles.createBtnText}>Créer un nouveau vault</Text>
        <Text style={styles.createBtnSub}>Pas besoin d'Obsidian — tout est créé automatiquement</Text>
      </TouchableOpacity>

      <View style={styles.separator}>
        <View style={[styles.separatorLine, { backgroundColor: colors.separator }]} />
        <Text style={[styles.separatorText, { color: colors.textFaint }]}>ou connecter un vault existant</Text>
        <View style={[styles.separatorLine, { backgroundColor: colors.separator }]} />
      </View>

      {/* iOS: folder picker */}
      {Platform.OS === 'ios' && (
        <TouchableOpacity
          style={[styles.pickerBtn, { backgroundColor: colors.infoBg }]}
          onPress={pickFolder}
        >
          <Text style={[styles.pickerBtnText, { color: colors.info || '#1D4ED8' }]}>Sélectionner le dossier du vault</Text>
          <Text style={[styles.pickerBtnSub, { color: colors.textMuted }]}>Depuis Fichiers, iCloud, Obsidian...</Text>
        </TouchableOpacity>
      )}

      {/* Android SAF picker */}
      {Platform.OS === 'android' && (
        <TouchableOpacity
          style={[styles.pickerBtn, { backgroundColor: colors.infoBg }]}
          onPress={useSAF}
        >
          <Text style={[styles.pickerBtnText, { color: colors.info || '#1D4ED8' }]}>Sélectionner le dossier du vault</Text>
          <Text style={[styles.pickerBtnSub, { color: colors.textMuted }]}>Depuis le stockage de l'appareil</Text>
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
            <Text style={{ fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', fontSize: 10 }}>
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
          <TouchableOpacity
            style={[styles.quickFillBtn, { backgroundColor: tint }]}
            onPress={() => { setPath(COFFRE_DEFAULT); setError(null); }}
          >
            <Text style={[styles.quickFillText, { color: primary }]}>Utiliser le vault coffre</Text>
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
    borderRadius: 10,
    padding: 14,
    gap: 2,
  },
  pickerBtnText: {
    fontSize: 14,
    fontWeight: '700',
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
    fontSize: 14,
    fontWeight: '600',
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
