---
phase: quick
plan: 260404-ips
type: execute
wave: 1
depends_on: []
files_modified:
  - lib/mascot/companion-types.ts
  - lib/parser.ts
  - hooks/useVault.ts
  - hooks/useFarm.ts
  - contexts/VaultContext.tsx
autonomous: true
requirements: [OPT-WRITES, REFRESH-FARM]
must_haves:
  truths:
    - "companion mood n'est plus ecrit dans farm-{id}.md (supprime du format CSV serialise)"
    - "companion recentMessages n'est plus dans le type CompanionData persiste"
    - "level n'est plus ecrit dans gami-{id}.md (calcule depuis points au parse)"
    - "Fichiers existants avec mood/level sont parses sans erreur (backward compat)"
    - "useFarm n'appelle plus refresh() — utilise refreshFarm/refreshGamification"
    - "refreshFarm(profileId) recharge uniquement farm-{id}.md sans toucher aux autres donnees"
  artifacts:
    - path: "lib/mascot/companion-types.ts"
      provides: "CompanionData sans mood ni recentMessages persistes"
    - path: "lib/parser.ts"
      provides: "parseCompanion backward compat, serializeCompanion sans mood, serializeGamification sans level"
    - path: "hooks/useVault.ts"
      provides: "refreshFarm(profileId) expose via retour"
    - path: "hooks/useFarm.ts"
      provides: "Toutes les fonctions utilisent refreshFarm/refreshGamification au lieu de refresh()"
  key_links:
    - from: "hooks/useFarm.ts"
      to: "hooks/useVault.ts"
      via: "useVault() destructure refreshFarm + refreshGamification"
      pattern: "refreshFarm|refreshGamification"
    - from: "lib/parser.ts"
      to: "lib/mascot/companion-types.ts"
      via: "CompanionData type import"
      pattern: "CompanionData"
---

<objective>
Optimiser les ecritures vault en supprimant les champs redondants (companion mood, gami level, companion recentMessages) et creer refreshFarm(profileId) pour eviter les refresh() complets dans useFarm.

Purpose: Reduire les I/O inutiles — mood est calcule a la volee, level derive des points, recentMessages jamais persiste. refreshFarm evite de recharger tout le vault apres chaque action ferme.
Output: Parser/serializer legers, refreshFarm dans useVault, useFarm optimise.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@CLAUDE.md
@lib/mascot/companion-types.ts
@lib/parser.ts
@hooks/useVault.ts
@hooks/useFarm.ts
@contexts/VaultContext.tsx
</context>

<tasks>

<task type="auto">
  <name>Task 1: Supprimer champs redondants (mood, level, recentMessages)</name>
  <files>lib/mascot/companion-types.ts, lib/parser.ts</files>
  <action>
    **companion-types.ts:**
    - Retirer `mood: CompanionMood` de l'interface `CompanionData` (ligne 50). Le mood est calcule a la volee par computeMoodScore dans tree.tsx — pas besoin de le persister.
    - Retirer `recentMessages?: string[]` de `CompanionData` (ligne 51). Jamais persiste, seulement en memoire dans tree.tsx.
    - NE PAS toucher a `CompanionMood` type ni `CompanionMessageContext.mood` — ils restent pour le runtime.

    **parser.ts — parseCompanion (ligne 536):**
    - Garder le parse de `parts[3]` pour backward compat mais ne pas l'assigner au resultat.
    - Le format CSV passe de 4 parties `activeSpecies:name:unlocked:mood` a 3 parties `activeSpecies:name:unlocked`.
    - Si 4 parties presentes (ancien format), ignorer silencieusement la 4e.
    - Retour: `{ activeSpecies, name, unlockedSpecies }` (sans mood).

    **parser.ts — serializeCompanion (ligne 556):**
    - Ne plus ecrire le mood. Format: `${activeSpecies}:${name}:${unlocked}` (3 parties).

    **parser.ts — parseGamification (ligne 770):**
    - La ligne `level: parseInt(currentProps.level ?? '1', 10)` reste pour backward compat au parse.
    - Mais remplacer par: importer `calculateLevel` depuis `../lib/gamification`, puis `level: calculateLevel(parseInt(currentProps.points ?? '0', 10))`.
    - Ainsi le level est toujours derive des points, meme si le fichier contient une ligne `level:` obsolete.

    **parser.ts — serializeGamification (ligne 851):**
    - Supprimer la ligne `level: ${p.level}` du template string (ligne ~851). Ne plus ecrire `level` dans gami-{id}.md.
  </action>
  <verify>npx tsc --noEmit 2>&1 | grep -v "MemoryEditor\|cooklang\|useVault" | head -20</verify>
  <done>CompanionData n'a plus mood/recentMessages. serializeCompanion produit 3 parties. serializeGamification n'ecrit plus level. parseCompanion/parseGamification restent backward compat avec ancien format.</done>
