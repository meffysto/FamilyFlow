---
status: partial
phase: 05-visuels-ferme
source: [05-VERIFICATION.md]
started: 2026-03-28
updated: 2026-03-28
---

## Current Test

[awaiting human testing]

## Tests

### 1. Cycle jour/nuit en temps reel
expected: Changer l'heure du device a 21h00, attendre ~60s, verifier que le tint bleu/violet apparait avec un fondu de ~2s
result: [pending]

### 2. Animation balancement cultures
expected: Le decalage vertical 1px entre frame A et frame B produit un balancement perceptible a tous les stades de croissance
result: [pending]

### 3. Direction de marche des animaux
expected: Les frames walk_left sont visuellement distinctes de walk_down, le flip scaleX fonctionne pour la marche a droite, et les bulles de pensee ne sont pas flippees
result: [pending]

### 4. Accessibilite Reduced Motion
expected: Activer Reduce Motion dans les reglages iOS desactive toutes les animations de frame (cultures + animaux)
result: [pending]

## Summary

total: 4
passed: 0
issues: 0
pending: 4
skipped: 0
blocked: 0

## Gaps
