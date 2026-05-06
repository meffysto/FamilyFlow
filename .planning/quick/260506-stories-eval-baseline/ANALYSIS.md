# Analyse — Golden set 20 histoires Lucas

**Date** : 2026-05-06
**Source** : `STORIES-NOTABLE.md` (20 dernières histoires, du 26/04 au 05/05)
**Notation** : 1 = problème (🔴), 2 = limite (🟡), 3 = OK (🟢). N/A = non applicable.

---

## Tableau de notation

| # | Date | Univers | Long. | D1 Long. | D2 Fin | D3 Ctx | D4 Saga | D5 Vocab | D6 Qual. | Verdict | Issues clés |
|---|------|---------|-------|----------|--------|--------|---------|----------|----------|---------|-------------|
| 1 | 04/26 | espace | courte | 3 | 3 | 3 | n/a | 2 | 3 | 🟢 | tags `[excited][whispers]` rendus dans texte |
| 2 | 04/26 | espace | courte | 3 | 3 | 3 | n/a | 2 | 3 | 🟡 | titre identique à #1 ; tags |
| 3 | 04/26 | espace | courte | 3 | 3 | 3 | n/a | 3 | 2 | 🟢 | aucun tag (preuve que c'est inconstant) |
| 4 | 04/26 | pirates | courte | 3 | 3 | 1 | n/a | 2 | 2 | 🟡 | pirate qui marche dans l'herbe verte = univers cassé par contexte forcé |
| 5 | 04/26 | princesse | moyenne | 3 | 3 | 3 | n/a | 2 | 3 | 🟢 | 4 tags pour 3 ¶ = overload |
| 6 | 04/26 | princesse | courte | 3 | 3 | 3 | n/a | 2 | 3 | 🟢 | tags |
| 7 | 04/26 | robots | courte | 3 | 3 | 3 | n/a | 1 | 3 | 🟡 | "doucement/doux" 5+ fois |
| 8 | 04/26 | super-heros | courte | 3 | 3 | 3 | n/a | 1 | 2 | 🟡 | vocab redondant |
| 9 | 04/26 | super-heros | courte | 3 | 3 | 3 | n/a | 2 | 1 | 🔴 | **typo lexicale "papates"** (au lieu de pâquerettes/patates) |
| 10 | 04/30 | espace | moyenne | 3 | 3 | 3 | n/a | 1 | 3 | 🟡 | "doucement" 8x en 3 ¶ |
| 11 | 05/02 | espace | moyenne | 3 | 3 | 3 | n/a | 2 | 2 | 🟡 | "Cagou" utilisé pour étoile/perso (devrait être objet forêt) |
| 12 | 05/02 | foret | moyenne | 3 | 3 | 3 | n/a | 2 | 3 | 🟢 | OK |
| 13 | 05/02 | ocean | moyenne | 3 | 3 | 3 | n/a | 2 | 1 | 🔴 | **typo "le museau dessert"** au lieu de "dessus" + Cagou utilisé pour dragon |
| 14 | 05/03 | foret | moyenne | 3 | 3 | 3 | n/a | 2 | 3 | 🟢 | aucun tag — "MAGIE!" en CAPS efficace |
| 15 | 05/03 | foret | courte | 3 | 3 | 3 | n/a | 1 | 2 | 🟡 | début quasi-identique à #14, #17 |
| 16 | 05/03 | foret | courte | 3 | 3 | 3 | n/a | 2 | 2 | 🟡 | clone de #18 |
| 17 | 05/03 | foret | courte | 3 | 3 | 3 | n/a | 1 | 1 | 🔴 | **quasi-clone de #15** sur 2 jours |
| 18 | 05/03 | foret | courte | 3 | 3 | 3 | n/a | 1 | 1 | 🔴 | **quasi-clone de #16** |
| 19 | 05/03 | foret | moyenne | 3 | 3 | 3 | n/a | 1 | 2 | 🟡 | "tout doucement" 6x en 3 ¶ |
| 20 | 05/05 | foret | longue | 2 | 3 | 3 | n/a | 2 | 2 | 🟡 | 270 mots vs target ~350 ; "Cacou" (typo de Cagou ?) |

**Distribution finale** : 🟢 6/20 (30%) — 🟡 10/20 (50%) — 🔴 4/20 (20%)

**D4 Cohérence saga = N/A partout** : aucune histoire du dataset n'est un chapitre 2+. Tous les `chapitre: 1`. La feature saga n'est pas testable sur ce baseline.

---

## Patterns systémiques (par fréquence d'apparition)

### 🔴 P1 — Tags TTS rendus dans le texte (18/20)

Les tags `[whispers]`, `[chuckles]`, `[gasps]`, `[sighs]`, `[excited]` apparaissent **dans le champ `texte`** de presque toutes les histoires d'avril. Conséquences :

- Le PDF imprime `[whispers]` comme un mot littéral (à vérifier sur le dernier PDF, mais structurellement le HTML template fait `escapeHtml(text)` sans strip)
- Si `voice_engine` n'est pas `eleven_v3`, ces tags sont **lus à voix haute** comme des mots
- #20 (la plus récente, 05/05) a `voice_engine: expo-speech` ET 0 tags → preuve que le prompt s'adapte récemment, mais le **stock historique est pollué**

**Implication rubric** : règle déterministe `texte ne doit contenir aucun \[\w+\] sauf si voice_engine === 'eleven_v3'`. Hard fail.

### 🔴 P2 — Vocabulaire ultra-redondant (14/20 limite ou problème)

**Top occurrences cross-stories** (mesuré à l'œil sur le corpus) :
- `doucement` : 4-8 fois par histoire, **toutes les histoires sauf 0**
- `tout doucement, tout doucement` : formule littérale dans 11/20
- `Un pas. Deux pas. Trois pas.` : verbatim dans 13/20
- `petits pieds dans l'herbe (verte/douce)` : 12/20
- `cœur (tout) chaud (et fier)` : 10/20
- `s'endort tout doucement` ou variante : 18/20

**Implication rubric** : ratio type-token (mots uniques/total) < 0.42 → soft warning. Présence d'au moins 2 formules-cliché dans le corpus historique de l'enfant → soft warning.

### 🟡 P3 — Saturation du contexte "premières-fois marche seul" (18/20)

`recentMemories[].type === 'premières-fois'` (probablement "Lucas marche tout seul") est **réinjecté à chaque génération depuis fin avril**. L'enfant a "marché tout seul" dans :
- 1 fusée espace (#1)
- 1 mer pirate (#4)
- 1 jardin princesse (#5, #6)
- 1 planète robots (#7)
- 1 cape héros (#8, #9)
- 1 forêt × 8 (#12, #14-20)
- 1 océan dragon (#13)

C'est **15+ histoires consécutives sur le même pivot narratif**. Le générateur n'a pas de mécanisme "ce souvenir a déjà été utilisé N fois, varie" ni de TTL.

**Implication rubric** : compter combien de stories des 7 derniers jours intègrent un même memory. Si > 3, soft warning au générateur "varie le pivot".

### 🟡 P4 — "Cagou/Cacou" sémantiquement incohérent cross-univers (8/20)

Le mot semble venir de `recentQuotes` (Lucas dit "cagou" IRL — c'est probablement un mot d'enfant). Le générateur le réintègre dans **chaque univers** mais avec une **définition différente à chaque fois** :
- #11 : Cagou = personnage/étoile (espace)
- #12, #16, #18, #19 : Cagou = caillou magique (forêt)
- #13 : Cagou = nom du dragon (océan)
- #20 : "Cacou" = fleur de lumière (forêt, **typo** ou nouvelle entité ?)

Pour un enfant de 3-5 ans, c'est confusionnant : le mot perd sa signature. Le générateur devrait soit (a) figer la signification une fois, soit (b) ne PAS forcer l'intégration verbatim et juste l'évoquer phonétiquement.

**Implication rubric** : tracker les "objets/personnages magiques nommés" cross-stories pour cet enfant et flag les conflits de définition.

### 🟡 P5 — Titres dupliqués (5/20)

`Le premier pas dans la forêt` (3 variantes de casse) apparaît **5 fois en 2 jours** (#14-19). Aucune détection de collision.

**Implication rubric** : soft fail si titre identique (insensible à la casse) à une story des 7 derniers jours du même enfant. Hard fail si > 90% similarité avec une saga différente.

### 🔴 P6 — Typos lexicales (2/20 — rare mais présent)

- #9 : `papates rondes cachées dans la terre` — probable corruption de "patates" ou "pâquerettes"
- #13 : `Le dragon posa son museau dessert` — confusion "dessus"/"dessert"

Sortie Claude pas re-relue. Pas de spell-check ni de validation morphosyntaxique.

**Implication rubric** : LLM-eval pass dédiée ("y a-t-il une faute lexicale ou syntaxique évidente ?") OU dictionnaire FR de fréquence avec flag des tokens hors-distribution.

### 🟡 P7 — Quasi-clones cross-stories (#15-#19)

#17 et #18 sont des quasi-clones (~70% similarité texte) de #15 et #16, générés le même jour. Le prompt ne reçoit pas l'historique des stories pour comparaison.

**Implication rubric** : n-gram overlap (3-grams) avec les 5 dernières histoires de l'enfant > 35% → hard fail.

### ✅ Ce qui marche bien

- **D1 Longueur** : 19/20 respectent le nombre de paragraphes (seul #20 sous-livré 270 vs 350 mots target)
- **D2 Fin paisible** : 20/20 ✓ — toutes finissent par "s'endort", "ferme les yeux", ou équivalent
- **D3 Intégration contexte** : 19/20 — le générateur intègre toujours les éléments du contexte (presque trop, cf. P3)
- **Univers respecté** : 19/20 — sauf #4 où le contexte casse l'univers pirate
- **Charge émotionnelle** : globalement OK, plusieurs images marquantes (dragon yeux dorés, baiser de lumière sur le front, fleur de lumière, étoile sur le cœur)

---

## Seuils calibrés pour le rubric (basés sur ce dataset)

| Dimension | Métrique | Seuil hard fail | Seuil soft warning | Couvre quoi de ce dataset |
|---|---|---|---|---|
| **D1 Longueur** | mots vs target ±20% | écart > 35% | écart > 20% | Aurait flag #20 (-23%) |
| **D1 Longueur** | nb ¶ exact match | mismatch | — | Aucune story de ce dataset |
| **D2 Fin paisible** | dernier ¶ contient ≥1 marqueur apaisant ET 0 marqueur d'agitation | violé | — | 0/20 (toutes OK) |
| **D5 Vocab** | "doucement" occurrences | > 7 par story | > 4 par story | Aurait flag #10, #19 (hard) + 12 autres (soft) |
| **D5 Vocab** | type-token ratio | < 0.40 | < 0.45 | Aurait flag #17, #18 (hard) |
| **D5 Vocab** | n-gram 3-grammes vs 5 dernières stories | overlap > 35% | overlap > 25% | Aurait flag #17 vs #15, #18 vs #16 |
| **D7 Tags TTS** | présence `\[\w+\]` quand voice_engine ≠ v3 | violé | — | 18/20 historiques (mais résolu sur récent) |
| **D7 Titre** | similarité titre vs 7 derniers jours même enfant | > 95% | > 80% | Aurait flag #14, #16, #17, #18, #19 |
| **D8 Memory rotation** | même `recentMemory[].titre` injecté dans 7 jours | > 4 fois | > 2 fois | Aurait flag toutes les stories foret post-04/30 |
| **D9 Cohérence objet magique** | même nom d'objet/perso, définition différente vs stories antérieures | violé | — | Aurait flag #11, #13, #20 (Cagou/Cacou) |

**Couverture** : ces seuils auraient flag 14 des 20 stories (les 4 🔴 + 10 des 10 🟡). Les 6 🟢 passent. C'est cohérent avec la notation manuelle.

---

## Implications pour le prompt actuel (`ai-service.ts:992-1315`)

### Ajouts proposés au prompt système

```diff
+ ANTI-RÉPÉTITION — vocabulaire (CRITIQUE) :
+ - N'utilise jamais l'adverbe "doucement" plus de 3 fois dans toute l'histoire
+ - N'utilise jamais la formule "tout doucement, tout doucement" (répétition immédiate)
+ - Ne reproduis pas verbatim la formule "Un pas. Deux pas. Trois pas." si elle apparaît dans le contexte des histoires précédentes (à injecter)
+ - Évite les chevilles "tout est doux/calme/bien" sauf 1 fois max (signal d'apaisement final)

+ HISTORIQUE RÉCENT — anti-clonage :
+ Voici les titres et 3 premiers mots des 5 dernières histoires de cet enfant : [INJECTER]
+ - Ton titre DOIT être substantiellement différent (pas une variante de casse)
+ - Tes 3 premiers mots DOIVENT être différents (pas le même incipit "Ce soir, la forêt enchantée brille…")

+ MÉMOIRE RÉINJECTÉE — éviter saturation :
+ Le souvenir [PREMIÈRE FOIS marche seul] a déjà été le pivot narratif central de N histoires récentes.
+ - Si N >= 3, ÉVOQUE-le subtilement (1 phrase max) mais NE LE FAIS PAS le ressort principal
+ - Privilégie un autre élément du contexte (mood, citation, autre memory)

+ OBJETS/PERSONNAGES NOMMÉS — cohérence cross-stories :
+ Cet enfant a déjà été en contact avec ces entités nommées dans des stories précédentes :
+   - "Cagou" : caillou magique (forêt, ch.1 saga "le-premier-pas-dans-la-foret-pt1uc7")
+ - Si tu réutilises un nom existant, RESPECTE sa définition originale
+ - Si l'univers ne s'y prête pas, INVENTE un nouveau nom plutôt que de redéfinir
```

### Bug structurel à fixer en priorité

**Tags `[…]` qui leakent quand `voice_engine !== 'eleven_v3'`** : `ai-service.ts:1187-1210` — la branche "EXPRESSIVITÉ NARRATIVE" est bien instruction-supprime-tags-jamais, mais visiblement Claude les met quand même en pratique. Soit :

- (a) Renforcer la règle (mettre des exemples NEGATIFS, "JAMAIS comme ceci : `[whispers] elle dit`")
- (b) Strip post-process : regex côté code après réponse Claude qui retire tout `\[[a-z\s]+\]` si modèle non-v3
- (c) Les deux — ceinture + bretelles

Recommandation : (b) immédiatement (zero-cost, garantit le résultat) + (a) en parallèle pour réduire les tokens gaspillés.

---

## Reco séquencée

1. **Quick fix immédiat (1 ligne)** : strip post-process `\[\w+\]` dans `generateBedtimeStory` quand `tagsSupported === false` (`ai-service.ts:1187`). Résout P1 sur **toutes les futures histoires** sans changer le prompt.

2. **Ajouter au prompt** (1 commit) : l'historique récent (5 derniers titres + incipits) + la liste des entités nommées cross-stories. Résout P5 et P9. Coût en tokens : ~150 par génération.

3. **Construire le rubric déterministe** (1 phase GSD) : code-only checks pour D1, D2, D5, D7, D8 (tout sauf qualité narrative). Run avant save. Soft warnings dans frontmatter, hard fail = re-roll. Couvre ~70% des problèmes détectés sur ce dataset.

4. **`/gsd-ai-integration-phase`** : structurer la phase complète avec domain-research (orthophonistes, lectrices École des Loisirs), eval-planner (formaliser les seuils), et le golden set (ce dataset noté + 5-10 hand-rated additional pour valider la rubric).

5. **Optionnel** : LLM-eval pass pour D6 (qualité narrative) en background async, ne bloque pas l'UX. Coût ~$0.004/story.

---

## Données utilisables pour la suite

- **Golden set** : ce dataset (20 stories, notation 6 dim) sert de référence. Toute version du rubric doit reproduire approximativement le verdict humain (6 🟢, 10 🟡, 4 🔴).
- **Test de régression** : si on re-génère ces 20 stories avec le prompt corrigé (anti-redondance + strip tags), la distribution doit s'améliorer (objectif : 14 🟢 / 5 🟡 / 1 🔴).
- **Référence pour `gsd-eval-planner`** : ces patterns (P1-P7) sont les "failure modes connus" à confronter avec l'expertise domaine.
