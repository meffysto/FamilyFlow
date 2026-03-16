/**
 * receipt-scanner.ts — Capture et traitement de tickets de caisse
 *
 * Pipeline : picker image → optimisation → base64 → vision IA → résultat structuré
 * Utilise scanReceiptImage() de ai-service.ts pour l'appel Claude Vision.
 */

import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system/legacy';
import { scanReceiptImage, ReceiptScanError } from './ai-service';
import type { AIConfig, ReceiptScanResult } from './ai-service';

// Ré-export du type canonique depuis ai-service
export type { ReceiptScanResult as ScannedReceipt } from './ai-service';

/** Résultat du pipeline : succès, annulé par l'utilisateur, ou erreur */
export type ScanOutcome =
  | { status: 'success'; data: ReceiptScanResult }
  | { status: 'cancelled' }
  | { status: 'error'; message: string };

// ─── Picker image ───────────────────────────────────────────────────────────────

/**
 * Lance le picker image (galerie — l'utilisateur peut prendre une photo via l'OS).
 * Retourne l'URI et la largeur, ou null si annulé.
 */
export async function pickReceiptImage(): Promise<{ uri: string; width: number } | null> {
  try {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') return null;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
      allowsEditing: false,
    });

    if (result.canceled || !result.assets?.[0]) return null;
    const asset = result.assets[0];
    return { uri: asset.uri, width: asset.width ?? 0 };
  } catch (e) {
    if (__DEV__) console.log('🧾 [RECEIPT] Erreur picker:', e);
    return null;
  }
}

// ─── Optimisation image ─────────────────────────────────────────────────────────

/**
 * Convertit en JPEG et redimensionne si trop large (max 1568px pour Vision API).
 * Gère automatiquement HEIC/HEIF → JPEG via ImageManipulator.
 */
async function optimizeImage(uri: string, currentWidth: number): Promise<string> {
  try {
    const maxWidth = 1568; // max recommandé pour Claude Vision
    const actions: ImageManipulator.Action[] = [];
    if (currentWidth > maxWidth) {
      actions.push({ resize: { width: maxWidth } });
    }
    const result = await ImageManipulator.manipulateAsync(uri, actions, {
      compress: 0.8,
      format: ImageManipulator.SaveFormat.JPEG,
    });
    return result.uri;
  } catch (e) {
    if (__DEV__) console.log('🧾 [RECEIPT] Erreur optimisation:', e);
    return uri;
  }
}

// ─── Conversion base64 ─────────────────────────────────────────────────────────

/**
 * Convertit une image locale en base64.
 * Le type MIME est toujours JPEG après optimisation (même si l'original est HEIC).
 */
async function imageToBase64(uri: string): Promise<{ base64: string; mediaType: string }> {
  const base64 = await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  return { base64, mediaType: 'image/jpeg' };
}

// ─── Pipeline complet ───────────────────────────────────────────────────────────

/**
 * Pipeline complet : picker → optimise → base64 → vision IA → résultat structuré.
 * Retourne un ScanOutcome discriminé pour que l'UI puisse afficher le bon feedback.
 */
export async function captureAndScanReceipt(
  config: AIConfig,
  categories: string[],
): Promise<ScanOutcome> {
  let optimizedUri: string | null = null;

  try {
    // 1. Sélectionner l'image
    const picked = await pickReceiptImage();
    if (!picked) return { status: 'cancelled' };

    if (__DEV__) console.log('🧾 [RECEIPT] Image sélectionnée:', picked.uri, 'largeur:', picked.width);

    // 2. Optimiser (convertit HEIC→JPEG + redimensionne si besoin)
    optimizedUri = await optimizeImage(picked.uri, picked.width);

    if (__DEV__) console.log('🧾 [RECEIPT] Image optimisée:', optimizedUri);

    // 3. Convertir en base64
    const { base64, mediaType } = await imageToBase64(optimizedUri);

    if (__DEV__) console.log('🧾 [RECEIPT] Base64 prêt, taille:', Math.round(base64.length / 1024), 'KB');

    // 4. Envoyer à l'IA pour extraction
    const result = await scanReceiptImage(config, base64, mediaType, categories);

    if (__DEV__) console.log('🧾 [RECEIPT] Résultat:', result.store, result.items.length, 'articles');

    // Vérifier que le résultat contient des articles
    if (!result.items.length) {
      return { status: 'error', message: 'Aucun article détecté sur le ticket' };
    }

    return { status: 'success', data: result };
  } catch (e: any) {
    if (__DEV__) console.log('🧾 [RECEIPT] Erreur pipeline:', e);
    const message = e instanceof ReceiptScanError
      ? e.message
      : (e?.message ?? 'Erreur lors du scan');
    return { status: 'error', message };
  } finally {
    // Nettoyer le fichier temporaire optimisé
    if (optimizedUri) {
      FileSystem.deleteAsync(optimizedUri, { idempotent: true }).catch(() => {});
    }
  }
}
