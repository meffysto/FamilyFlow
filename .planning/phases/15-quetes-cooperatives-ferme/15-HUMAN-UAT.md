---
status: partial
phase: 15-quetes-cooperatives-ferme
source: [15-VERIFICATION.md]
started: 2026-04-07T00:00:00Z
updated: 2026-04-07T00:00:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Animation FadeInDown et barre de progression
expected: La bannière glisse depuis le bas (FadeInDown), la barre affiche le bon ratio current/target, les avatars de contribution s'affichent
result: [pending]

### 2. Role gate UI — bouton invisible pour enfant
expected: Le bouton '+ Nouvelle quête familiale' n'est PAS visible quand le profil actif a role='enfant'. Un profil adulte/ado voit le bouton.
result: [pending]

### 3. Notification d'expiration quête
expected: Une notification locale apparaît immédiatement au rechargement quand une quête active a une endDate < today, avec le titre 'Quête expirée'
result: [pending]

### 4. Complétion de quête avec reward ferme
expected: Quand current >= target, taper 'Compléter la quête' dans le detail sheet applique la récompense (lootBoxesAvailable++, farmRareSeeds+, ou activeEffect dans family-quests.md selon le type)
result: [pending]

## Summary

total: 4
passed: 0
issues: 0
pending: 4
skipped: 0
blocked: 0

## Gaps
