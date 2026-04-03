import { useState, useEffect, useCallback } from 'react';
import { GlassCard } from '../components/ui/GlassCard';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { SegmentedControl } from '../components/ui/SegmentedControl';
import { useVault } from '../contexts/VaultContext';
import { THEMES, THEME_LIST } from '@family-vault/core';
import type { Profile, ProfileTheme } from '@family-vault/core';
import './Settings.css';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const THEME_STORAGE_KEY = 'familyflow_theme';
const APPEARANCE_STORAGE_KEY = 'familyflow_appearance';

const APPEARANCE_OPTIONS = [
  { value: 'auto',  label: 'Auto' },
  { value: 'light', label: 'Clair' },
  { value: 'dark',  label: 'Sombre' },
];

const ROLE_BADGE: Record<Profile['role'], { label: string; variant: 'default' | 'success' | 'info' | 'warning' }> = {
  enfant:  { label: 'Enfant',  variant: 'success' },
  ado:     { label: 'Ado',     variant: 'warning' },
  adulte:  { label: 'Adulte',  variant: 'info' },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function applyTheme(themeId: ProfileTheme) {
  const config = THEMES[themeId];
  document.documentElement.style.setProperty('--primary', config.primary);
  document.documentElement.style.setProperty('--tint', config.tint);
}

function applyAppearance(value: string) {
  if (value === 'auto') {
    document.documentElement.removeAttribute('data-theme');
  } else {
    document.documentElement.setAttribute('data-theme', value);
  }
}

function truncatePath(path: string, maxLen = 60): string {
  if (path.length <= maxLen) return path;
  const parts = path.split('/');
  // Keep last 3 segments and ellipsis prefix
  const tail = parts.slice(-3).join('/');
  return `…/${tail}`;
}

function detectSystemAppearance(): string {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'Sombre' : 'Clair';
}

// ---------------------------------------------------------------------------
// Profile row
// ---------------------------------------------------------------------------

interface ProfileRowProps {
  profile: Profile;
  isActive: boolean;
  onSelect: (profile: Profile) => void;
}

function ProfileRow({ profile, isActive, onSelect }: ProfileRowProps) {
  const roleBadge = ROLE_BADGE[profile.role];

  return (
    <button
      type="button"
      className={`settings-profile-row ${isActive ? 'settings-profile-row--active' : ''}`}
      onClick={() => onSelect(profile)}
      aria-pressed={isActive}
    >
      <span className="settings-profile-avatar" aria-hidden="true">
        {profile.avatar}
      </span>

      <span className="settings-profile-info">
        <span className="settings-profile-name">{profile.name}</span>
        <span className="settings-profile-meta">
          <Badge variant={roleBadge.variant} size="sm">
            {roleBadge.label}
          </Badge>
          {profile.level > 1 && (
            <span className="settings-profile-level">Niv. {profile.level}</span>
          )}
        </span>
      </span>

      <span className="settings-profile-check" aria-hidden="true">
        {isActive && '✓'}
      </span>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Theme circle
// ---------------------------------------------------------------------------

interface ThemeCircleProps {
  themeId: ProfileTheme;
  isActive: boolean;
  onSelect: (themeId: ProfileTheme) => void;
}

function ThemeCircle({ themeId, isActive, onSelect }: ThemeCircleProps) {
  const config = THEMES[themeId];

  return (
    <button
      type="button"
      className={`settings-theme-circle ${isActive ? 'settings-theme-circle--active' : ''}`}
      style={{ background: config.primary }}
      onClick={() => onSelect(themeId)}
      aria-label={`Thème ${config.label}`}
      aria-pressed={isActive}
      title={config.label}
    >
      {isActive && (
        <span className="settings-theme-check" aria-hidden="true">✓</span>
      )}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function Settings() {
  const { vaultPath, profiles, activeProfile, files, setActiveProfile, clearVaultPath, refresh } = useVault();

  const [activeTheme, setActiveThemeState] = useState<ProfileTheme>(() => {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    return (stored && stored in THEMES ? stored : 'default') as ProfileTheme;
  });

  const [appearance, setAppearanceState] = useState<string>(() => {
    return localStorage.getItem(APPEARANCE_STORAGE_KEY) ?? 'auto';
  });

  const [isRefreshing, setIsRefreshing] = useState(false);

  // Sync initial theme on mount
  useEffect(() => {
    applyTheme(activeTheme);
  }, [activeTheme]);

  // Sync initial appearance on mount
  useEffect(() => {
    applyAppearance(appearance);
  }, [appearance]);

  const handleSelectProfile = useCallback((profile: Profile) => {
    setActiveProfile(profile);
  }, [setActiveProfile]);

  const handleSelectTheme = useCallback((themeId: ProfileTheme) => {
    setActiveThemeState(themeId);
    localStorage.setItem(THEME_STORAGE_KEY, themeId);
    applyTheme(themeId);
  }, []);

  const handleAppearanceChange = useCallback((value: string) => {
    setAppearanceState(value);
    localStorage.setItem(APPEARANCE_STORAGE_KEY, value);
    applyAppearance(value);
  }, []);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await refresh();
    } finally {
      setIsRefreshing(false);
    }
  }, [refresh]);

  const systemAppearance = detectSystemAppearance();

  return (
    <div className="settings-page">
      {/* Page header */}
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">Paramètres</h1>
        </div>
      </div>

      <div className="settings-sections">

        {/* Section 1 — Profils */}
        <GlassCard title="Profils" icon="👤">
          {profiles.length === 0 ? (
            <p className="settings-empty-hint">Aucun profil trouvé dans le vault.</p>
          ) : (
            <div className="settings-profile-list">
              {profiles.map((profile) => (
                <ProfileRow
                  key={profile.id}
                  profile={profile}
                  isActive={activeProfile?.id === profile.id}
                  onSelect={handleSelectProfile}
                />
              ))}
            </div>
          )}
        </GlassCard>

        {/* Section 2 — Thème */}
        <GlassCard title="Thème" icon="🎨">
          {activeProfile?.theme && (
            <p className="settings-section-hint">
              Thème actuel du profil : <strong>{THEMES[activeProfile.theme]?.label ?? activeProfile.theme}</strong>
            </p>
          )}
          <div className="settings-theme-grid">
            {THEME_LIST.map((config) => (
              <ThemeCircle
                key={config.id}
                themeId={config.id}
                isActive={activeTheme === config.id}
                onSelect={handleSelectTheme}
              />
            ))}
          </div>
          <p className="settings-section-note">
            Le thème modifie les couleurs d'accent dans toute l'application.
          </p>
        </GlassCard>

        {/* Section 3 — Apparence */}
        <GlassCard title="Apparence" icon="🌓">
          <div className="settings-appearance-row">
            <div className="settings-appearance-label">
              <span className="settings-label-text">Mode d'affichage</span>
              <span className="settings-section-hint">
                Système détecté : {systemAppearance}
              </span>
            </div>
            <SegmentedControl
              options={APPEARANCE_OPTIONS}
              value={appearance}
              onChange={handleAppearanceChange}
            />
          </div>
        </GlassCard>

        {/* Section 4 — Vault */}
        <GlassCard title="Vault" icon="🗄️">
          <div className="settings-vault-body">
            <div className="settings-stat-row">
              <span className="settings-stat-label">Fichiers indexés</span>
              <span className="settings-stat-value">{files.length}</span>
            </div>

            {vaultPath && (
              <div className="settings-vault-path-block">
                <span className="settings-vault-path-label">Chemin</span>
                <code className="settings-vault-path">{truncatePath(vaultPath)}</code>
              </div>
            )}

            <div className="settings-vault-actions">
              <Button
                variant="secondary"
                size="sm"
                icon="↺"
                onClick={handleRefresh}
                disabled={isRefreshing}
              >
                {isRefreshing ? 'Rafraîchissement…' : 'Rafraîchir'}
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={clearVaultPath}
              >
                Changer de vault
              </Button>
            </div>

            <p className="settings-vault-note">
              Les données vivent dans ton vault Obsidian. Aucun serveur.
            </p>
          </div>
        </GlassCard>

        {/* Section 5 — A propos */}
        <GlassCard title="A propos" icon="ℹ️">
          <div className="settings-about-body">
            <div className="settings-about-app">
              <span className="settings-about-logo" aria-hidden="true">🌳</span>
              <div className="settings-about-info">
                <span className="settings-about-name">FamilyFlow Desktop</span>
                <span className="settings-about-version">Version 0.1.0</span>
              </div>
            </div>
            <p className="settings-about-tagline">Privacy-first · Offline-first</p>
            <p className="settings-about-tech">Propulsé par Tauri + React</p>
          </div>
        </GlassCard>

      </div>
    </div>
  );
}
