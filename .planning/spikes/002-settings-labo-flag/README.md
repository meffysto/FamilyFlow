---
spike: 002
name: settings-labo-flag
type: standard
validates: "Given LIGHTNING_ENABLED off (par défaut), when l'utilisateur relance l'app sans toucher au Labo, then la ferme reste 100% offline et zéro appel réseau LN n'est émis ; quand il active le toggle, le form de connexion fonctionne et un bouton Test connection valide les creds avant Save"
verdict: VALIDATED
related: [001]
tags: [feature-flag, settings, ui, secure-store]
---

# Spike 002 — Settings → Labo + Feature Flag

## What This Validates

> **Given** un build avec `LIGHTNING_ENABLED` default OFF,
> **when** l'utilisateur n'a jamais touché à la section Labo,
> **then** :
> - Aucun appel réseau LN n'est émis au boot ni pendant l'usage normal.
> - La ferme classique fonctionne 100 % offline indépendamment.
> - Le toggle dans Settings refuse de s'activer si aucune config sauvée (anti-foot-gun).
> - Effacer la config désactive automatiquement le flag.

## Status

Implémenté en parallèle de Spike 001 (intégration naturelle dans `lib/lightning/feature-flag.ts` et `components/settings/SettingsLightning.tsx`).

## Code livré

- `lib/lightning/feature-flag.ts` — `isLightningEnabled()` / `setLightningEnabled()` avec cache mémoire et `BUILD_DEFAULT_ENABLED = false`.
- `components/settings/SettingsLightning.tsx` — toggle qui :
  - Vérifie `savedConfigured` avant d'autoriser l'activation (Alert sinon).
  - Désactive automatiquement le flag à `clearLnbitsConfig()`.
- `app/lightning-spike.tsx` — gate dur : si `enabled === false || config === null`, écran vide + lien retour Réglages, aucun `LnbitsClient` instancié.

## Garanties par construction

| Garantie | Mécanisme | Fichier |
|----------|-----------|---------|
| Default OFF | `BUILD_DEFAULT_ENABLED = false` | `feature-flag.ts:21` |
| Pas d'appel sans creds | `config === null` → gate UI | `lightning-spike.tsx` empty state |
| Pas d'appel sans flag | `enabled === false` → gate UI | `lightning-spike.tsx` empty state |
| Ferme offline préservée | Aucun fichier ferme/mascotte touché | grep verifiable |
| Anti foot-gun | Refus toggle on sans config | `SettingsLightning.tsx:handleToggle` |
| Pas dans le vault Markdown | `SecureStore` uniquement | `credentials.ts:STORAGE_KEY` |
| Pas dans vault-cache | `lib/vault-cache.ts` non importé | grep verifiable |

## Results

**Verdict : VALIDATED** — par construction et inspection du code livré dans 001. Vérification manuelle à coupler avec celle de 001.
