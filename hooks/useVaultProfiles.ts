/**
 * useVaultProfiles.ts — Hook dédié au domaine Profils & mascotte
 *
 * Extrait de useVault.ts pour alléger le monolithe.
 * Appelé uniquement par useVaultInternal() via useVaultProfiles(vaultRef, setGamiData, tasksHookSetTasks).
 */

import { useState, useCallback, type SetStateAction, type Dispatch } from 'react';
import type React from 'react';
import * as SecureStore from 'expo-secure-store';
import type { Profile, Gender, GamificationData, ProfileTheme, AgeUpgrade, AgeCategory, Task } from '../lib/types';
import type { FarmProfileData } from '../lib/types';
import type { TreeSpecies } from '../lib/mascot/types';
import type { VaultManager } from '../lib/vault';
import { parseFamille, parseGamification, serializeGamification, mergeProfiles, parseFarmProfile, serializeFarmProfile, parseTaskFile } from '../lib/parser';
import { calculateLevel } from '../lib/gamification';
import { DECORATIONS, INHABITANTS, TREE_STAGES } from '../lib/mascot/types';
import { getStageIndex } from '../lib/mascot/engine';
import { enqueueWrite } from '../lib/famille-queue';
import { format } from 'date-fns';

// ─── Constantes ──────────────────────────────────────────────────────────────

export const ACTIVE_PROFILE_KEY = 'active_profile_id';

const FAMILLE_FILE = 'famille.md';

function gamiFile(profileId: string): string {
  return `gami-${profileId}.md`;
}

function farmFile(profileId: string): string {
  return `farm-${profileId}.md`;
}

function warnUnexpected(context: string, e: unknown) {
  const msg = String(e);
  const isNotFound = msg.includes('cannot read') || msg.includes('not exist') || msg.includes('no such') || msg.includes('ENOENT');
  if (!isNotFound && __DEV__) console.warn(`[useVaultProfiles] ${context}:`, e);
}

// ─── Interface de retour ─────────────────────────────────────────────────────

