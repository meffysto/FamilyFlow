# Spike Conventions

Patterns établis sur la branche `feat/lightning-farm`. Les futurs spikes Lightning suivent ces conventions sauf raison contraire.

## Stack

- **Module métier** : `lib/<domain>/` avec `types.ts` + `<domain>-client.ts` + `credentials.ts` + `feature-flag.ts` + `index.ts` (barrel).
- **UI playground** : `app/<domain>-spike.tsx` (route Expo Router dédiée, accessible via lien depuis Settings).
- **UI config** : `components/settings/Settings<Domain>.tsx`, montée dans `app/(tabs)/settings.tsx` via `SectionId` discriminant.
- **Persistance creds** : `expo-secure-store` uniquement. Jamais le vault Obsidian Markdown ni `lib/vault-cache.ts`.

## Structure

```
.planning/spikes/
  MANIFEST.md
  CONVENTIONS.md (ce fichier)
  NNN-descriptive-name/
    README.md (frontmatter spike + Investigation Trail + Results)
```

## Patterns

### Feature flag
- Default OFF (`BUILD_DEFAULT_ENABLED = false`).
- Cache mémoire pour éviter de lire SecureStore à chaque check.
- Gate l'instanciation du client réseau, pas juste l'UI.
- Toggle UI refuse l'activation sans configuration valide (anti foot-gun).
- `clearCreds()` → `setFlagEnabled(false)` systématiquement.

### Client REST
- Constructor prend `{baseUrl, ...credentials}` — testable, switchable, pas de singleton.
- Timeout par défaut 8s via `AbortController`.
- Normalise `baseUrl` (trim + retire trailing slashes).
- Erreurs typées : `<Domain>Error extends Error` avec `cause?: {httpStatus, body}`.
- Conversions d'unité côté client (ex. msat→sat) — l'app expose toujours l'unité utilisateur, jamais l'unité du protocole.

### Spike Labo (UI)
- Section `Labo` dans `app/(tabs)/settings.tsx`, visible adultes uniquement (`!isChildMode`).
- Modal `pageSheet` standard.
- Form de connexion + bouton « Tester » dédié (valide avant Save).
- Lien explicite vers le playground après save+enable.
- Bandeau d'instance bien visible (demo vs perso) avec code couleur.

## Tools & Libraries

| Lib | Version | Usage | Status |
|-----|---------|-------|--------|
| `expo-secure-store` | ~15.0.8 | Persistance creds | ✓ Confirmé |
| `expo-clipboard` | ~8.0.8 | Copier strings sensibles (bolt11) | ✓ Confirmé |
| `expo-haptics` | ~15.0.8 | Feedback tactile sur événements clés | ✓ Confirmé |
| `react-native-qrcode-svg` | ^6.3.21 | QR depuis string | ✓ Premier usage validé |
| `lucide-react-native` | (existant) | Icônes (Bitcoin, Zap, Copy, Check) | ✓ Confirmé |

## App Store

Toute feature en Labo doit :
- Rester invisible depuis l'onboarding et les CTA principaux.
- Ne pas apparaître dans les screenshots / metadata App Store.
- Garder un toggle off par défaut.
- Ne pas merger vers `main` sans décision explicite de release.
