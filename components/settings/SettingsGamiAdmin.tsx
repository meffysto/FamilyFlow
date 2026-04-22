/**
 * SettingsGamiAdmin.tsx — Panneau admin caché pour modifier les données de gamification
 *
 * Permet de modifier directement les valeurs de chaque profil :
 * - Points, coins, level, streak, loot boxes, multiplier, pity counter
 * - Bâtiments ferme (niveau)
 * - Inventaire ferme (oeuf, lait, farine, miel)
 * - Récoltes en stock
 */

import React, { useCallback, useRef, useState } from 'react';
import type { AppColors } from '../../constants/colors';
import { View, Text, StyleSheet, TextInput, Alert, TouchableOpacity, Modal } from 'react-native';
import { useTranslation } from 'react-i18next';
import { serializeGamification, parseFarmProfile, serializeFarmProfile } from '../../lib/parser';
import { useThemeColors } from '../../contexts/ThemeContext';
import { HarvestCardToast, type HarvestItem } from '../gamification/HarvestCardToast';
import { Button } from '../ui/Button';
import { Spacing, Radius } from '../../constants/spacing';
import { FontSize, FontWeight } from '../../constants/typography';
import { Shadows } from '../../constants/shadows';
import { calculateLevel } from '../../lib/gamification';
import { serializeBuildings, serializeInventory } from '../../lib/mascot/building-engine';
import { serializeHarvestInventory, serializeRareSeeds } from '../../lib/mascot/craft-engine';
import { TECH_TREE } from '../../lib/mascot/tech-engine';
import { getGradeEmoji, getGradeMultiplier } from '../../lib/mascot/grade-engine';
import type { Profile, GamificationData } from '../../lib/types';
import { CROP_CATALOG, type FarmInventory, type PlacedBuilding } from '../../lib/mascot/types';
import type { HarvestGrade } from '../../lib/mascot/grade-engine';
import type { CompanionData } from '../../lib/mascot/companion-types';

// ── Grades (FR) ──────────────────────────────────
const GRADES_FR: HarvestGrade[] = ['ordinaire', 'beau', 'superbe', 'parfait'];
const GRADE_EMOJI: Record<HarvestGrade, string> = {
  ordinaire: '⚪',
  beau: '🟢',
  superbe: '🟡',
  parfait: '🟣',
};

/** Split crops : classiques (plantables) vs rares/expédition (dropOnly). */
const REGULAR_CROPS = CROP_CATALOG.filter(c => !c.dropOnly);
const RARE_CROPS = CROP_CATALOG.filter(c => c.dropOnly);

interface SettingsGamiAdminProps {
  vault: any;
  profiles: Profile[];
  gamiData: GamificationData | null;
  refresh: () => Promise<void>;
}

/** Champ numérique éditable avec label */
function NumField({
  label,
  value,
  onChangeText,
  colors,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  colors: AppColors;
}) {
  return (
    <View style={styles.fieldRow}>
      <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>{label}</Text>
      <TextInput
        style={[styles.fieldInput, { color: colors.text, borderColor: colors.separator, backgroundColor: colors.bg }]}
        value={value}
        onChangeText={onChangeText}
        keyboardType="numeric"
        selectTextOnFocus
      />
    </View>
  );
}