export interface UseVaultProfilesResult {
  profiles: Profile[];
  setProfiles: Dispatch<SetStateAction<Profile[]>>;
  activeProfileId: string | null;
  setActiveProfileId: (id: string | null) => void;
  activeProfile: Profile | null;
  ageUpgrades: AgeUpgrade[];
  setAgeUpgrades: Dispatch<SetStateAction<AgeUpgrade[]>>;
  setActiveProfile: (profileId: string) => Promise<void>;
  updateProfileTheme: (profileId: string, theme: ProfileTheme) => Promise<void>;
  renameGarden: (profileId: string, name: string) => Promise<void>;
  updateTreeSpecies: (profileId: string, species: string) => Promise<void>;
  buyMascotItem: (profileId: string, itemId: string, itemType: 'decoration' | 'inhabitant') => Promise<void>;
  placeMascotItem: (profileId: string, slotId: string, itemId: string) => Promise<void>;
  unplaceMascotItem: (profileId: string, slotId: string) => Promise<void>;
  updateProfile: (profileId: string, updates: { name?: string; avatar?: string; birthdate?: string; propre?: boolean; gender?: Gender; voiceElevenLabsId?: string; voiceFishAudioId?: string; voicePersonalId?: string; voiceSource?: 'ios-personal' | 'elevenlabs-cloned' | 'elevenlabs-preset' | 'fish-audio-cloned' | 'expo-speech' }) => Promise<void>;
  deleteProfile: (profileId: string) => Promise<void>;
  applyAgeUpgrade: (upgrade: AgeUpgrade) => Promise<void>;
  dismissAgeUpgrade: (profileId: string) => void;
  addChild: (child: { name: string; avatar: string; birthdate: string; propre?: boolean; gender?: Gender; statut?: 'grossesse'; dateTerme?: string }) => Promise<void>;
  convertToBorn: (profileId: string, birthdate: string) => Promise<void>;
  refreshGamification: () => Promise<void>;
  refreshFarm: (profileId: string) => Promise<void>;
  resetProfiles: () => void;
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useVaultProfiles(
  vaultRef: React.MutableRefObject<VaultManager | null>,
  setGamiData: Dispatch<SetStateAction<GamificationData | null>>,
  tasksHookSetTasks: Dispatch<SetStateAction<Task[]>>,
): UseVaultProfilesResult {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [activeProfileId, setActiveProfileId] = useState<string | null>(null);
  const [ageUpgrades, setAgeUpgrades] = useState<AgeUpgrade[]>([]);

  // ─── Computed ────────────────────────────────────────────────────────────────

  const activeProfile = profiles.find((p) => p.id === activeProfileId) ?? null;

  // ─── Actions ─────────────────────────────────────────────────────────────────

  const setActiveProfile = useCallback(async (profileId: string) => {
    await SecureStore.setItemAsync(ACTIVE_PROFILE_KEY, profileId);
    setActiveProfileId(profileId);
  }, []);

  const updateProfileTheme = useCallback(async (profileId: string, theme: ProfileTheme) => {
    if (!vaultRef.current) return;
    return enqueueWrite(async () => {
      try {
        const content = await vaultRef.current!.readFile(FAMILLE_FILE);
        const lines = content.split('\n');
        let inSection = false;
        let themeLineIdx = -1;
        let lastPropIdx = -1;

        for (let i = 0; i < lines.length; i++) {
          if (lines[i].startsWith('### ')) {
            if (inSection) break; // hit next section, stop
            if (lines[i].replace('### ', '').trim() === profileId) {
              inSection = true;
            }
          } else if (inSection && lines[i].includes(': ')) {
            lastPropIdx = i;
            if (lines[i].trim().startsWith('theme:')) {
              themeLineIdx = i;
            }
          }
        }

        if (themeLineIdx >= 0) {
          lines[themeLineIdx] = `theme: ${theme}`;
        } else if (lastPropIdx >= 0) {
          lines.splice(lastPropIdx + 1, 0, `theme: ${theme}`);
        }

        await vaultRef.current!.writeFile(FAMILLE_FILE, lines.join('\n'));

        // Update local profile state
        setProfiles((prev) =>
          prev.map((p) => (p.id === profileId ? { ...p, theme } : p))
        );
      } catch (e) {
        throw new Error(`updateProfileTheme: ${e}`);
      }
    });
  }, []);

  const renameGarden = useCallback(async (profileId: string, name: string) => {
    if (!vaultRef.current) return;
    try {
      const file = farmFile(profileId);
      const content = await vaultRef.current.readFile(file).catch(() => '');
      const farmData = parseFarmProfile(content);
      farmData.gardenName = name || undefined;
      const profileName = profiles.find(p => p.id === profileId)?.name ?? profileId;
      await vaultRef.current.writeFile(file, serializeFarmProfile(profileName, farmData));
      setProfiles((prev) =>
        prev.map((p) => (p.id === profileId ? { ...p, gardenName: name || undefined } : p))
      );
    } catch (e) {
      throw new Error(`renameGarden: ${e}`);
    }
  }, [profiles]);

  const updateTreeSpecies = useCallback(async (profileId: string, species: string) => {
    if (!vaultRef.current) return;
    try {
      const file = farmFile(profileId);
      const content = await vaultRef.current.readFile(file).catch(() => '');
      const farmData = parseFarmProfile(content);
      farmData.treeSpecies = species as TreeSpecies;
      const profileName = profiles.find(p => p.id === profileId)?.name ?? profileId;
      await vaultRef.current.writeFile(file, serializeFarmProfile(profileName, farmData));
      setProfiles((prev) =>
        prev.map((p) => (p.id === profileId ? { ...p, treeSpecies: species as TreeSpecies } : p))
      );
    } catch (e) {
      throw new Error(`updateTreeSpecies: ${e}`);
    }
  }, [profiles]);

  /** Acheter une décoration ou un habitant pour l'arbre mascotte */
  const buyMascotItem = useCallback(async (profileId: string, itemId: string, itemType: 'decoration' | 'inhabitant') => {
    if (!vaultRef.current) return;

    const catalog = itemType === 'decoration' ? DECORATIONS : INHABITANTS;
    const item = catalog.find((d: any) => d.id === itemId);
    if (!item) throw new Error(`Item ${itemId} non trouvé`);

    const profile = profiles.find((p) => p.id === profileId);
    if (!profile) throw new Error(`Profil ${profileId} non trouvé`);

    // Vérifier si déjà acheté
    const owned = itemType === 'decoration' ? profile.mascotDecorations : profile.mascotInhabitants;
    if (owned.includes(itemId)) throw new Error(`${itemId} déjà acheté`);

    // Vérifier le stade minimum
    const level = calculateLevel(profile.points);
    const currentStageIdx = getStageIndex(level);
    const minStageIdx = TREE_STAGES.findIndex((s: any) => s.stage === item.minStage);
    if (currentStageIdx < minStageIdx) throw new Error(`Stade insuffisant`);

    // Vérifier les feuilles (monnaie dépensable)
    const currentCoins = profile.coins ?? profile.points;
    if (currentCoins < item.cost) throw new Error(`Feuilles insuffisantes`);

    try {
      // 1. Déduire les points dans gami-{profileId}.md
      const file = gamiFile(profileId);
      const gamiContent = await vaultRef.current.readFile(file).catch(() => '');
      const gami = parseGamification(gamiContent);
      const gamiProfile = gami.profiles.find((p) => p.id === profileId || p.name.toLowerCase().replace(/\s+/g, '') === profileId.toLowerCase());
      if (gamiProfile) {
        // Déduire les feuilles uniquement — l'XP (points) ne diminue jamais
        gamiProfile.coins = (gamiProfile.coins ?? gamiProfile.points) - item.cost;
        gami.history.push({
          profileId,
          action: `-${item.cost}`,
          points: -item.cost,
          note: `🍃 Achat : ${itemId} (${itemType})`,
          timestamp: new Date().toISOString(),
        });
      }
      const singleData: GamificationData = {
        profiles: gami.profiles.filter(p => p.id === profileId || p.name.toLowerCase().replace(/\s+/g, '') === profileId.toLowerCase()),
        history: gami.history.filter(e => e.profileId === profileId),
        activeRewards: (gami.activeRewards ?? []).filter(r => r.profileId === profileId),
        usedLoots: (gami.usedLoots ?? []).filter(u => u.profileId === profileId),
      };
      await vaultRef.current.writeFile(file, serializeGamification(singleData));

      // 3. Référence au profil gami mis à jour (définie pour closure)
      const updatedGamiProfile = gami.profiles.find(p => p.id === profileId || p.name.toLowerCase().replace(/\s+/g, '') === profileId.toLowerCase());

      // 2. Ajouter l'item dans farm-{profileId}.md
      const fp = farmFile(profileId);
      const farmContent = await vaultRef.current.readFile(fp).catch(() => '');
      const farmData = parseFarmProfile(farmContent);
      const newList = [...owned, itemId];
      if (itemType === 'decoration') {
        farmData.mascotDecorations = newList;
      } else {
        farmData.mascotInhabitants = newList;
      }
      const profileNameForFarm = profiles.find(p => p.id === profileId)?.name ?? profileId;
      await vaultRef.current.writeFile(fp, serializeFarmProfile(profileNameForFarm, farmData));

      // Mettre à jour l'état local
      setProfiles(prev => prev.map(p => {
        if (p.id !== profileId) return p;
        return {
          ...p,
          mascotDecorations: itemType === 'decoration' ? newList : p.mascotDecorations,
          mascotInhabitants: itemType === 'inhabitant' ? newList : p.mascotInhabitants,
          coins: updatedGamiProfile ? (updatedGamiProfile.coins ?? updatedGamiProfile.points) : p.coins,
        };
      }));

      // Mettre à jour l'état gami (hors queue — fichier différent)
      setGamiData(prev => {
        if (!prev || !updatedGamiProfile) return prev;
        return {
          ...prev,
          profiles: prev.profiles.map(p => (p.id === profileId || p.name.toLowerCase().replace(/\s+/g, '') === profileId.toLowerCase()) ? updatedGamiProfile : p),
          history: [...prev.history, ...gami.history.filter(e => e.profileId === profileId && !prev.history.some(h => h.timestamp === e.timestamp))],
        };
      });
    } catch (e) {
      throw new Error(`buyMascotItem: ${e}`);
    }
  }, [profiles]);

  /** Placer un item acheté sur un slot de la scène */
  const placeMascotItem = useCallback(async (profileId: string, slotId: string, itemId: string) => {
    if (!vaultRef.current) return;

    const profile = profiles.find((p) => p.id === profileId);
    if (!profile) throw new Error(`Profil ${profileId} non trouvé`);

    try {
      const fp = farmFile(profileId);
      const farmContent = await vaultRef.current.readFile(fp).catch(() => '');
      const farmData = parseFarmProfile(farmContent);

      // Récupérer les placements actuels et mettre à jour
      const placements = { ...(farmData.mascotPlacements ?? {}) };
      // Retirer l'item s'il est déjà placé ailleurs
      for (const [existingSlot, existingItem] of Object.entries(placements)) {
        if (existingItem === itemId) delete placements[existingSlot];
      }
      placements[slotId] = itemId;
      farmData.mascotPlacements = placements;

      const profileName = profiles.find(p => p.id === profileId)?.name ?? profileId;
      await vaultRef.current.writeFile(fp, serializeFarmProfile(profileName, farmData));

      setProfiles(prev => prev.map(p =>
        p.id === profileId ? { ...p, mascotPlacements: placements } : p
      ));
    } catch (e) {
      throw new Error(`placeMascotItem: ${e}`);
    }
  }, [profiles]);

  /** Retirer un item placé (décoration ou habitant) de son slot */
  const unplaceMascotItem = useCallback(async (profileId: string, slotId: string) => {
    if (!vaultRef.current) return;

    const profile = profiles.find((p) => p.id === profileId);
    if (!profile) throw new Error(`Profil ${profileId} non trouvé`);
    const placements = { ...(profile.mascotPlacements ?? {}) };
    if (!placements[slotId]) return; // rien à retirer

    try {
      delete placements[slotId];

      const fp = farmFile(profileId);
      const farmContent = await vaultRef.current.readFile(fp).catch(() => '');
      const farmData = parseFarmProfile(farmContent);
      farmData.mascotPlacements = placements;

      const profileName = profiles.find(p => p.id === profileId)?.name ?? profileId;
      await vaultRef.current.writeFile(fp, serializeFarmProfile(profileName, farmData));

      setProfiles(prev => prev.map(p =>
        p.id === profileId ? { ...p, mascotPlacements: placements } : p
      ));
    } catch (e) {
      throw new Error(`unplaceMascotItem: ${e}`);
    }
  }, [profiles]);

  const updateProfile = useCallback(async (profileId: string, updates: { name?: string; avatar?: string; birthdate?: string; propre?: boolean; gender?: Gender; voiceElevenLabsId?: string; voiceFishAudioId?: string; voicePersonalId?: string; voiceSource?: 'ios-personal' | 'elevenlabs-cloned' | 'elevenlabs-preset' | 'fish-audio-cloned' | 'expo-speech' }) => {
    if (!vaultRef.current) return;
    try {
      const content = await vaultRef.current.readFile(FAMILLE_FILE);
      const lines = content.split('\n');
      let inSection = false;
      let sectionStart = -1;
      let sectionEnd = lines.length;

      for (let i = 0; i < lines.length; i++) {
        if (lines[i].startsWith('### ')) {
          if (inSection) { sectionEnd = i; break; }
          if (lines[i].replace('### ', '').trim() === profileId) {
            inSection = true;
            sectionStart = i;
          }
        }
      }

      if (sectionStart === -1) return;

      // Update each field in the section
      for (const [key, value] of Object.entries(updates)) {
        if (value === undefined) continue;
        let found = false;
        for (let i = sectionStart + 1; i < sectionEnd; i++) {
          if (lines[i].trim().startsWith(`${key}:`)) {
            lines[i] = `${key}: ${value}`;
            found = true;
            break;
          }
        }
        if (!found) {
          // Insert after the last property line in the section
          let lastProp = sectionStart;
          for (let i = sectionStart + 1; i < sectionEnd; i++) {
            if (lines[i].includes(': ')) lastProp = i;
          }
          lines.splice(lastProp + 1, 0, `${key}: ${value}`);
          sectionEnd++;
        }
      }

      const newFamilleContent = lines.join('\n');
      await vaultRef.current.writeFile(FAMILLE_FILE, newFamilleContent);

      // Propager le renommage dans gami-{profileId}.md si le nom a changé
      // (l'ID du profil reste stable — seul le contenu interne change, pas le nom du fichier)
      if (updates.name) {
        try {
          const file = gamiFile(profileId);
          const gamiRaw = await vaultRef.current.readFile(file).catch(() => '');
          if (gamiRaw) {
            const gamiLines = gamiRaw.split('\n');
            // Trouver l'ancien nom du profil à partir du profileId
            const oldProfile = profiles.find(p => p.id === profileId);
            const oldName = oldProfile?.name;
            if (oldName && oldName !== updates.name) {
              for (let i = 0; i < gamiLines.length; i++) {
                // Renommer le header ## AncienNom → ## NouveauNom
                if (gamiLines[i] === `## ${oldName}`) {
                  gamiLines[i] = `## ${updates.name}`;
                }
                // Renommer aussi le champ name: si présent
                if (gamiLines[i].trim().startsWith('name:') && gamiLines[i].trim() === `name: ${oldName}`) {
                  gamiLines[i] = `name: ${updates.name}`;
                }
              }
              await vaultRef.current.writeFile(file, gamiLines.join('\n'));
            }
          }
        } catch (e) {
          warnUnexpected('updateProfile-rename-gami', e);
        }
      }

      // Mise à jour optimiste du state local
      try {
        const file = gamiFile(profileId);
        const profGamiContent = await vaultRef.current.readFile(file).catch(() => '');
        // Mise à jour partielle : seul le profil modifié change
        setProfiles(prev => {
          const parsed = parseFamille(newFamilleContent);
          return parsed.map(base => {
            const existing = prev.find(p => p.id === base.id);
            if (!existing) return { ...base, points: 0, coins: 0, level: 1, streak: 0, lootBoxesAvailable: 0, multiplier: 1, multiplierRemaining: 0, pityCounter: 0 };
            if (base.id === profileId && profGamiContent) {
              const profGami = parseGamification(profGamiContent);
              const gamiProf = profGami.profiles[0];
              return {
                ...base,
                points: gamiProf?.points ?? existing.points,
                coins: gamiProf?.coins ?? gamiProf?.points ?? existing.coins,
                level: gamiProf?.level ?? existing.level,
                streak: gamiProf?.streak ?? existing.streak,
                lootBoxesAvailable: gamiProf?.lootBoxesAvailable ?? existing.lootBoxesAvailable,
                multiplier: gamiProf?.multiplier ?? existing.multiplier,
                multiplierRemaining: gamiProf?.multiplierRemaining ?? existing.multiplierRemaining,
                pityCounter: gamiProf?.pityCounter ?? existing.pityCounter,
              };
            }
            return { ...base, points: existing.points, coins: existing.coins, level: existing.level, streak: existing.streak, lootBoxesAvailable: existing.lootBoxesAvailable, multiplier: existing.multiplier, multiplierRemaining: existing.multiplierRemaining, pityCounter: existing.pityCounter };
          });
        });
      } catch (e) {
        warnUnexpected('updateProfile-optimistic', e);
        setProfiles(prev => prev.map(p => p.id === profileId ? { ...p, ...updates } : p));
      }
    } catch (e) {
      throw new Error(`updateProfile: ${e}`);
    }
  }, []);

  const deleteProfile = useCallback(async (profileId: string) => {
    if (!vaultRef.current) return;
    try {
      const content = await vaultRef.current.readFile(FAMILLE_FILE);
      const lines = content.split('\n');
      let sectionStart = -1;
      let sectionEnd = lines.length;

      for (let i = 0; i < lines.length; i++) {
        if (lines[i].startsWith('### ')) {
          if (sectionStart >= 0) { sectionEnd = i; break; }
          if (lines[i].replace('### ', '').trim() === profileId) {
            sectionStart = i;
          }
        }
      }

      if (sectionStart === -1) return;

      // Supprimer les lignes du profil
      lines.splice(sectionStart, sectionEnd - sectionStart);
      // Nettoyer les lignes vides consécutives
      const cleaned = lines.join('\n').replace(/\n{3,}/g, '\n\n');
      await vaultRef.current.writeFile(FAMILLE_FILE, cleaned);

      // Mise à jour optimiste du state local
      setProfiles(prev => prev.filter(p => p.id !== profileId));
    } catch (e) {
      throw new Error(`deleteProfile: ${e}`);
    }
  }, []);

  /** Apply age upgrade: regenerate tasks file + update ageCategory in famille.md */
  const applyAgeUpgrade = useCallback(async (upgrade: AgeUpgrade) => {
    if (!vaultRef.current) return;
    const vault = vaultRef.current;
    const profile = profiles.find((p) => p.id === upgrade.profileId);
    if (!profile) return;

    // Regenerate tasks file with new age category templates
    const today = format(new Date(), 'yyyy-MM-dd');
    const tasksPath = `01 - Enfants/${upgrade.childName}/Tâches récurrentes.md`;
    const slug = upgrade.childName.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '-');
    const catLabels: Record<AgeCategory, string> = { bebe: 'bébé', petit: 'petit', enfant: 'enfant', ado: 'ado' };
    const taskTemplates: Record<AgeCategory, string> = {
      bebe: `## Quotidien\n- [ ] Préparer les biberons 🔁 every day 📅 ${today}\n- [ ] Laver biberons / tétines 🔁 every day 📅 ${today}\n- [ ] Vider la poubelle à couches 🔁 every day 📅 ${today}\n- [ ] Nettoyer le tapis à langer 🔁 every day 📅 ${today}\n- [ ] Bain 🔁 every day 📅 ${today}\n- [ ] Vérifier le stock de couches 🔁 every day 📅 ${today}\n- [ ] Vérifier le stock de lait 🔁 every day 📅 ${today}\n\n## Hebdomadaire\n- [ ] Laver le linge bébé 🔁 every week 📅 ${today}\n- [ ] Stériliser les accessoires 🔁 every week 📅 ${today}\n- [ ] Nettoyer le lit / berceau 🔁 every week 📅 ${today}\n\n## Mensuel\n- [ ] Vérifier la taille des vêtements 🔁 every month 📅 ${today}\n- [ ] Trier les vêtements trop petits 🔁 every month 📅 ${today}\n- [ ] Vérifier les produits de soin 🔁 every month 📅 ${today}\n`,
      petit: `## Quotidien\n- [ ] Brossage de dents matin 🔁 every day 📅 ${today}\n- [ ] Brossage de dents soir 🔁 every day 📅 ${today}\n- [ ] S'habiller tout seul 🔁 every day 📅 ${today}\n- [ ] Ranger les jouets 🔁 every day 📅 ${today}\n- [ ] Bain / douche 🔁 every day 📅 ${today}\n\n## Hebdomadaire\n- [ ] Laver le linge 🔁 every week 📅 ${today}\n- [ ] Nettoyer la chambre 🔁 every week 📅 ${today}\n- [ ] Activité / sortie 🔁 every week 📅 ${today}\n\n## Mensuel\n- [ ] Vérifier la taille des vêtements 🔁 every month 📅 ${today}\n- [ ] Vérifier les chaussures 🔁 every month 📅 ${today}\n- [ ] Trier les jouets 🔁 every month 📅 ${today}\n`,
      enfant: `## Quotidien\n- [ ] Préparer le cartable 🔁 every day 📅 ${today}\n- [ ] Faire les devoirs 🔁 every day 📅 ${today}\n- [ ] Douche 🔁 every day 📅 ${today}\n- [ ] Ranger la chambre 🔁 every day 📅 ${today}\n\n## Hebdomadaire\n- [ ] Laver le linge 🔁 every week 📅 ${today}\n- [ ] Ranger le bureau 🔁 every week 📅 ${today}\n- [ ] Activité extra-scolaire 🔁 every week 📅 ${today}\n\n## Mensuel\n- [ ] Vérifier les fournitures scolaires 🔁 every month 📅 ${today}\n- [ ] Vérifier les vêtements 🔁 every month 📅 ${today}\n`,
      ado: `## Quotidien\n- [ ] Ranger la chambre 🔁 every day 📅 ${today}\n- [ ] Mettre le linge sale au panier 🔁 every day 📅 ${today}\n- [ ] Faire les devoirs 🔁 every day 📅 ${today}\n\n## Hebdomadaire\n- [ ] Faire sa lessive 🔁 every week 📅 ${today}\n- [ ] Ménage de la chambre 🔁 every week 📅 ${today}\n- [ ] Aider en cuisine 🔁 every week 📅 ${today}\n\n## Mensuel\n- [ ] Gérer son argent de poche 🔁 every month 📅 ${today}\n- [ ] Vérifier les fournitures scolaires 🔁 every month 📅 ${today}\n`,
    };

    const header = `---\ntags:\n  - taches\n  - ${slug}\n---\n> ← [[00 - Dashboard/Dashboard|Dashboard]]\n\n# Tâches récurrentes — ${upgrade.childName}\n\n`;
    await vault.writeFile(tasksPath, header + taskTemplates[upgrade.newCategory]);

    // Update ageCategory in famille.md
    const familleContent = await vault.readFile(FAMILLE_FILE);
    const lines = familleContent.split('\n');
    let inSection = false;
    let ageCatLineIdx = -1;
    let lastPropIdx = -1;

    for (let i = 0; i < lines.length; i++) {
      if (lines[i].startsWith('### ')) {
        if (inSection) break;
        if (lines[i].replace('### ', '').trim() === upgrade.profileId) {
          inSection = true;
        }
      } else if (inSection && lines[i].includes(': ')) {
        lastPropIdx = i;
        if (lines[i].trim().startsWith('ageCategory:')) {
          ageCatLineIdx = i;
        }
      }
    }

    if (ageCatLineIdx >= 0) {
      lines[ageCatLineIdx] = `ageCategory: ${upgrade.newCategory}`;
    } else if (lastPropIdx >= 0) {
      lines.splice(lastPropIdx + 1, 0, `ageCategory: ${upgrade.newCategory}`);
    }
    await vault.writeFile(FAMILLE_FILE, lines.join('\n'));

    // Remove this upgrade from the list
    setAgeUpgrades((prev) => prev.filter((u) => u.profileId !== upgrade.profileId));

    // Mise à jour optimiste des profils (ageCategory mis à jour)
    try {
      const newFamilleContent = lines.join('\n');
      // Merge partiel : les données gami n'ont pas changé
      setProfiles(prev => {
        const parsed = parseFamille(newFamilleContent);
        return parsed.map(base => {
          const existing = prev.find(p => p.id === base.id);
          if (!existing) return { ...base, points: 0, coins: 0, level: 1, streak: 0, lootBoxesAvailable: 0, multiplier: 1, multiplierRemaining: 0, pityCounter: 0 };
          return { ...base, points: existing.points, coins: existing.coins, level: existing.level, streak: existing.streak, lootBoxesAvailable: existing.lootBoxesAvailable, multiplier: existing.multiplier, multiplierRemaining: existing.multiplierRemaining, pityCounter: existing.pityCounter };
        });
      });
    } catch (e) {
      warnUnexpected('applyAgeUpgrade-optimistic', e);
      setProfiles(prev => prev.map(p =>
        p.id === upgrade.profileId ? { ...p, ageCategory: upgrade.newCategory } : p
      ));
    }

    // Re-parser les tâches du fichier régénéré
    try {
      const newTaskContent = await vault.readFile(tasksPath);
      const newTasks = parseTaskFile(tasksPath, newTaskContent);
      tasksHookSetTasks(prev => {
        const otherTasks = prev.filter(t => t.sourceFile !== tasksPath);
        return [...otherTasks, ...newTasks];
      });
    } catch (e) { warnUnexpected('applyAgeUpgrade-tasks', e); }
  }, [profiles]);

