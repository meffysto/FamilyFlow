---
phase: quick-260410-qv2
plan: 01
subsystem: journal
tags: [journal, grossesse, bug-fix, template]
dependency_graph:
  requires: []
  provides: [journal-adulte-grossesse-template, journal-texte-multiline-fix]
  affects: [app/(tabs)/journal.tsx, lib/parser.ts]
tech_stack:
  added: []
  patterns: [blockquote-fields, numbered-list-sections, conditional-template]
key_files:
  created: []
  modified:
    - app/(tabs)/journal.tsx
    - lib/parser.ts
decisions:
  - "SommeilAdulte et SymptomeAdulte ajoutés comme EntryType distincts pour découpler du rendu bébé"
  - "typeFromHeading vérifie 'suivi sommeil' avant 'sommeil' pour éviter collision avec type Sieste bébé"
  - "Template grossesse utilise headings uniques (Suivi Sommeil, Symptômes) pour mapping sans ambiguïté"
  - "parseRowToFields SommeilAdulte parse les lignes blockquote individuellement (pas split par |)"
metrics:
  duration: "~5min"
  completed_date: "2026-04-10"
  tasks_completed: 2
  files_modified: 2
---

# Phase quick-260410-qv2 Plan 01: Fix Journal Adulte Grossesse — Bug Texte Coupé + Sections Structurées

**One-liner:** Bug fix alignement texte multiline + template journal grossesse avec suivi Sommeil/Symptômes/Humeur via EntryTypes dédiés et blockquote parsing.

## Objectif

Corriger le texte coupé dans les observations du journal adulte et ajouter des sections structurées (Sommeil, Symptômes, Humeur) pour le profil grossesse.

## Tâches Exécutées

| Tâche | Nom | Commit | Fichiers |
|-------|-----|--------|---------|
| 1 | Fix bug texte coupé + rendu sections adultes | 18f8eb0 | app/(tabs)/journal.tsx |
| 2 | Template journal adulte grossesse | 6bf22da | lib/parser.ts, app/(tabs)/journal.tsx |

## Détail des Changements

### Tâche 1 — Bug fix texte coupé + rendu sections adultes (18f8eb0)

**Bug fix obsRow:**
- `alignItems: 'center'` → `alignItems: 'flex-start'` dans le style `obsRow` (ligne ~1021)
- `flex: 1` ajouté sur le `MarkdownText` dans les observations pour expansion complète

**Nouveaux EntryTypes:**
- `type EntryType = '...' | 'SommeilAdulte' | 'SymptomeAdulte'`

**typeFromHeading étendu:**
- Check `'suivi sommeil'` → `SommeilAdulte` placé AVANT le check `'sommeil'` → `Sieste` (évite collision)
- Check `'symptôme'`/`'symptome'` → `SymptomeAdulte`

**getFieldConfigs étendu:**
- `SommeilAdulte`: coucher, lever, qualite (numeric), notes
- `SymptomeAdulte`: text

**getEntryMeta étendu:**
- `SommeilAdulte: { emoji: '😴', label: 'Sommeil' }`
- `SymptomeAdulte: { emoji: '🤒', label: 'Symptôme' }`

**sectionNameForType étendu:**
- `SommeilAdulte` → `'Suivi Sommeil'`
- `SymptomeAdulte` → `'Symptômes'`

**buildRowFromFields étendu:**
- `SommeilAdulte`: génère les 4 lignes blockquote `> **Champ**: valeur`
- `SymptomeAdulte`: retourne `fields.text`

**parseRowToFields étendu:**
- `SommeilAdulte`: parse chaque ligne blockquote via regex `\*\*Champ\*\*:\s*(.*)`
- `SymptomeAdulte`: identique à Observation (numbered list)

**renderSections — nouveaux blocs:**
- `SommeilAdulte`: parse les lignes blockquote `> **Label**: valeur`, affiche en paires label/valeur
- `SymptomeAdulte`: identique au bloc Observation (liste numérotée avec edit/add)

### Tâche 2 — Template grossesse (6bf22da)

**lib/parser.ts — generateAdultJournalTemplate:**
- Signature étendue: `(prenom: string, options?: { grossesse?: boolean }): string`
- Si `options.grossesse === true`: génère template avec 5 sections:
  - `## 😴 Suivi Sommeil` (blockquote Coucher/Lever/Qualité/Notes)
  - `## 🤒 Symptômes` (liste numérotée)
  - `## 😊 Humeur & Observations` (blockquote)
  - `## 🎯 Objectifs`
  - `## 🙏 Gratitude`
  - Tag `journal-grossesse` ajouté au frontmatter
- Si `options.grossesse` absent/false: template adulte normal **inchangé** (Notes du jour, Humeur, Objectifs, Gratitude)

**app/(tabs)/journal.tsx — createJournal:**
- `generateAdultJournalTemplate(activeProfile.name)` → `generateAdultJournalTemplate(activeProfile.name, { grossesse: activeProfile.statut === 'grossesse' })`

## Deviations from Plan

None — plan exécuté tel quel.

## Vérification

- `npx tsc --noEmit` : passe sans nouvelles erreurs (0 erreurs)
- Template grossesse contient les 5 sections structurées
- Template adulte normal inchangé
- obsRow `alignItems: 'flex-start'` + `flex: 1` sur MarkdownText
- typeFromHeading : 'suivi sommeil' → SommeilAdulte, 'symptôme' → SymptomeAdulte (sans collision avec Sieste bébé)

## Known Stubs

Aucun stub — les sections SommeilAdulte et SymptomeAdulte sont correctement câblées et s'affichent dans le rendu journal.

## Self-Check: PASSED

- `app/(tabs)/journal.tsx` : modifié ✓
- `lib/parser.ts` : modifié ✓
- Commit 18f8eb0 : ✓
- Commit 6bf22da : ✓
