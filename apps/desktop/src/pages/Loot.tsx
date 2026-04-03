import { useMemo, memo } from 'react';
import { GlassCard } from '../components/ui/GlassCard';
import { useVault } from '../contexts/VaultContext';
import type { Profile } from '@family-vault/core';
import './Loot.css';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** XP needed per level (simple linear: 100 * level) */
function xpForNextLevel(level: number): number {
  return level * 100;
}

/** Build a clamped 0-100 XP progress given points and level */
function xpProgress(profile: Profile): { current: number; needed: number; pct: number } {
  const level = profile.level ?? 1;
  const points = profile.points ?? 0;

  // Cumulative XP to reach current level
  const xpToCurrentLevel = Array.from({ length: level - 1 }, (_, i) => xpForNextLevel(i + 1))
    .reduce((a, b) => a + b, 0);

  const needed = xpForNextLevel(level);
  const current = Math.max(0, points - xpToCurrentLevel);
  const pct = Math.min(100, Math.round((current / needed) * 100));

  return { current, needed, pct };
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
    <GlassCard
      icon={profile.avatar ?? '👤'}
      title={profile.name}
      accentColor="var(--primary)"
      tinted
    >
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
// Loot box section
// ---------------------------------------------------------------------------

interface LootBoxSectionProps {
  available: number;
}

const LootBoxSection = memo(function LootBoxSection({ available }: LootBoxSectionProps) {
  const hasCoffres = available > 0;

  return (
    <GlassCard title="Coffres" icon="🎰" count={available > 0 ? available : undefined}>
      <div className="loot-box-section">
        {hasCoffres ? (
          <div className="loot-box-content">
            <div className="loot-box-count-row">
              <span className="loot-box-count-text">
                Tu as <strong>{available}</strong> coffre{available > 1 ? 's' : ''} à ouvrir !
              </span>
            </div>

            {/* Pulsing button — not yet functional */}
            <button
              type="button"
              className="loot-open-btn"
              aria-label="Ouvrir un coffre (bientôt disponible)"
              disabled
            >
              <span className="loot-open-btn-icon" aria-hidden="true">🎁</span>
              Ouvrir un coffre
            </button>

            <p className="loot-coming-soon">
              L'ouverture de coffres sera disponible bientôt
            </p>
          </div>
        ) : (
          <div className="loot-box-empty">
            <span className="loot-box-empty-icon" aria-hidden="true">📦</span>
            <p className="loot-box-empty-text">Aucun coffre disponible pour le moment</p>
            <p className="loot-box-empty-hint">
              Complète des tâches et des défis pour gagner des coffres
            </p>
          </div>
        )}
      </div>
    </GlassCard>
  );
});

// ---------------------------------------------------------------------------
// Inventory placeholder
// ---------------------------------------------------------------------------

function InventorySection() {
  return (
    <GlassCard title="Inventaire" icon="🎒">
      <div className="loot-inventory-placeholder">
        <span className="loot-inventory-icon" aria-hidden="true">🛡️</span>
        <p className="loot-inventory-text">
          Ton inventaire de récompenses apparaîtra ici
        </p>
      </div>
    </GlassCard>
  );
}

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
  const { activeProfile } = useVault();

  const lootCount = activeProfile?.lootBoxesAvailable ?? 0;

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
          <LootBoxSection available={lootCount} />
          <InventorySection />
        </>
      )}
    </div>
  );
}
