---
status: testing
phase: 52-stories-pipeline-d-valuation-auto-re-roll-qualit
source: 52-01-SUMMARY.md, 52-02-SUMMARY.md, 52-03-SUMMARY.md, 52-04-SUMMARY.md
started: 2026-05-06T20:30:00Z
updated: 2026-05-06T20:30:00Z
---

## Current Test

number: 1
name: Activation pipeline + génération bedtime story réelle (badge + frontmatter)
expected: |
  Avec setEvalEnabledOverride(true) au boot de l'app, génère une histoire pour un enfant.
  Sur le device :
  1. Frontmatter du .md créé contient quality_score, quality_dimensions, quality_issues, quality_evaluated_at
  2. Liste stories : badge couleur (vert ≥7 / ambre 4-7 / rouge <4) à côté du titre
  3. Tap badge → modal pageSheet FR avec issues + (après quelques secondes) sous-scores LLM-judge (Rythme/Originalité/Émotion/Fluidité) + justification ≤280 chars
  4. UX bedtime non dégradée (badge async, pas de blocage de la génération)
awaiting: user response

## Tests

### 1. Activation pipeline + génération bedtime story réelle (badge + frontmatter)
expected: setEvalEnabledOverride(true) → story générée a quality_* en frontmatter + badge UI couleur + modal détails FR avec sous-scores LLM-judge async
result: [pending]

### 2. Re-roll cap 1 in vivo (forcer un hardFail)
expected: Forcer un hardFail (story très courte ou tags TTS sur voice ≠ eleven_v3) → 1 seul retry max, frontmatter final a quality_retried: true, story shippée même si 2ème échoue, pas de boucle
result: [pending]

## Summary

total: 2
passed: 0
issues: 0
pending: 2
skipped: 0
blocked: 0

## Gaps

[none yet]
