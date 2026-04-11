---
status: partial
phase: 29-avatars-vivants-portail-retour
source: [29-VERIFICATION.md]
started: 2026-04-11T00:00:00Z
updated: 2026-04-11T00:00:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Rendu pixel art + positionnement déterministe des avatars
expected: Un sprite compagnon par profil actif (hors grossesse) apparaît à un emplacement fixe sur la carte village ; même profil → même slot à chaque ouverture (tri alphabétique stable profile.id) ; pas de chevauchement avec fountain/stalls/board
result: [pending]

### 2. Halo pulse + opacité inactive (indicateur hebdo)
expected: Halo `colors.success` oscillant opacity 0.5 ↔ 0.8 en 2s (withRepeat) sur profils ayant ≥ 1 contribution cette semaine ; sprite à 55% opacité sans halo sur profils inactifs ; différenciation visuelle immédiate
result: [pending]

### 3. Bulle tooltip tap avatar + clamp horizontal
expected: Tap sur avatar → bulle "[Prénom] — X contribution(s) cette semaine" (ou "pas encore contribué" si 0), entrée fade+slide 180ms, dismiss auto 2.5s, sortie 150ms ; pluriel FR conditionnel ('s' si ≥2) ; tooltip ne déborde jamais du container même sur avatar en bord de carte ; Haptics.selectionAsync au tap
result: [pending]

### 4. Fade cross-dissolve 400ms symétrique + ping-pong
expected: Tap portail bas-droit village (0.85/0.85) → fade cross-dissolve Reanimated 400ms `Easing.out(Easing.ease)` → arrivée sur ferme (écran pleine opacité) ; tap portail ferme → retour village (écran pleine opacité, P3 useFocusEffect reset) ; durée et easing identiques côté aller (tree.tsx) ; aucun écran invisible après aller-retour multiple
result: [pending]

### 5. Header village épuré (portail seul point de sortie)
expected: Absence totale du bouton header `‹` (backBtn) — seul le titre "Place du Village" est visible au centre du header ; confirmation UX D-19 (le portail retour est le seul chemin ferme ← village)
result: [pending]

## Summary

total: 5
passed: 0
issues: 0
pending: 5
skipped: 0
blocked: 0

## Gaps
