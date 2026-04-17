# Requirements: v1.6 Love Notes

**Milestone goal :** Permettre aux membres de la famille d'échanger des messages privés programmés ("love notes") qui apparaissent à une date future, avec une boîte aux lettres visualisée en carte enveloppe pinned en tête du dashboard — renforcer le lien affectif familial via des micro-moments de surprise asynchrones.

**Scope constraint (hérité CLAUDE.md) :**
- Aucune nouvelle dépendance npm (`expo-notifications`, `expo-haptics`, `react-native-reanimated` déjà installés)
- Backward compat Obsidian vault obligatoire (fichiers markdown lisibles/éditables manuellement)
- Stack inchangée : React Native + Expo SDK 54, reanimated ~4.1
- Pattern hook à répliquer : `useVaultNotes.ts` / `useVaultGratitude.ts`
- UI/commits/commentaires en français
- Couleurs via `useThemeColors()` — jamais de hardcoded

---

## v1 Requirements

### Catégorie DONNÉES — Fondation persistance & hook domaine

- [x] **LOVE-01**: User voit ses love notes persister dans le vault Obsidian au chemin `03 - Famille/LoveNotes/{to-profileId}/{YYYY-MM-DD-slug}.md` (un fichier = une note, classé par destinataire)
- [x] **LOVE-02**: User voit chaque love note conserver ses métadonnées critiques (`from`, `to`, `createdAt`, `revealAt`, `status`, `readAt?`) dans un frontmatter YAML lisible manuellement dans Obsidian desktop
- [x] **LOVE-03**: User voit les love notes hydratées en mémoire au démarrage de l'app via un hook `useVaultLoveNotes` exposé dans `VaultContext` (pattern identique aux 21 hooks domaine existants)
- [x] **LOVE-04**: User voit les love notes survivre à un restart à froid de l'app (cachables dans `lib/vault-cache.ts`, `CACHE_VERSION` bumpé pour éviter invalidation silencieuse)

### Catégorie BOÎTE AUX LETTRES — UI dashboard & écran dédié

- [x] **LOVE-05**: User voit une carte "enveloppe" distinctive (format paysage ≈ 2:1.15, papier ivoire, rabat triangulaire, cachet de cire rouge animé pulse, tilt -1.5°) pinned tout en haut du dashboard — rendue uniquement si au moins 1 love note destinée au profil actif est non lue ou prête à être révélée
- [x] **LOVE-06**: User voit un compteur (badge sur cachet) et un effet stack visuel (enveloppes empilées derrière) quand ≥2 notes sont en attente
- [x] **LOVE-07**: User peut accéder à sa boîte aux lettres complète (écran `/lovenotes`) depuis la carte enveloppe ET depuis une tuile permanente dans l'écran `more.tsx`
- [x] **LOVE-08**: User voit l'écran Boîte organisé en 3 segments : "Reçues" (non lues en priorité), "Envoyées" (programmées en attente de révélation côté destinataire), "Archivées" (reçues déjà lues + envoyées révélées)

### Catégorie COMPOSITION & RÉVÉLATION — Écriture et timing

