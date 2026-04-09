# Requirements: FamilyFlow — Milestone v1.3 Seed

**Defined:** 2026-04-09
**Core Value:** L'app doit rester fiable et stable pour un usage quotidien familial — les données ne doivent jamais être perdues ou corrompues, et les features existantes ne doivent pas régresser.

**Milestone goal:** Transformer la ferme en reflet différencié du quotidien familial en couplant sémantiquement chaque catégorie de tâche réelle à un effet ferme spécifique (wow moment tangible).

## v1.3 Requirements

Requirements pour le milestone v1.3. Chaque requirement mappe à une phase exacte du roadmap.

### SEMANTIC — Semantic coupling engine (Phase 19, 20)

- [ ] **SEMANTIC-01**: User sees a category correctly detected from task filepath (maison/enfants/rendez-vous/etc.)
- [ ] **SEMANTIC-02**: User sees a category detected from H2/H3 section (Quotidien/Ménage/Mensuel/etc.)
- [ ] **SEMANTIC-03**: User sees a category detected from task tags (#urgent, #budget, etc.)
- [ ] **SEMANTIC-04**: User's task with no matching category falls back to standard XP (zero regression)
- [ ] **SEMANTIC-05**: User can toggle the semantic coupling feature via feature flag
- [ ] **SEMANTIC-06**: User's 10 categories are each mapped to exactly one wow effect
- [x] **SEMANTIC-07**: User can't trigger an effect more than its daily/weekly cap
- [ ] **SEMANTIC-08**: User completing an "urgent" tagged task gets ×2 multiplier for 5 tasks
- [ ] **SEMANTIC-09**: User with >7 day task streak gets a Double Loot Cascade bonus

### EFFECTS — 10 wow effects wiring (Phase 20)

- [ ] **EFFECTS-01**: User doing housework (ménage quotidien) gets a weeds event removed from farm
- [ ] **EFFECTS-02**: User doing weekly/seasonal cleaning gets a free wear event repair
- [ ] **EFFECTS-03**: User completing shopping (courses) gets 24h building production turbo (0.5x interval)
- [ ] **EFFECTS-04**: User completing child routines gets a companion mood spike with AI message
- [ ] **EFFECTS-05**: User completing homework/school tasks gets 24h Growth Sprint (tasksPerStage -1)
- [ ] **EFFECTS-06**: User completing a medical appointment gets a guaranteed rare seed drop
- [ ] **EFFECTS-07**: User writing gratitude/birthday/family entries gets a saga trait boost
- [ ] **EFFECTS-08**: User completing budget/admin tasks gets 24h Building Capacity Boost (×2)
- [ ] **EFFECTS-09**: User completing baby care tasks gets next harvest = golden rain ×3
- [ ] **EFFECTS-10**: User cooking/meal planning tasks gets a free rare craft recipe unlock (weekly)

### FEEDBACK — Visual + companion + i18n (Phase 21)

- [ ] **FEEDBACK-01**: User sees a specific toast when an effect is triggered ("🌿 Ménage: 1 weeds retiré !")
- [ ] **FEEDBACK-02**: User feels a distinct haptic pattern per effect category
- [ ] **FEEDBACK-03**: User sees a visual burst (HarvestBurst variant) adapted to the effect
- [ ] **FEEDBACK-04**: User reads a contextual companion message referencing the real task category
- [ ] **FEEDBACK-05**: User sees i18n FR+EN parity for all feedback strings

### COUPLING-UI — Settings UI (Phase 22)

- [ ] **COUPLING-01**: User can access a "Couplage sémantique" screen in Settings
- [ ] **COUPLING-02**: User sees all 10 categories with their mapped effect
- [ ] **COUPLING-03**: User can toggle each category on/off individually
- [ ] **COUPLING-04**: User sees a preview of what each effect does
- [ ] **COUPLING-05**: User sees weekly stats (how many effects triggered this week)
- [ ] **COUPLING-06**: User's toggle state persists across app restarts

### MUSEUM — SEED-002 lite (Phase 23)

- [ ] **MUSEUM-01**: User sees every triggered effect recorded in a chronological museum
- [ ] **MUSEUM-02**: User can open a "Musée" screen showing dated milestones
- [ ] **MUSEUM-03**: User sees effect events persist across sessions (stored in gami-{id}.md)
- [ ] **MUSEUM-04**: User sees museum entries grouped by week/month
- [ ] **MUSEUM-05**: User sees museum UI consistent with Codex (Phase 17) design patterns

### COMPANION-EXT — SEED-003 lite (Phase 24)

- [ ] **COMPANION-01**: User sees a weekly_recap companion message on Sunday evenings with coupling stats
- [ ] **COMPANION-02**: User sees a morning_greeting message on first daily open (6h-11h)
- [ ] **COMPANION-03**: User sees a celebration message on streak multiples of 7
- [ ] **COMPANION-04**: User sees a gentle_nudge message if no task completed by afternoon
- [ ] **COMPANION-05**: User sees a comeback message after >24h absence
- [ ] **COMPANION-06**: User's companion messages are persisted across app restarts (not RAM-only)

### ARCH — Architecture constraints (cross-phase)

- [ ] **ARCH-01**: User's task files are never written to (Obsidian-respect, pure read)
- [ ] **ARCH-02**: User's feature flag allows instant disable of all semantic coupling
- [ ] **ARCH-03**: User experiences zero regression when category is unknown (standard XP fallback)
- [ ] **ARCH-04**: User's milestone adds no new npm dependencies (use existing libs)

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Full SEED-002 museum with cross-feature hub (codex + sagas + moods unified) | Only lite version integrated in v1.3 — chronologie simple des effets seulement. Full version reste dormant pour future milestone. |
| Full SEED-003 Companion with 27 event types and journal complet | Only 5 event types activés en v1.3 (weekly_recap, morning_greeting, celebration, gentle_nudge, comeback). Full version reste dormant. |
| Write-back into Obsidian task files | Obsidian-respect absolu — pure lecture, aucune mutation des fichiers tâches sources |
| Dynamic user-defined categories | Seulement 10 catégories hardcodées dans mapping table — extensibilité utilisateur hors scope |
| Negative effects / malus | Chaque effet est strictement positif — jamais de punition |
| Category field added to task frontmatter | Pas de mutation du format tâche — la taxonomie vient du filepath + sections + tags |
| Custom effect authoring by family | Les 10 effets sont fixes en v1.3 — écriture d'effets custom hors scope |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| SEMANTIC-01 | Phase 19 | Pending |
| SEMANTIC-02 | Phase 19 | Pending |
| SEMANTIC-03 | Phase 19 | Pending |
| SEMANTIC-04 | Phase 19 | Pending |
| SEMANTIC-05 | Phase 19 | Pending |
| SEMANTIC-06 | Phase 20 | Pending |
| SEMANTIC-07 | Phase 20 | Complete |
| SEMANTIC-08 | Phase 20 | Pending |
| SEMANTIC-09 | Phase 20 | Pending |
| EFFECTS-01 | Phase 20 | Pending |
| EFFECTS-02 | Phase 20 | Pending |
| EFFECTS-03 | Phase 20 | Pending |
| EFFECTS-04 | Phase 20 | Pending |
| EFFECTS-05 | Phase 20 | Pending |
| EFFECTS-06 | Phase 20 | Pending |
| EFFECTS-07 | Phase 20 | Pending |
| EFFECTS-08 | Phase 20 | Pending |
| EFFECTS-09 | Phase 20 | Pending |
| EFFECTS-10 | Phase 20 | Pending |
| FEEDBACK-01 | Phase 21 | Pending |
| FEEDBACK-02 | Phase 21 | Pending |
| FEEDBACK-03 | Phase 21 | Pending |
| FEEDBACK-04 | Phase 21 | Pending |
| FEEDBACK-05 | Phase 21 | Pending |
| COUPLING-01 | Phase 22 | Pending |
| COUPLING-02 | Phase 22 | Pending |
| COUPLING-03 | Phase 22 | Pending |
| COUPLING-04 | Phase 22 | Pending |
| COUPLING-05 | Phase 22 | Pending |
| COUPLING-06 | Phase 22 | Pending |
| MUSEUM-01 | Phase 23 | Pending |
| MUSEUM-02 | Phase 23 | Pending |
| MUSEUM-03 | Phase 23 | Pending |
| MUSEUM-04 | Phase 23 | Pending |
| MUSEUM-05 | Phase 23 | Pending |
| COMPANION-01 | Phase 24 | Pending |
| COMPANION-02 | Phase 24 | Pending |
| COMPANION-03 | Phase 24 | Pending |
| COMPANION-04 | Phase 24 | Pending |
| COMPANION-05 | Phase 24 | Pending |
| COMPANION-06 | Phase 24 | Pending |
| ARCH-01 | Phase 19 (cross-phase) | Pending |
| ARCH-02 | Phase 19 (cross-phase) | Pending |
| ARCH-03 | Phase 19 (cross-phase) | Pending |
| ARCH-04 | Phase 19 (cross-phase) | Pending |

**Coverage:**
- v1.3 requirements: 45 total (9 SEMANTIC + 10 EFFECTS + 5 FEEDBACK + 6 COUPLING-UI + 5 MUSEUM + 6 COMPANION-EXT + 4 ARCH)
- Mapped to phases: 45 ✓
- Unmapped: 0 ✓

---
*Requirements defined: 2026-04-09*
*Last updated: 2026-04-09 after milestone v1.3 Seed initialization*
