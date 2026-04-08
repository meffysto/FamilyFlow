/**
 * useVaultDietary.ts — Hook domaine pour les préférences alimentaires (Phase 15)
 *
 * Séparé de useVaultProfiles conformément à ARCH-04 :
 * ne pas gonfler useVaultProfiles avec des responsabilités hors-profil.
 *
 * Expose :
 * - guests : liste des invités récurrents (chargée depuis INVITES_FILE)
 * - reloadGuests : recharge les invités depuis le vault
 * - updateFoodPreferences : met à jour food_* d'un profil dans famille.md
 * - upsertGuest : crée ou remplace un invité dans Invités.md
 * - deleteGuest : supprime un invité de Invités.md
 */

import { useState, useCallback, useEffect } from 'react';
import type React from 'react';
import { Alert } from 'react-native';
import type { VaultManager } from '../lib/vault';
import type { Profile } from '../lib/types';
import type { GuestProfile } from '../lib/dietary/types';
import { parseInvites, serializeInvites, INVITES_FILE } from '../lib/parser';
import { enqueueWrite } from '../lib/famille-queue';

// ─── Constantes ──────────────────────────────────────────────────────────────

const FAMILLE_FILE = 'famille.md';

/** Clés food_* dans famille.md, mappées par catégorie */
const FOOD_KEYS: Record<'allergies' | 'intolerances' | 'regimes' | 'aversions', string> = {
  allergies: 'food_allergies',
  intolerances: 'food_intolerances',
  regimes: 'food_regimes',
  aversions: 'food_aversions',
};

// ─── Interface publique ───────────────────────────────────────────────────────

