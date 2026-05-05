# Phase 51 : UX export + manuel Lulu + non-régression — Contexte

**Status:** Ready for planning
**Source:** ROADMAP entry + 4 décisions express

<domain>
## Phase Boundary

Brancher l'export PDF (pipeline Phase 49 + QR Phase 50) dans l'UX. Création d'un écran dédié "Mes impressions" qui liste les exports passés et permet d'en générer de nouveaux, modal d'aperçu PDF, écran post-export avec 3 actions, mise à jour automatique du manifeste, i18n FR strict, et docs CLAUDE.md mises à jour.

Scope :
- Nouvel écran `app/impressions.tsx` ou similaire (route navigable depuis le menu Plus / Bibliothèque stories)
- `BookExportModal` (sélection histoire + génération + aperçu PDF)
- Écran post-export (Sauvegarder + Voir + Lulu)
- Manuel Lulu FR (instructions étape par étape)
- Mise à jour manifeste auto à chaque export (déjà fait par `persistBookPdf` mais à valider)
- i18n FR strict + haptic Medium sur succès
- Docs CLAUDE.md (Stack + Architecture + Vault)
</domain>

<decisions>
## Implementation Decisions

### Entry point — DÉVIATION ROADMAP
- **Décision :** écran dédié "Mes impressions" (nouvelle section app)
- **vs ROADMAP :** ROADMAP demandait bouton dans long-press menu cartes saga + écran fin génération histoire
- **Raison :** plus structuré, plus découvrable, plus simple à implémenter, permet l'historique des exports dans un seul endroit
- **Conséquence :** success criterion #1 du ROADMAP à reformuler : "Écran 'Mes impressions' accessible depuis le menu Plus, liste les exports passés + bouton générer"
- **Hors scope :** long-press menu sur cartes saga, bouton sur écran fin génération (peuvent venir plus tard si UX feedback le demande)

### Aperçu PDF dans BookExportModal
- **Choix :** PDF généré + visualiseur natif
- Génération complète à l'ouverture du modal (~3-5s budget perf)
- Affichage via `react-native-pdf` ou WebView avec data URI base64 du PDF
- Aperçu réel = ce que l'utilisateur recevra exactement

### Bouton "Commander chez Lulu"
- **Choix :** Lien web Lulu Studio + instructions FR
- `Linking.openURL('https://www.lulu.com/create/print-books/')`
- Modal/écran d'instructions FR : taille 21×21cm, 64 pages, upload PDF + couverture, options reliure
- Pas d'intégration Lulu Direct API (hors scope, nécessite compte business)

### Comportement post-export
- **Choix :** Écran post-export dédié avec 3 actions
- Modal pageSheet ou full-screen modal après génération réussie
- Action 1 : "Sauvegarder" → `expo-sharing.shareAsync(uri)` → iOS Share Sheet (Files, AirDrop, Mail, etc.)
- Action 2 : "Voir le PDF" → `Linking.openURL(uri)` ou viewer in-app
- Action 3 : "Commander chez Lulu" → ouvre la modal d'instructions FR puis Linking
- Drag-to-dismiss
- Haptic Medium au succès génération

### Manifeste
- `persistBookPdf` (Phase 49-03) écrit déjà dans `12 - Impressions/manifeste.md`
- Phase 51 : afficher le manifeste dans l'écran "Mes impressions" (lecture, pas écriture supplémentaire)
- Tap sur entrée manifeste → ouvre PDF correspondant

### i18n
- Toutes les chaînes en français strict (UI, alerts, instructions Lulu)
- `i18next` (déjà en place) avec namespace `impressions`
- Haptic Medium sur succès, Light sur tap boutons

### Docs CLAUDE.md (à mettre à jour en 51-04)
- Stack : ajouter `expo-print`, `expo-sharing`, `qrcode` (lib npm), `expo-clipboard`
- Architecture : ajouter `lib/pdf/` (pipeline export), `app/impressions.tsx` (nouvel écran)
- Vault : ajouter `12 - Impressions/PDFs/` + `12 - Impressions/manifeste.md`

