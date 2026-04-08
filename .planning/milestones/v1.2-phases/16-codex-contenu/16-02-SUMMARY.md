---
phase: 16-codex-contenu
plan: 02
subsystem: codex
tags: [codex, cultures, animals, loot, i18n, lore]
requires:
  - "lib/codex/types.ts (CropEntry, AnimalEntry, LootEntry) — Plan 16-01"
  - "locales/fr/codex.json + locales/en/codex.json (squelette vide) — Plan 16-01"
provides:
  - "lib/codex/cultures.ts (cropEntries dérivé de CROP_CATALOG, 15 entrées)"
  - "lib/codex/animals.ts (animalEntries dérivé de INHABITANTS, 17 entrées) + computeSubgroup()"
  - "lib/codex/loot.ts (lootEntries 8 entrées : golden_crop + 3 HARVEST_EVENTS + 4 RARE_SEED_DROP_RULES)"
  - "Re-export farm-engine constants (GOLDEN_CROP_CHANCE, GOLDEN_HARVEST_MULTIPLIER, HARVEST_EVENTS, RARE_SEED_DROP_RULES)"
  - "Lore FR+EN pour 15 crops (dont 4 dropOnly), 17 animals (dont 2 sagaExclusive), 8 loot"
affects:
  - "locales/fr/codex.json"
  - "locales/en/codex.json"
tech_stack:
  added: []
  patterns:
    - "Pattern .map(source => CodexEntry) — anti-drift D-02, aucune duplication de stats engine"
    - "Agrégation loot multi-sources (scalaires + events + drop rules) dans un seul array typé"
    - "Re-export de constantes engine pour découpler l'UI Phase 17 de farm-engine"
key_files:
  created:
    - "lib/codex/cultures.ts"
    - "lib/codex/animals.ts"
    - "lib/codex/loot.ts"
  modified:
    - "locales/fr/codex.json"
    - "locales/en/codex.json"
decisions:
  - "INHABITANTS contient 17 entrées (pas 18) — vérifié à la lecture de lib/mascot/types.ts, le plan estimait ~18"
  - "Mapping subgroup : sagaExclusive → 'saga', rarity épique/légendaire/prestige → 'fantasy', sinon 'farm'"
  - "loot.ts re-exporte les 4 constantes farm-engine pour que l'UI Phase 17 n'ait pas à ré-importer depuis mascot/"
  - "Lore golden_crop fait référence aux noms de constantes engine (GOLDEN_CROP_CHANCE, GOLDEN_HARVEST_MULTIPLIER) plutôt qu'aux valeurs — anti-drift D-02 étendu au texte lore"
requirements: [CODEX-02, CODEX-04, CODEX-05]
metrics:
  duration: "15min"
  completed_date: "2026-04-08"
  tasks: 3
  files_changed: 5
---

# Phase 16 Plan 02 : Cultures, Animaux & Loot — Summary

Génération des 3 premiers arrays du codex : 15 cultures (CROP_CATALOG), 17 animaux (INHABITANTS avec classement farm/fantasy/saga), et 8 entrées loot agrégeant golden_crop + HARVEST_EVENTS + RARE_SEED_DROP_RULES. Lore FR+EN rédigée pour les 40 entrées (80 blocs name+lore au total), avec traitement spécial des 4 crops dropOnly et des 2 animaux sagaExclusive (CODEX-05), et documentation explicite des pluies dorées (CODEX-04).

## Tâches exécutées

| Task | Description | Commit |
|------|-------------|--------|
| 1 | lib/codex/cultures.ts + lore 15 crops FR/EN | b60b7af |
| 2 | lib/codex/animals.ts + computeSubgroup + lore 17 animaux FR/EN | 951d4cb |
| 3 | lib/codex/loot.ts + re-export farm-engine + lore 8 loot FR/EN | e6470a2 |

## Artefacts livrés

### `lib/codex/cultures.ts`
`cropEntries: CropEntry[]` dérivé directement de `CROP_CATALOG.map(crop => ...)`. 15 entrées générées automatiquement, zéro stat numérique dans le fichier (anti-drift D-02 : les stats seront lues à la demande via `getCropStats()` de `lib/codex/stats.ts` construit au plan 16-01). Les 4 crops dropOnly (`orchidee`, `rose_doree`, `truffe`, `fruit_dragon`) sont présents dans le mapping au même titre que les autres — leur statut dropOnly est déjà porté par `CROP_CATALOG` et accessible via les helpers stats.

