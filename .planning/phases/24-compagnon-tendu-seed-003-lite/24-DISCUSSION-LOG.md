# Phase 24: Compagnon étendu (SEED-003 lite) - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-10
**Phase:** 24-compagnon-tendu-seed-003-lite
**Areas discussed:** Persistance messages, Triggers cross-feature, Timing & fréquence

---

## Persistance messages

### Q1: Comment persister les messages compagnon entre les restarts ?

| Option | Description | Selected |
|--------|-------------|----------|
| SecureStore JSON | Clé unique par profil, pattern déjà utilisé pour caps anti-abus (Phase 20) | ✓ |
| Fichier vault markdown | Écrire dans gami-{id}.md, visible dans Obsidian | |
| Tu décides | Claude choisit l'approche | |

**User's choice:** SecureStore JSON
**Notes:** Aucune

### Q2: Combien de messages garder en persistance ?

| Option | Description | Selected |
|--------|-------------|----------|
| 5 derniers | Suffisant pour anti-répétition, léger en SecureStore | ✓ |
| 10 derniers | Plus de contexte pour l'IA | |
| 20 derniers | Historique riche, risque limite SecureStore | |

**User's choice:** 5 derniers
**Notes:** Aucune

### Q3: Que persister par message ?

| Option | Description | Selected |
|--------|-------------|----------|
| Texte + event + timestamp | Message affiché, type d'événement, horodatage | ✓ |
| Texte + timestamp seulement | Minimaliste, pas de traçabilité par type | |
| Texte + event + timestamp + source | Ajouter si IA ou template | |

**User's choice:** Texte + event + timestamp
**Notes:** Aucune

---

## Triggers cross-feature

### Q4: Où le compagnon doit-il parler hors tree.tsx ?

| Option | Description | Selected |
|--------|-------------|----------|
| Dashboard seulement | morning_greeting + weekly_recap sur dashboard, reste sur tree.tsx | ✓ |
| Dashboard + tabs actifs | Compagnon réagit sur repas, budget, etc. | |
| Partout via provider global | CompanionProvider au root, toast sur tout écran | |

**User's choice:** Dashboard seulement (après demande de recommandation)
**Notes:** L'utilisateur a demandé la recommandation de Claude, qui a suggéré Dashboard seulement pour cette phase "lite".

### Q5: Comment afficher le message sur le dashboard ?

| Option | Description | Selected |
|--------|-------------|----------|
| Bulle inline | Section compagnon en haut du dashboard avec avatar + bulle | ✓ |
| Toast flottant | Toast animé par-dessus le dashboard | |
| Tu décides | Claude choisit le pattern | |

**User's choice:** Bulle inline
**Notes:** Aucune

---

## Timing & fréquence

### Q6: Créneaux de déclenchement actuels OK ?

| Option | Description | Selected |
|--------|-------------|----------|
| Garder tel quel | morning 6h-11h, nudge 14h-19h, comeback 24h, celebration streak%7 | |
| Ajuster les créneaux | Modifier heures ou seuils | |

**User's choice:** (Other) — Pas de celebration streak, le reste OK
**Notes:** L'utilisateur retire celebration (streak multiples de 7) du scope de cette phase. Les 4 autres event types gardent leurs créneaux actuels.

### Q7: Weekly recap — quand déclencher ?

| Option | Description | Selected |
|--------|-------------|----------|
| Dimanche 18h-21h | Première ouverture dimanche soir | ✓ |
| Dimanche toute la journée | Dès première ouverture du dimanche | |
| Lundi matin | Bilan de la semaine passée au début de la nouvelle | |

**User's choice:** Dimanche 18h-21h
**Notes:** Aucune

### Q8: gentle_nudge — fréquence ?

| Option | Description | Selected |
|--------|-------------|----------|
| 1 seul nudge/jour | Un rappel doux l'après-midi, pas plus | ✓ |
| Jusqu'à 2 nudges/jour | Un l'après-midi et un le soir | |
| Tu décides | Claude calibre la fréquence | |

**User's choice:** 1 seul nudge/jour
**Notes:** Aucune

---

## Claude's Discretion

- Implémentation technique de la bulle inline dashboard
- Gestion du flag celebration (supprimer ou désactiver)
- Structure exacte du weekly recap layout
- Pattern de chargement async des messages au mount

## Deferred Ideas

- Provider global CompanionProvider — futur milestone
- Celebration streak — réactiver si demandé
- Historique complet consultable (au-delà des 5 derniers) — futur milestone