  /** Dismiss an age upgrade notification without applying */
  const dismissAgeUpgrade = useCallback((profileId: string) => {
    setAgeUpgrades((prev) => prev.filter((u) => u.profileId !== profileId));
  }, []);

  const addChild = useCallback(async (child: { name: string; avatar: string; birthdate: string; propre?: boolean; gender?: Gender; statut?: 'grossesse'; dateTerme?: string }) => {
    if (!vaultRef.current) return;
    await vaultRef.current.addChild(child);

    // Mise à jour optimiste des profils et gamification
    try {
      const familleContent = await vaultRef.current.readFile(FAMILLE_FILE);
      const allProfs = parseFamille(familleContent);
      const gamiFileResults = await Promise.allSettled(allProfs.map(p => vaultRef.current!.readFile(gamiFile(p.id))));
      const mergedGamiProfiles: any[] = [];
      const mergedGamiHistory: any[] = [];
      const mergedGamiActiveRewards: any[] = [];
      const mergedGamiUsedLoots: any[] = [];
      for (let i = 0; i < allProfs.length; i++) {
        const r = gamiFileResults[i];
        const c = r.status === 'fulfilled' ? r.value : '';
        if (!c) continue;
        const g = parseGamification(c);
        mergedGamiProfiles.push(...g.profiles);
        mergedGamiHistory.push(...g.history);
        mergedGamiActiveRewards.push(...(g.activeRewards ?? []));
        mergedGamiUsedLoots.push(...(g.usedLoots ?? []));
      }
      const mergedGami: GamificationData = { profiles: mergedGamiProfiles, history: mergedGamiHistory, activeRewards: mergedGamiActiveRewards, usedLoots: mergedGamiUsedLoots };
      const merged = mergeProfiles(familleContent, serializeGamification(mergedGami));
      setProfiles(merged);
      setGamiData(mergedGami);
    } catch (e) { warnUnexpected('addChild-optimistic', e); }
  }, []);