### `lib/codex/animals.ts`
`animalEntries: AnimalEntry[]` dérivé de `INHABITANTS.map(...)`. Chaque entrée calcule :
- `subgroup` via `computeSubgroup(rarity, sagaExclusive)` :
  - `sagaExclusive === true` → `'saga'` (2 entrées : esprit_eau, ancien_gardien)
  - rarity ∈ {`'épique'`, `'légendaire'`, `'prestige'`} → `'fantasy'` (4 entrées : fee, dragon, phoenix, licorne)
  - sinon → `'farm'` (11 entrées : poussin, poulet, canard, cochon, vache, oiseau, ecureuil, papillons, coccinelle, chat, hibou)
- `dropOnly = sagaExclusive === true` (porte CODEX-05 au niveau animal)

Total : 17 entrées (le plan estimait ~18, vérification live a donné 17).

### `lib/codex/loot.ts`
`lootEntries: LootEntry[]` avec 8 entrées :
- 1 entrée `golden_crop` (lootType `'golden_crop'`)
- 3 entrées spread de `HARVEST_EVENTS.map(...)` (lootType `'harvest_event'`) : insectes, pluie_doree, mutation_rare
- 4 entrées spread de `RARE_SEED_DROP_RULES.map(...)` (lootType `'rare_seed_drop'`) : orchidee, rose_doree, truffe, fruit_dragon

Le fichier re-exporte également `HARVEST_EVENTS`, `RARE_SEED_DROP_RULES`, `GOLDEN_CROP_CHANCE`, `GOLDEN_HARVEST_MULTIPLIER` depuis `../mascot/farm-engine` pour que l'UI Phase 17 puisse accéder aux valeurs engine sans ré-importer depuis `mascot/`. **Zéro nombre hardcodé dans le fichier.**

### Lore i18n (FR + EN)
- `locales/fr/codex.json` et `locales/en/codex.json` enrichis :
  - `crop.*` : 15 entrées `{name, lore}` (wiki style Stardew, 2-4 phrases)
  - `animal.*` : 17 entrées `{name, lore}`
  - `loot.*` : 8 entrées `{name, lore}` dont `golden_crop` et `harvest_pluie_doree` documentent explicitement CODEX-04
- Lore des 4 crops dropOnly (orchidee, rose_doree, truffe, fruit_dragon) et des 2 animaux sagaExclusive (esprit_eau, ancien_gardien) évoque la rareté et l'accès rare sans dévoiler la mécanique exacte
- Aucune valeur numérique dans les textes lore — le `golden_crop` fait référence aux noms de constantes engine (GOLDEN_CROP_CHANCE / GOLDEN_HARVEST_MULTIPLIER) plutôt qu'à leurs valeurs chiffrées

## Vérification

- Script Task 1 (`OK 15 crops`) : les 15 IDs crop présents dans FR+EN avec name+lore non vides
- Script Task 2 (`OK 17 animals`) : IDs extraits dynamiquement de `INHABITANTS` via regex, tous présents dans FR+EN
- Script Task 3 (`OK 8 loot`) : les 8 IDs loot présents dans FR+EN
- `npx tsc --noEmit` : zéro nouvelle erreur dans `lib/codex/*`. Les erreurs pré-existantes (MemoryEditor, cooklang, useVault + video/src/* Remotion) restent tolérées per CLAUDE.md
- `lib/codex/cultures.ts` : 14 lignes, aucune logique, aucun digit dans les valeurs
- `lib/codex/animals.ts` : 23 lignes, seul `computeSubgroup` contient de la logique (mapping string → string)
- `lib/codex/loot.ts` : aucun nombre hardcodé (`grep 0.03 | =5 | =3` vide), valeurs lues uniquement via imports

## Requirements satisfaits

- **CODEX-02** (cultures et animaux tracés) : 15 crops + 17 animaux couverts avec lore FR+EN
- **CODEX-04** (pluies dorées documentées) : documenté dans `loot.golden_crop.lore` et `loot.harvest_pluie_doree.lore` dans les deux langues
- **CODEX-05** (dropOnly tracé) : 4 crops dropOnly présents dans `cropEntries` + 2 animaux sagaExclusive marqués `dropOnly: true` dans `animalEntries` via le mapping automatique

## Déviations du plan

Aucune. Plan exécuté exactement comme écrit, sans bug à corriger ni fonctionnalité critique manquante.

Note : le plan estimait ~18 inhabitants, le nombre exact vérifié dans `lib/mascot/types.ts` est 17. Le mapping `.map()` est exhaustif indépendamment du nombre, donc aucune modification du code — seul le chiffre dans ce résumé reflète la réalité.

## Self-Check : PASSED

- `lib/codex/cultures.ts` : FOUND
- `lib/codex/animals.ts` : FOUND
- `lib/codex/loot.ts` : FOUND
- `locales/fr/codex.json` (enrichi crop+animal+loot) : FOUND
- `locales/en/codex.json` (enrichi crop+animal+loot) : FOUND
- Commit `b60b7af` : FOUND
- Commit `951d4cb` : FOUND
- Commit `e6470a2` : FOUND