/** Carte d'un profil avec tous ses champs éditables */
function ProfileCard({
  profile,
  gamiData,
  vault,
  refresh,
}: {
  profile: Profile;
  gamiData: GamificationData;
  vault: any;
  refresh: () => Promise<void>;
}) {
  const { colors, primary } = useThemeColors();
  const [expanded, setExpanded] = useState(false);

  // Champs gamification (gami-{id}.md)
  const [points, setPoints] = useState(String(profile.points ?? 0));
  const [coins, setCoins] = useState(String(profile.coins ?? 0));
  const [streak, setStreak] = useState(String(profile.streak ?? 0));
  const [lootBoxes, setLootBoxes] = useState(String(profile.lootBoxesAvailable ?? 0));
  const [multiplier, setMultiplier] = useState(String(profile.multiplier ?? 1));
  const [multiplierRemaining, setMultiplierRemaining] = useState(String(profile.multiplierRemaining ?? 0));
  const [pityCounter, setPityCounter] = useState(String(profile.pityCounter ?? 0));

  // Bâtiments ferme (famille.md)
  const buildings = profile.farmBuildings ?? [];
  const [buildingLevels, setBuildingLevels] = useState<Record<string, string>>(
    Object.fromEntries(buildings.map(b => [b.cellId, String(b.level)]))
  );

  // Inventaire ferme (famille.md)
  const inv = profile.farmInventory ?? { oeuf: 0, lait: 0, farine: 0, miel: 0 };
  const [oeuf, setOeuf] = useState(String(inv.oeuf));
  const [lait, setLait] = useState(String(inv.lait));
  const [farine, setFarine] = useState(String(inv.farine));
  const [miel, setMiel] = useState(String(inv.miel));

  // Récoltes — structure par grade : Record<cropId, Record<grade, string>>
  // Supporte l'ancien format (number direct = ordinaire) et le nouveau (per-grade)
  const harvestInv = profile.harvestInventory ?? {};
  const initHarvests = (): Record<string, Record<HarvestGrade, string>> => {
    const out: Record<string, Record<HarvestGrade, string>> = {};
    for (const crop of CROP_CATALOG) {
      const entry = (harvestInv as Record<string, unknown>)[crop.id];
      const row: Record<HarvestGrade, string> = { ordinaire: '', beau: '', superbe: '', parfait: '' };
      if (typeof entry === 'number') {
        row.ordinaire = entry > 0 ? String(entry) : '';
      } else if (entry && typeof entry === 'object') {
        for (const g of GRADES_FR) {
          const n = (entry as Partial<Record<HarvestGrade, number>>)[g] ?? 0;
          row[g] = n > 0 ? String(n) : '';
        }
      }
      out[crop.id] = row;
    }
    return out;
  };
  const [harvests, setHarvests] = useState<Record<string, Record<HarvestGrade, string>>>(initHarvests);
  const [harvestsExpanded, setHarvestsExpanded] = useState(false);

  // Graines rares — flat numbers (pas de grade, cf. RareSeedInventory)
  const rareSeeds = profile.farmRareSeeds ?? {};
  const initSeeds = (): Record<string, string> => {
    const out: Record<string, string> = {};
    for (const crop of RARE_CROPS) {
      const n = (rareSeeds as Record<string, number>)[crop.id] ?? 0;
      out[crop.id] = n > 0 ? String(n) : '';
    }
    return out;
  };
  const [seeds, setSeeds] = useState<Record<string, string>>(initSeeds);
  const [seedsExpanded, setSeedsExpanded] = useState(false);

  // Compagnon — outils test feedBuff / cooldown (Phase 42)
  const companion = profile.companion as CompanionData | undefined;

  // Technologies ferme
  const [unlockedTechs, setUnlockedTechs] = useState<Set<string>>(
    new Set(profile.farmTech ?? [])
  );

  const level = calculateLevel(parseInt(points, 10) || 0);

  const handleSave = useCallback(async () => {
    if (!vault) return;
    try {
      const numPoints = parseInt(points, 10) || 0;
      const numCoins = parseInt(coins, 10) || 0;

      // 1. Écrire gami-{id}.md
      const gamiProfile = gamiData.profiles.find(
        p => p.id === profile.id || p.name.toLowerCase().replace(/\s+/g, '') === profile.id.toLowerCase()
      );
      const updatedProfile = {
        ...(gamiProfile ?? profile),
        points: numPoints,
        coins: numCoins,
        level: calculateLevel(numPoints),
        streak: parseInt(streak, 10) || 0,
        lootBoxesAvailable: parseInt(lootBoxes, 10) || 0,
        multiplier: parseFloat(multiplier) || 1,
        multiplierRemaining: parseInt(multiplierRemaining, 10) || 0,
        pityCounter: parseInt(pityCounter, 10) || 0,
      };

      const singleData = {
        profiles: [updatedProfile],
        history: gamiData.history.filter(h => h.profileId === profile.id),
        activeRewards: gamiData.activeRewards.filter(r => r.profileId === profile.id),
        usedLoots: (gamiData.usedLoots ?? []).filter(u => u.profileId === profile.id),
      };
      await vault.writeFile(`gami-${profile.id}.md`, serializeGamification(singleData));

      // 2. Écrire les champs ferme dans farm-{id}.md
      const updatedBuildings: PlacedBuilding[] = buildings.map(b => ({
        ...b,
        level: parseInt(buildingLevels[b.cellId], 10) || b.level,
      }));
      const updatedInventory: FarmInventory = {
        oeuf: parseInt(oeuf, 10) || 0,
        lait: parseInt(lait, 10) || 0,
        farine: parseInt(farine, 10) || 0,
        miel: parseInt(miel, 10) || 0,
      };
      // Harvest : reconstruire en format per-grade, ne garder que les crops avec >0 pour au moins un grade
      const updatedHarvest: Record<string, Partial<Record<HarvestGrade, number>>> = {};
      for (const [cropId, row] of Object.entries(harvests)) {
        const grades: Partial<Record<HarvestGrade, number>> = {};
        let hasAny = false;
        for (const g of GRADES_FR) {
          const n = parseInt(row[g] ?? '', 10) || 0;
          if (n > 0) { grades[g] = n; hasAny = true; }
        }
        if (hasAny) updatedHarvest[cropId] = grades;
      }
      // Seeds : flat numbers
      const updatedSeeds: Record<string, number> = {};
      for (const [cropId, v] of Object.entries(seeds)) {
        const n = parseInt(v, 10) || 0;
        if (n > 0) updatedSeeds[cropId] = n;
      }

      const farmPath = `farm-${profile.id}.md`;
      const farmContent = await vault.readFile(farmPath).catch(() => '');
      const farmData = parseFarmProfile(farmContent);
      farmData.farmBuildings = updatedBuildings;
      farmData.farmInventory = updatedInventory;
      farmData.harvestInventory = updatedHarvest;
      farmData.farmRareSeeds = updatedSeeds;
      farmData.farmTech = Array.from(unlockedTechs);
      await vault.writeFile(farmPath, serializeFarmProfile(profile.name, farmData));

      await refresh();
      Alert.alert('Admin', `${profile.avatar} ${profile.name} mis à jour`);
    } catch (e: any) {
      Alert.alert('Erreur', e.message ?? String(e));
    }
  }, [
    vault, profile, gamiData, points, coins, streak, lootBoxes,
    multiplier, multiplierRemaining, pityCounter, buildings,
    buildingLevels, oeuf, lait, farine, miel, harvests, seeds, unlockedTechs, refresh,
  ]);

  return (
    <View style={[styles.card, { backgroundColor: colors.card }, Shadows.sm]}>
      <TouchableOpacity
        style={styles.cardHeader}
        onPress={() => setExpanded(e => !e)}
        activeOpacity={0.7}
      >
        <Text style={[styles.cardTitle, { color: colors.text }]}>
          {profile.avatar} {profile.name}
        </Text>
        <Text style={[styles.cardSubtitle, { color: colors.textMuted }]}>
          Niv. {level} · {points} XP · {coins} coins
        </Text>
        <Text style={[styles.chevron, { color: colors.textFaint }]}>
          {expanded ? '▼' : '▶'}
        </Text>
      </TouchableOpacity>

      {expanded && (
        <View style={styles.cardBody}>
          {/* ── Gamification ── */}
          <Text style={[styles.sectionLabel, { color: primary }]}>Gamification</Text>
          <NumField label="Points (XP)" value={points} onChangeText={setPoints} colors={colors} />
          <NumField label="Coins (feuilles)" value={coins} onChangeText={setCoins} colors={colors} />
          <NumField label="Streak (jours)" value={streak} onChangeText={setStreak} colors={colors} />
          <NumField label="Loot boxes" value={lootBoxes} onChangeText={setLootBoxes} colors={colors} />
          <NumField label="Multiplicateur" value={multiplier} onChangeText={setMultiplier} colors={colors} />
          <NumField label="Mult. restant" value={multiplierRemaining} onChangeText={setMultiplierRemaining} colors={colors} />
          <NumField label="Pity counter" value={pityCounter} onChangeText={setPityCounter} colors={colors} />

          <Text style={[styles.levelHint, { color: colors.textFaint }]}>
            Niveau calculé : {calculateLevel(parseInt(points, 10) || 0)}
          </Text>

          {/* ── Bâtiments ferme ── */}
          {buildings.length > 0 && (
            <>
              <Text style={[styles.sectionLabel, { color: primary }]}>Bâtiments</Text>
              {buildings.map(b => (
                <NumField
                  key={b.cellId}
                  label={`${b.buildingId} (${b.cellId})`}
                  value={buildingLevels[b.cellId] ?? String(b.level)}
                  onChangeText={v => setBuildingLevels(prev => ({ ...prev, [b.cellId]: v }))}
                  colors={colors}
                />
              ))}
            </>
          )}

          {/* ── Inventaire ferme ── */}
          <Text style={[styles.sectionLabel, { color: primary }]}>Inventaire ferme</Text>
          <NumField label="Oeuf" value={oeuf} onChangeText={setOeuf} colors={colors} />
          <NumField label="Lait" value={lait} onChangeText={setLait} colors={colors} />
          <NumField label="Farine" value={farine} onChangeText={setFarine} colors={colors} />
          <NumField label="Miel" value={miel} onChangeText={setMiel} colors={colors} />

          {/* ── Récoltes (tous crops, par grade) ── */}
          <TouchableOpacity
            onPress={() => setHarvestsExpanded(e => !e)}
            activeOpacity={0.7}
            style={styles.subHeader}
          >
            <Text style={[styles.sectionLabel, { color: primary, marginTop: 0 }]}>
              Récoltes en stock ({REGULAR_CROPS.length} crops × 4 grades)
            </Text>
            <Text style={[styles.chevron, { color: colors.textFaint }]}>
              {harvestsExpanded ? '▼' : '▶'}
            </Text>
          </TouchableOpacity>
          {harvestsExpanded && (
            <>
              <View style={styles.gradeHeader}>
                <Text style={[styles.gradeHeaderLabel, { color: colors.textFaint }]}>Crop</Text>
                {GRADES_FR.map(g => (
                  <Text key={g} style={[styles.gradeHeaderCell, { color: colors.textFaint }]}>
                    {GRADE_EMOJI[g]}
                  </Text>
                ))}
              </View>
              {REGULAR_CROPS.map(crop => (
                <View key={crop.id} style={styles.gradeRow}>
                  <Text style={[styles.cropLabel, { color: colors.text }]} numberOfLines={1}>
                    {crop.emoji} {crop.id}
                  </Text>
                  {GRADES_FR.map(g => (
                    <TextInput
                      key={g}
                      style={[styles.gradeInput, { color: colors.text, borderColor: colors.separator, backgroundColor: colors.bg }]}
                      value={harvests[crop.id]?.[g] ?? ''}
                      onChangeText={v => setHarvests(prev => ({
                        ...prev,
                        [crop.id]: { ...prev[crop.id], [g]: v },
                      }))}
                      keyboardType="numeric"
                      selectTextOnFocus
                      placeholder="0"
                      placeholderTextColor={colors.textFaint}
                    />
                  ))}
                </View>
              ))}
              <View style={styles.quickActionRow}>
                <TouchableOpacity
                  style={[styles.quickBtn, { borderColor: primary + '40', backgroundColor: primary + '12' }]}
                  onPress={() => {
                    const filled: Record<string, Record<HarvestGrade, string>> = {};
                    for (const crop of REGULAR_CROPS) {
                      filled[crop.id] = { ordinaire: '10', beau: '5', superbe: '2', parfait: '1' };
                    }
                    setHarvests(prev => ({ ...prev, ...filled }));
                  }}
                >
                  <Text style={[styles.quickBtnText, { color: primary }]}>🌾 Remplir tout (10/5/2/1)</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.quickBtn, { borderColor: colors.separator }]}
                  onPress={() => {
                    const empty: Record<string, Record<HarvestGrade, string>> = {};
                    for (const crop of REGULAR_CROPS) {
                      empty[crop.id] = { ordinaire: '', beau: '', superbe: '', parfait: '' };
                    }
                    setHarvests(empty);
                  }}
                >
                  <Text style={[styles.quickBtnText, { color: colors.textMuted }]}>🗑 Vider</Text>
                </TouchableOpacity>
              </View>
            </>
          )}

          {/* ── Graines rares (drop-only + expédition) ── */}
          <TouchableOpacity
            onPress={() => setSeedsExpanded(e => !e)}
            activeOpacity={0.7}
            style={styles.subHeader}
          >
            <Text style={[styles.sectionLabel, { color: primary, marginTop: 0 }]}>
              Graines rares ({RARE_CROPS.length})
            </Text>
            <Text style={[styles.chevron, { color: colors.textFaint }]}>
              {seedsExpanded ? '▼' : '▶'}
            </Text>
          </TouchableOpacity>
          {seedsExpanded && (
            <>
              {RARE_CROPS.map(crop => (
                <NumField
                  key={crop.id}
                  label={`${crop.emoji} ${crop.id}${crop.expeditionExclusive ? ' (expé)' : ''}`}
                  value={seeds[crop.id] ?? ''}
                  onChangeText={v => setSeeds(prev => ({ ...prev, [crop.id]: v }))}
                  colors={colors}
                />
              ))}
            </>
          )}

          {/* ── Compagnon (Phase 42) : reset cooldown + buff ── */}
          {companion && (
            <>
              <Text style={[styles.sectionLabel, { color: primary }]}>
                Compagnon — {companion.activeSpecies} {companion.name ? `« ${companion.name} »` : ''}
              </Text>
              <Text style={[styles.levelHint, { color: colors.textFaint, textAlign: 'left' }]}>
                {companion.lastFedAt ? `Dernier nourrissage : ${new Date(companion.lastFedAt).toLocaleString('fr-FR')}` : 'Jamais nourri'}
                {companion.feedBuff ? ` · Buff ×${companion.feedBuff.multiplier} jusqu'à ${new Date(companion.feedBuff.expiresAt).toLocaleTimeString('fr-FR')}` : ''}
              </Text>
              <View style={styles.quickActionRow}>
                <TouchableOpacity
                  style={[styles.quickBtn, { borderColor: primary + '40', backgroundColor: primary + '12' }]}
                  onPress={async () => {
                    try {
                      const farmPath = `farm-${profile.id}.md`;
                      const farmContent = await vault.readFile(farmPath).catch(() => '');
                      const farmData = parseFarmProfile(farmContent);
                      if (farmData.companion) {
                        farmData.companion = { ...farmData.companion, lastFedAt: undefined, feedBuff: null };
                        await vault.writeFile(farmPath, serializeFarmProfile(profile.name, farmData));
                        await refresh();
                        Alert.alert('🐾 Compagnon', 'Cooldown reset — prêt à être nourri !');
                      }
                    } catch (e: any) {
                      Alert.alert('Erreur', e.message ?? String(e));
                    }
                  }}
                >
                  <Text style={[styles.quickBtnText, { color: primary }]}>⏱ Reset cooldown</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.quickBtn, { borderColor: primary + '40', backgroundColor: primary + '12' }]}
                  onPress={async () => {
                    try {
                      const farmPath = `farm-${profile.id}.md`;
                      const farmContent = await vault.readFile(farmPath).catch(() => '');
                      const farmData = parseFarmProfile(farmContent);
                      if (farmData.companion) {
                        const expiresAt = new Date(Date.now() + 90 * 60 * 1000).toISOString();
                        farmData.companion = {
                          ...farmData.companion,
                          feedBuff: { multiplier: 1.1950, expiresAt },
                        };
                        await vault.writeFile(farmPath, serializeFarmProfile(profile.name, farmData));
                        await refresh();
                        Alert.alert('✨ Compagnon', 'Buff +19.5% XP activé pour 1h30');
                      }
                    } catch (e: any) {
                      Alert.alert('Erreur', e.message ?? String(e));
                    }
                  }}
                >
                  <Text style={[styles.quickBtnText, { color: primary }]}>✨ Force buff max</Text>
                </TouchableOpacity>
              </View>
            </>
          )}

          {/* ── Technologies ferme ── */}
          <Text style={[styles.sectionLabel, { color: primary }]}>Technologies</Text>
          {TECH_TREE.map(node => {
            const unlocked = unlockedTechs.has(node.id);
            return (
              <TouchableOpacity
                key={node.id}
                style={styles.techRow}
                onPress={() => {
                  setUnlockedTechs(prev => {
                    const next = new Set(prev);
                    if (next.has(node.id)) next.delete(node.id);
                    else next.add(node.id);
                    return next;
                  });
                }}
                activeOpacity={0.7}
              >
                <Text style={[styles.techToggle, { color: unlocked ? '#22c55e' : colors.textFaint }]}>
                  {unlocked ? '✅' : '⬜'}
                </Text>
                <Text style={[styles.techLabel, { color: unlocked ? colors.text : colors.textMuted }]}>
                  {node.emoji} {node.id} ({node.branch} {node.order}) — {node.cost} 🍃
                </Text>
              </TouchableOpacity>
            );
          })}

          {__DEV__ && (
            <View style={styles.saveBtn}>
              <Button
                label="🧪 Seed grades (dev)"
                onPress={async () => {
                  try {
                    const farmPath = `farm-${profile.id}.md`;
                    const farmContent = await vault.readFile(farmPath).catch(() => '');
                    const farmData = parseFarmProfile(farmContent);
                    const techs = new Set(farmData.farmTech ?? []);
                    for (const id of ['culture-1', 'culture-2', 'culture-3', 'culture-4', 'culture-5']) {
                      techs.add(id);
                    }
                    farmData.farmTech = Array.from(techs);
                    const gradedSeed = { ordinaire: 10, beau: 5, superbe: 2, parfait: 1 };
                    farmData.harvestInventory = {
                      ...(farmData.harvestInventory ?? {}),
                      tomato: gradedSeed,
                      potato: gradedSeed,
                      carrot: gradedSeed,
                      wheat: gradedSeed,
                      cabbage: gradedSeed,
                    };
                    await vault.writeFile(farmPath, serializeFarmProfile(profile.name, farmData));
                    await refresh();
                    Alert.alert('🧪 Seed grades', `${profile.avatar} ${profile.name} — techs culture-1→5 + 5 cultures avec mix de grades (10/5/2/1)`);
                  } catch (e: any) {
                    Alert.alert('Erreur', e.message ?? String(e));
                  }
                }}
              />
            </View>
          )}

          <View style={styles.saveBtn}>
            <Button label="Sauvegarder" onPress={handleSave} />
          </View>
        </View>
      )}
    </View>
  );
}

