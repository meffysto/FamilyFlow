/**
 * effort.ts — Classification d'effort par titre de tâche (chronotype).
 *
 * Time-blocking v2.
 *
 * Détecte le type d'effort dominant d'une tâche depuis son texte pour permettre
 * un placement chronotype-aware (Pink, "When") :
 *  - focus    : implicite (par défaut), pic cognitif → matin
 *  - admin    : appels/email/papiers → aprem (trough, low-stakes répétitif)
 *  - physical : ménage/courses → pas d'affinité forte (fallback nextfit)
 *  - social   : famille/amis → soir
 *
 * Module pur (aucune dépendance React/RN) — testable en Node.
 */

export type EffortType = 'focus' | 'admin' | 'physical' | 'social';

/**
 * Détecte le type d'effort dominant depuis le titre de la tâche.
 * Retourne null si aucun mot-clé reconnu (= focus implicite).
 *
 * Ordre important : social est testé AVANT admin pour que "appeler maman"
 * tombe en social plutôt qu'en admin (l'intention sociale prime).
 */
export function titleToEffort(text: string): EffortType | null {
  if (!text) return null;
  // Social : famille, amis, visite, anniversaire, appeler maman/papa/mamie/papi
  if (/\b(famille|amis?|visite|anniversaire|maman|papa|mamie|papi)\b/i.test(text)) return 'social';
  // Admin : appeler, téléphoner, email, RDV, payer, déclarer, formulaire, papier, banque, facture, courrier, impôt
  if (/\b(appel(?:er|e)?|t[ée]l[ée]phon\w*|e[\s-]?mail|mail|rdv|payer|d[ée]clar\w*|formulaire|papier|banque|facture|courrier|imp[oô]t)\b/i.test(text)) return 'admin';
  // Physique : ranger, nettoyer, laver, courses, jardin, garage, repasser, plier, aspirer, balayer, sortir poubelle
  if (/\b(ranger|nettoyer|laver|courses|jardin|garage|repasser|plier|aspirer|balayer|sortir poubelle)\b/i.test(text)) return 'physical';
  return null; // focus = implicite (par défaut)
}
