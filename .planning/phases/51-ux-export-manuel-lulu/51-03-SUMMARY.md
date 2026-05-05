---
phase: 51-ux-export-manuel-lulu
plan: 03
subsystem: ui-export-pdf
tags: [export, pdf, post-export, lulu, sharing, i18n]
requires:
  - components/pdf/BookExportModal (Phase 51-01 — phase post-export branchée)
  - lib/i18n (Phase 51-02 — namespace `impressions` ajouté ici)
  - expo-sharing ~14.0.8 (lazy import, fallback Linking)
  - expo-print (Print.printAsync iOS — déjà installé Phase 49)
  - expo-haptics (Medium au mount, Light sur taps)
provides:
  - components/pdf/PostExportView (3 actions Sauvegarder/Voir/Lulu)
  - components/pdf/LuluInstructionsModal (manuel FR pas-à-pas + CTA)
  - locales/{fr,en}/impressions.json (namespace complet Phase 51)
affects:
  - components/pdf/BookExportModal (handleContinue scinde GO_POST_EXPORT vs onSuccess ; nouveau handleDone)
  - lib/i18n.ts (namespace `impressions` enregistré)
  - locales/en/common.json (clé menu.items.impressions ajoutée — manquait côté EN)
  - package.json (expo-sharing ~14.0.8)
tech-stack:
  added:
    - "expo-sharing ~14.0.8"
  patterns:
    - "Lazy import `await import('expo-sharing')` + fallback Linking (résilience rebuild dev-client en cours)"
    - "Sub-modal au lieu de nested Modal — LuluInstructionsModal est un Modal pageSheet ouvert depuis l'état local de PostExportView"
    - "ActionButton helper interne : props sérialisables (icônes lucide passés en prop, couleurs résolues côté caller)"
    - "Haptic Medium au mount via useEffect + useEffect cleanup zéro (notification one-shot)"
key-files:
  created:
    - components/pdf/PostExportView.tsx
    - components/pdf/LuluInstructionsModal.tsx
    - locales/fr/impressions.json
    - locales/en/impressions.json
    - lib/__tests__/i18n.impressions.test.ts
  modified:
    - components/pdf/BookExportModal.tsx
    - components/pdf/index.ts
    - lib/i18n.ts
    - locales/en/common.json
    - package.json
    - package-lock.json
decisions:
  - "expo-sharing en lazy import (`await import`) — fallback Linking.openURL si module natif absent (rebuild dev-client en cours côté utilisateur, RESEARCH Pitfall 1)"
  - "Specs Lulu retenues dans le manuel : 8.5″×8.5″ (≈ 21,59cm), Saddle Stitch ≤ 16 pages OU Perfect Bound > 16, 80# White Coated"
  - "EN mirror = copie FR strict (projet FR-only, l'EN sert juste à éviter un crash i18next quand la device est en EN)"
  - "URL Lulu hardcodée (LULU_URL constante module) — pas de string interpolée user-input (threat T-51-03-01)"
  - "handleContinue ne déclenche plus onSuccess immédiatement — onSuccess est appelé dans handleDone (bouton Terminé) pour que l'écran parent rafraîchisse le manifeste après que l'utilisateur ait profité des 3 actions"
  - "Pas de Typography.* token (n'existe pas projet) — usage direct FontSize/FontWeight/LineHeight + colors.* (cf. Plan 51-01 mêmes choix)"
metrics:
  duration_seconds: 540
  tasks_completed: 2
  files_created: 5
  files_modified: 6
  completed_date: 2026-05-05
---

# Phase 51 Plan 03 : Post-export + manuel Lulu Summary

**One-liner :** Phase post-export branchée (3 actions + bouton Terminé), manuel Lulu FR pas-à-pas, namespace i18n `impressions` complet — pipeline UX export bouclé.

## Objectif atteint

