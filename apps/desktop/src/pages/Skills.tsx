import { useState, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
// GlassCard — note: no className prop, wrap in div if custom layout needed
import { useVault } from '../contexts/VaultContext';
import {
  SKILL_CATEGORIES,
  AGE_BRACKETS,
  XP_PER_BRACKET,
  SKILL_TREE,
  getSkillsForBracket,
  getCategoriesForBracket,
  detectAgeBracket,
  type AgeBracketId,
  type SkillCategoryId,
  type SkillDefinition,
} from '@family-vault/core';

type SkillState = 'locked' | 'unlockable' | 'unlocked';
import './Skills.css';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getSkillById(id: string): SkillDefinition | undefined {
  return SKILL_TREE.find((s) => s.id === id);
}

function getSkillState(skillId: string, unlockedIds: Set<string>): SkillState {
  if (unlockedIds.has(skillId)) return 'unlocked';
  return 'unlockable';
}

// ---------------------------------------------------------------------------
// Category color map
// ---------------------------------------------------------------------------

const CATEGORY_COLORS: Record<string, string> = {
  motricite_globale: '#3B82F6',
  motricite_fine:    '#8B5CF6',
  langage:           '#10B981',
  proprete:          '#F59E0B',
  autonomie:         '#EF4444',
  cuisine:           '#F97316',
  menage:            '#6B7280',
  social:            '#EC4899',
  organisation:      '#0EA5E9',
  responsabilite:    '#14B8A6',
};

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

interface SkillCardProps {
  skill: SkillDefinition;
  state: SkillState;
  categoryColor: string;
  onPress: (skillId: string) => void;
}

function SkillCard({ skill, state, categoryColor, onPress }: SkillCardProps) {
  const { t } = useTranslation('skills');
  const label = t(`tree.${skill.id}`, { defaultValue: skill.label });
  const isLocked = state === 'locked';
  const isUnlocked = state === 'unlocked';

  return (
    <button
      className={`skill-card skill-card--${state}`}
      style={{ borderColor: isLocked ? undefined : categoryColor }}
      onClick={() => onPress(skill.id)}
      aria-label={label}
      aria-pressed={isUnlocked}
    >
      <div className="skill-card-icon" style={{ background: isLocked ? undefined : `${categoryColor}20` }}>
        {isUnlocked ? '✅' : isLocked ? '🔒' : '⭐'}
      </div>
      <span className="skill-card-label">{label}</span>
      {isUnlocked && <span className="skill-card-check" aria-hidden="true">✓</span>}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Detail panel
// ---------------------------------------------------------------------------

interface SkillDetailPanelProps {
  skill: SkillDefinition;
  state: SkillState;
  categoryColor: string;
  xp: number;
  unlockedAt?: string;
  onUnlock: () => void;
  onClose: () => void;
  isParent: boolean;
}

function SkillDetailPanel({ skill, state, categoryColor, xp, unlockedAt, onUnlock, onClose, isParent }: SkillDetailPanelProps) {
  const { t } = useTranslation('skills');
  const { t: tCommon } = useTranslation('common');
  const label = t(`tree.${skill.id}`, { defaultValue: skill.label });
  const category = SKILL_CATEGORIES.find((c) => c.id === skill.categoryId);
  const catLabel = t(`categories.${skill.categoryId}`, { defaultValue: skill.categoryId });
  const bracketInfo = AGE_BRACKETS.find((b) => b.id === skill.ageBracketId);
  const bracketLabel = t(`ageBrackets.${skill.ageBracketId}.label`, { defaultValue: skill.ageBracketId });

  return (
    <div className="skill-detail-overlay" onClick={onClose}>
      <div className="skill-detail-panel" onClick={(e) => e.stopPropagation()}>
        <button className="skill-detail-close" onClick={onClose} aria-label={tCommon('fermer', { defaultValue: 'Fermer' })}>
          ✕
        </button>

        <div className="skill-detail-header" style={{ borderColor: categoryColor }}>
          <span className="skill-detail-emoji">{category?.emoji ?? '🎯'}</span>
          <div>
            <h2 className="skill-detail-title">{label}</h2>
            <span className="skill-detail-meta">
              {catLabel} · {bracketLabel}
              {bracketInfo && ` (${bracketInfo.subtitle})`}
            </span>
          </div>
        </div>

        <div className="skill-detail-body">
          <div className="skill-detail-xp" style={{ color: categoryColor }}>
            ⚡ {xp} XP
          </div>

          {state === 'unlocked' && unlockedAt && (
            <p className="skill-detail-unlocked">
              {t('debloque', { defaultValue: 'Débloqué le' })} {unlockedAt.split('-').reverse().join('/')}
            </p>
          )}

          {state === 'unlockable' && isParent && (
            <button
              className="skill-detail-unlock-btn"
              style={{ background: categoryColor }}
              onClick={onUnlock}
            >
              {t('debloquer', { defaultValue: 'Débloquer cette compétence' })}
            </button>
          )}

          {!isParent && state === 'unlockable' && (
            <p className="skill-detail-parent-note">
              {t('parentRequired', { defaultValue: 'Un parent doit valider cette compétence.' })}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function Skills() {
  const { t } = useTranslation('skills');
  const { t: tCommon } = useTranslation('common');
  const { profiles, activeProfile, skillTrees, unlockSkill } = useVault();

  const [selectedChildId, setSelectedChildId] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<SkillCategoryId | 'all'>('all');
  const [selectedBracket, setSelectedBracket] = useState<AgeBracketId | null>(null);
  const [selectedSkillId, setSelectedSkillId] = useState<string | null>(null);

  const isParent = activeProfile?.role === 'adulte';

  const childProfiles = useMemo(
    () => profiles.filter((p) => p.role === 'enfant' || p.role === 'ado'),
    [profiles],
  );

  const selectedChild = useMemo(() => {
    if (activeProfile && (activeProfile.role === 'enfant' || activeProfile.role === 'ado')) {
      return activeProfile;
    }
    if (selectedChildId) return childProfiles.find((p) => p.id === selectedChildId) ?? childProfiles[0] ?? null;
    return childProfiles[0] ?? null;
  }, [activeProfile, selectedChildId, childProfiles]);

  const detectedBracket = useMemo((): AgeBracketId => {
    if (!selectedChild?.birthdate) return '3-5';
    return detectAgeBracket(selectedChild.birthdate);
  }, [selectedChild]);

  const activeBracket = selectedBracket ?? detectedBracket;

  const activeBracketInfo = useMemo(
    () => AGE_BRACKETS.find((b) => b.id === activeBracket),
    [activeBracket],
  );

  const categories = useMemo(
    () => getCategoriesForBracket(activeBracket),
    [activeBracket],
  );

  const skills = useMemo(() => {
    const all = getSkillsForBracket(activeBracket);
    if (selectedCategory === 'all') return all;
    return all.filter((s) => s.categoryId === selectedCategory);
  }, [activeBracket, selectedCategory]);

  const childTree = useMemo(
    () => skillTrees.find((tree) => tree.profileId === selectedChild?.id),
    [skillTrees, selectedChild],
  );

  const unlockedIds = useMemo(
    () => new Set(childTree?.unlocked.map((u) => u.skillId) ?? []),
    [childTree],
  );

  const { totalSkills, unlockedCount } = useMemo(() => {
    const allBracket = getSkillsForBracket(activeBracket);
    return {
      totalSkills: allBracket.length,
      unlockedCount: allBracket.filter((s) => unlockedIds.has(s.id)).length,
    };
  }, [activeBracket, unlockedIds]);

  const totalXp = unlockedCount * XP_PER_BRACKET[activeBracket];
  const progressPercent = totalSkills > 0 ? Math.round((unlockedCount / totalSkills) * 100) : 0;

  const selectedSkill = useMemo(() => {
    if (!selectedSkillId) return null;
    return getSkillById(selectedSkillId) ?? null;
  }, [selectedSkillId]);

  const selectedSkillState = useMemo((): SkillState => {
    if (!selectedSkillId) return 'locked';
    return getSkillState(selectedSkillId, unlockedIds);
  }, [selectedSkillId, unlockedIds]);

  const selectedSkillUnlock = useMemo(() => {
    if (!selectedSkillId || !childTree) return undefined;
    return childTree.unlocked.find((u) => u.skillId === selectedSkillId);
  }, [selectedSkillId, childTree]);

  const handleSkillPress = useCallback((skillId: string) => {
    setSelectedSkillId(skillId);
  }, []);

  const handleUnlock = useCallback(async () => {
    if (!selectedChild || !selectedSkillId) return;
    await unlockSkill(selectedSkillId, selectedChild.id);
    setSelectedSkillId(null);
  }, [selectedChild, selectedSkillId, unlockSkill]);

  const handleCloseDetail = useCallback(() => {
    setSelectedSkillId(null);
  }, []);

  if (childProfiles.length === 0) {
    return (
      <div className="skills-page">
        <div className="skills-empty">
          <span className="skills-empty-emoji">👶</span>
          <p>{tCommon('aucunEnfant', { defaultValue: 'Aucun profil enfant configuré.' })}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="skills-page">
      {/* Header */}
      <div className="skills-header">
        <div className="skills-header-top">
          <div>
            <h1 className="skills-title">{t('titre', { defaultValue: 'Compétences' })}</h1>
            {selectedChild && (
              <p className="skills-subtitle">
                {selectedChild.avatar} {selectedChild.name}
              </p>
            )}
          </div>

          {/* Child selector (parent with multiple children) */}
          {isParent && childProfiles.length > 1 && (
            <div className="skills-child-selector">
              {childProfiles.map((child) => (
                <button
                  key={child.id}
                  className={`skills-child-btn ${child.id === selectedChild?.id ? 'skills-child-btn--active' : ''}`}
                  onClick={() => setSelectedChildId(child.id)}
                  aria-label={child.name}
                  aria-pressed={child.id === selectedChild?.id}
                >
                  <span>{child.avatar}</span>
                  <span className="skills-child-name">{child.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Progress + bracket selector */}
      <div className="skills-progress-card glass-card-wrap">
        <div className="skills-progress-ring-wrap">
          <svg className="skills-progress-ring" viewBox="0 0 84 84" aria-hidden="true">
            <circle cx="42" cy="42" r="35" className="skills-ring-track" />
            <circle
              cx="42"
              cy="42"
              r="35"
              className="skills-ring-fill"
              strokeDasharray={`${2 * Math.PI * 35}`}
              strokeDashoffset={`${2 * Math.PI * 35 * (1 - (totalSkills > 0 ? unlockedCount / totalSkills : 0))}`}
              transform="rotate(-90 42 42)"
            />
          </svg>
          <div className="skills-ring-text">
            <span className="skills-ring-pct">{progressPercent}%</span>
            <span className="skills-ring-label">{t('complete', { defaultValue: 'complété' })}</span>
          </div>
        </div>

        <div className="skills-progress-info">
          <p className="skills-progress-count">
            {unlockedCount} / {totalSkills} {t('competences', { defaultValue: 'compétences' })}
          </p>
          <div className="skills-xp-badge">
            ⚡ {totalXp} XP {t('gagnes', { defaultValue: 'gagnés' })}
          </div>

          {/* Age bracket selector */}
          <div className="skills-bracket-selector">
            <span className="skills-bracket-label">{t('trancheAge', { defaultValue: 'Tranche d\'âge' })} :</span>
            <div className="skills-bracket-pills">
              {AGE_BRACKETS.map((b) => (
                <button
                  key={b.id}
                  className={`skills-bracket-pill ${activeBracket === b.id ? 'skills-bracket-pill--active' : ''}`}
                  onClick={() => setSelectedBracket(b.id === detectedBracket && !selectedBracket ? null : b.id)}
                  aria-pressed={activeBracket === b.id}
                >
                  {b.label}
                  {b.id === detectedBracket && <span className="skills-bracket-current">●</span>}
                </button>
              ))}
            </div>
          </div>

          {activeBracketInfo && (
            <p className="skills-bracket-subtitle">{activeBracketInfo.subtitle}</p>
          )}
        </div>
      </div>

      {/* Category filter */}
      <div className="skills-category-filter">
        <button
          className={`skills-cat-chip ${selectedCategory === 'all' ? 'skills-cat-chip--active' : ''}`}
          onClick={() => setSelectedCategory('all')}
        >
          {t('toutesCategories', { defaultValue: 'Toutes' })}
        </button>
        {categories.map((cat) => (
          <button
            key={cat.id}
            className={`skills-cat-chip ${selectedCategory === cat.id ? 'skills-cat-chip--active' : ''}`}
            style={selectedCategory === cat.id ? { background: `${CATEGORY_COLORS[cat.id] ?? cat.color}20`, borderColor: CATEGORY_COLORS[cat.id] ?? cat.color, color: CATEGORY_COLORS[cat.id] ?? cat.color } : undefined}
            onClick={() => setSelectedCategory(cat.id)}
          >
            {cat.emoji} {t(`categories.${cat.id}`, { defaultValue: cat.id })}
          </button>
        ))}
      </div>

      {/* Skills grid */}
      <div className="skills-section">
        {(selectedCategory === 'all' ? categories : categories.filter((c) => c.id === selectedCategory)).map((cat) => {
          const catSkills = skills.filter((s) => s.categoryId === cat.id);
          if (catSkills.length === 0) return null;
          const catColor = CATEGORY_COLORS[cat.id] ?? cat.color;
          const catUnlocked = catSkills.filter((s) => unlockedIds.has(s.id)).length;

          return (
            <div key={cat.id} className="skills-category-section">
              <div className="skills-category-header">
                <span className="skills-category-emoji">{cat.emoji}</span>
                <h2 className="skills-category-title" style={{ color: catColor }}>
                  {t(`categories.${cat.id}`, { defaultValue: cat.id })}
                </h2>
                <span className="skills-category-count">
                  {catUnlocked}/{catSkills.length}
                </span>
                <div className="skills-category-bar">
                  <div
                    className="skills-category-bar-fill"
                    style={{ width: `${catSkills.length > 0 ? (catUnlocked / catSkills.length) * 100 : 0}%`, background: catColor }}
                  />
                </div>
              </div>

              <div className="skills-grid">
                {catSkills.map((skill) => (
                  <SkillCard
                    key={skill.id}
                    skill={skill}
                    state={getSkillState(skill.id, unlockedIds)}
                    categoryColor={catColor}
                    onPress={handleSkillPress}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Detail panel overlay */}
      {selectedSkill && (
        <SkillDetailPanel
          skill={selectedSkill}
          state={selectedSkillState}
          categoryColor={CATEGORY_COLORS[selectedSkill.categoryId] ?? '#6B7280'}
          xp={XP_PER_BRACKET[selectedSkill.ageBracketId]}
          unlockedAt={selectedSkillUnlock?.unlockedAt}
          onUnlock={handleUnlock}
          onClose={handleCloseDetail}
          isParent={isParent}
        />
      )}
    </div>
  );
}
