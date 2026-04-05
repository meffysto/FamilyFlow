import { memo, useCallback, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  getCompanionMood,
  getCompanionStage,
  pickCompanionMessage,
  COMPANION_SPECIES_CATALOG,
  type CompanionData,
  type CompanionMood,
  type CompanionSpecies,
} from '@family-vault/core';
import { useVault } from '../../contexts/VaultContext';
import './CompanionWidget.css';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Emoji représentatif par espèce de compagnon */
const SPECIES_EMOJI: Record<CompanionSpecies, string> = {
  chat: '🐱',
  chien: '🐶',
  lapin: '🐰',
  renard: '🦊',
  herisson: '🦔',
};

/** Indicateur visuel par humeur */
const MOOD_CONFIG: Record<CompanionMood, { emoji: string; label: string; color: string }> = {
  content: { emoji: '😊', label: 'Content', color: '#4ade80' },
  excite: { emoji: '🤩', label: 'Excité', color: '#facc15' },
  endormi: { emoji: '😴', label: 'Endormi', color: '#94a3b8' },
  triste: { emoji: '😢', label: 'Triste', color: '#60a5fa' },
};

/** Messages fallback français (pas de clé i18n chargée) */
const FALLBACK_MESSAGES: Record<string, string> = {
  'companion.msg.greeting.1': "Coucou ! Prêt pour une nouvelle journée ?",
  'companion.msg.greeting.2': "Salut ! Tu as l'air en forme aujourd'hui.",
  'companion.msg.greeting.3': "Me revoilà ! J'espère que ta journée se passe bien.",
  'companion.msg.taskDone.1': "Bravo, tu as terminé une tâche ! Continue comme ça !",
  'companion.msg.taskDone.2': "Super boulot ! Chaque tâche accomplie est une victoire.",
  'companion.msg.taskDone.3': "Tu cartonnes aujourd'hui, continue !",
  'companion.msg.harvest.1': "Quelle belle récolte ! La ferme est florissante.",
  'companion.msg.harvest.2': "Les fruits de ton travail ! Littéralement !",
  'companion.msg.loot.1': "Oooh, un coffre ! Voyons ce qu'il contient...",
  'companion.msg.loot.2': "La chance est avec toi aujourd'hui !",
  'companion.msg.levelUp.1': "Tu as monté de niveau ! Je suis fier de toi !",
  'companion.msg.levelUp.2': "Un nouveau palier franchi, félicitations !",
  'companion.msg.nudge.1': "Hé, tu n'as pas oublié tes tâches du jour ?",
  'companion.msg.nudge.2': "Un petit effort suffit pour garder ton élan !",
  'companion.msg.comeback.1': "Tu es de retour ! Ça faisait longtemps…",
  'companion.msg.comeback.2': "Content de te revoir ! On reprend ensemble ?",
  'companion.msg.morning.1': "Bonjour ! Une belle journée commence.",
  'companion.msg.morning.2': "Prêt pour une nouvelle aventure aujourd'hui ?",
  'companion.msg.morning.3': "Le soleil se lève, et toi aussi ! Allons-y !",
  'companion.msg.streak.1': "Waouh, quelle régularité ! Ton streak est impressionnant.",
  'companion.msg.streak.2': "Jour après jour tu avances — c'est ça la vraie force.",
  'companion.msg.celebration.1': "On fête ça ! Tu es incroyable.",
  'companion.msg.celebration.2': "Hourra ! Quelle journée fantastique !",
};

function resolveMessage(key: string): string {
  return FALLBACK_MESSAGES[key] ?? key;
}

// ---------------------------------------------------------------------------
// Companion Avatar
// ---------------------------------------------------------------------------

interface CompanionAvatarProps {
  species: CompanionSpecies;
  mood: CompanionMood;
  stage: string;
  onClick: () => void;
}

const CompanionAvatar = memo(function CompanionAvatar({
  species,
  mood,
  stage,
  onClick,
}: CompanionAvatarProps) {
  const moodCfg = MOOD_CONFIG[mood];
  const emoji = SPECIES_EMOJI[species] ?? '🐾';

  return (
    <motion.button
      type="button"
      className={`companion-avatar companion-avatar--${mood}`}
      onClick={onClick}
      whileTap={{ scale: 0.88 }}
      whileHover={{ scale: 1.06 }}
      aria-label={`Compagnon ${species} — ${moodCfg.label}`}
      style={{ '--mood-color': moodCfg.color } as React.CSSProperties}
    >
      <span className="companion-avatar-emoji" aria-hidden="true">{emoji}</span>
      <span className="companion-mood-dot" aria-label={`Humeur: ${moodCfg.label}`}>
        {moodCfg.emoji}
      </span>
      <span className="companion-stage-badge">{stage}</span>
    </motion.button>
  );
});

