---
phase: 17-codex-ui
plan: 02
type: execute
wave: 1
depends_on: []
files_modified:
  - locales/fr/codex.json
  - locales/en/codex.json
autonomous: true
requirements:
  - CODEX-07
  - CODEX-10
must_haves:
  truths:
    - "Les clés UI codex (modal, search, tabs, detail, tutorial) existent en FR et EN"
    - "Les 10 kinds ont une tab label FR+EN"
    - "Parité stricte FR/EN : aucune clé présente dans une seule langue"
  artifacts:
    - path: "locales/fr/codex.json"
      provides: "Nouvelles clés modal/search/tabs/detail/tutorial/card FR"
      contains: "codex.modal.title"
    - path: "locales/en/codex.json"
      provides: "Nouvelles clés modal/search/tabs/detail/tutorial/card EN"
      contains: "codex.modal.title"
  key_links:
    - from: "locales/fr/codex.json"
      to: "locales/en/codex.json"
      via: "parité de clés"
      pattern: "modal.title|search.placeholder|tabs\\.(crop|animal|building|craft|tech|companion|loot|seasonal|saga|quest)|detail\\.(lore|stats)|tutorial.replay"
---

<objective>
Ajouter aux locales codex existantes (Phase 16) les clés UI nécessaires à FarmCodexModal : titre modale, placeholder recherche, empty state, labels des 10 tabs, headers détail (lore/stats), bouton replay tutoriel, card locked. Parité FR+EN stricte (D-16).

Purpose: Séparer les données i18n de la logique UI (17-03) permet d'ajouter/modifier les textes sans toucher au code TSX.
Output: locales/fr/codex.json et locales/en/codex.json enrichis.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/17-codex-ui/17-CONTEXT.md
@locales/fr/codex.json
@locales/en/codex.json
</context>

<tasks>

<task type="auto">
  <name>Task 1: Ajouter clés UI codex FR+EN (parité stricte)</name>
  <files>locales/fr/codex.json, locales/en/codex.json</files>
  <read_first>
    - locales/fr/codex.json (lire TOUT le fichier pour voir la structure existante de Phase 16 — namespace racine, sous-objets par kind, conventions de nommage)
    - locales/en/codex.json (vérifier parité existante avant d'ajouter)
    - .planning/phases/17-codex-ui/17-CONTEXT.md décision D-16 (clés à ajouter)
  </read_first>
  <action>
    Ajouter au niveau racine de `locales/fr/codex.json` et `locales/en/codex.json` les sous-objets suivants (à merger avec l'existant, PAS écraser Phase 16).

    **locales/fr/codex.json — ajouts :**

    ```json
    {
      "modal": {
        "title": "Codex de la ferme"
      },
      "search": {
        "placeholder": "Rechercher une entrée…",
        "empty": "Aucune entrée trouvée pour « {{query}} »"
      },
      "tabs": {
        "crop": "Cultures",
        "animal": "Animaux",
        "building": "Bâtiments",
        "craft": "Artisanat",
        "tech": "Technologies",
        "companion": "Compagnons",
        "loot": "Butin",
        "seasonal": "Saisonnier",
        "saga": "Sagas",
        "quest": "Quêtes"
      },
      "detail": {
        "lore": "Description",
        "stats": "Caractéristiques",
        "close": "Fermer"
      },
      "card": {
        "locked": "???"
      },
      "tutorial": {
        "replay": "Rejouer le tutoriel"
      }
    }
    ```

    **locales/en/codex.json — ajouts :**

    ```json
    {
      "modal": {
        "title": "Farm codex"
      },
      "search": {
        "placeholder": "Search an entry…",
        "empty": "No entry found for \"{{query}}\""
      },
      "tabs": {
        "crop": "Crops",
        "animal": "Animals",
        "building": "Buildings",
        "craft": "Crafting",
        "tech": "Technologies",
        "companion": "Companions",
        "loot": "Loot",
        "seasonal": "Seasonal",
        "saga": "Sagas",
        "quest": "Quests"
      },
      "detail": {
        "lore": "Description",
        "stats": "Stats",
        "close": "Close"
      },
      "card": {
        "locked": "???"
      },
      "tutorial": {
        "replay": "Replay tutorial"
      }
    }
    ```

    Contraintes :
    - Merger avec l'existant (ne PAS supprimer les clés Phase 16 `codex.crop.*`, `codex.animal.*`, etc.)
    - Si un sous-objet `modal`/`search`/`tabs`/`detail`/`card`/`tutorial` existe déjà à la racine → ajouter uniquement les clés manquantes
    - Respecter l'indentation existante (probablement 2 espaces)
    - JSON valide (pas de trailing comma)
    - Les 10 tabs kinds doivent être exactement : crop, animal, building, craft, tech, companion, loot, seasonal, saga, quest (alignés sur CodexKind union)
    - Interpolation `{{query}}` en format i18next standard
  </action>
  <verify>
    <automated>node -e "const fr=require('./locales/fr/codex.json');const en=require('./locales/en/codex.json');const keys=['modal.title','search.placeholder','search.empty','tabs.crop','tabs.animal','tabs.building','tabs.craft','tabs.tech','tabs.companion','tabs.loot','tabs.seasonal','tabs.saga','tabs.quest','detail.lore','detail.stats','card.locked','tutorial.replay'];const get=(o,p)=>p.split('.').reduce((a,k)=>a?.[k],o);for(const k of keys){if(get(fr,k)==null)throw new Error('FR missing: '+k);if(get(en,k)==null)throw new Error('EN missing: '+k);}console.log('OK parité',keys.length,'clés');"</automated>
  </verify>
  <acceptance_criteria>
    - Les deux fichiers JSON sont valides (`node -e "require('./locales/fr/codex.json')"` OK)
    - `node -e "const x=require('./locales/fr/codex.json');console.log(x.modal.title)"` affiche "Codex de la ferme"
    - `node -e "const x=require('./locales/en/codex.json');console.log(x.modal.title)"` affiche "Farm codex"
    - Les 10 clés `tabs.{kind}` existent dans les DEUX langues
    - `tabs.crop`, `tabs.animal`, `tabs.building`, `tabs.craft`, `tabs.tech`, `tabs.companion`, `tabs.loot`, `tabs.seasonal`, `tabs.saga`, `tabs.quest` présents FR+EN
    - `search.empty` contient la chaîne `{{query}}` dans les deux langues
    - Les clés Phase 16 existantes (`codex.crop.blé.name`, etc.) NE sont PAS supprimées
  </acceptance_criteria>
  <done>
    Les deux JSON valides, parité stricte vérifiée, 17 nouvelles clés UI ajoutées, namespace Phase 16 préservé.
  </done>
</task>

</tasks>

<verification>
- JSON valides dans les deux langues
- Parité stricte : pour chaque clé ajoutée, présence FR et EN
- Clés Phase 16 (lore/name) préservées
</verification>

<success_criteria>
- 17 clés UI nouvelles disponibles dans le namespace `codex` FR+EN
- Aucune clé Phase 16 supprimée
- Parité vérifiée par script node inline
</success_criteria>

<output>
Après complétion, créer `.planning/phases/17-codex-ui/17-02-SUMMARY.md` avec :
- Liste des clés ajoutées par sous-namespace (modal/search/tabs/detail/card/tutorial)
- Confirmation parité FR+EN
- Comment 17-03 les consomme (`t('codex.modal.title')`, `t('codex.tabs.crop')`, etc.)
</output>