  const convertToBorn = useCallback(async (profileId: string, birthdate: string) => {
    if (!vaultRef.current) return;
    await vaultRef.current.convertToBorn(profileId, birthdate);

    // Mise à jour optimiste des profils
    try {
      const familleContent = await vaultRef.current.readFile(FAMILLE_FILE);
      // Merge partiel : gami non modifié, seule famille.md a changé (birthdate)
      setProfiles(prev => {
        const parsed = parseFamille(familleContent);
        return parsed.map(base => {
          const existing = prev.find(p => p.id === base.id);
          if (!existing) return { ...base, points: 0, coins: 0, level: 1, streak: 0, lootBoxesAvailable: 0, multiplier: 1, multiplierRemaining: 0, pityCounter: 0 };
          return { ...base, points: existing.points, coins: existing.coins, level: existing.level, streak: existing.streak, lootBoxesAvailable: existing.lootBoxesAvailable, multiplier: existing.multiplier, multiplierRemaining: existing.multiplierRemaining, pityCounter: existing.pityCounter };
        });
      });
    } catch (e) { warnUnexpected('convertToBorn-optimistic', e); }
  }, []);

  // ─── Refresh ───────────────────────────────────────────────────────────────

  const refreshGamification = useCallback(async () => {
    if (!vaultRef.current) return;
    try {
      const familleContent = await vaultRef.current.readFile(FAMILLE_FILE);
      const baseProfiles = parseFamille(familleContent);
      const [gamiFileResults, farmFileResults] = await Promise.all([
        Promise.allSettled(baseProfiles.map(p => vaultRef.current!.readFile(gamiFile(p.id)))),
        Promise.allSettled(baseProfiles.map(p => vaultRef.current!.readFile(farmFile(p.id)))),
      ]);
      const mergedProfiles: any[] = [];
      const mergedHistory: any[] = [];
      const mergedActiveRewards: any[] = [];
      const mergedUsedLoots: any[] = [];
      for (let i = 0; i < baseProfiles.length; i++) {
        const result = gamiFileResults[i];
        const content = result.status === 'fulfilled' ? result.value : '';
        if (!content) continue;
        const g = parseGamification(content);
        mergedProfiles.push(...g.profiles);
        mergedHistory.push(...g.history);
        mergedActiveRewards.push(...(g.activeRewards ?? []));
        mergedUsedLoots.push(...(g.usedLoots ?? []));
      }
      const farmDataByProfile: Record<string, FarmProfileData> = {};
      for (let i = 0; i < baseProfiles.length; i++) {
        const result = farmFileResults[i];
        const content = result.status === 'fulfilled' ? result.value : '';
        farmDataByProfile[baseProfiles[i].id] = parseFarmProfile(content);
      }
      const gami: GamificationData = {
        profiles: mergedProfiles,
        history: mergedHistory,
        activeRewards: mergedActiveRewards,
        usedLoots: mergedUsedLoots,
      };
      const gamiContent = serializeGamification(gami);
      const merged = mergeProfiles(familleContent, gamiContent);
      const mergedWithFarm = merged.map(p => ({
        ...p,
        ...(farmDataByProfile[p.id] ?? { mascotDecorations: [], mascotInhabitants: [], mascotPlacements: {} }),
      }));
      setProfiles(mergedWithFarm);
      setGamiData(gami);
    } catch (e) {
      warnUnexpected('refreshGamification', e);
    }
  }, []);

