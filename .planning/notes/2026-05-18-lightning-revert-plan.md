# Plan de revert Lightning Family Wallet (Phase 53)

> **Quand utiliser** : si Apple rejette la version qui contient Lightning, ou
> si tu décides après coup que la posture App Store §3.1.5(iii) est trop
> risquée et veux retirer Lightning de la version publique.
>
> **Stratégie retenue** : **Option B — merge via merge commit + `git revert -m 1`**.
> Documentation complète des deux scénarios ci-dessous (merge OK / merge déjà
> squashé donc pas de revert facile).

---

## Pré-requis avant tout merge sur `main`

Lis et coche cette checklist AVANT de taper `git merge` :

- [ ] La branche `feat/lightning-farm` build correctement en dev-client (`npx expo run:ios --device`)
- [ ] TSC clean (`npx tsc --noEmit`)
- [ ] Jest Lightning scopé clean (`npx jest lib/lightning/__tests__/ --no-coverage`)
- [ ] Feature flag `LIGHTNING_ENABLED` confirmé OFF par défaut au boot (cf. `lib/lightning/feature-flag.ts`)
- [ ] Aucun lien visible vers `/lightning-wallet` ou `SettingsLightning` HORS de la section Réglages → Labo (`!isChildMode`)
- [ ] Aucune mention "Lightning", "Bitcoin", "sats" dans les screenshots/metadata App Store Connect
- [ ] Le wording in-app est neutre (pas de promotion explicite de la feature)
- [ ] Tu as une **décision juridique documentée** (cf. issue GitHub "Décision App Store Lightning §3.1.5(iii)")

Si tu coches tout, tu peux merger. Sinon, **reste sur Option A** (jamais merger, build perso uniquement).

---

## Procédure de merge (CRUCIAL pour le revert)

**ALWAYS use `--no-ff`. Never `--squash`. Never rebase.**

```bash
git switch main
git pull --ff-only origin main
git merge --no-ff feat/lightning-farm -m "Merge feat/lightning-farm — Lightning Family Wallet Phase 53"

# Récupère le SHA du merge — c'est le KILL-SWITCH
MERGE_SHA=$(git rev-parse HEAD)
echo "Merge SHA = $MERGE_SHA" >> .planning/notes/2026-05-18-lightning-revert-plan.md
git add .planning/notes/2026-05-18-lightning-revert-plan.md
git commit -m "docs: archive lightning merge SHA pour kill-switch"

git push origin main
```

> **Pourquoi `--no-ff`** : crée un merge commit avec 2 parents. `git revert -m 1`
> sait alors annuler **tout** le contenu de la feature en 1 commande.
>
> **Pourquoi pas `--squash`** : 1 commit géant, impossible à reverter proprement
> (perte de granularité, conflits possibles).
>
> **Pourquoi pas rebase** : ré-écriture des SHA = histoire perdue, traçabilité
> nulle.

---

## Scénario A — Apple rejette → revert via merge commit

Si tu as bien suivi la procédure de merge :

```bash
# 1. Identifier le merge commit (ou récupérer le SHA archivé plus haut)
git log --merges --oneline | head -5
# Cherche la ligne "Merge feat/lightning-farm..."

MERGE_SHA=<le_sha>

# 2. Revert en 1 commande
git switch main
git revert -m 1 $MERGE_SHA \
  -m "Revert Lightning Family Wallet — décision App Store §3.1.5(iii)"

# 3. Vérifier
npx tsc --noEmit             # doit être clean
npx jest --no-coverage       # tests existants doivent passer
# (les tests Lightning seront supprimés par le revert, donc OK)

# 4. Push + re-soumettre App Store
git push origin main
# Bump version dans app.json (build number) + EAS submit
```

**Coût** : 1 commit de revert, ~5 min, propre, traçable.

---

## Scénario B — Pas de merge commit propre (urgence ou erreur de procédure)

Si quelqu'un a `--squash` ou rebase, ou si le revert -m 1 échoue, voici le strip manuel.

### B.1 — Fichiers à supprimer entièrement

```bash
# Dirs complets
git rm -r lib/lightning/
git rm -r components/lightning/

# Fichiers individuels
git rm app/lightning-wallet.tsx
git rm components/settings/SettingsLightning.tsx
```

### B.2 — Fichiers à éditer (retirer le code Lightning, garder le reste)