// ── Crops de test pour HarvestCardToast ───────────────────────────────────
const TEST_CROPS = [
  { emoji: '🍅', label: 'Tomate récoltée !', qty: 12 },
  { emoji: '🥕', label: 'Carotte récoltée !', qty: 8 },
  { emoji: '🌽', label: 'Maïs récolté !', qty: 20 },
  { emoji: '🍓', label: '✨ Fraise dorée récoltée !', qty: 60 },
  { emoji: '🌾', label: 'Blé récolté !', qty: 5 },
];

export function HarvestCardTest() {
  const { colors, primary } = useThemeColors();
  const [expanded, setExpanded] = useState(true);

  // État local — le toast global est rendu derrière le modal pageSheet,
  // on rend donc une instance locale qui overlay l'intérieur du modal.
  const [items, setItems] = useState<HarvestItem[]>([]);
  const [visible, setVisible] = useState(false);
  const [hasLoot, setHasLoot] = useState(false);
  const [sparkleKey, setSparkleKey] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const visibleRef = useRef(false);

  const hideHarvest = useCallback(() => {
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
    visibleRef.current = false;
    setVisible(false);
    setTimeout(() => { setItems([]); setHasLoot(false); }, 400);
  }, []);

  const showHarvestCard = useCallback((item: HarvestItem, loot?: boolean) => {
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
    setItems(prev => {
      const existing = prev.find(i => i.emoji === item.emoji);
      if (existing) {
        return prev.map(i => i.emoji === item.emoji
          ? { ...i, qty: i.qty + item.qty, wager: item.wager ?? i.wager, grade: item.grade ?? i.grade }
          : i);
      }
      return [...prev, item];
    });
    if (loot) setHasLoot(true);
    if (!visibleRef.current) { visibleRef.current = true; setVisible(true); }
    setSparkleKey(k => k + 1);
    timerRef.current = setTimeout(() => { hideHarvest(); timerRef.current = null; }, 3000);
  }, [hideHarvest]);

  return (
    <View style={[styles.card, { backgroundColor: colors.card }, Shadows.sm]}>
      <TouchableOpacity
        style={styles.cardHeader}
        onPress={() => setExpanded(e => !e)}
        activeOpacity={0.7}
      >
        <Text style={[styles.cardTitle, { color: colors.text }]}>🌾 Test HarvestCardToast</Text>
        <Text style={[styles.cardSubtitle, { color: colors.textMuted }]}>
          Tester l'accumulation live
        </Text>
        <Text style={[styles.chevron, { color: colors.textFaint }]}>{expanded ? '▼' : '▶'}</Text>
      </TouchableOpacity>

      {expanded && (
        <View style={styles.cardBody}>
          <Text style={[styles.sectionLabel, { color: primary }]}>Récoltes individuelles</Text>
          <Text style={[styles.levelHint, { color: colors.textFaint }]}>
            Tape plusieurs fois le même bouton → observe l'accumulation (merge qty + pulse)
          </Text>

          {TEST_CROPS.map(crop => (
            <TouchableOpacity
              key={crop.emoji}
              style={[styles.testBtn, { backgroundColor: primary + '20', borderColor: primary + '40' }]}
              onPress={() => showHarvestCard({ emoji: crop.emoji, label: crop.label, qty: crop.qty }, crop.emoji === '🍓')}
              activeOpacity={0.7}
            >
              <Text style={[styles.testBtnText, { color: colors.text }]}>
                {crop.emoji}  {crop.label}  <Text style={{ color: primary }}>+{crop.qty} 🍂</Text>
              </Text>
            </TouchableOpacity>
          ))}

          <Text style={[styles.sectionLabel, { color: primary }]}>Stress test</Text>
          <Text style={[styles.levelHint, { color: colors.textFaint }]}>
            Déclenche 5 récoltes différentes en rafale → tous les chips doivent s'accumuler
          </Text>
          <TouchableOpacity
            style={[styles.testBtn, { backgroundColor: '#ef444420', borderColor: '#ef444440' }]}
            onPress={() => {
              TEST_CROPS.forEach((crop, i) => {
                setTimeout(() => {
                  showHarvestCard({ emoji: crop.emoji, label: crop.label, qty: crop.qty }, crop.emoji === '🍓');
                }, i * 300);
              });
            }}
            activeOpacity={0.7}
          >
            <Text style={[styles.testBtnText, { color: '#ef4444' }]}>
              🚀  Rafale × 5 cultures (300ms d'écart)
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.testBtn, { backgroundColor: '#ef444420', borderColor: '#ef444440' }]}
            onPress={() => {
              // Même culture × 8 fois rapidement → qty doit s'additionner
              for (let i = 0; i < 8; i++) {
                setTimeout(() => {
                  showHarvestCard({ emoji: '🍅', label: 'Tomate récoltée !', qty: 12 });
                }, i * 200);
              }
            }}
            activeOpacity={0.7}
          >
            <Text style={[styles.testBtnText, { color: '#ef4444' }]}>
              🔁  Même culture × 8 (merge qty : attendu +96 🍂)
            </Text>
          </TouchableOpacity>

          <Text style={[styles.sectionLabel, { color: primary }]}>Grades de récolte</Text>
          <Text style={[styles.levelHint, { color: colors.textFaint }]}>
            Badge grade + bonus coins sur le chip (Phase A GRADE-04)
          </Text>
          {(['beau', 'superbe', 'parfait'] as const).map(g => {
            const bonus = Math.round(12 * (getGradeMultiplier(g) - 1));
            return (
              <TouchableOpacity
                key={g}
                style={[styles.testBtn, { backgroundColor: primary + '20', borderColor: primary + '40' }]}
                onPress={() => showHarvestCard({
                  emoji: '🍅',
                  label: `Tomate ${g} !`,
                  qty: 12,
                  grade: { key: g, bonusCoins: bonus, emoji: getGradeEmoji(g) },
                })}
                activeOpacity={0.7}
              >
                <Text style={[styles.testBtnText, { color: colors.text }]}>
                  {getGradeEmoji(g)}  Tomate {g}  <Text style={{ color: primary }}>×12 +{bonus} 🍃</Text>
                </Text>
              </TouchableOpacity>
            );
          })}

          <Text style={[styles.sectionLabel, { color: primary }]}>Sporée scellée (wager)</Text>
          <Text style={[styles.levelHint, { color: colors.textFaint }]}>
            Badge 🍄×N (won) et 🎁 (drop-back) — Phase 40
          </Text>
          <TouchableOpacity
            style={[styles.testBtn, { backgroundColor: '#FFD70020', borderColor: '#FFD70060' }]}
            onPress={() => showHarvestCard({
              emoji: '🍓',
              label: 'Fraise dorée !',
              qty: 30,
              wager: { won: true, multiplier: 3, dropBack: false },
            })}
            activeOpacity={0.7}
          >
            <Text style={[styles.testBtnText, { color: colors.text }]}>
              🍄  Wager won ×3 (fond doré)
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.testBtn, { backgroundColor: '#FFD70020', borderColor: '#FFD70060' }]}
            onPress={() => showHarvestCard({
              emoji: '🍓',
              label: 'Fraise dorée + drop-back !',
              qty: 60,
              wager: { won: true, multiplier: 5, dropBack: true },
            }, true)}
            activeOpacity={0.7}
          >
            <Text style={[styles.testBtnText, { color: colors.text }]}>
              🎁  Wager won ×5 + drop-back (loot badge)
            </Text>
          </TouchableOpacity>

          <Text style={[styles.sectionLabel, { color: primary }]}>Combo grade + wager</Text>
          <TouchableOpacity
            style={[styles.testBtn, { backgroundColor: primary + '20', borderColor: primary + '40' }]}
            onPress={() => showHarvestCard({
              emoji: '🌽',
              label: 'Maïs parfait + wager !',
              qty: 20,
              grade: { key: 'parfait', bonusCoins: 60, emoji: getGradeEmoji('parfait') },
              wager: { won: true, multiplier: 4, dropBack: true },
            }, true)}
            activeOpacity={0.7}
          >
            <Text style={[styles.testBtnText, { color: colors.text }]}>
              💎🍄  Parfait + wager ×4 + drop-back (full stack)
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Toast local dans un Modal transparent — overlay le sheet parent
          (le toast global du ToastProvider est rendu sous le sheet pageSheet) */}
      <Modal
        visible={visible || items.length > 0}
        transparent
        animationType="none"
        onRequestClose={hideHarvest}
      >
        <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
          <HarvestCardToast
            visible={visible}
            items={items}
            onDismiss={hideHarvest}
            hasLoot={hasLoot}
            sparkleKey={sparkleKey}
          />
        </View>
      </Modal>
    </View>
  );
}

