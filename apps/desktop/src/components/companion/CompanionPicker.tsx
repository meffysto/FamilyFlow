import { memo, useCallback, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// per D-07: useTranslation shim (react-i18next not installed on desktop)
function useTranslation(_namespace?: string) {
  const t = useCallback((key: string): string => {
    const LABELS: Record<string, string> = {
      'companion.picker.title': 'Compagnon',
      'companion.picker.hint': 'Les compagnons rares et épiques se débloquent via les coffres loot box.',
      'companion.picker.saving': 'Sauvegarde…',
      'companion.picker.rename': 'Renommer le compagnon',
      'companion.picker.close': 'Fermer',
      'companion.picker.unlockHint.rare': 'Coffre rare',
      'companion.picker.unlockHint.epique': 'Coffre épique',
      'companion.picker.active': 'Actif',
      'companion.picker.locked': 'verrouillé',
    };
    return LABELS[key] ?? key;
  }, []);
  return { t };
}
import {
  COMPANION_SPECIES_CATALOG,
  SPECIES_PERSONALITY,
  type CompanionData,
  type CompanionSpecies,
} from '@family-vault/core';
import { useVault } from '../../contexts/VaultContext';
import './CompanionPicker.css';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Emoji représentatif par espèce */
const SPECIES_EMOJI: Record<CompanionSpecies, string> = {
  chat: '🐱',
  chien: '🐶',
  lapin: '🐰',
  renard: '🦊',
  herisson: '🦔',
};

/** Label français par espèce */
const SPECIES_LABELS: Record<CompanionSpecies, string> = {
  chat: 'Chat',
  chien: 'Chien',
  lapin: 'Lapin',
  renard: 'Renard',
  herisson: 'Hérisson',
};

/** Label de rareté */
const RARITY_LABELS: Record<string, { label: string; color: string }> = {
  initial: { label: 'Initial', color: '#10b981' },
  rare: { label: 'Rare', color: '#3b82f6' },
  epique: { label: 'Épique', color: '#8b5cf6' },
};

// ---------------------------------------------------------------------------
// SpeciesCard
// ---------------------------------------------------------------------------

interface SpeciesCardProps {
  species: CompanionSpecies;
  rarity: 'initial' | 'rare' | 'epique';
  isUnlocked: boolean;
  isActive: boolean;
  onSelect: (species: CompanionSpecies) => void;
}

const SpeciesCard = memo(function SpeciesCard({
  species,
  rarity,
  isUnlocked,
  isActive,
  onSelect,
}: SpeciesCardProps) {
  const rarityInfo = RARITY_LABELS[rarity];
  const personality = SPECIES_PERSONALITY[species];
  const emoji = SPECIES_EMOJI[species];
  const label = SPECIES_LABELS[species];

  return (
    <motion.button
      type="button"
      className={`companion-picker-card${isActive ? ' companion-picker-card--active' : ''}${!isUnlocked ? ' companion-picker-card--locked' : ''}`}
      onClick={() => isUnlocked && onSelect(species)}
      whileHover={isUnlocked ? { scale: 1.03 } : {}}
      whileTap={isUnlocked ? { scale: 0.97 } : {}}
      disabled={!isUnlocked}
      aria-label={`${label}${isUnlocked ? '' : ' (verrouillé)'}`}
      aria-pressed={isActive}
      style={{ '--rarity-color': rarityInfo.color } as React.CSSProperties}
    >
      {/* Avatar */}
      <div className={`companion-picker-avatar${!isUnlocked ? ' companion-picker-avatar--locked' : ''}`}>
        <span className="companion-picker-emoji" aria-hidden="true">{emoji}</span>
        {!isUnlocked && (
          <span className="companion-picker-lock" aria-hidden="true">🔒</span>
        )}
      </div>

      {/* Name + rarity */}
      <div className="companion-picker-card-info">
        <span className="companion-picker-card-name">{label}</span>
        <span
          className="companion-picker-rarity"
          style={{ color: rarityInfo.color }}
        >
          {rarityInfo.label}
        </span>
      </div>

      {/* Personality trait */}
      {isUnlocked && personality && (
        <p className="companion-picker-trait">{personality.traits[0]}</p>
      )}

      {/* Unlock hint */}
      {!isUnlocked && (
        <p className="companion-picker-unlock-hint">
          {rarity === 'rare' ? 'Coffre rare' : 'Coffre épique'}
        </p>
      )}

      {/* Active indicator */}
      {isActive && (
        <span className="companion-picker-active-badge" aria-hidden="true">✓ Actif</span>
      )}
    </motion.button>
  );
});

// ---------------------------------------------------------------------------
// Name editor — simple inline input
// ---------------------------------------------------------------------------

interface NameEditorProps {
  currentName: string;
  onSave: (name: string) => void;
}

const NameEditor = memo(function NameEditor({ currentName, onSave }: NameEditorProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(currentName);

  const handleSubmit = useCallback(() => {
    const trimmed = draft.trim();
    if (trimmed && trimmed !== currentName) {
      onSave(trimmed);
    }
    setEditing(false);
  }, [draft, currentName, onSave]);

  if (!editing) {
    return (
      <div className="companion-name-editor">
        <span className="companion-name-display">{currentName}</span>
        <button
          type="button"
          className="companion-name-edit-btn"
          onClick={() => setEditing(true)}
          aria-label="Renommer le compagnon"
        >
          ✏️
        </button>
      </div>
    );
  }

  return (
    <div className="companion-name-editor companion-name-editor--editing">
      <input
        type="text"
        className="companion-name-input"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') handleSubmit();
          if (e.key === 'Escape') setEditing(false);
        }}
        maxLength={20}
        autoFocus
        aria-label="Nom du compagnon"
      />
      <button type="button" className="companion-name-save-btn" onClick={handleSubmit}>
        ✓
      </button>
    </div>
  );
});

