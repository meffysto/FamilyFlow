# Phase 23: Musée des effets (SEED-002 lite) - Context

**Gathered:** 2026-04-10
**Status:** Ready for planning

<domain>
## Phase Boundary

Persister chaque effet sémantique déclenché dans une chronologie accessible via un écran Musée minimal, réutilisant les patterns Codex UI de la Phase 17. Version lite de SEED-002 — uniquement les effets sémantiques (10 catégories), pas le hub cross-feature complet.

**Ce que Phase 23 NE fait PAS :**
- Hub cross-feature (photos, anniversaires, gratitude) — SEED-002 full, future milestone
- Messages compagnon étendus (Phase 24)
- Fichier vault séparé `milestones-{id}.md` — on utilise `gami-{id}.md` existant
- Rétroactivité des effets passés — le musée enregistre à partir de son activation

</domain>

<decisions>
## Implementation Decisions

### Format persistance (D-01)
- **D-01a**: Nouvelle section `## Musée` en bas de `gami-{id}.md` (après les sections existantes). Format append-only : chaque entrée est une ligne formatée (pas YAML frontmatter, pas JSON — markdown lisible cohérent avec le reste du fichier).
- **D-01b**: Format d'une entrée : `- YYYY-MM-DDTHH:mm:ss | {categoryId} | {icon} {labelFr}` — une ligne par effet déclenché. Exemples :
  ```
  - 2026-04-10T08:30:00 | bebe_soins | 🌟 Soins bébé : récolte dorée ×3
  - 2026-04-10T09:15:00 | menage_quotidien | 🌿 Ménage : mauvaises herbes retirées
  ```