Ajout de la phase finale du `BookExportModal` : après génération + tap "Continuer", l'utilisateur voit `<PostExportView />` qui propose 3 actions claires (Sauvegarder via expo-sharing, Voir via Print.printAsync, Commander chez Lulu via sub-modal d'instructions) et un bouton "Terminé" qui déclenche `onSuccess` (refresh manifeste de l'écran "Mes impressions") puis ferme la modal. Le manuel Lulu (LuluInstructionsModal) propose 5 étapes FR détaillées avec specs Lulu retenues + CTA `Linking.openURL` vers Lulu Studio.

## Tâches exécutées

| Task | Description                                                         | Commit     |
|------|---------------------------------------------------------------------|------------|
| 1    | Install expo-sharing + namespace i18n FR/EN + 4 tests Jest verts    | `fa1336bf` |
| 2    | PostExportView + LuluInstructionsModal + branche dans BookExportModal | `558be68d` |

## Décisions de design

### expo-sharing — lazy import résilient
Le dev-client utilisateur n'a pas encore été rebuild avec `expo-sharing` (rebuild prévu Phase 51-04). Pour ne pas bloquer l'usage immédiat, l'import est `await import('expo-sharing')` enveloppé d'un try/catch. Si le module natif n'est pas chargé, l'erreur est attrapée et on bascule sur `Linking.openURL(uri)` qui ouvre QLPreviewController iOS — l'utilisateur peut ensuite utiliser le bouton de partage natif d'iOS. Pattern conforme à `app/dev-deep-link.tsx` (Phase 50).

### Sub-modal vs nested Modal — LuluInstructionsModal isolé
Le manuel Lulu est un Modal pageSheet *séparé* (pas un nested Modal dans BookExportModal). Trigger : `setLuluOpen(true)` depuis PostExportView. Avantage : drag-to-dismiss du parent (BookExportModal) reste fonctionnel ; seule LuluInstructionsModal absorbe le swipe quand elle est visible. Évite l'anti-pattern documenté en RESEARCH §4.

### onSuccess déplacé de handleContinue à handleDone
Avant 51-03, `handleContinue` appelait `onSuccess` immédiatement après dispatch GO_POST_EXPORT — ce qui aurait pu pousser l'écran parent à fermer la modal avant que l'utilisateur n'ait vu PostExportView. Désormais : `handleContinue` ne fait QUE dispatch GO_POST_EXPORT (reste dans la modal) ; `handleDone` (bouton "Terminé") appelle `onSuccess(uri, storyTitle)` puis dispatch RESET + onClose. Conséquence : l'écran "Mes impressions" rafraîchit son manifeste UNE SEULE FOIS, au moment où l'utilisateur ferme volontairement la modal.

### Specs Lulu retenues (RESEARCH §5)
- Taille : 8.5″ × 8.5″ (Square / Carré) ≈ 21,59 × 21,59 cm
- Reliure : Saddle Stitch ≤ 16 pages OU Perfect Bound > 16 pages
- Pages intérieures : 80# White Coated (papier blanc couché ~120g)
- Couleur : Color (couleur intégrale)
- URL : `https://www.lulu.com/create/print-books/` (hardcodée constante module)

### i18n namespace `impressions` — FR strict, EN mirror identique
- 50+ clés organisées en sous-objets : `screen`, `card`, `export.modal`, `postExport`, `lulu` (5 étapes + intro + tip + CTA + erreurs), `errors`, `share`
- EN copié à l'identique (le projet est FR-only ; l'EN sert juste à éviter un crash i18next si la device démarre en EN)
- Test Jest pinne 4 clés représentatives : titre écran, manuel Lulu, étape génération, 3 actions post-export

## Branchements posés

### Pour Plan 51-04 (validation finale)
- Test device : générer un livre → ModalHeader title doit changer en "Et maintenant ?" avec haptic Medium → tap chaque action :
  - **Sauvegarder** → iOS Share Sheet apparaît OU Alert "sharingUnavailable" + ouverture directe (selon état rebuild dev-client)
  - **Voir le PDF** → QLPreviewController natif iOS
  - **Commander chez Lulu** → sub-modal manuel s'ouvre, scroll OK, tap CTA → Safari sur lulu.com/create/print-books
