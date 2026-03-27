// ─────────────────────────────────────────────
// Sagas narratives — Types & interfaces
// ─────────────────────────────────────────────

/** 5 traits de personnalité accumulés par les choix */
export type SagaTrait = 'courage' | 'sagesse' | 'générosité' | 'malice' | 'curiosité';

/** Tous les traits possibles (pour itération) */
export const ALL_TRAITS: SagaTrait[] = ['courage', 'sagesse', 'générosité', 'malice', 'curiosité'];

/** Un choix proposé dans un chapitre */
export interface SagaChoice {
  id: string;               // 'A' | 'B' | 'C'
  labelKey: string;         // clé i18n du bouton
  emoji: string;
  traits: Partial<Record<SagaTrait, number>>;  // ex: { courage: 2, sagesse: 1 }
  points: number;           // XP immédiat (5-15)
}

/** Un chapitre dans une saga */
export interface SagaChapter {
  id: number;               // 1, 2, 3... (1-indexed)
  narrativeKey: string;     // clé i18n du texte narratif principal
  choices: SagaChoice[];    // 2-3 choix
  cliffhangerKey: string;   // texte post-choix ("La suite demain...")
  /** Variantes narratives selon le trait dominant jusqu'ici */
  narrativeVariants?: Partial<Record<SagaTrait, string>>;  // trait → clé i18n alt
}

/** Variante de finale selon le trait dominant */
export interface SagaFinaleVariant {
  narrativeKey: string;     // texte de conclusion
  rewardItemId: string;     // ID décoration ou habitant exclusif
  rewardType: 'mascot_deco' | 'mascot_hab';
  bonusXP: number;          // 20-50 points bonus
  titleKey: string;         // titre temporaire sous le nom ("L'Explorateur")
}

/** Finale de saga avec variantes par trait */
export interface SagaFinale {
  variants: Partial<Record<SagaTrait, SagaFinaleVariant>>;
  /** Trait par défaut en cas d'ex-aequo */
  defaultTrait: SagaTrait;
}

/** Définition complète d'une saga */
export interface Saga {
  id: string;               // 'voyageur_argent', etc.
  emoji: string;
  titleKey: string;         // clé i18n titre
  descriptionKey: string;   // teaser affiché entre les sagas
  chapters: SagaChapter[];  // 3-5 chapitres
  finale: SagaFinale;
  sceneEmoji: string;       // émoji affiché dans le diorama pendant la saga
}

/** État de progression d'une saga pour un profil */
export interface SagaProgress {
  sagaId: string;
  profileId: string;
  currentChapter: number;   // 1-indexed, chapters.length = dernier chapitre
  choices: Record<number, string>;  // chapterNumber → choiceId
  traits: Record<SagaTrait, number>;
  startDate: string;        // YYYY-MM-DD
  lastChapterDate: string;  // YYYY-MM-DD du dernier chapitre complété
  status: 'active' | 'completed';
  rewardClaimed: boolean;
}

/** Résultat de complétion d'une saga */
export interface SagaCompletionResult {
  dominantTrait: SagaTrait;
  rewardItemId: string;
  rewardType: 'mascot_deco' | 'mascot_hab';
  bonusXP: number;
  titleKey: string;
  narrativeKey: string;
}

/** Crée un SagaProgress initial vide */
export function createEmptySagaProgress(sagaId: string, profileId: string, date: string): SagaProgress {
  return {
    sagaId,
    profileId,
    currentChapter: 1,
    choices: {},
    traits: { courage: 0, sagesse: 0, générosité: 0, malice: 0, curiosité: 0 },
    startDate: date,
    lastChapterDate: '',
    status: 'active',
    rewardClaimed: false,
  };
}
