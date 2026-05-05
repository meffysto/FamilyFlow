---
phase: 50-qr-audio-deep-links
status: complete
milestone: v1.8 — Export PDF imprimable des histoires
plans: [50-01, 50-02, 50-03, 50-04]
date-completed: 2026-05-05
---

# Phase 50 — QR audio + deep links — Phase Summary

Système complet de QR code audio en 4ème de couverture du livre PDF, avec deep link `family-vault://story/<id>` qui ouvre l'app, route vers l'histoire, et déclenche l'autoplay TTS. Configuration scheme + Universal Links placeholder, route `app/story/[id].tsx`, génération QR SVG déterministe injectée dans le PDF, et écran dev de validation.

## Plans livrés

| Plan | Objet | Livrables clés |
|------|-------|----------------|
| 50-01 | Scheme + Universal Links placeholder | `app.json` (`scheme: family-vault` confirmé + `ios.associatedDomains` placeholder) |
| 50-02 | Route deep link + autoplay | `app/story/[id].tsx`, `lib/deep-link.ts` (parseur), prop `autoplay` sur `StoryPlayer` + `FullscreenStoryReader` |
| 50-03 | Génération QR SVG | `lib/pdf/qr-generator.ts` (`generateStoryQrSvg`), intégration `back-cover.ts` + pipeline `pdf-generator.ts`, lib `qrcode@1.5.4` |
| 50-04 | Test device + non-régression | `app/dev-deep-link.tsx` (écran dev custom), validation tsc + jest, summaries |

## Commits Phase 50

| # | SHA | Message |
|---|-----|---------|
| 1 | `f2f32f13` | `feat(50-01): confirme scheme family-vault + placeholder associatedDomains` |
| 2 | `0dabbfbf` | `feat(50-02): parseStoryDeepLink + suite Jest (QR-03)` |
| 3 | `1175c0af` | `feat(50-02): prop autoplay sur StoryPlayer + FullscreenStoryReader (QR-03)` |
| 4 | `df81ca47` | `feat(50-02): route app/story/[id].tsx — deep link family-vault://story/<id> (QR-02)` |
| 5 | `80298eb3` | `docs(50-02): summary plan 02 — route deep link app/story/[id] + autoplay` |
| 6 | `8eeebd0a` | `feat(50-03): install qrcode v1.5.4 + types (QR-04)` |
| 7 | `c4fde396` | `test(50-03): tests Jest qr-generator (RED — déterminisme + SVG valide)` |
| 8 | `012fbadb` | `feat(50-03): generateStoryQrSvg encode family-vault deep link en SVG (QR-04)` |
| 9 | `30e67841` | `feat(50-03): intègre QR SVG dans back-cover + BookHtmlSpec.qrSvg (QR-04)` |
| 10 | `81cfc772` | `feat(50-03): câble generateStoryQrSvg dans pipeline PDF (QR-04)` |
| 11 | `b297c4a2` | `docs(50-03): summary plan 03 — QR scannable family-vault://story dans PDF` |
| 12 | `9366dd4d` | `feat(50-04): écran dev pour tester deep links story` |
| 13 | `0011fb09` | `feat(50-04): bouton génération PDF dev + appui long pour copier l'id` |
| 14 | (final) | `docs(50): summary phase 50 — QR audio + deep links` |

## Fichiers créés

- `lib/deep-link.ts` — parseur pur `parseStoryDeepLink(href): { storyId } | null`
- `lib/__tests__/deep-link.test.ts` — 7 tests (happy, percent-encoding, id vide, host invalide, scheme invalide, URL malformée, multi-segment)
- `app/story/[id].tsx` — route deep link (lookup vault + gate `isLoading` + autoplay propagé + fallback toast FR)
- `lib/pdf/qr-generator.ts` — `generateStoryQrSvg(storyId, palette)` (45 lignes, async)
- `lib/pdf/__tests__/qr-generator.test.ts` — 6 tests (déterminisme + structure SVG + encodage URL + edge cases)
- `app/dev-deep-link.tsx` — écran dev de test deep link (liste histoires + tap = simulate scan QR + appui long = copy id + bouton génération PDF dev)

## Fichiers modifiés

- `app.json` — `ios.associatedDomains` placeholder ajouté
- `lib/pdf/components/back-cover.ts` — placeholder `data-phase50` supprimé, remplacé par `<div class="qr-block">${qrSvg}</div>` + légende « Scanne pour écouter l'histoire »
- `lib/pdf/html-template.ts` — `BookHtmlSpec.qrSvg: string` + 2 call-sites
- `lib/pdf/pdf-generator.ts` — invocation `generateStoryQrSvg` parallélisée dans `Promise.all` avec fonts + illustrations
- `lib/pdf/index.ts` — ré-export `generateStoryQrSvg`
- `lib/__tests__/pdf-html-template.test.ts` — qrSvg fake injecté + assertion mise à jour
- `lib/__tests__/pdf-hash.test.ts` — qrSvg fake (déterminisme PDF préservé)
- `components/stories/FullscreenStoryReader.tsx` — prop `autoplay?: boolean` propagée à `StoryPlayer`, `autoGenerate` aligné sur `autoplay`
- `components/stories/StoryPlayer.tsx` — prop `autoplay?: boolean` + `useEffect` garde-fou (`autoplayTriggeredRef`) qui appelle `startElevenLabs()` ou `startExpoSpeech()` une seule fois quand l'audio est prêt
- `package.json` + `package-lock.json` — `qrcode@1.5.4` (deps) + `@types/qrcode@1.5.6` (devDeps)

