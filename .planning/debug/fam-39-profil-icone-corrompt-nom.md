---
status: resolved
trigger: "FAM-39 — Modifier l'icône d'un profil corrompt le nom et fait perdre toutes les données de jardin/niveaux/gamification"
created: 2026-06-08
updated: 2026-06-08
---

# Debug Session: FAM-39 — Icône profil corrompt nom + perte jardin/niveaux

## Symptoms (from Linear FAM-39, reporter = parent "Julie")

DATA_START
Séquence de l'utilisatrice hier soir :
1. Profil bébé → renommé "Louis" (rename)
2. Profil "Maxence" → choix d'un icône lapin → DEPUIS il s'appelle "rabbit Maxence" et ses niveaux semblent chamboulés
3. Son propre profil → choix d'un icône cœur

Symptômes observés :
- L'icône cœur est BIEN pris en compte sur le **Dashboard**
- MAIS dans les **Réglages** : nom affiché = "heart Julie" + ANCIEN icône (pas le cœur)
- Le préfixe = NOM de l'icône (en anglais) ajouté devant le prénom : "heart Julie", "rabbit Maxence"
- TOUS les niveaux du **jardin** ont sauté (était à la moitié du niveau 22)
- Parcelles toutes niveau max → perdues
- Arbre violet → perdu
- Hérisson (mascotte/companion) → perdu
- Feuilles (leaves/monnaie ?) perdues
- Ne peut plus **crafter** → n'ose plus cocher de tâches
- **POINT POSITIF : l'inventaire est toujours plein** (préservé)
DATA_END

## Hypothèses initiales (orchestrateur)

- Le sélecteur d'icône écrit le nom de l'icône (clé string "heart"/"rabbit") DANS le champ `name`/`displayName` du profil, ou préfixe le prénom.
- Les données gamification/jardin/mascotte/companion sont **clé-ées par le nom/displayName du profil** (et NON par un id stable). Quand le nom change ("Julie" → "heart Julie"), le lookup gamification échoue → données orphelines/perdues.
- L'inventaire est préservé car probablement stocké différemment (clé stable ou global) — indice fort sur quelle clé est utilisée vs pas.
- Cache : jardin/ferme/mascotte/companion/gamification sont EXCLUS du cache (toujours frais depuis vault) → la perte est réelle côté vault, pas un artefact de cache.
- Divergence Dashboard vs Réglages sur l'icône = deux sources de lecture différentes (l'une lit le nouveau champ, l'autre l'ancien) → indice sur où l'écriture se fait.

## Current Focus

hypothesis: CONFIRMED — deux bugs distincts trouvés.
next_action: apply fixes

## Evidence

- timestamp: 2026-06-08T00:00:00Z
  file: app/(tabs)/settings.tsx:175
  finding: >
    Le subtitle du SettingsRow "Profils" utilise `${activeProfile.avatar} ${activeProfile.name}`.
    Avant migration AvatarIcon, avatar = emoji (ex: "❤️") → rendu correct en template string.
    Après migration, avatar = clé canonique string (ex: "heart") → affichage texte brut "heart Julie".
    Le NOM dans famille.md n'est PAS corrompu — c'est uniquement un bug d'affichage dans la subtitle.

- timestamp: 2026-06-08T00:00:01Z
  file: hooks/useVaultProfiles.ts:489-510 (updateProfile)
  finding: >
    La mise à jour optimiste appelle `setProfiles(prev => parsed.map(base => { ...base, points: ..., ... }))`.
    `base` vient de `parseFamille()` qui initialise tous les champs farm/mascot à leurs valeurs vides :
    `farmCrops: ''`, `farmInventory: undefined`, `mascotDecorations: []`, `treeSpecies: undefined`, etc.
    Le spread `...base` écrase les champs farm chargés depuis `farm-{id}.md` dans `existing`.
    → Perte TEMPORAIRE de l'arbre mascotte, des parcelles, du companion, des feuilles en mémoire runtime.
    Les fichiers vault (farm-{id}.md, gami-{id}.md) ne sont PAS corrompus — rechargement de l'app restaure tout.

- timestamp: 2026-06-08T00:00:02Z
  file: lib/parser.ts:1673
  finding: >
    mergeProfiles lie les données gami au profil base via
    `g.name.toLowerCase().replace(/\s+/g, '') === base.id.toLowerCase()`.
    base.id = section header `### {id}` (stable). Gamification correctement liée même après rename.
    Farm data liée par `farmDataByProfile[p.id]` — stable aussi. Pas de corruption réelle dans le vault.

## Eliminated

- Nom réellement corrompu dans famille.md : NON — updateProfile écrit name et avatar séparément, correctement.
- Données gamification orphelines : NON — gami-{profileId}.md est keyed par profileId stable, pas par name.
- Inventaire préservé pour raison différente : logique, il vit dans farm-{id}.md keyed par id stable.

## Verification — disque non corrompu (post-fix, suite question utilisateur)

Question : cocher une tâche / une écriture .md pendant que le state mémoire est corrompu
pourrait-elle persister les champs ferme vides sur le disque ?

Réponse : NON. Trois fichiers séparés, isolation prouvée :
- parser.ts:1392 — parseFamille met farm/mascot/companion à defaults : famille.md ne transporte
  AUCUN champ ferme. updateProfile édite famille.md ligne-à-ligne (useVaultProfiles.ts:451-452).
- useFarm.ts:250-266 (+ tous les sites d'écriture farm) — chaque mutation fait
  readFile(farmFile) → parseFarmProfile(content) → mutate → writeFile. Source = TOUJOURS le disque.
  Le seul champ pris de `profiles` mémoire est profileName (header ## Nom) — et name n'était pas corrompu.
- addCoins/deductCoins (useFarm.ts:190-245) — gami relu frais du disque avant écriture.

→ Le state mémoire corrompu (farm vides) ne peut JAMAIS atteindre le disque. Jardin/arbre/hérisson/
  feuilles/inventaire intacts dans farm-{id}.md. Cocher des tâches n'aggrave rien. Redémarrage = restore.

## Resolution

root_cause: >
  Deux bugs distincts :
  1. AFFICHAGE (settings.tsx:175) — `${activeProfile.avatar}` dans le subtitle du SettingsRow "Profils" affiche
     la clé de l'icône ("heart", "rabbit") comme texte brut au lieu de l'emoji/icône, car la migration vers
     AvatarIcon a changé le format de stockage de emoji → clé string canonique.
  2. PERTE DE DONNÉES RUNTIME (useVaultProfiles.ts:updateProfile) — la mise à jour optimiste post-save fait
     `{ ...base }` depuis parseFamille() qui contient des valeurs vides pour tous les champs farm/mascot,
     écrasant les données chargées depuis farm-{id}.md. Perte temporaire jusqu'au prochain refresh/relaunch.
     Les fichiers vault ne sont pas corrompus.

fix: >
  1. settings.tsx:175 — remplacer `${activeProfile.avatar}` par `activeProfile.name` seul ou par un emoji
     de rôle fixe. Suppression du avatar dans ce template string (AvatarIcon est affiché visuellement séparément
     dans la section Mon profil plus bas).
  2. useVaultProfiles.ts:updateProfile — dans la mise à jour optimiste setProfiles, préserver les champs
     farm/mascot depuis `existing` : `...existing, ...base, points: ..., coins: ..., ...`.
     L'ordre correct est `{ ...existing, ...base, <gami fields> }` pour que les champs stable de base
     (name, avatar, role, etc.) soient à jour ET que les champs farm de existing soient préservés.