### Claude's Discretion
- Choix exact lib aperçu PDF : `react-native-pdf` (Pods natifs) vs WebView data URI vs `expo-print.printAsync` mode preview — le planner tranche selon recherche
- Layout exact écran "Mes impressions" (liste cards / table / timeline)
- Position bouton "Générer" (FAB / header / inline)
</decisions>

<canonical_refs>
## Canonical References

### Phase 49 — pipeline PDF
- `.planning/phases/49-layout-livre-generation-pdf/49-PHASE-SUMMARY.md`
- `lib/pdf/pdf-generator.ts` — `generateBookPdf({ story, allStories })`
- `lib/pdf/book-storage.ts` — `persistBookPdf(vault, uri, entry)` (manifeste auto)
- `lib/pdf/manifest-parser.ts` — `parseManifeste`, `serializeManifeste`

### Phase 50 — QR + deep links
- `.planning/phases/50-qr-audio-deep-links/50-PHASE-SUMMARY.md`
- `app/dev-deep-link.tsx` — bouton PDF dev existant (à supprimer ou cacher en prod)

### Code existant à étendre
- `app/(tabs)/more.tsx` — ajouter row "Mes impressions" (DÉLÉGUÉ — l'utilisateur a des modifs en cours sur ce fichier, à coordonner)
- `i18n/fr.json` ou équivalent — namespace `impressions`
- `contexts/VaultContext.tsx` — exposer `vault.vault` (VaultManager) déjà OK

### Conventions projet
- `CLAUDE.md` racine — stack, conventions, animations
- Modals : `pageSheet` + drag-to-dismiss (cf RDV existant)
- Couleurs : `useThemeColors()` — jamais hardcoded
- Animations : react-native-reanimated obligatoire
- Icons : lucide-react-native
</canonical_refs>

<specifics>
## Specific Ideas

### Plans pré-définis (ROADMAP, à reformuler avec déviation entry-point)
- 51-01 : `BookExportModal` (sélection histoire + aperçu PDF + récap format + boutons générer/annuler) + drag-to-dismiss
- 51-02 : Écran "Mes impressions" (`app/impressions.tsx`) — liste manifeste + bouton générer (remplace "wiring boutons export long-press menu saga + écran fin génération")
- 51-03 : Écran post-export (3 actions) + i18n FR strict + haptic + manuel Lulu FR
- 51-04 : Validation manifeste + docs CLAUDE.md + suppression/gating écran dev `app/dev-deep-link.tsx` + non-régression finale

### Pitfalls à anticiper
- Aperçu PDF : `react-native-pdf` nécessite des Pods natifs → un `expo prebuild` requis
- Alternative WebView data URI : peut être lourd pour PDFs >5MB
- Lien Lulu : surface mobile pour upload PDF — instructions claires nécessaires
- Manifeste : déjà bien testé en Phase 49, juste lecture en Phase 51
- Le dev-client utilisateur n'a PAS encore expo-print/expo-clipboard côté natif (rebuild en cours) — Phase 51 dépend de ce rebuild
</specifics>

<deferred>
## Deferred Ideas

- Long-press menu cartes saga + bouton fin génération histoire (entry points contextuels) — peut venir post-Phase 51 si UX feedback positif sur écran dédié
- Intégration Lulu Direct API (création commande automatique)
- Aperçu PDF via snapshots images pré-générés (perf alternative)
- Partage direct social (Instagram, etc.)
- Email auto avec PDF en pièce jointe
- Multi-langues UI (en, es, etc.) — actuellement FR strict
- Statistiques exports dans le manifeste (combien de fois exporté chaque histoire)
</deferred>

---

*Phase : 51-ux-export-manuel-lulu*
*Context gathered: 2026-05-05 via ROADMAP + 4 décisions express*