- **Note rebuild dev-client requis** pour test complet avec expo-sharing : `npx expo prebuild --clean` + `npx expo run:ios --device` (sinon fallback Linking est utilisé — c'est OK mais moins riche)
- Cleanup `app/dev-deep-link.tsx` (gating en prod) — out-of-scope 51-03
- Update CLAUDE.md (Stack: ajouter `expo-sharing`) — out-of-scope 51-03

## Pitfalls anticipés (et mitigés)

| Pitfall                                              | Source              | Mitigation                                                                  |
|------------------------------------------------------|---------------------|-----------------------------------------------------------------------------|
| Dev-client pas rebuild → crash `ExpoSharing`         | RESEARCH Pitfall 1  | `await import('expo-sharing')` + try/catch + fallback Linking.openURL       |
| URL Lulu phishing (interpolation user-input)         | T-51-03-01 STRIDE   | `LULU_URL` constante module, jamais interpolée                              |
| Linking.openURL échoue (pas de navigateur)           | RESEARCH §5         | `.catch()` → Alert FR `lulu.errorOpen` avec instruction                     |
| Drag-to-dismiss perdu sur le parent quand sub-modal  | RESEARCH §4         | LuluInstructionsModal séparée (pas nested) — déjà documenté Plan 51-01      |
| Haptic Medium qui se rejoue si re-render             | RESEARCH §1         | `useEffect(() => {...}, [])` deps vides — un seul tir au mount              |

## Déviations du plan

### Auto-fixées (Rules 1-3)

**1. [Rule 2 - Critical fonctionnalité] Clé `menu.items.impressions` manquante en EN**
- **Trouvé pendant :** Task 1 vérification done criteria
- **Issue :** Plan 51-02 avait ajouté la clé en `locales/fr/common.json` mais pas en EN — i18next aurait fallback affiché la clé brute si la device était en EN
- **Fix :** ajout de `"impressions": "My prints"` dans `locales/en/common.json` (entre `bedtimeStories` et `nightMode`)
- **Fichiers modifiés :** `locales/en/common.json`
- **Commit :** `fa1336bf`

**2. [Rule 3 - Blocking] `app.json` modifié inopinément par `npx expo install`**
- **Trouvé pendant :** Task 1 git diff pre-commit
- **Issue :** `npx expo install expo-sharing` a retiré la ligne `associatedDomains: ["applinks:placeholder.familyflow.app"]` de `app.json` — non lié à expo-sharing, non demandé
- **Fix :** `git checkout -- app.json` ciblé (NOM EXPLICITE — conforme destructive-git-prohibition) avant le commit
- **Fichiers modifiés :** aucun (revert)
- **Commit :** rien — change non commit

**3. [Rule 1 - Bug] Mismatch token `Typography.h1/body/caption` vs design system réel**
- **Trouvé pendant :** Task 2 écriture des composants (le plan utilise `Typography.h1`)
- **Issue :** Le projet expose `FontSize` + `FontWeight` + `LineHeight` (cf. `constants/typography.ts`), pas un objet `Typography.{h1,h2,body,...}`. Plan 51-01 avait déjà flaggé ce point.
- **Fix :** mapping vers `FontSize.titleLg / heading / body / label` + `FontWeight.semibold/bold` + `LineHeight.body/normal` (cohérent avec le reste de `components/pdf/`)
- **Commit :** `558be68d`

**4. [Rule 1 - Bug] Token `colors.muted` inexistant**
- **Trouvé pendant :** Task 2 écriture des composants (le plan utilise `colors.muted`)
- **Issue :** Le design system expose `colors.textMuted` / `colors.textFaint`, pas `colors.muted`
- **Fix :** mapping vers `colors.textMuted` (consistant avec ExportCard, BookExportModal existants)
- **Commit :** `558be68d`

**5. [Rule 1 - Bug] Token `colors.bg` utilisé pour onPrimary dans LuluInstructionsModal**
- **Trouvé pendant :** Task 2 (le plan utilise `colors.bg` comme couleur de texte/icône sur bouton primary)
- **Issue :** `colors.bg` est `#EDEAE4` (sable clair) en light mode — contraste insuffisant sur primary. Le design system expose `colors.onPrimary: '#FFFFFF'` pour ça.
- **Fix :** usage de `colors.onPrimary` pour le label et l'icône du CTA Lulu
- **Commit :** `558be68d`

## Tests

### Jest — 4 nouveaux tests + 17 préservés (21 verts)
```
i18n impressions namespace
  ✓ charge le namespace impressions FR (titre écran)
  ✓ expose la clé du manuel Lulu
  ✓ expose les étapes de génération
  ✓ expose les 3 actions post-export

(préservés Phase 51-01/02 : 8 reducer + 3 buildVaultPdfUri + 6 qr-generator)
```

### Type-check
`npx tsc --noEmit` clean — aucune nouvelle erreur dans `components/pdf/`. Erreurs pré-existantes (`MemoryEditor.tsx`, `cooklang.ts`, `hooks/useVault.ts`) inchangées.

### Hardcoded UI strings
`grep -nE "<Text[^>]*>[A-Za-zÀ-ÿ]+ +[A-Za-zÀ-ÿ]" components/pdf/PostExportView.tsx components/pdf/LuluInstructionsModal.tsx` → 0 hits.

## Critères de succès — checklist

- [x] `expo-sharing ~14.0.8` installé
- [x] 3 fichiers i18n créés (`fr/impressions.json`, `en/impressions.json`, registration `lib/i18n.ts`)
- [x] Test Jest namespace vert (4 cas)
- [x] `LuluInstructionsModal` rend les 5 étapes FR + intro + tip + CTA Lulu
- [x] `PostExportView` rend les 3 boutons + bouton Terminé + haptic Medium au mount
- [x] `BookExportModal` phase post-export branchée (rendu + handleDone)
- [x] Toutes chaînes UI en FR strict via `t()` (0 hardcoded)
- [x] `npx tsc --noEmit` clean (hors pré-existantes)
- [x] Couleurs via `useThemeColors()` uniquement — aucun hex hardcoded
- [x] Lazy import `expo-sharing` + fallback Linking opérationnel

## Self-Check: PASSED

- FOUND: components/pdf/PostExportView.tsx
- FOUND: components/pdf/LuluInstructionsModal.tsx
- FOUND: locales/fr/impressions.json
- FOUND: locales/en/impressions.json
- FOUND: lib/__tests__/i18n.impressions.test.ts
- FOUND: fa1336bf (chore install + i18n namespace)
- FOUND: 558be68d (feat post-export + Lulu modal)
