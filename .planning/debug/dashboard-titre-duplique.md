---
slug: dashboard-titre-duplique
status: resolved
trigger: "FAM-9 — Dashboard affiche deux titres à la suite (visible sur capture Linear)"
created: 2026-05-01
updated: 2026-05-01
linear_issue: FAM-9
---

# Debug : Dashboard — ZoneLabels orphelins (« À la maison » / « Côté ferme »)

## Symptoms

- **Expected**: Chaque ZoneLabel ("Aujourd'hui" / "À la maison" / "Côté ferme") doit toujours être suivi d'au moins une carte
- **Actual**: "À la maison" et "Côté ferme" apparaissent à la suite, sans carte entre eux (cf. capture FAM-9)
- **Mode**: adulte (le précédent diagnostic « mode enfant » était erroné)
- **Reproduction**: Ouvrir Dashboard quand certaines sections de zone retournent `null` en interne

## Root Cause

`app/(tabs)/index.tsx:1194` — la table `hasContent` est une whitelist de visibilité utilisée pour filtrer les sections AVANT d'insérer leur ZoneLabel. Plusieurs composants Dashboard renvoient `null` quand leurs données sont absentes mais ne sont **pas** listés dans `hasContent` :

| Section | Zone | `return null` si... |
|---|---|---|
| `garden` | farm | `profiles.length === 0` |
| `auberge` | farm | `!hasAuberge` (auberge non construite) |
| `photos` | home | `enfants.length === 0` |

→ ces sections passent le filtre `visibleSections`, déclenchent `maybePushZone` (qui pousse "À la maison" / "Côté ferme"), puis rendent `null`. Si aucune autre section de la zone ne suit, le ZoneLabel reste orphelin et on lit deux titres consécutifs.

`auberge` est le déclencheur le plus probable : feature récente, retourne null tant que l'utilisateur n'a pas construit l'auberge dans la ferme.

## Fix

`app/(tabs)/index.tsx:1205-1210` — étendre `hasContent` pour mirrorer la condition de rendu réelle des trois sections :

```ts
garden: profiles.length > 0,
auberge: Array.isArray(activeProfile?.farmBuildings)
  && activeProfile.farmBuildings.some((b) => b.buildingId === 'auberge'),
photos: enfants.length > 0,
```

## Verification

- `npx tsc --noEmit` → OK
- Test visuel à confirmer : ouvrir l'app sur le profil concerné — "Côté ferme" ne doit plus apparaître si aucune section ferme n'a de carte à montrer.

## Files changed

- `app/(tabs)/index.tsx` — extension du whitelist `hasContent` (3 entrées ajoutées)

## Eliminated

- Header navigation (Tabs `headerShown: false`)
- `greetingChild` vs `dateText` (faux diagnostic du cycle 1, revert effectué)
- ZoneLabel doublon dans le code (la logique `prevZone` empêche bien deux labels identiques consécutifs)