// ---------------------------------------------------------------------------
// Message Bubble
// ---------------------------------------------------------------------------

interface MessageBubbleProps {
  message: string;
  visible: boolean;
}

const MessageBubble = memo(function MessageBubble({ message, visible }: MessageBubbleProps) {
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className="companion-bubble"
          initial={{ opacity: 0, y: 8, scale: 0.92 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 8, scale: 0.92 }}
          transition={{ type: 'spring', damping: 18, stiffness: 280 }}
          role="status"
          aria-live="polite"
        >
          <p className="companion-bubble-text">{message}</p>
          <div className="companion-bubble-arrow" aria-hidden="true" />
        </motion.div>
      )}
    </AnimatePresence>
  );
});

// ---------------------------------------------------------------------------
// XP Bonus badge
// ---------------------------------------------------------------------------

const XpBonusBadge = memo(function XpBonusBadge() {
  return (
    <div className="companion-xp-bonus" title="Bonus XP compagnon actif">
      <span aria-hidden="true">⭐</span>
      <span>+5% XP</span>
    </div>
  );
});

// ---------------------------------------------------------------------------
// CompanionWidget — exported component
// ---------------------------------------------------------------------------

interface CompanionWidgetProps {
  /** Compact mode — réduit le widget à l'avatar seul */
  compact?: boolean;
  /** Callback quand l'utilisateur clique sur "Changer de compagnon" */
  onOpenPicker?: () => void;
}

export const CompanionWidget = memo(function CompanionWidget({
  compact = false,
  onOpenPicker,
}: CompanionWidgetProps) {
  const { activeProfile } = useVault();
  const [showBubble, setShowBubble] = useState(false);
  const [currentMessage, setCurrentMessage] = useState('');

  const companion: CompanionData | null = activeProfile?.companion ?? null;
  const level = activeProfile?.level ?? 1;
  const streak = activeProfile?.streak ?? 0;

  // Compute mood based on context
  const hourNow = new Date().getHours();
  const mood = companion
    ? getCompanionMood(0, 0, hourNow)
    : 'content';

  const stage = companion
    ? getCompanionStage(level)
    : 'bebe';

  const stageLabel: Record<string, string> = {
    bebe: 'Bébé',
    jeune: 'Jeune',
    adulte: 'Adulte',
  };

  const handleAvatarClick = useCallback(() => {
    if (!companion) return;
    // Pick a random contextual message
    const event = streak >= 3 ? 'streak_milestone' : 'greeting';
    const msgKey = pickCompanionMessage(event, {
      profileName: activeProfile?.name ?? '',
      companionName: companion.name,
      companionSpecies: companion.activeSpecies,
      tasksToday: 0,
      streak,
      level,
    });
    setCurrentMessage(resolveMessage(msgKey));
    setShowBubble(true);

    // Auto-hide after 3 seconds
    setTimeout(() => setShowBubble(false), 3000);
  }, [companion, streak, level, activeProfile]);

  // No companion — show empty state
  if (!companion) {
    return (
      <div className="companion-widget companion-widget--empty">
        <span className="companion-empty-icon" aria-hidden="true">🐾</span>
        <p className="companion-empty-text">Aucun compagnon</p>
        {onOpenPicker && (
          <button
            type="button"
            className="companion-pick-btn"
            onClick={onOpenPicker}
          >
            Choisir un compagnon
          </button>
        )}
      </div>
    );
  }

  return (
    <div className={`companion-widget${compact ? ' companion-widget--compact' : ''}`}>
      {/* Message bubble — appears above avatar */}
      <MessageBubble message={currentMessage} visible={showBubble} />

      {/* Avatar */}
      <CompanionAvatar
        species={companion.activeSpecies}
        mood={mood}
        stage={stageLabel[stage] ?? stage}
        onClick={handleAvatarClick}
      />

      {/* Details — hidden in compact mode */}
      {!compact && (
        <div className="companion-details">
          <div className="companion-name-row">
            <span className="companion-name">{companion.name}</span>
            <span className="companion-species-label">
              {COMPANION_SPECIES_CATALOG.find(s => s.id === companion.activeSpecies)?.id ?? companion.activeSpecies}
            </span>
          </div>
          <div className="companion-mood-row">
            <span className="companion-mood-label">
              {MOOD_CONFIG[mood].emoji} {MOOD_CONFIG[mood].label}
            </span>
          </div>
          <XpBonusBadge />
          {onOpenPicker && (
            <button
              type="button"
              className="companion-change-btn"
              onClick={onOpenPicker}
            >
              Changer de compagnon
            </button>
          )}
        </div>
      )}
    </div>
  );
});

export default CompanionWidget;