  const refreshFarm = useCallback(async (profileId: string) => {
    if (!vaultRef.current) return;
    try {
      const content = await vaultRef.current.readFile(farmFile(profileId));
      const farmData = parseFarmProfile(content);
      setProfiles(prev => prev.map(p =>
        p.id === profileId ? { ...p, ...farmData } : p
      ));
    } catch (e) {
      warnUnexpected('refreshFarm', e);
    }
  }, []);

  // ─── Reset ─────────────────────────────────────────────────────────────────

  const resetProfiles = useCallback(() => {
    setProfiles([]);
    setActiveProfileId(null);
    setAgeUpgrades([]);
  }, []);

  // ─── Return ────────────────────────────────────────────────────────────────

  return {
    profiles,
    setProfiles,
    activeProfileId,
    setActiveProfileId,
    activeProfile,
    ageUpgrades,
    setAgeUpgrades,
    setActiveProfile,
    updateProfileTheme,
    renameGarden,
    updateTreeSpecies,
    buyMascotItem,
    placeMascotItem,
    unplaceMascotItem,
    updateProfile,
    deleteProfile,
    applyAgeUpgrade,
    dismissAgeUpgrade,
    addChild,
    convertToBorn,
    refreshGamification,
    refreshFarm,
    resetProfiles,
  };
}
