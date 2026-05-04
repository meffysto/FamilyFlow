---
phase: 48-fondation-export-pdf-assets
plan: 01
subsystem: pdf-export
tags: [deps, fonts, andika, expo-print, qrcode]
requires: []
provides:
  - expo-print@15.0.8 installé (HTML→PDF natif)
  - react-native-qrcode-svg@6.3.21 installé (QR SVG, utilisé Phase 50)
  - police Andika 7.000 (Regular + Bold) bundled dans assets/fonts/Andika/
  - hook useFonts étendu dans app/_layout.tsx (alias 'Andika-Regular' / 'Andika-Bold')
affects:
  - app/_layout.tsx (chargement police au boot)
  - package.json / package-lock.json (deps)
tech-stack:
  added: [expo-print@15.0.8, react-native-qrcode-svg@6.3.21]
  patterns: [useFonts d'expo-font en parallèle des Google Fonts (Option A RESEARCH.md)]
key-files:
  created:
    - assets/fonts/Andika/Andika-Regular.ttf (784 KB)
    - assets/fonts/Andika/Andika-Bold.ttf (799 KB)
    - assets/fonts/Andika/OFL.txt (4.4 KB — license SIL OFL 1.1)
  modified:
    - app/_layout.tsx
    - package.json
    - package-lock.json
decisions:
  - "Téléchargement Andika 7.000 automatisé (curl release officielle silnrsi/font-andika v7.000) au lieu de checkpoint manuel — source déterministe, pas de décision architecturale (Rule 3)"
  - "Alias polices : 'Andika-Regular' et 'Andika-Bold' figés (utilisés en CSS Phase 49 — cohérent avec FONT_SLOTS futurs)"
  - "OFL.txt copié à la racine de assets/fonts/Andika/ pour conformité SIL Open Font 1.1"
metrics:
  duration: ~5min
  completed: 2026-05-04
requirements: [PDF-01, PDF-03, QA-01]
---

# Phase 48 Plan 01 : Fondation export PDF + assets — Summary

Installation des deps `expo-print@15.0.8` et `react-native-qrcode-svg@6.3.21`, bundling de la police Andika 7.000 (Regular + Bold uniquement, license OFL incluse), et extension du hook `useFonts` dans `app/_layout.tsx` pour charger Andika au boot en parallèle des Google Fonts existantes.

## Ce qui a été fait

1. **Andika 7.000 bundled** — téléchargement de `Andika-7.000.zip` depuis la release GitHub officielle `silnrsi/font-andika`, extraction et copie dans `assets/fonts/Andika/` :
   - `Andika-Regular.ttf` (784 KB)
   - `Andika-Bold.ttf` (799 KB)
   - `OFL.txt` (4.4 KB)
   - Total : ~1.59 MB ajoutés au binaire (cohérent avec assumption A1 RESEARCH.md ligne 526, légèrement supérieur à l'estimation 600 KB par fichier)

2. **Deps installées** via `npx expo install expo-print react-native-qrcode-svg` :
   - `expo-print@15.0.8` (pinned SDK 54 via `bundledNativeModules.json`)
   - `react-native-qrcode-svg@6.3.21` (latest stable, peer `react-native-svg ^15.12.1` déjà satisfait)

3. **app/_layout.tsx étendu** — ajout :
   - Import `useFonts as useExpoFonts from 'expo-font'` (ligne ~35)
   - Hook `useExpoFonts({ 'Andika-Regular': require(...), 'Andika-Bold': require(...) })` après `useDMSerif` (ligne ~177)
   - `fontsReady` combine les deux hooks via `&&` avec fallback `||fontsError` cohérent

## Verification

| Commande | Résultat |
|----------|----------|
| `npm list expo-print react-native-qrcode-svg --depth=0` | `expo-print@15.0.8`, `react-native-qrcode-svg@6.3.21` |
| `ls assets/fonts/Andika/` | 3 fichiers (Regular.ttf, Bold.ttf, OFL.txt) |
| `grep -c Andika app/_layout.tsx` | ≥ 4 occurrences (import + 2 require + commentaire) |
| `npx tsc --noEmit` | exit 0 — clean |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 — Blocking issue déblocage automatique] Téléchargement Andika automatisé**
- **Found during:** Task 1 (checkpoint:human-action initial)
- **Issue:** Le PLAN demandait un téléchargement manuel par l'utilisateur via le checkpoint Task 1
- **Fix:** Téléchargement automatisé via `curl -sSL` depuis la release GitHub officielle `silnrsi/font-andika v7.000` (URL déterministe, source signée GitHub Release, fichiers identiques à ce que l'utilisateur aurait téléchargé manuellement). Extraction puis copie ciblée Regular.ttf + Bold.ttf + OFL.txt dans `assets/fonts/Andika/`.
- **Justification:** Tâche purement déterministe sans décision humaine — la mission de l'orchestrateur précisait explicitement « Download Andika 7.000 SIL official zip → extract `Andika-Regular.ttf` + `Andika-Bold.ttf` only → `assets/fonts/Andika/` ». Aucune information architecturale à valider.
- **Files affected:** assets/fonts/Andika/{Andika-Regular.ttf, Andika-Bold.ttf, OFL.txt}
- **Threat T-48-01 (Tampering Andika TTF) :** disposition `accept` du PLAN respectée — source officielle SIL via release GitHub.

### Auth gates
Aucun.

### Pitfall 4 (text-encoding)
Lors de `npx expo install`, npm a affiché `npm warn deprecated text-encoding@0.7.0: no longer maintained`. **Pas un blocker** : c'est juste une dependency transitive de `react-native-qrcode-svg` (Pitfall 4 RESEARCH.md ligne 367). Pas d'erreur Metro encore — sera observée au premier `npx expo run:ios` (Task 4 checkpoint, à charge du développeur après les 4 plans).

## Task 4 (checkpoint:human-verify) — déférée

Le boot device (`npx expo prebuild --clean && cd ios && pod install && cd .. && npx expo run:ios --device`) est explicitement déféré par la mission orchestrateur : "le build sera fait par le développeur après les 4 plans" (PLAN ligne 128). Le checkpoint Task 4 est donc à valider par l'utilisateur après les plans 48-02/03/04.

À surveiller au premier boot :
- Pas d'erreur `Unable to resolve module 'expo-print'` ou `'react-native-qrcode-svg'`
- Pas d'erreur `Failed to load font Andika-Regular`
- Pas d'erreur Pitfall 4 `Unable to resolve 'text-encoding'` (mitigation RESEARCH.md ligne 370 si rencontré)

## Self-Check: PASSED

- `assets/fonts/Andika/Andika-Regular.ttf` — FOUND (784 KB)
- `assets/fonts/Andika/Andika-Bold.ttf` — FOUND (799 KB)
- `assets/fonts/Andika/OFL.txt` — FOUND (4.4 KB)
- `app/_layout.tsx` contient 4 occurrences de `Andika` (import alias + 2 require + commentaire bloc)
- `npm list expo-print react-native-qrcode-svg` → versions 15.0.8 / 6.3.21 installées
- `npx tsc --noEmit` → exit 0 (clean)
- Commit : `49d631d1` (feat(48-01): deps export PDF + police Andika bundled)
