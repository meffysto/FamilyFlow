/**
 * SettingsGamiAdmin.tsx — Panneau admin caché pour modifier les données de gamification
 *
 * Permet de modifier directement les valeurs de chaque profil :
 * - Points, coins, level, streak, loot boxes, multiplier, pity counter
 * - Bâtiments ferme (niveau)
 * - Inventaire ferme (oeuf, lait, farine, miel)
 * - Récoltes en stock
 */

import React, { useCallback, useState } from 'react';
import type { AppColors } from '../../constants/colors';
import { View, Text, StyleSheet, TextInput, Alert, TouchableOpacity } from 'react-native';
import { useTranslation } from 'react-i18next';
import { serializeGamification, parseFarmProfile, serializeFarmProfile } from '../../lib/parser';
import { useThemeColors } from '../../contexts/ThemeContext';
import { useToast } from '../../contexts/ToastContext';
import { Button } from '../ui/Button';
import { Spacing, Radius } from '../../constants/spacing';
import { FontSize, FontWeight } from '../../constants/typography';
import { Shadows } from '../../constants/shadows';
import { calculateLevel } from '../../lib/gamification';
import { serializeBuildings, serializeInventory } from '../../lib/mascot/building-engine';
import { serializeHarvestInventory, serializeRareSeeds } from '../../lib/mascot/craft-engine';
import { TECH_TREE } from '../../lib/mascot/tech-engine';
import type { Profile, GamificationData } from '../../lib/types';
import type { FarmInventory, PlacedBuilding } from '../../lib/mascot/types';

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

  // Récoltes
  const harvestInv = profile.harvestInventory ?? {};
  const [harvests, setHarvests] = useState<Record<string, string>>(
    Object.fromEntries(Object.entries(harvestInv).map(([k, v]) => [k, String(v)]))
  );

  // Graines rares
  const rareSeeds = profile.farmRareSeeds ?? {};
  const [seeds, setSeeds] = useState<Record<string, string>>(
    Object.fromEntries(Object.entries(rareSeeds).map(([k, v]) => [k, String(v)]))
  );

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
      const updatedHarvest: Record<string, number> = {};
      for (const [k, v] of Object.entries(harvests)) {
        const n = parseInt(v, 10) || 0;
        if (n > 0) updatedHarvest[k] = n;
      }
      const updatedSeeds: Record<string, number> = {};
      for (const [k, v] of Object.entries(seeds)) {
        const n = parseInt(v, 10) || 0;
        if (n > 0) updatedSeeds[k] = n;
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

          {/* ── Récoltes ── */}
          {Object.keys(harvests).length > 0 && (
            <>
              <Text style={[styles.sectionLabel, { color: primary }]}>Récoltes en stock</Text>
              {Object.entries(harvests).map(([cropId, qty]) => (
                <NumField
                  key={cropId}
                  label={cropId}
                  value={qty}
                  onChangeText={v => setHarvests(prev => ({ ...prev, [cropId]: v }))}
                  colors={colors}
                />
              ))}
            </>
          )}

          {/* ── Graines rares ── */}
          {Object.keys(seeds).length > 0 && (
            <>
              <Text style={[styles.sectionLabel, { color: primary }]}>Graines rares</Text>
              {Object.entries(seeds).map(([cropId, qty]) => (
                <NumField
                  key={cropId}
                  label={cropId}
                  value={qty}
                  onChangeText={v => setSeeds(prev => ({ ...prev, [cropId]: v }))}
                  colors={colors}
                />
              ))}
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

function HarvestCardTest() {
  const { colors, primary } = useThemeColors();
  const { showHarvestCard } = useToast();
  const [expanded, setExpanded] = useState(false);

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
        </View>
      )}
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
      <HarvestCardTest />
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
});
