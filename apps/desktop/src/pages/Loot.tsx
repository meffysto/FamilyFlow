import { useState, useCallback, useMemo, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';
import { GlassCard } from '../components/ui/GlassCard';
import { useVault } from '../contexts/VaultContext';
import { BADGES, getAllBadgeProgress, TIER_EMOJI, type BadgeTier } from '@family-vault/core';
import type { Profile, LootBox, LootRarity, ActiveReward } from '@family-vault/core';
import './Loot.css';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const RARITY_GLOW: Record<string, string> = {
  commun: '0 0 8px rgba(100,100,100,0.4)',
  rare: '0 0 16px rgba(59,130,246,0.6)',
  épique: '0 0 24px rgba(168,85,247,0.8)',
  légendaire: '0 0 32px rgba(245,158,11,1.0)',
  mythique: '0 0 40px rgba(239,68,68,1.0)',
};

const RARITY_COLOR: Record<string, string> = {
  commun: '#9CA3AF',
  rare: '#3B82F6',
  épique: '#8B5CF6',
  légendaire: '#F59E0B',
  mythique: '#EF4444',
};

const RARITY_LABEL: Record<string, string> = {
  commun: 'Commun',
  rare: 'Rare',
  épique: 'Épique',
  légendaire: 'Légendaire',
  mythique: 'Mythique',
};

const REWARD_TYPE_CATEGORY: Record<string, InventoryCategory> = {
  mascot_deco: 'Décorations',
  mascot_hab: 'Habitants',
  companion: 'Compagnons',
  badge: 'Cosmétiques',
  skip: 'Cosmétiques',
  skip_all: 'Cosmétiques',
  crown: 'Cosmétiques',
  double_loot: 'Cosmétiques',
  vacation: 'Cosmétiques',
  points: 'Cosmétiques',
  reward: 'Cosmétiques',
  multiplier: 'Cosmétiques',
  family_bonus: 'Cosmétiques',
  farm_seed: 'Cosmétiques',
};

type InventoryCategory = 'Tous' | 'Décorations' | 'Habitants' | 'Compagnons' | 'Cosmétiques';
const INVENTORY_CATEGORIES: InventoryCategory[] = ['Tous', 'Décorations', 'Habitants', 'Compagnons', 'Cosmétiques'];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function xpForNextLevel(level: number): number {
  return level * 100;
}

function xpProgress(profile: Profile): { current: number; needed: number; pct: number } {
  const level = profile.level ?? 1;
  const points = profile.points ?? 0;
  const xpToCurrentLevel = Array.from({ length: level - 1 }, (_, i) => xpForNextLevel(i + 1))
    .reduce((a, b) => a + b, 0);
  const needed = xpForNextLevel(level);
  const current = Math.max(0, points - xpToCurrentLevel);
  const pct = Math.min(100, Math.round((current / needed) * 100));
  return { current, needed, pct };
}

function fireConfetti(rarity: LootRarity) {
  if (rarity === 'légendaire' || rarity === 'mythique') {
    confetti({ particleCount: 200, spread: 100, origin: { y: 0.6 } });
    setTimeout(() => confetti({ particleCount: 100, spread: 60, origin: { y: 0.4 }, angle: 60 }), 300);
    setTimeout(() => confetti({ particleCount: 100, spread: 60, origin: { y: 0.4 }, angle: 120 }), 500);
  } else {
    confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
  }
}

// ---------------------------------------------------------------------------
// Profile stats card
// ---------------------------------------------------------------------------

interface ProfileStatsCardProps {
  profile: Profile;
}

const ProfileStatsCard = memo(function ProfileStatsCard({ profile }: ProfileStatsCardProps) {
  const xp = useMemo(() => xpProgress(profile), [profile]);
  const lootCount = profile.lootBoxesAvailable ?? 0;

  return (
    <GlassCard icon={profile.avatar ?? '👤'} title={profile.name} accentColor="var(--primary)" tinted>
      <div className="loot-profile-body">
        {/* Level + XP */}
        <div className="loot-level-row">
          <div className="loot-level-badge" aria-label={`Niveau ${profile.level ?? 1}`}>
            <span className="loot-level-number">{profile.level ?? 1}</span>
            <span className="loot-level-label">niv.</span>
          </div>

          <div className="loot-xp-block">
            <div className="loot-xp-header">
              <span className="loot-xp-label">Expérience</span>
              <span className="loot-xp-value">{xp.current} / {xp.needed} XP</span>
            </div>
            <div className="loot-xp-track" aria-label={`XP: ${xp.pct}%`}>
              <div
                className="loot-xp-fill"
                style={{ width: `${xp.pct}%` }}
                role="progressbar"
                aria-valuenow={xp.pct}
                aria-valuemin={0}
                aria-valuemax={100}
              />
            </div>
          </div>
        </div>

        {/* Stats grid */}
        <div className="loot-stats-grid">
          <div className="loot-stat-tile">
            <span className="loot-stat-icon" aria-hidden="true">⭐</span>
            <span className="loot-stat-val">{(profile.points ?? 0).toLocaleString('fr-FR')}</span>
            <span className="loot-stat-lbl">points</span>
          </div>

          <div className="loot-stat-tile">
            <span className="loot-stat-icon" aria-hidden="true">🪙</span>
            <span className="loot-stat-val">{(profile.coins ?? 0).toLocaleString('fr-FR')}</span>
            <span className="loot-stat-lbl">pièces</span>
          </div>

          <div className="loot-stat-tile">
            <span className="loot-stat-icon" aria-hidden="true">🔥</span>
            <span className="loot-stat-val">{profile.streak ?? 0}</span>
            <span className="loot-stat-lbl">jours consécutifs</span>
          </div>

          <div className="loot-stat-tile loot-stat-tile--loot" aria-live="polite">
            <span className="loot-stat-icon" aria-hidden="true">🎰</span>
            <span className="loot-stat-val">{lootCount}</span>
            <span className="loot-stat-lbl">coffre{lootCount > 1 ? 's' : ''} disponible{lootCount > 1 ? 's' : ''}</span>
          </div>
        </div>
      </div>
    </GlassCard>
  );
});

// ---------------------------------------------------------------------------
// Companion info strip (bonus XP, avatar)
// ---------------------------------------------------------------------------

interface CompanionStripProps {
  profile: Profile;
}

const CompanionStrip = memo(function CompanionStrip({ profile }: CompanionStripProps) {
  const companion = (profile as any).companion;
  if (!companion) return null;

  const speciesEmoji: Record<string, string> = {
    chat: '🐱', chien: '🐶', lapin: '🐰', renard: '🦊', herisson: '🦔',
  };
  const emoji = speciesEmoji[companion.species] ?? '🐾';
  const bonusXp = companion.bonusXp ?? 0;

  return (
    <GlassCard icon={emoji} title={`Compagnon — ${companion.name ?? companion.species}`} accentColor="var(--primary)">
      <div className="loot-companion-strip">
        <div className="loot-companion-avatar">{emoji}</div>
        <div className="loot-companion-info">
          <p className="loot-companion-name">{companion.name ?? companion.species}</p>
          <p className="loot-companion-species">{companion.species}</p>
        </div>
        {bonusXp > 0 && (
          <div className="loot-companion-bonus">
            <span className="loot-companion-bonus-label">+{bonusXp}%</span>
            <span className="loot-companion-bonus-sub">bonus XP</span>
          </div>
        )}
        <div className="loot-companion-level">
          <span className="loot-companion-level-val">Niv. {companion.level ?? 1}</span>
        </div>
      </div>
    </GlassCard>
  );
});

// ---------------------------------------------------------------------------
// Loot box open section
// ---------------------------------------------------------------------------

type OpenPhase = 'idle' | 'shaking' | 'flipping' | 'revealed';

interface LootBoxSectionProps {
  available: number;
  onOpen: () => Promise<LootBox | null>;
}

function LootBoxSection({ available, onOpen }: LootBoxSectionProps) {
  const [phase, setPhase] = useState<OpenPhase>('idle');
  const [revealedBox, setRevealedBox] = useState<LootBox | null>(null);
  const [isOpening, setIsOpening] = useState(false);

  const handleOpen = useCallback(async () => {
    if (isOpening || available <= 0) return;
    setIsOpening(true);
    setRevealedBox(null);
    setPhase('shaking');

    await new Promise((r) => setTimeout(r, 600));
    setPhase('flipping');

    const box = await onOpen();
    if (!box) {
      setPhase('idle');
      setIsOpening(false);
      return;
    }

    await new Promise((r) => setTimeout(r, 400));
    setRevealedBox(box);
    setPhase('revealed');
    fireConfetti(box.rarity as LootRarity);
    setIsOpening(false);
  }, [isOpening, available, onOpen]);

  const handleDismiss = useCallback(() => {
    setPhase('idle');
    setRevealedBox(null);
  }, []);

  const rarityGlow = revealedBox
    ? RARITY_GLOW[revealedBox.rarity] ?? RARITY_GLOW.commun
    : undefined;
  const rarityColor = revealedBox
    ? RARITY_COLOR[revealedBox.rarity] ?? RARITY_COLOR.commun
    : undefined;

  return (
    <GlassCard title="Coffres" icon="🎰" count={available > 0 ? available : undefined}>
      <div className="loot-box-section">
        {/* Chest area */}
        <div className="loot-chest-area">
          <AnimatePresence mode="wait">
            {phase !== 'revealed' ? (
              <motion.div
                key="chest"
                className="loot-chest"
                animate={phase === 'shaking' ? {
                  x: [-3, 3, -3, 3, -2, 2, 0],
                  rotate: [-2, 2, -2, 2, 0],
                } : { x: 0, rotate: 0 }}
                transition={phase === 'shaking' ? { duration: 0.5, ease: 'easeInOut' } : { duration: 0.2 }}
              >
                <span className="loot-chest-emoji" aria-hidden="true">
                  {available > 0 ? '🎰' : '📦'}
                </span>
                {available > 0 && (
                  <span className="loot-chest-count">{available}</span>
                )}
              </motion.div>
            ) : (
              <div key="card-flip-area" className="loot-card-flip-area" style={{ perspective: 1200 }}>
                <motion.div
                  className="loot-reward-card"
                  initial={{ rotateY: 180, scale: 0.85, opacity: 0 }}
                  animate={{ rotateY: 0, scale: 1, opacity: 1 }}
                  transition={{ type: 'spring', stiffness: 160, damping: 18 }}
                  style={{
                    boxShadow: rarityGlow,
                    borderColor: rarityColor,
                  }}
                  onClick={handleDismiss}
                >
                  {/* Card back (hidden after flip) */}
                  <div className="loot-card-back" aria-hidden="true" />

                  {/* Card front */}
                  <div className="loot-card-front">
                    <span
                      className="loot-reward-badge"
                      style={{ background: rarityColor }}
                    >
                      {RARITY_LABEL[revealedBox?.rarity ?? 'commun']}
                    </span>
                    <span className="loot-reward-emoji" aria-hidden="true">
                      {revealedBox?.emoji}
                    </span>
                    <p className="loot-reward-name">{revealedBox?.reward}</p>
                    {revealedBox?.requiresParent && (
                      <p className="loot-reward-parent-note">👨‍👩‍👧 Validation parent requise</p>
                    )}
                    {(revealedBox?.bonusPoints ?? 0) > 0 && (
                      <p className="loot-reward-bonus">+{revealedBox?.bonusPoints} pts</p>
                    )}
                    <p className="loot-card-dismiss-hint">Cliquer pour fermer</p>
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>
        </div>

        {/* Open button */}
        {phase !== 'revealed' && (
          available > 0 ? (
            <button
              type="button"
              className="loot-open-btn"
              onClick={handleOpen}
              disabled={isOpening}
              aria-label="Ouvrir un coffre"
            >
              <span className="loot-open-btn-icon" aria-hidden="true">
                {isOpening ? '⌛' : '🎁'}
              </span>
              {isOpening ? 'Ouverture...' : 'Ouvrir un coffre'}
            </button>
          ) : (
            <div className="loot-box-empty">
              <span className="loot-box-empty-icon" aria-hidden="true">📦</span>
              <p className="loot-box-empty-text">Aucun coffre disponible pour le moment</p>
              <p className="loot-box-empty-hint">Complète des tâches et des défis pour gagner des coffres</p>
            </div>
          )
        )}

        {phase === 'revealed' && revealedBox && (
          <motion.button
            type="button"
            className="loot-open-btn loot-open-btn--dismiss"
            onClick={handleDismiss}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8 }}
          >
            ✓ Continuer
          </motion.button>
        )}
      </div>
    </GlassCard>
  );
}

// ---------------------------------------------------------------------------
// Inventory section
// ---------------------------------------------------------------------------

interface InventorySectionProps {
  rewards: ActiveReward[];
  onMarkUsed: (id: string) => void;
}

const InventorySection = memo(function InventorySection({ rewards, onMarkUsed }: InventorySectionProps) {
  const [activeCategory, setActiveCategory] = useState<InventoryCategory>('Tous');

  const filtered = useMemo(() => {
    if (activeCategory === 'Tous') return rewards;
    return rewards.filter((r) => {
      const cat = REWARD_TYPE_CATEGORY[r.type] ?? 'Cosmétiques';
      return cat === activeCategory;
    });
  }, [rewards, activeCategory]);

  return (
    <GlassCard title="Inventaire" icon="🎒" count={rewards.length > 0 ? rewards.length : undefined}>
      {/* Segmented control */}
      <div className="loot-segment-bar" role="tablist" aria-label="Filtrer l'inventaire">
        {INVENTORY_CATEGORIES.map((cat) => (
          <button
            key={cat}
            type="button"
            role="tab"
            aria-selected={activeCategory === cat}
            className={`loot-segment-btn${activeCategory === cat ? ' loot-segment-btn--active' : ''}`}
            onClick={() => setActiveCategory(cat)}
          >
            {cat}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="loot-inventory-empty">
          <span aria-hidden="true" className="loot-inventory-empty-icon">🛡️</span>
          <p className="loot-inventory-empty-text">
            {rewards.length === 0
              ? 'Ton inventaire est vide — ouvre des coffres pour gagner des récompenses !'
              : `Aucune récompense dans la catégorie "${activeCategory}"`}
          </p>
        </div>
      ) : (
        <div className="loot-inventory-grid">
          {filtered.map((reward) => {
            const rarityFromType = reward.type === 'companion' ? 'épique'
              : reward.type === 'mascot_deco' || reward.type === 'mascot_hab' ? 'rare'
              : 'commun';
            const color = RARITY_COLOR[rarityFromType];
            return (
              <div
                key={reward.id}
                className="loot-inventory-card"
                style={{ borderColor: color + '66' }}
              >
                <span className="loot-inventory-card-emoji" aria-hidden="true">{reward.emoji}</span>
                <p className="loot-inventory-card-name">{reward.label}</p>
                <span
                  className="loot-inventory-card-type"
                  style={{ background: color + '22', color }}
                >
                  {REWARD_TYPE_CATEGORY[reward.type] ?? 'Cosmétique'}
                </span>
                {reward.remainingTasks != null && (
                  <p className="loot-inventory-card-remaining">
                    {reward.remainingTasks} tâche{reward.remainingTasks > 1 ? 's' : ''} restante{reward.remainingTasks > 1 ? 's' : ''}
                  </p>
                )}
                {reward.remainingDays != null && (
                  <p className="loot-inventory-card-remaining">
                    {reward.remainingDays} jour{reward.remainingDays > 1 ? 's' : ''} restant{reward.remainingDays > 1 ? 's' : ''}
                  </p>
                )}
                <button
                  type="button"
                  className="loot-inventory-card-use"
                  onClick={() => onMarkUsed(reward.id)}
                  aria-label={`Utiliser : ${reward.label}`}
                >
                  Utiliser
                </button>
              </div>
            );
          })}
        </div>
      )}
    </GlassCard>
  );
});

// ---------------------------------------------------------------------------
// Badges collection section
// ---------------------------------------------------------------------------

interface BadgesSectionProps {
  profile: Profile;
  history: Array<{ action: string; points: number; note: string; timestamp: string; profileId: string }>;
}

const TIER_BORDER: Record<BadgeTier, string> = {
  none: '#374151',
  bronze: '#92400E',
  argent: '#6B7280',
  or: '#D97706',
  diamant: '#6366F1',
};

const BadgesSection = memo(function BadgesSection({ profile, history }: BadgesSectionProps) {
  const allProgress = useMemo(() => {
    return getAllBadgeProgress(
      {
        level: profile.level ?? 1,
        streak: profile.streak ?? 0,
        craftedItems: (profile as any).craftedItems ?? [],
        farmBuildings: (profile as any).farmBuildings ?? [],
        farmTech: (profile as any).farmTech ?? [],
      },
      { history },
    );
  }, [profile, history]);

  const obtained = allProgress.filter((b) => b.currentTier !== 'none');
  const locked = allProgress.filter((b) => b.currentTier === 'none');
  const totalBadges = BADGES.length * 4; // 4 tiers per badge
  const earnedCount = allProgress.reduce((acc, b) => {
    const tierIdx = ['none', 'bronze', 'argent', 'or', 'diamant'].indexOf(b.currentTier);
    return acc + Math.max(0, tierIdx);
  }, 0);

  return (
    <GlassCard title="Collection badges" icon="🏅">
      {/* Progress bar */}
      <div className="loot-badge-progress-row">
        <span className="loot-badge-progress-label">{earnedCount} / {totalBadges} badges</span>
        <div className="loot-badge-progress-track">
          <div
            className="loot-badge-progress-fill"
            style={{ width: `${Math.round((earnedCount / totalBadges) * 100)}%` }}
            role="progressbar"
            aria-valuenow={earnedCount}
            aria-valuemin={0}
            aria-valuemax={totalBadges}
          />
        </div>
      </div>

      {/* Obtained badges */}
      {obtained.length > 0 && (
        <>
          <h3 className="loot-badge-section-title">Obtenus</h3>
          <div className="loot-badge-grid">
            {obtained.map(({ badge, currentTier, currentValue, nextThreshold, progress }) => (
              <div
                key={badge.id}
                className="loot-badge-item"
                style={{ borderColor: TIER_BORDER[currentTier] }}
                title={`${badge.id} — Valeur: ${currentValue}`}
              >
                <span className="loot-badge-tier-emoji" aria-hidden="true">{TIER_EMOJI[currentTier]}</span>
                <span className="loot-badge-emoji" aria-hidden="true">{badge.emoji}</span>
                <span className="loot-badge-id">{badge.id}</span>
                {nextThreshold != null && (
                  <div className="loot-badge-mini-track">
                    <div className="loot-badge-mini-fill" style={{ width: `${Math.round(progress * 100)}%` }} />
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      {/* Locked badges */}
      {locked.length > 0 && (
        <>
          <h3 className="loot-badge-section-title loot-badge-section-title--locked">À débloquer</h3>
          <div className="loot-badge-grid">
            {locked.map(({ badge, currentValue, nextThreshold, progress }) => (
              <div
                key={badge.id}
                className="loot-badge-item loot-badge-item--locked"
                title={`${badge.id} — Condition: atteindre ${nextThreshold}`}
              >
                <span className="loot-badge-emoji loot-badge-emoji--locked" aria-hidden="true">{badge.emoji}</span>
                <span className="loot-badge-id">{badge.id}</span>
                {nextThreshold != null && (
                  <>
                    <span className="loot-badge-threshold">{currentValue}/{nextThreshold}</span>
                    <div className="loot-badge-mini-track">
                      <div className="loot-badge-mini-fill" style={{ width: `${Math.round(progress * 100)}%` }} />
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </GlassCard>
  );
});

// ---------------------------------------------------------------------------
// No profile state
// ---------------------------------------------------------------------------

function NoProfile() {
  return (
    <GlassCard>
      <div className="loot-no-profile">
        <span aria-hidden="true" style={{ fontSize: 32 }}>👤</span>
        <p>Aucun profil actif</p>
        <p style={{ fontSize: 13, color: 'var(--text-faint)' }}>
          Configure ton vault pour afficher les récompenses
        </p>
      </div>
    </GlassCard>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function Loot() {
  const { activeProfile, gamiData, openLootBox, markLootUsed } = useVault();

  const lootCount = activeProfile?.lootBoxesAvailable ?? 0;

  const handleOpenLootBox = useCallback(async () => {
    const result = await openLootBox();
    if (!result) return null;
    return result.box;
  }, [openLootBox]);

  const activeRewards = useMemo(() => {
    if (!gamiData || !activeProfile) return [];
    return (gamiData.activeRewards ?? []).filter((r) => r.profileId === activeProfile.id);
  }, [gamiData, activeProfile]);

  const history = useMemo(() => {
    if (!gamiData || !activeProfile) return [];
    return (gamiData.history ?? []).filter((h) => h.profileId === activeProfile.id);
  }, [gamiData, activeProfile]);

  return (
    <div className="page loot-page">
      {/* Page header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Récompenses</h1>
          <p className="page-subtitle">
            {activeProfile
              ? `Profil : ${activeProfile.name}`
              : 'Aucun profil sélectionné'}
          </p>
        </div>
      </div>

      {/* Content */}
      {!activeProfile ? (
        <NoProfile />
      ) : (
        <>
          <ProfileStatsCard profile={activeProfile} />

          {/* Companion system */}
          <CompanionStrip profile={activeProfile} />

          {/* Loot box opening */}
          <LootBoxSection available={lootCount} onOpen={handleOpenLootBox} />

          {/* Inventory */}
          <InventorySection rewards={activeRewards} onMarkUsed={markLootUsed} />

          {/* Badges collection */}
          <BadgesSection profile={activeProfile} history={history} />
        </>
      )}
    </div>
  );
}
