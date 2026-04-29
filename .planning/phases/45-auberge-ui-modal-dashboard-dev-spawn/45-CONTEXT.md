# Phase 45: Auberge — UI modal + dashboard + dev spawn - Context

**Gathered:** 2026-04-29
**Status:** Ready for planning
**Source:** Conversation design (auto mode)

<domain>
## Phase Boundary

Cette phase rend l'Auberge **testable bout-en-bout** par l'utilisateur. Elle livre :
- `AubergeSheet.tsx` — modal complète accessible depuis `BuildingDetailSheet` (CTA "Voir l'auberge").
- `DashboardAuberge.tsx` — carte dashboard si auberge construite.
- Bouton `__DEV__` "Forcer un visiteur" dans `AubergeSheet` pour spawn manuel sans attendre les conditions de spawn.
- Wiring du CTA dans `BuildingDetailSheet` (remplace le placeholder Phase 44).

**IN scope :**
- Modal `AubergeSheet.tsx` avec :
  - Header titre + compteur "X visiteurs · ❤ Y"
  - Liste cartes visiteurs actifs (portrait emoji XL, nom, bio, demande items avec ✅/❌, timer animé, reward preview, CTAs Livrer/Décliner)
  - Empty state si aucun visiteur
  - Section repliée Réputation (CollapsibleSection, liste PNJ rencontrés + cœurs)
  - Bouton dev `__DEV__ &&` "Forcer un visiteur" en bas
- `DashboardAuberge.tsx` :
  - Visible uniquement si l'auberge est construite (lecture `placedBuildings` via useFarm)
  - Carte compacte avec 1-2 visiteurs en aperçu + CTA "Voir l'auberge"
  - Pulse léger Reanimated si timer < 2h
  - Toggle visibilité dans `DashboardPrefsModal.tsx`
- Wiring `BuildingDetailSheet` : pour `producesResource: false`, remplacer le placeholder par un CTA "Voir l'auberge" qui ouvre `AubergeSheet`.

**OUT of scope :**
- Spawn automatique des visiteurs (Phase 46).
- Notifications expo-notifications (Phase 46).
- Sprites bâtiment auberge + portraits PNJ (Phase 47 — emoji fallback en attendant).
- Animations sophistiquées (LootBoxOpener-like) à la livraison — animations basiques OK pour cette phase.
- Badges/achievements (Phase 47+).

</domain>

<decisions>
## Implementation Decisions

### AubergeSheet.tsx (composant principal)
- Présentation `pageSheet` + drag-to-dismiss (convention CLAUDE.md).
- Lit l'état via `useAuberge(profileId)` (hook livré Phase 43).
- Lit le profileId actif via `useVault()` (pattern existant des sheets).
- Wraps tout dans `SectionErrorBoundary`.
- Couleurs via `useThemeColors()` exclusivement.
- i18n : préférer chaînes FR direct dans cette phase (réserver les clés `auberge.*` pour polish ultérieur).

**Layout des cartes visiteurs :**
- Portrait : `<Text style={{ fontSize: 56 }}>{visitor.emoji}</Text>` (sprite plus tard).
- Nom + bio : depuis le catalogue (`labelKey` + `descriptionKey` → traductions FR direct dans le composant via lookup map locale OK pour cette phase).
- Demande : grid des items avec `✅/❌` selon `canDeliver` qui retourne `{ ok, missing }`.
- Timer : `getRemainingMinutes(visitor, now)` formaté en `Xh YYmin`. Couleur via `useThemeColors`.
  - Default : neutral
  - < 6h : ambre
  - < 1h : rouge
- Reward preview : `+{rewardCoins} 🍃 · {lootChance}% chance loot`
- CTAs :
  - **Livrer** : disabled si `!canDeliver.ok`. OnPress → `useAuberge.deliverVisitor(profileId, instanceId)` + Haptics.success + toast "Livré ! +X 🍃" (réutiliser ToastContext si dispo).
  - **Décliner** : OnPress → confirm Alert "Vraiment décliner ?" → `useAuberge.dismissVisitor(...)` + Haptics.warning.

**Empty state :**
- Centré, emoji 🛖, texte "L'auberge est calme... un visiteur arrivera bientôt."

**Section Réputation (CollapsibleSection, repliée par défaut) :**
- Liste tous les visiteurs du catalogue.
- Pour chaque : portrait + nom + cœurs (level/5) ou "Jamais rencontré" si absent du state.

**Dev button (bas du sheet, visible si `__DEV__`) :**
```tsx
{__DEV__ && (
  <Button
    title="🪄 Forcer un visiteur (dev)"
    onPress={() => {
      // appel direct à spawnVisitor via useAuberge (à ajouter au hook si nécessaire)
      // OU exposer une méthode debug dans le hook : forceSpawn()
    }}
  />
)}
```
Le hook `useAuberge` doit exposer une méthode `forceSpawn(profileId)` (ou équivalent debug-only) qui contourne `shouldSpawnVisitor` et appelle `spawnVisitor` directement. À ajouter dans cette phase.

