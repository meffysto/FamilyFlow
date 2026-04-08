# Phase 16: Codex contenu - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-08
**Phase:** 16-codex-contenu
**Areas discussed:** Forme du type CodexEntry, Mapping catégories ↔ sources + dropOnly, Description / lore textuel

---

## Sélection initiale des zones grises

| Option | Description | Selected |
|--------|-------------|----------|
| Forme du type CodexEntry | Union discriminée vs type unique générique vs hybride | ✓ |
| Mapping catégories ↔ sources + dropOnly | Quelle constante engine est source de vérité ? Comment marquer dropOnly ? | ✓ |
| Description / lore textuel | Stats brutes seules vs lore court vs lore narratif riche | ✓ |
| Validation & garde anti-drift | Test unitaire vs typage TS strict | (non sélectionné — délégué à Claude's Discretion) |

**Notes:** L'utilisateur a sélectionné les 3 zones les plus structurantes. La validation anti-drift et l'organisation fichier sont laissées à Claude's Discretion pendant le plan.

---

## Forme du type CodexEntry

| Option | Description | Selected |
|--------|-------------|----------|
| Union discriminée (Recommandé) | type CodexEntry = CropEntry \| BuildingEntry \| TechEntry... Champs typés par catégorie. Plus de rigueur, l'UI Phase 17 sait exactement quels champs afficher selon le kind. | ✓ |
| Type unique générique | interface CodexEntry { id, category, name, stats: Array<{label, value}> }. Plus simple mais moins de typage. | |
| Hybride | Base commune + champ stats: Record<string, string\|number> non-typé. Compromis. | |

**User's choice:** Union discriminée

---

## Source ref strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Référence par id (Recommandé) | sourceId: 'wheat' + getter runtime CROP_CATALOG.find(...). Zéro drift garanti. | ✓ |
| Spread au module load | const wheatCrop = ...; { ...wheatCrop, kind:'crop', lore:'...' }. Plus direct mais perd la référence vivante. | |
| Helper builder | makeCropEntry(crop, lore) qui mappe explicitement chaque champ. Plus verbeux. | |

**User's choice:** Référence par id

---

## Catégorie 'Loot box & raretés' — source

| Option | Description | Selected |
|--------|-------------|----------|
| Agréger HARVEST_EVENTS + RARE_SEED_DROP_RULES | Construire vue 'tables de drop' à partir des constantes farm-engine existantes. Zéro nouvelle constante engine. | ✓ |
| Créer LOOT_TABLES dans farm-engine.ts | Refactor : extraire une nouvelle constante engine. Plus propre mais touche l'engine. | |
| Liste curated dans content.ts | Hardcoder dans content.ts les entrées avec références aux constantes via getter. | |

**User's choice:** Agréger HARVEST_EVENTS + RARE_SEED_DROP_RULES
**Notes:** Décision cohérente avec la philosophie non-cassante de la phase et l'objectif zéro modification engine.

---

## Animaux : INHABITANTS

| Option | Description | Selected |
|--------|-------------|----------|
| Tout INHABITANTS, sous-catégories visuelles | Tous habitants en une catégorie 'Animaux & Habitants', avec sous-groupes (animaux ferme / fantastiques / saga). Une seule source = simple. | ✓ |
| Filtre strict animaux ferme uniquement | Seulement poussin/poulet/canard/cochon/vache. | |
| INHABITANTS + flag dropOnly pour saga | Tout INHABITANTS, sagaExclusive traité comme dropOnly. | |

**User's choice:** Tout INHABITANTS, sous-catégories visuelles
**Notes:** La sémantique dropOnly pour les sagaExclusive sera quand même appliquée (D-15) — c'est une combinaison de l'option 1 et de l'option 3 dans CONTEXT.md.

---

## Lore / description textuel

| Option | Description | Selected |
|--------|-------------|----------|
| Stats brutes seules | Aucun texte. UI affiche nom + stats. | |
| 1 phrase courte par entrée (Recommandé) | description: string max ~120 chars hardcodé FR. | |
| Lore narratif riche (2-4 phrases) | Descriptions immersives type Stardew Valley wiki. | ✓ |

**User's choice:** Lore narratif riche mais i18n pour traduction
**Notes:** L'utilisateur a précisé "mais i18n pour traduction" — ce qui modifie la décision : pas d'inline FR, mais externalisation en clés i18n. Cette précision a déclenché la question suivante sur le setup i18n.

---

## Rédaction des lores

| Option | Description | Selected |
|--------|-------------|----------|
| Claude propose, tu valides | Claude génère FR pendant exécution, tu relis et corriges. | ✓ |
| Toi entièrement | Tu fournis CSV/markdown des textes. | |
| Skip lore (revenir à stats brutes) | Fallback si pas d'avis. | |

**User's choice:** Claude propose, tu valides

---

## Setup i18n pour les lores

| Option | Description | Selected |
|--------|-------------|----------|
| Nouveau namespace 'codex' FR+EN dès Phase 16 | locales/fr/codex.json + locales/en/codex.json. CodexEntry stocke loreKey. Claude rédige FR ET EN. | ✓ |
| Namespace 'codex' FR uniquement, EN plus tard (Recommandé) | codex.json FR uniquement, EN reste TODO. Fallback i18next FR. | |
| Inline FR dans content.ts + migration i18n future | Hardcode lore: 'texte FR'. Migration plus tard. | |

**User's choice:** Nouveau namespace 'codex' FR+EN dès Phase 16
**Notes:** L'utilisateur a choisi l'option la plus rigoureuse — FR+EN dès le départ. Volume rédactionnel ~150-200 textes courts à valider en Phase 16.

---

## Claude's Discretion

- **Validation anti-drift** : zone non-sélectionnée par l'utilisateur. Claude décide pendant le plan (probablement test TS strict + assert runtime `__DEV__`).
- **Organisation fichier** : single-file vs split par catégorie. Claude décide selon volume final (~600 LOC seuil).

## Deferred Ideas

- CODEX-FUT-01 (Pokédex tracking par profil) — déjà roadmap futur
- Refactor LOOT_TABLES dans farm-engine.ts — reconsidérer si maintenance pénible
- i18n autres langues (ES, DE) — out of scope projet
- Lore audio / TTS — non demandé