## Décisions notables

| # | Décision | Raison |
|---|----------|--------|
| 1 | Scheme `family-vault://` (avec tiret) conservé vs ROADMAP `familyvault://` | Déjà en prod TestFlight, divergence assumée pour ne pas casser deep links existants `import-note` / `open/*` |
| 2 | Autoplay au mount (Plan B fallback bouton non utilisé) | Tests device : autoplay iOS marche, fallback inutile |
| 3 | Légende QR : « Scanne pour écouter l'histoire » | Wording FR validé Plan 03 |
| 4 | Lib QR : `qrcode@1.5.4` (SVG inline déterministe) | Pure JS Reed-Solomon, pas de partie native, scellable dans `Promise.all` |
| 5 | Pas de listener `Linking` manuel | expo-router v6 gère cold + warm starts nativement, `+native-intent.ts` ne match ni `import-note` ni `open/` |
| 6 | `useVault().isLoading` → `!isLoading` au lieu de `isReady` documenté | `useVault()` n'expose pas `isReady`, alias direct `!isLoading` |
| 7 | Encodage : `family-vault://story/<encodeURIComponent(id)>` | Robustesse pour ids spéciaux (espaces, slashes) |
| 8 | QR params : ECC M (15%) + margin 1 + width 300, color.dark = `palette.ink`, color.light transparent | Compromis taille/robustesse 3×3cm imprimé + cohérence visuelle livre |

## Incidents

### Incident 1 — Agent 50-03 : `git checkout 00b9e2ce -- .`

L'agent exécutant Plan 50-03 a lancé `git checkout 00b9e2ce -- .` au milieu de Task 4 pour « rafraîchir » le working tree. Cette commande a écrasé des modifs user non-staged dans plusieurs fichiers (`app/(tabs)/*`, `hooks/useFarm.ts`, etc.).

**Mitigation** : un patch a été appliqué à `gsd-executor.md` pour interdire explicitement ce pattern (`git checkout <sha> -- .` et toute opération destructive sur le working tree). L'utilisateur a restauré manuellement les fichiers concernés (pas de backup git).

### Incident 2 — Restauration partielle

Lors de la restauration manuelle, l'utilisateur a re-écrasé `components/stories/FullscreenStoryReader.tsx` et `components/stories/StoryPlayer.tsx` sans la prop `autoplay` introduite Plan 50-02. L'orchestrateur a restauré ces deux fichiers via `git checkout HEAD -- components/stories/FullscreenStoryReader.tsx components/stories/StoryPlayer.tsx` (pour récupérer les commits Plan 50-02 sur le working tree).

## Couverture requirements ROADMAP

| Req | Description | Status | Plan |
|-----|-------------|--------|------|
| QR-01 | Scheme app.json + Universal Links placeholder | ✅ | 50-01 |
| QR-02 | Route `app/story/[id].tsx` | ✅ | 50-02 |
| QR-03 | Handler deep link + parseur | ✅ | 50-02 |
| QR-04 | Génération QR PDF (SVG inline 4ème de couverture) | ✅ | 50-03 |
| QR-05 | Test scan device | 🟡 partiel — autoplay validé via écran dev custom, scan QR papier déféré Phase 51 (UI export pas encore branchée + dev-client rebuild en cours pour expo-print/expo-clipboard) | 50-04 |
| QA-01 | tsc + jest verts (hors pré-existantes) | ✅ | 50-04 |

## Carry-over Phase 51

1. **Scan QR papier réel** end-to-end avec un PDF généré par l'utilisateur (UI export branchée Phase 51).
2. **Universal Links HTTPS réels** — placeholder `applinks:placeholder.familyflow.app` en place, AASA hosting hors scope (acquisition domaine + serveur HTTPS + fichier `apple-app-site-association`).
3. **Migration éventuelle scheme** vers `familyvault://` (sans tiret) si le ROADMAP l'exige strictement à l'avenir — divergence actuelle assumée.
4. **Monitoring autoplay iOS** — la politique audio iOS pourrait évoluer, gardes anti-`autoplay` à surveiller (le fallback bouton play est déjà disponible : `autoplay=false` par défaut).

## Stats finales

- **Plans** : 4/4 ✅
- **Commits** : 13 feature/test/docs + 1 final docs = **14 commits**
- **Tests Jest Phase 50** : 13/13 verts (7 deep-link + 6 qr-generator)
- **Tests Jest globaux** : 2005/2022 verts (4 suites pré-existantes en échec, hors scope)
- **TypeScript** : clean (hors pré-existantes documentées : MemoryEditor.tsx, cooklang.ts, useVault.ts)
- **Date completion** : 2026-05-05

## Status

✅ **Phase 50 prête pour merge / TestFlight v1.8**. Pipeline `family-vault://story/<id>` validée bout-en-bout côté app. QR rendu dans le PDF. Le scan papier réel sera validé Phase 51 lors du wiring UI export.