### DashboardAuberge.tsx
- Pattern de `DashboardGarden.tsx` ou `DashboardSection` existant.
- Detection auberge construite : `placedBuildings.find(b => b.buildingId === 'auberge')` via useFarm.
- Si aucune auberge : composant retourne `null` (pas de carte).
- Si construite :
  - Header "🛖 Auberge" + compteur "X visiteurs"
  - 1-2 cartes compactes (portrait, nom, timer, statut delivrable ou pas)
  - CTA "Voir l'auberge" → ouvre `AubergeSheet`
  - Pulse Reanimated si un timer < 2h (`useAnimatedStyle` + `withRepeat(withTiming)`)
- Toggle visibilité : ajouter une entrée dans `DashboardPrefsModal.tsx` pour cacher/afficher la carte (suivre le pattern existant).
- `SectionErrorBoundary` wrap.

### BuildingDetailSheet wiring
Remplacer le placeholder Phase 44 :
- Si `def.id === 'auberge'` : afficher un bouton/CTA "🛖 Voir l'auberge" qui ouvre `AubergeSheet` (state local `aubergeOpen` ou prop).
- Le sheet auberge doit pouvoir être ouvert par-dessus `BuildingDetailSheet` (pageSheet sur pageSheet OK iOS).

### useAuberge — ajout `forceSpawn` (debug)
Étendre le hook livré Phase 43 :
- `forceSpawn(profileId): Promise<ActiveVisitor | null>` — appelle directement `spawnVisitor(state, treeStage, now, totalReputation)` sans passer par `shouldSpawnVisitor`. Persiste l'état farm. Retourne le visiteur spawné ou null si aucun éligible (stade trop bas par exemple).
- À garder même hors `__DEV__` (le hook ne sait pas s'il est en debug, c'est l'UI qui filtre l'exposition du bouton).

### Tests
- Pas de tests unitaires UI pour cette phase (suivant CLAUDE.md "pas de test suite UI").
- Vérification : `npx tsc --noEmit` clean + lancement dev-client manuel pour valider.

### Claude's Discretion
- Choix exact des copies FR (titres, descriptions, copies des cartes visiteurs depuis le catalogue).
- Layout précis (grid items / list, espacement).
- Animation pulse exacte (durée, scale).
- Gestion du focus / scroll dans la modal (FlatList vs ScrollView selon longueur attendue).
- Décision : afficher OU NON les visiteurs `delivered`/`expired` dans la liste (recommandation : non, juste les `active`).

</decisions>

<canonical_refs>
## Canonical References

### Patterns à imiter
- `components/mascot/BuildingDetailSheet.tsx` — pattern modal pageSheet avec drag-to-dismiss.
- `components/mascot/BuildingShopSheet.tsx` — autre exemple de sheet ferme.
- `components/dashboard/DashboardGarden.tsx` — pattern carte dashboard avec lectures useFarm.
- `components/ui/CollapsibleSection.tsx` — section repliée pour la réputation.
- `components/ui/ModalHeader.tsx` — header standard.
- `hooks/useExpeditions.ts` — pattern hook autonome consommé par les sheets.

### Hook à étendre
- `hooks/useAuberge.ts` — ajout `forceSpawn`.

### Composant à modifier
- `components/mascot/BuildingDetailSheet.tsx` — wiring CTA "Voir l'auberge" pour `id === 'auberge'`.
- `components/dashboard/DashboardPrefsModal.tsx` — toggle visibilité.

### Conventions
- `CLAUDE.md` — useThemeColors, FR, ReanimatedSwipeable, no hardcoded colors, `Spacing['2xl']` au lieu de `16`.
- `constants/spacing.ts`, `constants/typography.ts` — tokens design.

</canonical_refs>

<specifics>
## Specific Ideas

- **Critère d'acceptation testable** : après cette phase, l'utilisateur peut :
  1. Construire l'auberge dans le shop (déjà possible Phase 44 si `social-1` débloqué).
  2. Tap dessus dans la grille → ouvre `BuildingDetailSheet` qui affiche le CTA "Voir l'auberge".
  3. Tap "Voir l'auberge" → `AubergeSheet` s'ouvre avec empty state initial.
  4. Tap "Forcer un visiteur (dev)" → un visiteur apparaît avec une demande.
  5. Si inventaire suffisant → tap "Livrer" → animation succès + reward visible + carte disparaît.
  6. Si inventaire insuffisant → "Livrer" disabled, indication claire de ce qui manque.
  7. Tap "Décliner" → confirm + visiteur disparaît, cooldown enregistré.
- Le test peut se faire en Sim iOS sans iCloud (vault local).

</specifics>

<deferred>
## Deferred Ideas

- Phase 46 : spawn automatique au launch + cascade de tâches + notifications expo-notifications + toggle "Visiteurs auberge" dans NotificationSettings.
- Phase 47 : sprites pixel art bâtiment auberge (3 niveaux) + 6 portraits PNJ via mcp__pixellab.
- Phase 47+ : badges Auberge (1ère livraison, 10 livraisons, cœur max), équilibrage final, animations LootBoxOpener-like, microcopy polish.

</deferred>

---

*Phase: 45-auberge-ui-modal-dashboard-dev-spawn*
*Context gathered: 2026-04-29 via design conversation (auto mode)*
