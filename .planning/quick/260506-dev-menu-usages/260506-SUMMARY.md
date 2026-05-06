---
phase: quick-260506-dev-menu-usages
type: quick
---

# Summary — Menu Plus par usages dev-only

## Livré

- Branche creee : `codex/dev-menu-usages`
- `app/(tabs)/more.tsx` affiche une nouvelle vue uniquement sous `__DEV__`
- La vue production conserve l'ancien menu liste/grille
- La vue dev ajoute :
  - recherche de raccourcis
  - favoris rapides
  - groupes d'intention : Aujourd'hui, Planifier, Souvenirs, Jeu, Reglages
  - inventaire complet replie derriere `Tous les outils`

## Verification

- `npx tsc --noEmit` : OK

## Notes

- Les raccourcis continuent de s'appuyer sur `items` pour conserver badges,
  couleurs, routes et restrictions enfant/adulte.
- Les sous-raccourcis Reglages pointent tous vers l'ecran Reglages pour cette
  premiere version de test.