</task>

<task type="auto">
  <name>Task 2: Creer refreshFarm et remplacer refresh() dans useFarm</name>
  <files>hooks/useVault.ts, hooks/useFarm.ts, contexts/VaultContext.tsx</files>
  <action>
    **hooks/useVault.ts:**
    - Creer `refreshFarm` (apres refreshGamification, ~ligne 2451):
      ```
      const refreshFarm = useCallback(async (profileId: string) => {
        if (!vaultRef.current) return;
        try {
          const content = await vaultRef.current.readFile(farmFile(profileId));
          const farmData = parseFarmProfile(content);
          setProfiles(prev => prev.map(p =>
            p.id === profileId ? { ...p, ...farmData } : p
          ));
        } catch (e) {
          warnUnexpected('refreshFarm', e);
        }
      }, []);
      ```
    - Ajouter `refreshFarm` au type d'interface VaultState (~ligne 190): `refreshFarm: (profileId: string) => Promise<void>;`
    - Ajouter `refreshFarm` au retour de useVaultInternal (~ligne 3644, a cote de refreshGamification).
    - Ajouter `refreshFarm` dans la liste des deps du useMemo final (~ligne 3728+).

    **contexts/VaultContext.tsx:**
    - Si VaultContext expose un type ou interface, ajouter `refreshFarm`. Sinon le type est dans useVault.ts (deja gere ci-dessus).

    **hooks/useFarm.ts:**
    - Changer le destructuring (ligne 122): `const { vault, profiles, refreshFarm, refreshGamification } = useVault();`
      (retirer `refresh`).
    - Remplacer chaque `await refresh()` selon la logique:
      - **Farm-only** (ne touche que farm-{id}.md): `await refreshFarm(profileId)` — concerne: `harvest` (l295), `collectBuildingResources` (l453), `collectPassiveIncome` (l489), `checkWear` (l560 et l567).
      - **Farm + Gami** (touche aussi gami-{id}.md via deductCoins/addCoins): `await refreshFarm(profileId); await refreshGamification();` — concerne: `plant` (l246), `sellHarvest` (l320), `craft` (l355), `sellCrafted` (l382), `buyBuilding` (l401), `upgradeBuildingAction` (l431), `unlockTech` (l515), `repairWear` (l589).
    - Mettre a jour les deps arrays de chaque useCallback: remplacer `refresh` par `refreshFarm, refreshGamification` la ou necessaire.
    - NE PLUS importer ni utiliser `refresh` depuis useVault dans useFarm.
  </action>
  <verify>npx tsc --noEmit 2>&1 | grep -v "MemoryEditor\|cooklang\|useVault" | head -20</verify>
  <done>refreshFarm(profileId) existe dans useVault et est expose via VaultContext. useFarm utilise exclusivement refreshFarm/refreshGamification — aucun appel a refresh() ne subsiste dans useFarm.ts.</done>
</task>

</tasks>

<verification>
- `npx tsc --noEmit` compile sans nouvelles erreurs
- `grep -n "refresh()" hooks/useFarm.ts` retourne 0 resultats
- `grep -n "mood" lib/parser.ts | grep -i serialize` ne contient plus mood dans serializeCompanion
- `grep -n "level:" lib/parser.ts | grep serialize` ne contient plus level dans serializeGamification
- `grep "refreshFarm" hooks/useVault.ts` confirme la fonction existe et est exportee
</verification>

<success_criteria>
- Aucun champ redondant n'est ecrit (mood, level, recentMessages)
- Backward compat: anciens fichiers avec mood/level parsent sans erreur
- useFarm ne fait plus de refresh() complet — uniquement refreshFarm/refreshGamification cibles
- tree.tsx et SettingsGamiAdmin.tsx non modifies et fonctionnels (mood via computeMoodScore, level via calculateLevel)
- `npx tsc --noEmit` passe
</success_criteria>

<output>
After completion, create `.planning/quick/260404-ips-optimiser-writes-farm-gami-et-cr-er-refr/260404-ips-SUMMARY.md`
</output>