export interface VaultDietaryState {
  guests: GuestProfile[];
  reloadGuests: () => Promise<void>;
  updateFoodPreferences: (
    profileId: string,
    category: 'allergies' | 'intolerances' | 'regimes' | 'aversions',
    items: string[],
  ) => Promise<void>;
  upsertGuest: (guest: GuestProfile) => Promise<void>;
  deleteGuest: (guestId: string) => Promise<void>;
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useVaultDietary(
  vaultRef: React.MutableRefObject<VaultManager | null>,
  _profiles: Profile[],
  reloadProfiles: () => Promise<void>,
): VaultDietaryState {
  const [guests, setGuests] = useState<GuestProfile[]>([]);

  // ─── Invités ─────────────────────────────────────────────────────────────

  /**
   * Recharge les invités récurrents depuis le vault.
   * Silencieux si le fichier n'existe pas encore.
   */
  const reloadGuests = useCallback(async () => {
    if (!vaultRef.current) return;
    try {
      const content = await vaultRef.current.readFile(INVITES_FILE);
      setGuests(parseInvites(content));
    } catch {
      // Fichier absent au premier lancement — état vide normal
      setGuests([]);
    }
  }, []);

  // Chargement au montage
  useEffect(() => {
    reloadGuests();
  }, [reloadGuests]);

  // ─── Préférences famille ─────────────────────────────────────────────────

  /**
   * Met à jour la clé food_{category} du profil dans famille.md.
   * Lecture fraîche du fichier pour éviter les race conditions.
   * Si items est vide, la ligne est supprimée pour conserver la lisibilité Obsidian.
   * Utilise enqueueWrite pour cohérence avec le reste du codebase (pattern 260403-q6y).
   */
  const updateFoodPreferences = useCallback(async (
    profileId: string,
    category: 'allergies' | 'intolerances' | 'regimes' | 'aversions',
    items: string[],
  ) => {
    if (!vaultRef.current) return;

    const foodKey = FOOD_KEYS[category];

    return enqueueWrite(async () => {
      try {
        const content = await vaultRef.current!.readFile(FAMILLE_FILE);
        const lines = content.split('\n');

        let inSection = false;
        let sectionStart = -1;
        let sectionEnd = lines.length;

        // Trouver la section ### {profileId}
        for (let i = 0; i < lines.length; i++) {
          if (lines[i].startsWith('### ')) {
            if (inSection) {
              sectionEnd = i;
              break;
            }
            if (lines[i].replace('### ', '').trim() === profileId) {
              inSection = true;
              sectionStart = i;
            }
          }
        }

        if (sectionStart === -1) {
          if (__DEV__) console.warn(`[useVaultDietary] Section introuvable pour ${profileId}`);
          return;
        }

        // Chercher la ligne food_{category} existante dans la section
        let keyLineIdx = -1;
        for (let i = sectionStart + 1; i < sectionEnd; i++) {
          if (lines[i].trim().startsWith(`${foodKey}:`)) {
            keyLineIdx = i;
            break;
          }
        }

        if (items.length === 0) {
          // Supprimer la ligne si elle existe (Obsidian — pas de clés vides)
          if (keyLineIdx !== -1) {
            lines.splice(keyLineIdx, 1);
          }
        } else {
          const newLine = `${foodKey}: ${items.join(',')}`;
          if (keyLineIdx !== -1) {
            // Mettre à jour la ligne existante
            lines[keyLineIdx] = newLine;
          } else {
            // Insérer après la dernière propriété de la section
            let lastPropIdx = sectionStart;
            for (let i = sectionStart + 1; i < sectionEnd; i++) {
              if (lines[i].includes(': ')) lastPropIdx = i;
            }
            lines.splice(lastPropIdx + 1, 0, newLine);
          }
        }

        await vaultRef.current!.writeFile(FAMILLE_FILE, lines.join('\n'));

        // Synchroniser le state React via reloadProfiles
        await reloadProfiles();
      } catch (e) {
        if (__DEV__) console.warn('[useVaultDietary] updateFoodPreferences:', e);
        Alert.alert(
          'Erreur',
          'Impossible d\'enregistrer les préférences. Vérifiez l\'accès au vault.',
        );
      }
    });
  }, [reloadProfiles]);

  // ─── CRUD invités ─────────────────────────────────────────────────────────

  /**
   * Crée ou remplace un invité dans Invités.md.
   * La comparaison se fait par ID — si l'ID existe déjà, l'invité est remplacé.
   */
  const upsertGuest = useCallback(async (guest: GuestProfile) => {
    if (!vaultRef.current) return;
    try {
      // Charger les invités courants
      let current: GuestProfile[] = [];
      try {
        const content = await vaultRef.current.readFile(INVITES_FILE);
        current = parseInvites(content);
      } catch {
        // Fichier absent — on repart de zéro
      }

      // Remplacer si existe, sinon ajouter
      const idx = current.findIndex((g) => g.id === guest.id);
      if (idx !== -1) {
        current[idx] = guest;
      } else {
        current.push(guest);
      }

      await vaultRef.current.writeFile(INVITES_FILE, serializeInvites(current));
      setGuests(current);
    } catch (e) {
      if (__DEV__) console.warn('[useVaultDietary] upsertGuest:', e);
      Alert.alert('Erreur', 'Impossible d\'enregistrer l\'invité. Vérifiez l\'accès au vault.');
    }
  }, []);

  /**
   * Supprime un invité par son ID dans Invités.md.
   */
  const deleteGuest = useCallback(async (guestId: string) => {
    if (!vaultRef.current) return;
    try {
      let current: GuestProfile[] = [];
      try {
        const content = await vaultRef.current.readFile(INVITES_FILE);
        current = parseInvites(content);
      } catch {
        // Fichier absent — rien à supprimer
        return;
      }

      const filtered = current.filter((g) => g.id !== guestId);
      await vaultRef.current.writeFile(INVITES_FILE, serializeInvites(filtered));
      setGuests(filtered);
    } catch (e) {
      if (__DEV__) console.warn('[useVaultDietary] deleteGuest:', e);
      Alert.alert('Erreur', 'Impossible de supprimer l\'invité. Vérifiez l\'accès au vault.');
    }
  }, []);

  return {
    guests,
    reloadGuests,
    updateFoodPreferences,
    upsertGuest,
    deleteGuest,
  };
}