export function SettingsGamiAdmin({ vault, profiles, gamiData, refresh }: SettingsGamiAdminProps) {
  const { colors } = useThemeColors();

  if (!gamiData || profiles.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={[styles.emptyText, { color: colors.textMuted }]}>
          Aucune donnée de gamification disponible
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={[styles.warning, { color: '#ef4444' }]}>
        Mode admin — Les modifications sont écrites directement dans le vault.
      </Text>
      {profiles.map(profile => (
        <ProfileCard
          key={profile.id}
          profile={profile}
          gamiData={gamiData}
          vault={vault}
          refresh={refresh}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: Spacing.lg },
  warning: {
    fontSize: FontSize.caption,
    fontWeight: FontWeight.medium,
    textAlign: 'center',
    paddingVertical: Spacing.sm,
  },
  card: {
    borderRadius: Radius.lg,
    overflow: 'hidden',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.lg,
    gap: Spacing.sm,
  },
  cardTitle: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.semibold,
  },
  cardSubtitle: {
    fontSize: FontSize.caption,
    flex: 1,
  },
  chevron: {
    fontSize: FontSize.body,
  },
  cardBody: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.lg,
    gap: Spacing.xs,
  },
  sectionLabel: {
    fontSize: FontSize.label,
    fontWeight: FontWeight.bold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: Spacing.md,
    marginBottom: Spacing.xs,
  },
  fieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.xs,
  },
  fieldLabel: {
    fontSize: FontSize.label,
    flex: 1,
  },
  fieldInput: {
    width: 100,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    fontSize: FontSize.label,
    textAlign: 'right',
  },
  levelHint: {
    fontSize: FontSize.micro,
    fontStyle: 'italic',
    textAlign: 'right',
    marginTop: Spacing.xs,
  },
  saveBtn: {
    marginTop: Spacing.lg,
  },
  techRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.xs,
    gap: Spacing.sm,
  },
  techToggle: {
    fontSize: FontSize.body,
  },
  techLabel: {
    fontSize: FontSize.label,
    flex: 1,
  },
  empty: {
    padding: Spacing['2xl'],
    alignItems: 'center',
  },
  emptyText: {
    fontSize: FontSize.body,
  },
  testBtn: {
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    marginTop: Spacing.xs,
  },
  testBtnText: {
    fontSize: FontSize.label,
    fontWeight: FontWeight.medium,
  },
  // ── Grade editor (harvest + seeds) ──
  subHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.sm,
    marginTop: Spacing.md,
  },
  gradeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingVertical: Spacing.xs,
    marginBottom: 2,
  },
  gradeHeaderLabel: {
    flex: 1,
    fontSize: FontSize.micro,
    fontWeight: FontWeight.semibold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  gradeHeaderCell: {
    width: 50,
    textAlign: 'center',
    fontSize: FontSize.label,
  },
  gradeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingVertical: 2,
  },
  cropLabel: {
    flex: 1,
    fontSize: FontSize.label,
    fontWeight: FontWeight.medium,
  },
  gradeInput: {
    width: 50,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.xs,
    paddingVertical: Spacing.xs,
    fontSize: FontSize.label,
    textAlign: 'center',
  },
  quickActionRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  quickBtn: {
    flex: 1,
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    alignItems: 'center',
  },
  quickBtnText: {
    fontSize: FontSize.label,
    fontWeight: FontWeight.semibold,
  },
});
