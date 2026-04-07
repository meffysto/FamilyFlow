# Phase 15: Préférences alimentaires - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Use `15-CONTEXT.md` as the canonical source of decisions.

**Date:** 2026-04-07
**Mode:** discuss (interactive, no advisor)

## Zones grises présentées

1. Point d'entrée UI
2. Affichage badges recette
3. Saisie vocale UX
4. Matching ingrédients (NON-sélectionnée → Claude's discretion)

**Sélection utilisateur:** 1, 2, 3

---

## Zone 1 — Point d'entrée UI

### Q1.1 — Où l'utilisateur gère les préférences alimentaires d'un membre famille ?
**Options:**
- Modal détail profil (Recommandé) — ProfileDetailModal réutilisable
- **[CHOISI]** Écran dédié Préfs alim — depuis more.tsx, liste membres + invités côte à côte
- Section inline settings — CollapsibleSection dans settings.tsx

### Q1.2 — Où gérer les invités récurrents (PREF-06/07) ?
**Options:**
- **[CHOISI]** Même écran que membres (Recommandé)
- Écran séparé Invités

### Q1.3 — Sélecteur "qui mange ce soir" (PREF-08) ?
**Options:**
- **[CHOISI]** Bouton ad hoc dans détail recette (Recommandé) — sélecteur volatil, préserve PREF-FUT-01
- Persisté dans MealItem
- Sélecteur global session

### Q1.4 — Catalogue UI ajout allergène ?
**Options:** Input + suggestions chips / Liste fermée à cocher / Chips toggleables inline
**Réponse user (texte libre):** "N'oublie pas que ce n'est pas QUE pour les allergènes mais aussi pour les préférences en général"
→ Reformulation nécessaire car les 14 UE ne couvrent pas intolérances/régimes/aversions.

### Q1.5 (follow-up) — Structure input pour les 4 catégories ?
**Options:**
- **[CHOISI]** 4 sections + autocomplete par catégorie (Recommandé)
- 4 sections, texte libre partout + suggestions
- Une seule section unifiée + sélecteur sévérité

### Q1.6 (follow-up) — Quels catalogues canoniques créer ? (multiSelect)
**Réponse user:** TOUS les 4 sélectionnés
- 14 allergènes UE
- Catalogue intolérances courantes
- Catalogue régimes courants
- Aversions = texte libre uniquement

---

## Zone 2 — Affichage badges recette

### Q2.1 — Où placer le badge de conflit ?
**Options:**
- **[CHOISI]** Bandeau global haut + inline ingrédients (Recommandé)
- Bandeau haut uniquement
- Inline ingrédients uniquement
- Modal bloquante au mount

### Q2.2 — Bandeau global affiche toutes sévérités ou seulement allergies ?
**Options:**
- **[CHOISI]** Toutes sévérités, hiérarchisé (Recommandé)
- Allergies seulement (P0)

### Q2.3 — Profil cible par défaut à l'ouverture d'une recette ?
**Options:**
- **[CHOISI]** Toute la famille (union, Recommandé)
- Profil actif uniquement
- Famille + invités connus

### Q2.4 — PREF-11 enforcement technique ?
**Options:**
- **[CHOISI]** Pas de bouton close, ignoré par swipe (Recommandé) — test unitaire dédié
- Bouton dismiss qui re-trigger

---

## Zone 3 — Saisie vocale UX

### Q3.1 — Où placer le bouton DictaphoneRecorder ?
**Options:**
- **[CHOISI]** Bouton flottant global haut d'écran (Recommandé) — pattern existant meals/budget/journal
- Bouton micro par profil
- Bouton micro par catégorie

### Q3.2 — Que se passe-t-il après la transcription IA ?
**Options:**
- **[CHOISI]** Modal preview éditable + valider (Recommandé) — sécurité élevée
- Auto-commit + toast undo
- Toast confirmation simple Oui/Non

### Q3.3 — Gestion dictée multi-items ?
**Options:**
- **[CHOISI]** Parsing multi-items + preview liste (Recommandé) — checkbox par item
- Premier item seulement
- Refus multi-items

### Q3.4 — Erreur ai-service.ts ou basse confiance ?
**Options:**
- **[CHOISI]** Ouvrir modale d'ajout manuel pré-rempli (Recommandé)
- Toast erreur + retry
- Alerte + cancel

---

## Synthèse

**Décisions finales:** voir `15-CONTEXT.md`
**Zones laissées en Claude's discretion:**
- Matching ingrédients .cook ↔ catalogue (substring + aliases manuels FR + normalisation accents/singulier, conservatisme P0)
- Format récap planificateur PREF-12
- Choix domain hook (`useDietary` vs extension `useProfiles`)
- Structure exacte fichiers `lib/dietary*.ts`

**Pas de scope creep enregistré.**