- [ ] **LOVE-09**: User peut composer une nouvelle love note via un éditeur modal (`pageSheet` + drag-to-dismiss) comprenant : sélection destinataire (chip par profil famille, exclut l'auteur), zone texte markdown avec preview, picker date/heure de révélation
- [ ] **LOVE-10**: User peut choisir des presets rapides pour le moment de révélation ("Demain matin", "Dimanche soir", "Dans 1 mois", date custom)
- [ ] **LOVE-11**: User voit une notification locale silencieuse planifiée au `revealAt` via `expo-notifications` qui déclenche le basculement de statut `pending` → `revealed`
- [ ] **LOVE-12**: User voit les love notes `pending` dont `revealAt <= now` basculer automatiquement en `revealed` à chaque retour app foreground (`AppState` → `active`)
- [ ] **LOVE-13**: User voit une animation "unfold" Reanimated (rotation X du rabat ≥175°, cachet qui saute, contenu dévoilé) au tap sur une enveloppe `revealed`, accompagnée d'un haptic `notificationAsync('success')` — la note passe ensuite en `read`

### Catégorie GARDE-PARENT — Sécurité familiale

- [ ] **LOVE-14**: User parent peut activer/désactiver la fonctionnalité Love Notes par profil enfant depuis l'écran `ParentalControls` (défault ON)
- [ ] **LOVE-15**: User parent peut consulter un mode modérateur listant toutes les love notes envoyées PAR ses enfants (protection anti-bullying) — les notes REÇUES par les enfants restent privées pour préserver la surprise parent→enfant

### Catégorie QUALITÉ — Non-régression et tests

- [ ] **LOVE-16**: User ne voit aucune régression TypeScript (`npx tsc --noEmit` clean hors erreurs pré-existantes) ni aucune régression Jest (`npx jest --no-coverage` clean) après chaque phase
- [x] **LOVE-17**: User a un parser love notes testé par suite Jest (`lib/__tests__/parser-lovenotes.test.ts`) couvrant parse/serialize roundtrip, gestion frontmatter invalide, et listing par destinataire

---

## Future Requirements (deferred)

- **LOVE-F01**: Déclencheurs contextuels au lieu de dates (`trigger: 'level_up' | 'birthday' | 'rainy_day' | ...`)
- **LOVE-F02**: Capsule audio 10s attachée à la note (via `expo-av`)
- **LOVE-F03**: Chaîne de gratitude — répondre à une love note crée une nouvelle note en retour
- **LOVE-F04**: Notifications push distantes (nécessiterait un backend — hors scope core value "100% local + iCloud")
- **LOVE-F05**: Bibliothèque de templates ("félicitations contrôle", "bravo premier pas", etc.)

---

## Out of Scope

- **Backend serveur** — les love notes restent 100% locales + iCloud sync (core value)
- **Chiffrement fort** — les notes ne sont pas sensibles au point de justifier un chiffrement E2E ; la confidentialité vient du fait que le vault est privé famille
- **Messagerie instantanée** — Love Notes ≠ chat ; la proposition de valeur est justement l'asynchrone et la surprise, pas la communication temps réel
- **Notifications push distantes** — même principe que backend, exclu par core value

---

## Traceability

Mapping REQ-ID → Phase (100% coverage des 17 REQ-IDs v1).

| Requirement | Phase | Status |
|-------------|-------|--------|
| LOVE-01 | Phase 34 — Fondation données & hook domaine | Complete |
| LOVE-02 | Phase 34 — Fondation données & hook domaine | Complete |
| LOVE-03 | Phase 34 — Fondation données & hook domaine | Complete |
| LOVE-04 | Phase 34 — Fondation données & hook domaine | Complete |
| LOVE-05 | Phase 35 — Carte enveloppe dashboard + écran boîte aux lettres | Complete |
| LOVE-06 | Phase 35 — Carte enveloppe dashboard + écran boîte aux lettres | Complete |
| LOVE-07 | Phase 35 — Carte enveloppe dashboard + écran boîte aux lettres | Complete |
| LOVE-08 | Phase 35 — Carte enveloppe dashboard + écran boîte aux lettres | Complete |
| LOVE-09 | Phase 36 — Composition & programmation reveal | Pending |
| LOVE-10 | Phase 36 — Composition & programmation reveal | Pending |
| LOVE-11 | Phase 36 — Composition & programmation reveal | Pending |
| LOVE-12 | Phase 36 — Composition & programmation reveal | Pending |
| LOVE-13 | Phase 36 — Composition & programmation reveal | Pending |
| LOVE-14 | Phase 37 — Garde-parent & polish | Pending |
| LOVE-15 | Phase 37 — Garde-parent & polish | Pending |
| LOVE-16 | Phase 37 — Garde-parent & polish | Pending |
| LOVE-17 | Phase 34 — Fondation données & hook domaine | Complete |

**Coverage check :** 17/17 REQ-IDs mappés ✓ — zéro orphelin, zéro duplicate.

### Breakdown par phase

| Phase | REQ-IDs | Count |
|-------|---------|-------|
| 34 — Fondation données & hook domaine | LOVE-01, LOVE-02, LOVE-03, LOVE-04, LOVE-17 | 5 |
| 35 — Carte enveloppe + écran boîte | LOVE-05, LOVE-06, LOVE-07, LOVE-08 | 4 |
| 36 — Composition & reveal | LOVE-09, LOVE-10, LOVE-11, LOVE-12, LOVE-13 | 5 |
| 37 — Garde-parent & polish | LOVE-14, LOVE-15, LOVE-16 | 3 |
| **Total** | | **17** |