| Fichier | Quoi retirer |
|---------|--------------|
| `hooks/useVault.ts` | Les **4 useEffects Lightning** (`subscribeTaskComplete` Lightning + bootstrap migration + AppState flush + `subscribeTaskUncomplete` REQ-6) — autour des lignes 855-914. Retirer aussi les `useRef` pour `profilesRefForLightning`, `activeProfileIdRefForLightning` (~ligne 580). Retirer les imports `lib/lightning` en haut du fichier. |
| `hooks/useVaultTasks.ts` | Retirer `subscribeTaskUncomplete` + le type `TaskUncompleteListener` + le `Set<TaskUncompleteListener>` registry (~lignes 41, 66, 102). Garder `subscribeTaskComplete` (utilisé par gamification, pas Lightning). |
| `app/_layout.tsx` | Retirer `<Stack.Screen name="lightning-wallet" />` (ligne ~332). |
| `app/(tabs)/tree.tsx` | Retirer imports `lib/lightning` (lignes 151-160), import `HudLightningButton` (162-164), states `lightningVisible` + `lightningMember` + `hudLightningRef` (~496-501), useEffects visibilité + pulse listener (~552-592), render bouton HUD (~3585-3596). |
| `app/(tabs)/settings.tsx` | Retirer `import { SettingsLightning }` (ligne 46), import icône `Bitcoin` (54), entrée `'lightning'` dans le union `activeSection` (66), bloc Labo entier (276-289), render conditionnel `<SettingsLightning />` (501). |
| `app.json` | Retirer `"expo-camera"` du tableau `plugins` (ligne ~116). **Garder** `NSCameraUsageDescription` (utilisé aussi par d'autres features photo). |
| `package.json` | `npm uninstall expo-camera`. **NE PAS retirer** `@react-native-async-storage/async-storage` — il faut d'abord vérifier qu'aucune autre feature ne l'a adopté entre-temps. |

### B.3 — Vérifications post-strip

```bash
# Aucune référence orpheline ?
grep -RIn "lib/lightning\|components/lightning\|lightning-wallet\|SettingsLightning\|HudLightningButton\|isLightningEnabled\|loadFamilyConfig" \
  app/ components/ hooks/ contexts/ lib/ 2>/dev/null
# → doit retourner 0 résultat

# Type check
npx tsc --noEmit

# Tests
npx jest --no-coverage
# → les ex-tests Lightning n'existent plus, les tests pré-existants doivent passer
```

### B.4 — Commit + push

```bash
git add -A
git commit -m "chore(lightning): strip feature — décision App Store §3.1.5(iii)"
git push origin main
```

---

## Vérifications fines post-revert (les 2 scénarios)

- [ ] L'app build en prod (`eas build --platform ios --profile production`)
- [ ] Aucun crash au boot sans config Lightning
- [ ] Settings → pas de section "Labo" visible
- [ ] La ferme s'affiche normalement, pas de HUD ⚡
- [ ] `npm ls expo-camera` → "(empty)" (ou absent du `dependencies` du `package.json`)
- [ ] Bump build number dans `app.json` (`expo.ios.buildNumber`)

---

## Inventaire de la feature (référence visuelle)

**Code Lightning total** (à supprimer en cas de revert) :

| Catégorie | Compte | Lignes |
|-----------|--------|--------|
| `lib/lightning/*.ts` (modules purs) | 18 fichiers | ~3 000 |
| `lib/lightning/__tests__/*.test.ts` | 13 fichiers + mocks | ~2 500 |
| `components/lightning/*.tsx` | 8 fichiers | ~1 800 |
| `app/lightning-wallet.tsx` | 1 fichier | ~300 |
| `components/settings/SettingsLightning.tsx` | 1 fichier | ~700 |
| `hooks/useVault.ts` (extensions) | + 4 useEffects | ~70 lignes |
| `hooks/useVaultTasks.ts` (extension) | + `subscribeTaskUncomplete` | ~40 lignes |
| `app/(tabs)/tree.tsx` (HUD ⚡) | + imports, states, useEffects, render | ~80 lignes |
| `app/(tabs)/settings.tsx` (entrée Labo) | + import, union, section | ~15 lignes |
| `app/_layout.tsx` (route) | + 1 Stack.Screen | 1 ligne |
| `app.json` (plugin + perm) | + `expo-camera` plugin, NSCameraUsageDescription enrichi | ~5 lignes |

**Dépendances natives ajoutées Phase 53** :
- `expo-camera` (~17.0.10) — uniquement consommée par `QrScannerOverlay.tsx` → safe à retirer après strip
- `@react-native-async-storage/async-storage` (2.2.0) — consommée par `audit-log.ts` UNIQUEMENT au moment du strip Phase 53. ⚠ **VÉRIFIER** au moment du revert qu'aucune autre feature ne l'a adoptée entre-temps avant `npm uninstall`.

---

## Décision SHA archivée

> **Empty for now.** Sera rempli automatiquement par la procédure de merge ci-dessus.

```
Merge SHA = (à remplir au moment du merge)
Date du merge = (à remplir)
Décision juridique référencée = (issue GitHub ou note)
```

---

## Sources

- SPEC ligne 121, 125, 126, 135 : posture App Store §3.1.5(iii)
- `VERIFICATION.md` Phase 53 : "Décision merge `main` REPORTÉE — posture spike 003 (App Store conformité) maintenue PARTIAL"
- Apple App Store Review Guideline §3.1.5(iii) Cryptocurrency Exchanges
