# Phase 17: Codex UI - Context

**Gathered:** 2026-04-08
**Status:** Ready for planning

<domain>
## Phase Boundary

Livraison de la couche présentation du codex ferme : une modale `FarmCodexModal` ouverte depuis un bouton « ? » intégré au HUD ferme existant, qui permet de parcourir les 110 entrées produites en Phase 16 par catégorie, de rechercher en texte libre, et de rejouer le tutoriel ferme (préparé pour Phase 18). Aucune donnée à créer ni à agréger — tout est déjà dans `lib/codex/content.ts` + `locales/{fr,en}/codex.json`. Phase 17 consomme Phase 16.

**Out of scope** (appartient à d'autres phases) :
- Contenu/lore supplémentaire → Phase 16 verrouillé
- Implémentation réelle du tutoriel → Phase 18 (seulement le bouton replay ici)
- Refonte du HUD ferme existant → juste l'ajout d'un 5e item

</domain>

<decisions>
## Implementation Decisions

### Layout et navigation

- **D-01 (Tabs horizontaux scrollables + FlatList 2-col) :** Extension du pattern `CraftSheet` (qui a 3 tabs fixes) à 10 catégories via tabs/chips scrollables horizontalement en haut de la modale. Sous la barre de tabs, une seule `FlatList` virtualisée affiche la catégorie active en grille 2 colonnes (`numColumns={2}`). Changer de tab remplace le dataset de la FlatList. Cohérent avec CraftSheet catalogue + BadgesSheet + TreeShop.
- **D-02 (Mini-modal détail au tap) :** Appuyer sur une carte ouvre un mini-modal détail (pattern CraftSheet lignes 1-7 du header : « grille 2 colonnes groupee par stade d'arbre […] mini-modal detail au tap »). Pas de navigation push, pas de bottom sheet secondaire — une `Modal` classique par-dessus `FarmCodexModal` avec fermeture par bouton + backdrop tap.
- **D-03 (Carte compacte : icône + nom) :** Dans la grille 2-col, chaque carte contient uniquement sprite/emoji + nom. Pas de stats ni lore inline. Maximum de cartes visibles par écran, visuel épuré, alignement avec TreeShop et CraftSheet catalogue.

### Détail d'une entrée

- **D-04 (Lore en haut, stats en bas) :** Mini-modal détail en style wiki Stardew Valley : grande icône + nom + paragraphe lore narratif i18n (immersion) en tête, puis tableau stats brutes (cycles, coûts, taux de drop, déblocages requis) en bas. Les stats sont résolues via les getters anti-drift de `lib/codex/stats.ts` (Phase 16, D-02) — jamais de valeurs hardcodées.
- **D-05 (Sections conditionnelles par `kind`) :** Chaque variante de `CodexEntry` (`crop`, `animal`, `building`, `craft`, `tech`, `companion`, `loot`, `saga`, `quest`, `seasonal`) affiche ses propres champs stats. Switch exhaustif TS sur `entry.kind` (Phase 16 D-01) — le compilateur enforce la couverture des 10 variantes.

### Mécanisme dropOnly (silhouette « ??? »)

- **D-06 (Calcul lazy à l'ouverture, pas de nouveau champ persisté) :** À l'ouverture de `FarmCodexModal`, on construit un `Set<string>` des IDs découverts en scannant :
  - `profile.farmInventory` (items actuellement en possession)
  - Les sagas complétées par le profil actif (pour les `sagaExclusive` animals — Phase 16 D-15)
  - Les crops déjà présents dans `profile.farmCrops` ou historique de récolte accessible
  Aucune modification des write paths farm engine, aucun nouveau champ dans `farm-{profileId}.md`, aucun hook supplémentaire dans `useFarm`. Les entrées non découvertes (test via `entry.dropOnly && !discoveredIds.has(entry.sourceId)`) rendent leur card en silhouette « ??? » avec icône floutée/grisée.
- **D-07 (Trade-off accepté : consommation rétablit la silhouette) :** Si l'utilisateur consomme/vend une orchidée avant d'ouvrir le codex, elle peut redevenir silhouette. Accepté comme trade-off simple vs ajouter persistance. À revisiter si retour utilisateur négatif.

### Recherche

- **D-08 (Cross-catégories global avec override des tabs) :** Quand `query.length > 0`, la FlatList affiche une liste plate de TOUS les matchs across les 10 catégories. Les tabs sont visuellement désactivés ou masqués pendant la recherche active. Chaque résultat porte un badge catégorie (emoji + label) pour identification rapide. Clear query → retour à la tab active et au mode grille 2-col.
- **D-09 (Normalisation locale, pas de dépendance `lib/search.ts`) :** La fonction `normalize()` de `lib/search.ts:52` n'est PAS exportée. Plutôt que la réexporter (modification d'un fichier hors-scope), on duplique la logique (3 lignes : `NFD` + `toLowerCase` + `trim`) dans un petit helper `lib/codex/search.ts` local. Le pattern de normalisation reste identique à `lib/search.ts` — juste dupliqué par frontière de module. Zero dépendance npm ajoutée (respecte ARCH-05).
- **D-10 (Match sur `name` + `lore` i18n de la langue active) :** La recherche indexe `t(entry.nameKey)` et `t(entry.loreKey)` dans la langue courante. Pas d'indexation multi-langue simultanée. Reindex lazy à chaque changement de query (110 entrées × 2 strings = ~220 comparaisons → zéro latence perceptible sans debounce nécessaire, mais debounce 150ms gardé en option si needed).
- **D-11 (Empty state search) :** Quand `filteredResults.length === 0`, on affiche un placeholder centré : emoji 🔍 + texte i18n `codex.search.empty` (« Aucune entrée trouvée pour "{query}" »). Pas de suggestions, pas de rebond — minimal comme le reste des empty states de l'app.

### Intégration HUD ferme

- **D-12 (5e item du HUD horizontal, à droite après season) :** Le bouton « ? » est ajouté comme cinquième `View` dans `app/(tabs)/tree.tsx:2030` (`styles.hudContent`), après l'item saison. Même style (emoji + touch target 44×44 minimum), wrapping `TouchableOpacity` ou `Pressable` qui ouvre `FarmCodexModal`. Aucun nouveau style HUD — réutilisation des styles `hudItem`/`hudEmoji` existants. Respect CODEX-06 (pas de nouveau bouton flottant).
- **D-13 (Icône = emoji 📖 ou ❓ — Claude's Discretion) :** Choix final de l'emoji laissé à Claude pendant l'implémentation. Candidats : 📖 (livre/codex) ou ❓ (point d'interrogation). 📖 recommandé car plus explicite sur le rôle (wiki) vs ❓ (aide générique).

### Squelette modale FarmCodexModal

- **D-14 (Pattern Modal pageSheet + SafeAreaView) :** Identique aux autres sheets ferme (CraftSheet, TechTreeSheet, BuildingShopSheet, BadgesSheet) :
  ```tsx
  <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
    <SafeAreaView style={styles.safe}>
      {/* Header : close button + title */}
      {/* Search bar */}
      {/* Tabs horizontaux scrollables */}
      {/* FlatList 2-col (ou liste plate si recherche active) */}
      {/* Footer : bouton "Rejouer le tutoriel" */}
    </SafeAreaView>
  </Modal>
  ```
  Drag-to-dismiss est natif pour `pageSheet` sur iOS, zero code supplémentaire.

### Bouton « Rejouer le tutoriel »

- **D-15 (Footer modale, appel `resetScreen` + `onClose`) :** Bouton visible en bas de `FarmCodexModal` (pas caché dans un menu), handler :
  ```tsx
  async () => {
    await resetScreen('farm_tutorial');
    onClose();
  }
  ```
  `resetScreen` est déjà exposé par `useHelp()` (contexts/HelpContext.tsx:42, 218). Aucun nouveau provider, aucun état global supplémentaire. Phase 18 implémentera le tutoriel qui réagit à ce reset.

### i18n

- **D-16 (Namespace `codex` de Phase 16) :** Tous les textes UI de la modale (titre, recherche placeholder, tabs labels, empty state, bouton replay tutoriel) utilisent le namespace `codex` déjà créé en Phase 16. Nouvelles clés à ajouter à `locales/{fr,en}/codex.json` : `codex.modal.title`, `codex.search.placeholder`, `codex.search.empty`, `codex.tabs.{kind}`, `codex.detail.stats`, `codex.detail.lore`, `codex.tutorial.replay`, etc. Parité FR/EN obligatoire (test Phase 16 garantit déjà que le namespace existe dans les deux langues).

### Folded Todos

Aucun todo folded — `gsd-tools todo match-phase 17` retourne 0 matches.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Roadmap & exigences
- `.planning/ROADMAP.md` §Phase 17 (lignes 62-73) — Goal et critères de succès
- `.planning/REQUIREMENTS.md` §Codex UI (lignes 43-47) — CODEX-06 à CODEX-10

### Phase 16 (dépendance directe)
- `.planning/phases/16-codex-contenu/16-CONTEXT.md` — Décisions data layer (types, dropOnly, i18n namespace)
- `lib/codex/content.ts` — Export `CODEX_CONTENT: CodexEntry[]` (110 entrées, 10 kinds)
- `lib/codex/types.ts` — Types discriminés `CodexEntry` + variants `CropEntry|AnimalEntry|...`
- `lib/codex/stats.ts` — 9 getters anti-drift (`getCropStats`, `getBuildingStats`, etc.)
- `locales/fr/codex.json` + `locales/en/codex.json` — Lore narratif + stats labels FR+EN

### Patterns UI existants (sources d'inspiration directe)
- `components/mascot/CraftSheet.tsx` §header (lignes 1-7) — Pattern sheet avec tabs + grille 2-col + mini-modal détail (le plus proche de ce que Phase 17 doit construire)
- `components/mascot/TechTreeSheet.tsx` — Pattern Modal pageSheet + SafeAreaView + header close/title + ScrollView catégorisé
- `components/mascot/BadgesSheet.tsx` — Pattern card compact avec emoji + nom + état
- `components/mascot/BuildingShopSheet.tsx` — Autre exemple sheet catalog
- `app/(tabs)/tree.tsx:2018-2048` — Définition actuelle du HUD ferme (cible d'intégration du bouton « ? »)

### Contextes React à réutiliser
- `contexts/HelpContext.tsx:42` — Interface `resetScreen(screenId: string)`
- `contexts/HelpContext.tsx:218` — Implémentation `resetScreen`
- `contexts/VaultContext.tsx` — Accès au profil actif via `useVault()`
- `contexts/ThemeContext.tsx` — `useThemeColors()` obligatoire (CLAUDE.md convention)

### Utilitaire de recherche (référence, pas dépendance)
- `lib/search.ts:52` — Fonction `normalize()` interne non exportée (pattern à dupliquer en local — voir D-09)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **Modal pageSheet squelette** : 5+ sheets ferme suivent le même pattern (CraftSheet, TechTreeSheet, BuildingShopSheet, BadgesSheet, FamilyQuestDetailSheet) — squelette copiable
- **`useThemeColors()`** : couleurs dynamiques (primary, tint, colors, isDark) — obligation CLAUDE.md
- **`useTranslation()` (i18next)** : namespace `codex` déjà chargé par Phase 16 D-18
- **`useVault()`** : accès au profil actif + farmInventory + unlocked sagas pour calcul lazy discovery
- **`useHelp()`** : expose `resetScreen` pour le replay tutoriel
- **Constants design tokens** : `constants/spacing.ts` (`Spacing`, `Radius`), `constants/typography.ts` (`FontSize`, `FontWeight`), `constants/shadows.ts` (`Shadows`) — obligation CLAUDE.md (pas de valeurs hardcodées)
- **Haptics** : `Haptics.selectionAsync()` au tap sur une tab/carte pour feedback tactile (pattern CraftSheet)
- **`FadeInDown` de Reanimated** : animation d'entrée des cards (pattern BadgesSheet lignes 19, 62)

### Established Patterns
- **Tabs textuels simples** : CraftSheet utilise un `useState<CraftTab>` + TouchableOpacity en row — étendu à 10 tabs scrollables
- **Grille 2-col dans ScrollView** : CraftSheet, TreeShop — Phase 17 remplace ScrollView par FlatList avec `numColumns={2}` pour respecter CODEX-09
- **Mini-modal détail au tap** : CraftSheet ligne 6 — second `<Modal>` par-dessus la sheet principale
- **Header close/title** : pattern uniforme « bouton close à gauche + titre centré » dans toutes les sheets
- **Empty states** : pattern centré emoji + texte dans l'app (ex: dashboard sections)

### Integration Points
- **`app/(tabs)/tree.tsx`** : un seul point d'ajout — insertion d'un `<View style={styles.hudItem}>` dans le HUD (ligne 2030) + ajout d'un `useState<boolean>` pour `showCodex` + montage de `<FarmCodexModal>` près des autres `<Modal>` (~ligne 2050)
- **`lib/i18n.ts`** : aucune modification (namespace `codex` déjà enregistré en Phase 16)
- **`components/mascot/FarmCodexModal.tsx`** : nouveau fichier principal
- **`lib/codex/search.ts`** : nouveau petit helper avec `normalize()` + `searchCodex(query, lang, entries)` pour la recherche filtrée

### Creative Options
- **Debounce recherche** : 150ms possible via `useDeferredValue` React 18 natif ou `useState + useEffect + setTimeout` — Claude décide pendant planning selon perf mesurée
- **FadeIn animations** : `FadeInDown.delay(idx * 40)` sur les cards pour stagger entrée (pattern BadgesSheet)
- **Sticky header tabs** : pourrait rester visible pendant scroll liste via `stickyHeaderIndices` ou `ListHeaderComponent` de FlatList — Claude décide

</code_context>

<specifics>
## Specific Ideas

- **Ton « wiki Stardew Valley »** : le lore en haut du mini-modal doit évoquer un entry de wiki de jeu — paragraphe immersif, pas une fiche technique. Phase 16 D-17/18 a garanti du lore narratif « ~2-4 phrases par entrée » dans le namespace `codex`.
- **Pattern CraftSheet comme référence principale** : c'est le composant le plus proche de ce qu'on construit (catalog sheet + tabs + grille + mini-modal détail). Phase 17 = « CraftSheet mais en lecture seule et généralisé aux 10 catégories codex ».
- **Zéro nouvelle dépendance npm** : contrainte ARCH-05 (milestone v1.2). Pas de Fuse.js (explicit CODEX-08), pas de lib de modale tierce, pas de virtualized list alternative.

</specifics>

<deferred>
## Deferred Ideas

- **Persistance `discoveredCodex`** : si le trade-off de D-07 (consommation = re-silhouette) pose problème en TestFlight, ajouter un champ persisté dans `farm-{profileId}.md` lors d'une phase ultérieure ou d'un `/gsd:quick`. Pas en scope Phase 17.
- **Recherche multi-langue simultanée** : D-10 indexe uniquement la langue active. Indexer FR+EN en parallèle permettrait à un utilisateur bilingue de trouver un terme même en mauvaise langue — hors scope, feature mineure.
- **Filtres avancés** (par rareté, par stade d'arbre, par saisonnalité) : la recherche texte suffit pour CODEX-08. Filtres supplémentaires → backlog.
- **Partage/export d'une entrée codex** : « partager cette fiche avec la famille » — hors scope, feature mineure.
- **Animations pixel-art détail** : afficher les sprites animés (frames A/B) dans le mini-modal détail au lieu d'une image statique — possible via le pattern `CROP_SPRITES` de phase 05 mais hors scope Phase 17.

</deferred>

---

*Phase: 17-codex-ui*
*Context gathered: 2026-04-08*
