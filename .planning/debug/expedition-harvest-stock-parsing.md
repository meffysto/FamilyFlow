---
status: awaiting_human_verify
trigger: "Dans les expéditions, le stock des récoltes du profil n'est pas correctement parsé — les pommes de terre ne sont pas visibles pour lancer une expédition"
created: 2026-04-15T00:00:00Z
updated: 2026-04-15T02:00:00Z
---

## Current Focus

hypothesis: CONFIRMÉ — useExpeditions utilisait profiles.find(p => p.role === 'adulte') au lieu d'activeProfile, causant un mauvais profil sélectionné dans les familles avec plusieurs adultes
test: Corrigé — currentProfile utilise désormais activeProfile ?? profiles.find(p => p.role === 'adulte') ?? profiles[0]
expecting: Le profil actif (Maman ou Papa selon qui est connecté) voit son inventaire de récoltes dans l'écran expéditions
next_action: Vérifier en ouvrant l'app + l'écran expéditions

## Symptoms

expected: Les pommes de terre (et autres récoltes) du profil actif doivent apparaître dans le stock disponible pour lancer une expédition
actual: Betteraves affichées : 1 au lieu de 2 ; Pommes de terre affichées : 0 au lieu de 16
errors: Aucun message d'erreur visible — le stock apparaît simplement vide ou incomplet
reproduction: Ouvrir l'écran des expéditions → essayer de lancer une expédition → le stock de pommes de terre n'apparaît pas
started: Comportement observé récemment

## Eliminated

- hypothesis: Le parser parseHarvestInventory ne gère pas le format CSV correctement
  evidence: Lecture du code — parseHarvestInventory gère parfaitement cropId:qty,cropId:qty
  timestamp: 2026-04-15

- hypothesis: Le cropId 'potato' ne correspond pas entre le catalogue et le vault
  evidence: CROP_CATALOG utilise 'potato' et c'est ce qui est sérialisé/parsé — pas de mismatch
  timestamp: 2026-04-15

- hypothesis: parseFarmProfile a un bug de parsing sur les lignes farm_harvest_inventory
  evidence: Le parser lit les lignes key: value correctement, trim() sur la valeur
  timestamp: 2026-04-15

- hypothesis: useExpeditions utilisait le mauvais chemin fichier (04 - Gamification/farm-${id}.md)
  evidence: Chemin corrigé dans commit aafd7fc mais le problème persistait avec betteraves=1 et potatoes=0
  timestamp: 2026-04-15

## Evidence

- timestamp: 2026-04-15
  checked: hooks/useExpeditions.ts — farmFilePath function
  found: function farmFilePath retournait '04 - Gamification/farm-${profileId}.md' (CORRIGÉ dans aafd7fc)
  implication: Ce fix a partiellement aidé mais n'a pas tout résolu

- timestamp: 2026-04-15
  checked: hooks/useExpeditions.ts — currentProfile derivation
  found: currentProfile = profiles.find(p => p.role === 'adulte') ?? profiles[0] — toujours le PREMIER adulte du tableau
  implication: Dans une famille avec plusieurs adultes (Papa + Maman), cela retourne toujours le premier adulte dans famille.md, peu importe qui est actif

- timestamp: 2026-04-15
  checked: app/(tabs)/tree.tsx — expedition invocation
  found: expeditionHarvestInventory vient de useExpeditions(expeditionTreeStage) ; expeditionTreeStage basé sur profile?.points (profil actif/consulté)
  implication: tree.tsx utilise le bon profil pour l'arbre mais useExpeditions ignore l'activeProfile

- timestamp: 2026-04-15
  checked: contexts/VaultContext.tsx (via useVault) — activeProfile
  found: activeProfile: Profile | null est exporté par useVault() — c'est le profil sélectionné par l'utilisateur
  implication: useExpeditions pouvait utiliser activeProfile directement au lieu de chercher le premier adulte

- timestamp: 2026-04-15
  checked: Comparaison symptômes betteraves=1/potatoes=0 vs inventaire réel betteraves=2/potatoes=16
  found: Le premier adulte dans le tableau de profils a betteraves=1 et potatoes=0 ; le profil actif (second adulte) a betteraves=2 et potatoes=16
  implication: Prouve la mismatch de profil — currentProfile pointait sur le mauvais adulte

## Resolution

root_cause: Dans hooks/useExpeditions.ts, currentProfile était dérivé via profiles.find(p => p.role === 'adulte') ?? profiles[0] — toujours le premier adulte dans famille.md. Dans une famille à deux adultes, si le profil actif n'est pas le premier adulte du tableau, l'inventaire de récoltes affiché est celui du mauvais adulte (d'où betteraves=1 au lieu de 2, et potatoes=0 au lieu de 16).
fix: Remplacer profiles.find(p => p.role === 'adulte') par activeProfile ?? profiles.find(p => p.role === 'adulte') ?? profiles[0] dans useExpeditions.ts. Aussi ajouter activeProfile au destructuring de useVault(). Correction d'une ligne.
verification: tsc --noEmit = 0 erreurs (hors pré-existantes)
files_changed: [hooks/useExpeditions.ts]
