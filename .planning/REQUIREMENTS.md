# Requirements: v1.8 Export PDF imprimable des histoires

**Milestone goal :** Permettre d'exporter chaque chapitre d'histoire généré en PDF imprimable aux specs imprimeur (carré 21×21 cm, saddle-stitch 16 pages, bleed 0.32 cm, polices embarquées), avec QR code audio en 4ème de couverture pointant vers un deep link `familyvault://story/:id` qui rejoue l'audio dans l'app — sans backend, tout reste local. L'utilisateur upload manuellement le PDF sur lulu.com pour commande (Option 1 du plan d'évolution).

**Scope v1.8 :** Export PDF côté client + QR audio + deep links + manifeste local + UX export. Pas d'intégration API Lulu (Option 2 deferred). Pas de coffret/abonnement (Étape 3 deferred).

**Scope constraint (hérité CLAUDE.md + brief milestone) :**
- ZERO backend — tout reste dans le vault local/iCloud
- Audio reste local, JAMAIS uploadé vers un serveur tiers
- Stack inchangée : React Native 0.81 + Expo SDK 54 + expo-router v6
- Cohérence avec existant : `lib/story-scenes.ts`, `lib/story-illustrations.ts`, `lib/types.ts:761-797`
- UI/commits/commentaires en français
- Couleurs via `useThemeColors()` — pas de hardcoded
- Polices : Patrick Hand (déjà bundled) + Andika (à ajouter, OFL Google Fonts)
- Palette PDF : cream `#F5EFE0`, ink `#2C3E50`, teal `#4F9396`
- PDF aux specs Lulu Direct dès le départ (réutilisable Option 2 sans refonte)
- Saddle-stitch impose un multiple de 4 pages — 16 pages fixes verrouillées

---

## v1 Requirements

### Catégorie FONDATION — Infra PDF + assets