// ---------------------------------------------------------------------------
// CompanionPicker — exported component
// ---------------------------------------------------------------------------

interface CompanionPickerProps {
  isOpen: boolean;
  onClose: () => void;
  /** Called after companion is changed */
  onChanged?: (companion: CompanionData) => void;
}

export const CompanionPicker = memo(function CompanionPicker({
  isOpen,
  onClose,
  onChanged,
}: CompanionPickerProps) {
  const { activeProfile, writeFile, readFile, refresh } = useVault();
  const [saving, setSaving] = useState(false);

  const companion: CompanionData | null = activeProfile?.companion ?? null;
  const unlockedSpecies: CompanionSpecies[] = companion?.unlockedSpecies ?? (
    // If no companion yet, offer the 3 initial species
    ['chat', 'chien', 'lapin']
  );

  const handleSelectSpecies = useCallback(async (species: CompanionSpecies) => {
    if (!activeProfile || saving) return;

    const currentCompanion = activeProfile.companion;
    const newCompanion: CompanionData = {
      activeSpecies: species,
      name: currentCompanion?.name ?? SPECIES_LABELS[species],
      unlockedSpecies: currentCompanion?.unlockedSpecies ?? ['chat', 'chien', 'lapin'],
      mood: 'content',
    };

    setSaving(true);
    try {
      // Persist companion choice to famille.md
      const famille = await readFile('famille.md');
      const lines = famille.split('\n');
      const header = `### ${activeProfile.id}`;
      let inSection = false;
      let companionLineIdx = -1;

      for (let i = 0; i < lines.length; i++) {
        const trimmed = lines[i].trim();
        if (trimmed.toLowerCase() === header.toLowerCase()) {
          inSection = true;
          continue;
        }
        if (inSection && trimmed.startsWith('### ')) break;
        if (inSection && trimmed.startsWith('companion:')) {
          companionLineIdx = i;
          break;
        }
      }

      const companionValue = `companion: ${JSON.stringify(newCompanion)}`;
      if (companionLineIdx >= 0) {
        lines[companionLineIdx] = companionValue;
      } else {
        // Append after the section header
        const headerIdx = lines.findIndex(l =>
          l.trim().toLowerCase() === header.toLowerCase()
        );
        if (headerIdx >= 0) {
          lines.splice(headerIdx + 1, 0, companionValue);
        }
      }

      await writeFile('famille.md', lines.join('\n'));
      await refresh();
      onChanged?.(newCompanion);
      onClose();
    } catch (e: unknown) {
      if (import.meta.env.DEV) console.error('CompanionPicker: save error', e);
    } finally {
      setSaving(false);
    }
  }, [activeProfile, saving, readFile, writeFile, refresh, onChanged, onClose]);

  const handleRenameCompanion = useCallback(async (name: string) => {
    if (!activeProfile || !companion || saving) return;
    const updated: CompanionData = { ...companion, name };

    setSaving(true);
    try {
      const famille = await readFile('famille.md');
      const lines = famille.split('\n');
      const header = `### ${activeProfile.id}`;
      let inSection = false;

      for (let i = 0; i < lines.length; i++) {
        const trimmed = lines[i].trim();
        if (trimmed.toLowerCase() === header.toLowerCase()) {
          inSection = true;
          continue;
        }
        if (inSection && trimmed.startsWith('### ')) break;
        if (inSection && trimmed.startsWith('companion:')) {
          lines[i] = `companion: ${JSON.stringify(updated)}`;
          break;
        }
      }

      await writeFile('famille.md', lines.join('\n'));
      await refresh();
    } catch (e: unknown) {
      if (import.meta.env.DEV) console.error('CompanionPicker: rename error', e);
    } finally {
      setSaving(false);
    }
  }, [activeProfile, companion, saving, readFile, writeFile, refresh]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            className="companion-picker-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            aria-hidden="true"
          />

          {/* Panel */}
          <motion.div
            className="companion-picker-panel"
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.96 }}
            transition={{ type: 'spring', damping: 20, stiffness: 300 }}
            role="dialog"
            aria-label="Choisir un compagnon"
            aria-modal="true"
          >
            {/* Header */}
            <div className="companion-picker-header">
              <h2 className="companion-picker-title">
                🐾 Compagnon
              </h2>
              <button
                type="button"
                className="companion-picker-close"
                onClick={onClose}
                aria-label="Fermer"
              >
                ✕
              </button>
            </div>

            {/* Current companion name editor */}
            {companion && (
              <div className="companion-picker-current">
                <NameEditor
                  currentName={companion.name}
                  onSave={handleRenameCompanion}
                />
              </div>
            )}

            {/* Species grid */}
            <div className="companion-picker-grid" role="list" aria-label="Espèces disponibles">
              {COMPANION_SPECIES_CATALOG.map((spec) => {
                const isUnlocked = unlockedSpecies.includes(spec.id);
                const isActive = companion?.activeSpecies === spec.id;
                return (
                  <SpeciesCard
                    key={spec.id}
                    species={spec.id}
                    rarity={spec.rarity}
                    isUnlocked={isUnlocked}
                    isActive={isActive}
                    onSelect={handleSelectSpecies}
                  />
                );
              })}
            </div>

            {/* Hint */}
            <p className="companion-picker-hint">
              Les compagnons rares et épiques se débloquent via les coffres loot box.
            </p>

            {saving && (
              <div className="companion-picker-saving" aria-live="polite">
                Sauvegarde…
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
});

export default CompanionPicker;