- **D-01c**: Parser : `parseMuseumEntries(content: string): MuseumEntry[]` qui lit la section `## Musée`. Serializer : `appendMuseumEntry(content: string, entry: MuseumEntry): string` qui ajoute une ligne en bas.
- **D-01d**: Type `MuseumEntry = { date: Date; categoryId: CategoryId; icon: string; label: string }`.
- **D-01e**: Pas de limite de taille — append-only, jamais tronqué (contrairement à l'historique gamification plafonné à 100). Le musée est la mémoire long-terme.

### Structure écran (D-02)
- **D-02a**: Modal `pageSheet` accessible depuis l'écran arbre (tree.tsx), nouveau bouton dans l'actionBar (emoji 🏛️, label "Musée").
- **D-02b**: Réutiliser le pattern `FarmCodexModal` de Phase 17 : SafeAreaView + header avec ModalHeader + contenu scrollable.
- **D-02c**: `SectionList` natif React Native groupé par semaine (lundi→dimanche). Chaque section header : "Semaine du DD/MM/AAAA". Fallback : "Cette semaine" pour la semaine courante.
- **D-02d**: Chaque row : icône catégorie + label effet FR/EN (via i18n) + date/heure relative ("il y a 2h", "Hier 14:30", "Lun 08:15").
- **D-02e**: Badge variant coloré (ambient/rare/golden) inline comme dans SettingsCoupling.
- **D-02f**: Empty state : message "Aucun effet enregistré — complète des tâches pour remplir le musée !" avec icône 🏛️.
- **D-02g**: Animations : `FadeInDown` de react-native-reanimated sur chaque row (pattern Codex).

### Point d'enregistrement (D-03)
- **D-03a**: Dans `hooks/useGamification.ts`, dans le bloc `completeTask()`, APRÈS le toast/haptic/SecureStore (Phase 21, lignes ~270-285) et APRÈS l'override check (Phase 22), quand `effectResult?.effectApplied` est truthy.
- **D-03b**: Appel : `await appendMuseumEntry(vault, profileId, { categoryId, icon, label })`. Fire-and-forget avec try/catch silencieux (non-critical, comme les stats Phase 22).
- **D-03c**: Le module `lib/museum/engine.ts` encapsule la logique : lecture/écriture `gami-{id}.md`, parsing de la section Musée, append.

### Groupement temporel (D-04)
- **D-04a**: Groupement primaire par semaine (lundi→dimanche) pour la SectionList.
- **D-04b**: Header de section : "Semaine du DD/MM/AAAA" (format date FR, DD/MM/AAAA per CLAUDE.md).
- **D-04c**: Pas de groupement par mois dans cette version lite — les sections semaine suffisent. Le groupement mois est pour SEED-002 full.

### Claude's Discretion
- Taille des rows (compact vs spacieux) — suivre la densité du Codex
- Icône exacte du bouton Musée dans tree.tsx
- Ordre des entrées dans une semaine (chronologique descendant = plus récent en haut)
- Nombre de clés i18n nécessaires (labels écran, empty state, headers)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Codex UI patterns (Phase 17 — MUSEUM-05)
- `components/mascot/FarmCodexModal.tsx` — Pattern modal pageSheet, FlatList virtualisée, FadeInDown, tabs, recherche
- `components/mascot/CodexEntryDetailModal.tsx` — Pattern modal détail

### Semantic coupling data
- `lib/semantic/categories.ts` — CATEGORIES array avec labelFr/labelEn
- `lib/semantic/effect-toasts.ts` — EFFECT_TOASTS (icon, fr, en, subtitle), CATEGORY_VARIANT

### Gamification files
- `lib/parser.ts` — parseGamification, serializeGamification (patterns pour étendre gami-{id}.md)
- `lib/vault.ts` — gamiFile() helper, VaultManager pour lecture/écriture
- `hooks/useGamification.ts` — completeTask() lignes ~260-290 (point d'injection Phase 23)

### SEED-002 spec
- `.planning/seeds/SEED-002-musee-premieres-fois.md` — Vision complète du musée, format fichier, catégories milestones

### Settings coupling (Phase 22)
- `lib/semantic/coupling-overrides.ts` — Pattern cache module-level + SecureStore (réutilisable)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `FarmCodexModal` : pattern complet modal + FlatList + animations — base pour l'écran Musée
- `ModalHeader` : header standard des modals pageSheet
- `EFFECT_TOASTS` : icon + label pour chaque catégorie — directement utilisable pour les rows musée
- `CATEGORY_VARIANT` + `VARIANT_CONFIG` : couleurs des badges variant
- `SectionList` natif RN : déjà utilisé dans d'autres écrans
- `useTranslation()` + locales : i18n en place

### Established Patterns
- `gami-{id}.md` : fichier per-profil avec sections markdown — extensible avec `## Musée`
- `parseGamification` / `serializeGamification` : pattern parser/serializer pour gami files
- `gamiFile(profileId)` : helper pour le chemin du fichier
- Animations Codex : `FadeInDown` de reanimated, delay indexé (`delay: index * 50`)

### Integration Points
- `hooks/useGamification.ts` : point d'injection après effet appliqué
- `app/(tabs)/tree.tsx` : actionBar pour le bouton Musée (même section que Codex, Badges, etc.)
- `lib/parser.ts` : peut nécessiter extension pour parser la section Musée
- `locales/*/common.json` : clés i18n musée

</code_context>

<specifics>
## Specific Ideas

- Réutiliser le pattern exact de FarmCodexModal pour la cohérence visuelle (MUSEUM-05)
- Le SEED-002 suggère une "carte d'inauguration" narrative — hors scope lite, mais un empty state soigné remplit ce rôle
- Les entrées musée utilisent directement les données de EFFECT_TOASTS (pas de duplication)

</specifics>

<deferred>
## Deferred Ideas

- Hub cross-feature musée (photos, anniversaires, gratitude) — SEED-002 full
- Groupement par mois avec collapse — future milestone
- Filtrage par catégorie dans le musée — future milestone
- Carte d'inauguration narrative — future milestone
- Rétroactivité des effets passés — impossible techniquement, documenté dans SEED-002

</deferred>

---

*Phase: 23-mus-e-des-effets-seed-002-lite*
*Context gathered: 2026-04-10*