- [ ] **PDF-01**: User voit la police Andika (Regular + Bold, OFL) téléchargée et bundled dans `assets/fonts/Andika/`, déclarée dans `app.json` plugins fonts si applicable, et chargée via `expo-font` au boot — fallback gracieux vers System si chargement échoue
- [ ] **PDF-02**: User voit un module `lib/pdf/` créé (barrel `index.ts` exportant types + constantes Lulu specs : trim 21×21cm, bleed 0.32cm, DPI 300, page count 16, palette, slots polices) — pattern aligné avec autres modules `lib/` du projet
- [ ] **PDF-03**: User voit `expo-print` ajouté aux dependencies (déjà compatible Expo SDK 54) et la lib QR `react-native-qrcode-svg` ajoutée — préférer une lib qui rend en SVG inline (compatible HTML→PDF via dataURL) plutôt qu'un composant natif
- [ ] **PDF-04**: User voit un manifeste `12 - Impressions/manifeste.md` créé avec parser bidirectionnel (frontmatter + corps Markdown), traçant les exports : `id story`, `hash PDF`, `date`, `format`, `chemin local PDF` — backward-compat (fichier absent = liste vide, pas d'erreur)
- [ ] **PDF-05**: User voit `CACHE_VERSION` bumpé dans `lib/vault-cache.ts` SI le manifeste impressions est ajouté à la liste des domaines cachés (à décider en phase planning — par défaut, on EXCLUT le manifeste du cache pour éviter le bump)

### Catégorie LAYOUT — Mise en page livre 16 pages

- [ ] **LAY-01**: User voit le PDF généré respecter la structure 16 pages : p1 couverture pleine illustration + titre + N° tome / p2 page de garde cream uni / p3 page de titre personnalisée (titre + "Une histoire pour [Prénom]" + date) / p4-15 six scènes en double page (illustration gauche / texte droite) / p16 4ème couverture (résumé court + date + QR audio + logo discret)
- [ ] **LAY-02**: User voit chaque scène en double page : illustration pleine page à gauche, texte respiré à droite avec mots-clés highlightés en teal (`#4F9396`) — réutilise les highlights existants des `StoryScene.highlights`
- [ ] **LAY-03**: User voit les titres en Patrick Hand (40pt couverture / 28pt intérieur) et le corps de texte en Andika (16-18pt) — typographie hybride pour cohérence visuelle app + lisibilité enfant apprenant à lire
- [ ] **LAY-04**: User voit le bleed 0.32cm respecté sur les 4 bords de chaque page (extension cream de l'arrière-plan), avec illustrations qui touchent les bords poussées jusqu'au bleed — pas de bord blanc à l'impression
- [ ] **LAY-05**: User voit un fallback gracieux pour les histoires sans `scenes` (V2 ou texte seul) ou pour les univers sans illustrations bundled (actuellement seul `foret` est couvert) : mise en page texte seul avec ornements typographiques (puces, lettrines), 6 doubles pages adaptées par découpage du texte
- [ ] **LAY-06**: User voit la cohérence collection assurée pour les sagas multi-chapitres : badge "Tome IV" en coin haut-droit de la couverture, même typographie et position, dos coordonné visuellement (bandeau teal en pied de couverture)

### Catégorie GENERATION — Pipeline PDF

- [ ] **PDF-06**: User voit `expo-print.printToFileAsync()` invoqué avec un HTML template aux specs Lulu (CSS @page avec size + bleed, polices embarquées en base64 ou via @font-face, palette appliquée) — PDF généré dans le cache app, ensuite copié dans le vault sous `12 - Impressions/PDFs/`
- [ ] **PDF-07**: User voit le hash SHA-256 du PDF généré calculé et stocké dans le manifeste — permet de détecter les ré-générations identiques et d'éviter les doublons d'export
- [ ] **PDF-08**: User voit le PDF généré inclure les illustrations en haute résolution (PNG bundled extraits via `Asset.fromModule().downloadAsync()` puis embarqués base64 dans le HTML) — 300 DPI minimum visuel
- [ ] **PDF-09**: User voit la génération PDF complétée en moins de 5 secondes pour une histoire moyenne (3-5 scènes, illustrations bundled), avec indicateur de progression visuel non-bloquant (modal preview affiche "Génération du PDF...") — sinon timeout avec message d'erreur explicite

### Catégorie QR — Code audio + deep links

- [ ] **QR-01**: User voit le scheme `familyvault://` configuré dans `app.json` (champ `scheme`) avec Universal Links iOS (`associatedDomains` placeholder pour le futur hosting) — préparation Option 2 sans casser Option 1
- [ ] **QR-02**: User voit une nouvelle route `app/story/[id].tsx` créée (expo-router) qui : récupère l'`id` de l'histoire depuis le vault, navigue vers la bibliothèque stories avec la story sélectionnée, et déclenche l'autoplay audio si disponible localement (via `StoryPlayer` existant avec prop `autoplay`)
- [ ] **QR-03**: User voit le handler deep link dans `app/_layout.tsx` (ou via `expo-linking`) qui parse les URLs `familyvault://story/:id` et route vers `app/story/[id].tsx` avec le bon paramètre — fallback graceful si l'id n'existe plus dans le vault (toast "Histoire introuvable", retour bibliothèque)
- [ ] **QR-04**: User voit un QR code 3×3cm généré en SVG (haute résolution) embarqué dans le PDF en 4ème de couverture, encodant l'URL `familyvault://story/{storyId}` — couleur ink (`#2C3E50`) sur cream, légende "Scanne pour écouter l'histoire" en Patrick Hand 14pt
- [ ] **QR-05**: User voit le scan du QR depuis l'iPhone familial avec l'app installée ouvrir directement l'histoire et lancer l'audio (testé manuellement sur device — doc dans phase plan)

### Catégorie UX — Bouton export + aperçu + manuel Lulu

- [ ] **UX-01**: User voit un bouton "Exporter le livre" disponible à 2 endroits : (a) long-press menu sur les cartes de saga dans la bibliothèque stories (ajouter l'action au menu contextuel existant) ; (b) écran fin de génération d'une histoire (étape `fin` dans `app/(tabs)/stories.tsx`) — entry point optionnel selon contexte
- [ ] **UX-02**: User voit une `BookExportModal` qui affiche : aperçu de la couverture (rendu HTML/preview), aperçu de 2-3 pages intérieures (page titre + 1 scène double page), récap du format (21×21cm, 16 pages, saddle-stitch), bouton "Générer le PDF", bouton "Annuler" — modal présentation `pageSheet` avec drag-to-dismiss (pattern projet)
- [ ] **UX-03**: User voit après génération réussie un écran de confirmation avec : 3 actions claires — "Sauvegarder dans Fichiers" (`expo-sharing`), "Voir le PDF" (preview système), "Commander chez Lulu" (ouvre `https://www.lulu.com/create/print-books` dans Safari avec instructions courtes en français : "Format carré 21×21, papier standard mat, reliure agrafée, 16 pages")
- [ ] **UX-04**: User voit le manifeste `12 - Impressions/manifeste.md` mis à jour automatiquement après chaque export réussi (entrée ajoutée avec id, hash, date, format, chemin) — réutilisable pour afficher l'historique des impressions par histoire
- [ ] **UX-05**: User voit toutes les chaînes UI traduites en français (FR strict, pas d'EN) — i18n cohérent avec le reste du projet (utilise le système i18n existant si applicable, sinon strings inline FR)
- [ ] **UX-06**: User voit un feedback haptique (`Haptics.impactAsync(Medium)`) à la fin d'une génération PDF réussie — cohérent avec les patterns existants (succès actions importantes)

### Catégorie QUALITÉ — Non-régression et tests

- [ ] **QA-01**: User ne voit aucune régression TypeScript (`npx tsc --noEmit` clean hors erreurs pré-existantes documentées dans CLAUDE.md) ni aucune régression Jest (`npx jest --no-coverage` clean) après chaque phase
- [ ] **QA-02**: User voit des tests Jest couvrant les fonctions pures critiques : parser/sérializer manifeste impressions (round-trip), calcul hash PDF, fallback layout texte-seul (découpage 6 doubles pages), génération URL deep link
- [ ] **QA-03**: User voit la documentation projet mise à jour : CLAUDE.md section Stack mentionne `expo-print` et `react-native-qrcode-svg`, section Architecture liste `lib/pdf/`, section Vault mentionne `12 - Impressions/`

---

## Future Requirements (deferred v1.9+ ou Option 2/Étape 3)

### Option 2 — Intégration API Lulu Direct

- **LULU-F01**: Cloudflare Worker minimal (proxy OAuth Lulu Direct + endpoints quote/order/webhook), credentials côté serveur, pas de DB
- **LULU-F02**: Stripe Checkout intégré (paiement direct par l'utilisateur, marge appliquée sur la commande Lulu)
- **LULU-F03**: Adresse de livraison + récap commande dans la `BookExportModal` étendue
- **LULU-F04**: Tracking statut commande via webhook Lulu (printing → shipped → delivered) avec push notifications

### Étape 3 — Coffret modulaire et abonnements

- **BOX-F01**: Coffret personnalisé (slipcase) commandé une fois avec le premier chapitre — fournisseur custom (Packlane ou artisan)
- **BOX-F02**: Abonnement chapitres récurrents (1 chapitre imprimé/mois automatiquement, livraison 3PL)
- **BOX-F03**: Édition collector annuelle (compilation hardcover de toutes les histoires de l'année)
- **BOX-F04**: Tier premium avec illustrateur réel qui repasse sur les scènes IA avant impression

### Audio CDN (futur)

- **AUDIO-F01**: Hosting audio sur Cloudflare R2 (gratuit en egress) — permet aux personnes sans l'app de scanner le QR et d'écouter l'audio (Mamie, Papi, etc.) ; le deep link `familyvault://` reste valide via Universal Links fallback HTTPS

---

## Out of Scope

- **Backend serveur / base de données** — l'app reste 100% locale + iCloud (cohérent avec PROJECT.md)
- **Intégration API Lulu Direct dans v1.8** — workflow manuel uniquement (Option 1) ; user upload son PDF sur lulu.com lui-même
- **Paiements in-app** — pas de Stripe ni d'IAP dans v1.8 (cohérent avec absence de backend)
- **Coffret/slipcase physique** — Étape 3 deferred ; pas de gestion de stock ni de fulfillment dans v1.8
- **Hosting audio public** — l'audio reste local dans le vault, le QR pointe vers un deep link app uniquement (Mamie sans l'app ne peut pas écouter — accepté comme privacy by design)
- **Coloration CMYK explicite** — Lulu accepte RGB avec conversion auto ; pas de pipeline CMYK pour ne pas alourdir
- **Génération illustrations IA pour les univers manquants** — fallback texte-seul accepté pour les 8 univers sans illustrations bundled (espace, océan, dinosaures, princesse, super-héros, pirates, robots, surprise) ; couverture illustration des autres univers = chantier séparé
- **Format alternatif (A5, hardcover, dos carré collé)** — UN seul format verrouillé en v1.8 (carré 21×21 saddle-stitch) ; multi-format = chantier séparé si demande émerge
- **Édition manuelle du contenu PDF** — le PDF est généré depuis l'histoire telle quelle ; pas d'éditeur WYSIWYG ni de retouches (cohérent avec la philosophie "le vault est la source")

---

## Traceability

Mapping REQ-ID → Phase (v1.8 Phases 48-51).

| Requirement | Phase | Status |
|-------------|-------|--------|
| PDF-01 | Phase 48 | Pending |
| PDF-02 | Phase 48 | Pending |
| PDF-03 | Phase 48 | Pending |
| PDF-04 | Phase 48 | Pending |
| PDF-05 | Phase 48 | Pending |
| LAY-01 | Phase 49 | Pending |
| LAY-02 | Phase 49 | Pending |
| LAY-03 | Phase 49 | Pending |
| LAY-04 | Phase 49 | Pending |
| LAY-05 | Phase 49 | Pending |
| LAY-06 | Phase 49 | Pending |
| PDF-06 | Phase 49 | Pending |
| PDF-07 | Phase 49 | Pending |
| PDF-08 | Phase 49 | Pending |
| PDF-09 | Phase 49 | Pending |
| QR-01 | Phase 50 | Pending |
| QR-02 | Phase 50 | Pending |
| QR-03 | Phase 50 | Pending |
| QR-04 | Phase 50 | Pending |
| QR-05 | Phase 50 | Pending |
| UX-01 | Phase 51 | Pending |
| UX-02 | Phase 51 | Pending |
| UX-03 | Phase 51 | Pending |
| UX-04 | Phase 51 | Pending |
| UX-05 | Phase 51 | Pending |
| UX-06 | Phase 51 | Pending |
| QA-01 | Phases 48-51 | Pending |
| QA-02 | Phases 48-51 | Pending |
| QA-03 | Phase 51 | Pending |

**Coverage check :** 29/29 REQ-IDs mappés ✓ (5 PDF-fondation + 6 LAY + 4 PDF-pipeline + 5 QR + 6 UX + 3 QA). Aucun orphelin, aucune duplication. QA-01 et QA-02 transversaux (vérifiés à chaque fin de phase).

### Phase repartition summary

- **Phase 48 — Fondation export PDF + assets (5 REQ + QA)** : PDF-01 (Andika), PDF-02 (lib/pdf/), PDF-03 (deps expo-print + qrcode), PDF-04 (manifeste impressions), PDF-05 (cache decision)
- **Phase 49 — Layout livre + génération PDF (10 REQ + QA)** : LAY-01 à LAY-06 (structure 16 pages), PDF-06 à PDF-09 (pipeline génération)
- **Phase 50 — QR audio + deep links (5 REQ + QA)** : QR-01 (scheme app.json), QR-02 (route story/[id]), QR-03 (handler deep link), QR-04 (génération QR PDF), QR-05 (test scan device)
- **Phase 51 — UX export + manuel Lulu + non-régression (6 REQ + QA)** : UX-01 à UX-06 (entry points + modal + post-export + i18n + haptic), QA-03 (docs)
