/**
 * useVaultVacation.ts — Hook dédié au domaine Vacances
 *
 * Extrait de useVault.ts pour alléger le monolithe.
 * Appelé uniquement par useVaultInternal() via useVaultVacation(vaultRef).
 */

import { useState, useCallback } from 'react';
import type React from 'react';
import * as SecureStore from 'expo-secure-store';
import type { Task, VacationConfig } from '../lib/types';
import { parseTaskFile } from '../lib/parser';
import type { VaultManager } from '../lib/vault';

const VACATION_FILE = '02 - Maison/Vacances.md';
const VACATION_STORE_KEY = 'vacation_mode';

const VACATION_TEMPLATE = `# Checklist Vacances

## Avant le départ

### Documents
- [ ] Vérifier passeports (dates de validité)
- [ ] Carte d'identité à jour
- [ ] Carte européenne d'assurance maladie
- [ ] Ordonnances médicaments
- [ ] Confirmation réservation (hôtel / location)
- [ ] Billets de transport (avion / train)
- [ ] Assurance voyage

### Santé
- [ ] Trousse à pharmacie (doliprane, pansements, thermomètre)
- [ ] Crème solaire
- [ ] Médicaments habituels
- [ ] Carnet de santé des enfants

### Valises
- [ ] Vêtements enfants (prévoir 1 tenue/jour + 2 extras)
- [ ] Vêtements adultes
- [ ] Pyjamas
- [ ] Maillots de bain
- [ ] Chaussures confortables
- [ ] Vestes / pulls (soirées fraîches)

### Bébé / Jeunes enfants
- [ ] Couches en quantité suffisante
- [ ] Lait / biberons
- [ ] Petits pots / compotes
- [ ] Doudou + tétine de rechange
- [ ] Poussette / porte-bébé
- [ ] Lit parapluie

### Maison
- [ ] Couper l'eau (si absence longue)
- [ ] Baisser le chauffage / clim
- [ ] Vider le frigo (périssables)
- [ ] Sortir les poubelles
- [ ] Arrosage plantes (demander au voisin ?)
- [ ] Fermer volets et vérifier serrures
- [ ] Débrancher appareils électriques

### Divers
- [ ] Charger les appareils (téléphone, tablette, appareil photo)
- [ ] Télécharger films / jeux pour le trajet
- [ ] Snacks pour la route
- [ ] GPS / itinéraire vérifié
- [ ] Prévenir la nounou / école / crèche

## Retour de vacances
- [ ] Lancer une machine de linge
- [ ] Faire les courses de base
- [ ] Relever le courrier
- [ ] Remettre le chauffage / clim
- [ ] Déballer et ranger les valises
`;

// ─── Interface de retour ─────────────────────────────────────────────────────

export interface UseVaultVacationResult {
  vacationConfig: VacationConfig | null;
  setVacationConfig: (config: VacationConfig | null) => void;
  vacationTasks: Task[];
  setVacationTasks: React.Dispatch<React.SetStateAction<Task[]>>;
  isVacationActive: boolean;
  activateVacation: (startDate: string, endDate: string) => Promise<void>;
  deactivateVacation: () => Promise<void>;
  resetVacation: () => void;
}

// ─── Exports pour loadVaultData ──────────────────────────────────────────────

export { VACATION_STORE_KEY, VACATION_FILE };

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useVaultVacation(
  vaultRef: React.MutableRefObject<VaultManager | null>
): UseVaultVacationResult {
  const [vacationConfig, setVacationConfig] = useState<VacationConfig | null>(null);
  const [vacationTasks, setVacationTasks] = useState<Task[]>([]);

  const todayISO = new Date().toISOString().slice(0, 10);
  const isVacationActive = !!(vacationConfig?.active && vacationConfig.endDate >= todayISO);

  const resetVacation = useCallback(() => {
    setVacationConfig(null);
    setVacationTasks([]);
  }, []);

  const activateVacation = useCallback(async (startDate: string, endDate: string) => {
    const config: VacationConfig = { active: true, startDate, endDate };
    await SecureStore.setItemAsync(VACATION_STORE_KEY, JSON.stringify(config));
    setVacationConfig(config);
    if (vaultRef.current) {
      const exists = await vaultRef.current.exists(VACATION_FILE);
      if (!exists) {
        await vaultRef.current.writeFile(VACATION_FILE, VACATION_TEMPLATE);
      }
      const content = await vaultRef.current.readFile(VACATION_FILE);
      setVacationTasks(parseTaskFile(VACATION_FILE, content));
    }
  }, [vaultRef]);

  const deactivateVacation = useCallback(async () => {
    if (vacationConfig) {
      const deactivated = { ...vacationConfig, active: false };
      await SecureStore.setItemAsync(VACATION_STORE_KEY, JSON.stringify(deactivated));
      setVacationConfig(deactivated);
    }
  }, [vacationConfig]);

  return {
    vacationConfig,
    setVacationConfig,
    vacationTasks,
    setVacationTasks,
    isVacationActive,
    activateVacation,
    deactivateVacation,
    resetVacation,
  };
}
