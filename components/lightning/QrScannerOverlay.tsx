/**
 * QrScannerOverlay — Modal fullScreen scan QR Lightning bolt11 (UI-SPEC Surface 5).
 *
 * Plan 53-03b — composant écran scanner caméra.
 *
 * Présentation : `presentationStyle="fullScreen"` PAR-DESSUS la pageSheet
 * CashOutModal (Pitfall #7 RESEARCH — éviter le bug stacking pageSheets iOS
 * via fullScreen au-dessus, pas dismiss+present).
 *
 * Permission caméra demandée au mount (Pitfall #6 RESEARCH). Si refusée :
 * fallback UI avec bouton `Linking.openSettings()` pour autoriser dans les
 * Réglages iOS. Le paste bolt11 reste toujours disponible côté CashOutModal.
 *
 * Au scan d'un QR : Haptics.notificationAsync(Success) → onScan(bolt11) → le
 * caller ferme l'overlay et colle la valeur dans le textarea.
 */

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Linking,
  Platform,
} from 'react-native';
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import * as Haptics from 'expo-haptics';

import { useThemeColors } from '../../contexts/ThemeContext';
import { Spacing, Radius } from '../../constants/spacing';
import { FontSize, FontWeight } from '../../constants/typography';

interface QrScannerOverlayProps {
  /** Affiche le scanner (Modal monté en permanence pour bénéficier du stacking iOS). */
  visible: boolean;
  /** Callback déclenché au scan d'un QR — la string contient potentiellement un bolt11. */
  onScan: (data: string) => void;
  /** Fermeture demandée (bouton ✕ ou refus permission). */
  onClose: () => void;
}

export function QrScannerOverlay({ visible, onScan, onClose }: QrScannerOverlayProps) {
  const { colors, primary } = useThemeColors();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);

  // Permission demandée au mount uniquement quand l'overlay s'ouvre — évite
  // un prompt prématuré dès l'ouverture de CashOutModal (Pitfall #6).
  useEffect(() => {
    if (!visible) {
      setScanned(false);
      return;
    }
    if (permission && !permission.granted && permission.canAskAgain) {
      requestPermission();
    }
  }, [visible, permission, requestPermission]);

  const handleBarcodeScanned = (result: BarcodeScanningResult) => {
    if (scanned) return; // garde anti-multi-fire
    setScanned(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onScan(result.data);
  };

  const handleOpenSettings = () => {
    Linking.openSettings();
  };

  // États de rendu — 3 cas (UI-SPEC Surface 5 + Pitfall #6) :
  //   - permission === null  (loading initial) → écran noir minimal
  //   - !granted && !canAskAgain → fallback permission refusée
  //   - granted → CameraView + cadre + bouton fermer
  const renderContent = () => {
    if (!permission) {
      // 1 frame avant résolution permission — fond neutre via token thème.
      return <View style={[styles.fullBg, { backgroundColor: colors.bg }]} />;
    }

    if (!permission.granted) {
      return (
        <View style={[styles.fullBg, styles.permissionContainer, { backgroundColor: colors.bg }]}>
          <Text style={[styles.permissionTitle, { color: colors.text }]}>
            {permission.canAskAgain
              ? 'Autoriser l\'accès à la caméra'
              : 'Accès caméra refusé'}
          </Text>
          <Text style={[styles.permissionBody, { color: colors.textSub }]}>
            {permission.canAskAgain
              ? 'Pour scanner un QR Lightning, FamilyFlow a besoin d\'accéder à la caméra.'
              : 'Active l\'accès caméra dans les Réglages iOS pour scanner un QR Lightning.'}
          </Text>

          {permission.canAskAgain ? (
            <TouchableOpacity
              style={[styles.permissionBtn, { backgroundColor: primary }]}
              onPress={requestPermission}
              accessibilityRole="button"
            >
              <Text style={[styles.permissionBtnLabel, { color: colors.onPrimary }]}>
                Autoriser la caméra
              </Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.permissionBtn, { backgroundColor: primary }]}
              onPress={handleOpenSettings}
              accessibilityRole="button"
            >
              <Text style={[styles.permissionBtnLabel, { color: colors.onPrimary }]}>
                Ouvrir les Réglages
              </Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[styles.permissionCancel]}
            onPress={onClose}
            accessibilityRole="button"
          >
            <Text style={[styles.permissionCancelLabel, { color: colors.textSub }]}>
              Fermer
            </Text>
          </TouchableOpacity>
        </View>
      );
    }

    // Permission granted → CameraView + cadre + bouton fermer
    return (
      <View style={styles.fullBg}>
        <CameraView
          style={StyleSheet.absoluteFill}
          facing="back"
          barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
          onBarcodeScanned={handleBarcodeScanned}
        />

        {/* Cadre 240×240 centré, bordure or — UI-SPEC Surface 5 */}
        <View pointerEvents="none" style={styles.frameWrapper}>
          <View style={[styles.frame, { borderColor: colors.brand.or }]} />
        </View>

        {/* Bouton fermer ✕ en haut à droite */}
        <TouchableOpacity
          style={[styles.closeBtn, { backgroundColor: colors.overlay }]}
          onPress={onClose}
          accessibilityLabel="Fermer le scanner QR"
          accessibilityRole="button"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={[styles.closeText, { color: colors.onAccent }]}>{'✕'}</Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
      statusBarTranslucent={Platform.OS === 'android'}
    >
      {renderContent()}
    </Modal>
  );
}

const styles = StyleSheet.create({
  fullBg: {
    flex: 1,
  },
  frameWrapper: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  frame: {
    width: 240,
    height: 240,
    borderWidth: 2,
    borderRadius: Radius.md,
  },
  closeBtn: {
    position: 'absolute',
    top: 56,
    right: Spacing['2xl'],
    width: 44,
    height: 44,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: {
    fontSize: FontSize.title,
    fontWeight: FontWeight.semibold,
  },
  permissionContainer: {
    flex: 1,
    paddingHorizontal: Spacing['3xl'],
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xl,
  },
  permissionTitle: {
    fontSize: FontSize.heading,
    fontWeight: FontWeight.semibold,
    textAlign: 'center',
  },
  permissionBody: {
    fontSize: FontSize.body,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: Spacing.xl,
  },
  permissionBtn: {
    paddingVertical: Spacing.xl,
    paddingHorizontal: Spacing['3xl'],
    borderRadius: Radius.md,
    minWidth: 240,
    alignItems: 'center',
  },
  permissionBtnLabel: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.semibold,
  },
  permissionCancel: {
    marginTop: Spacing.md,
    paddingVertical: Spacing.md,
  },
  permissionCancelLabel: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.normal,
  },
});
