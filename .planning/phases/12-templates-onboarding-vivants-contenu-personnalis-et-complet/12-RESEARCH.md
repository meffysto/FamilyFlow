# Phase 12: Templates onboarding vivants — Research

**Researched:** 2026-04-03
**Domain:** Vault template system, onboarding personalization, markdown content generation
**Confidence:** HIGH — analysis based on complete source code review

## Summary

The current template system (`lib/vault-templates.ts`) contains 7 `TemplatePack` objects exported via `TEMPLATE_PACKS`. Each pack implements a `generate(ctx: TemplateContext)` method that receives family configuration and emits `TemplateFile[]` objects. The `TemplateContext` already carries `parents`, `children` (with `ageCategory`), and `today`.

The setup wizard (`app/setup.tsx`) has 9 steps: the user selects pain points at step 2, which auto-selects template packs, then confirms at step 8. On "C'est parti", `scaffoldVault()` creates the vault skeleton, then `installTemplates()` writes the selected packs. The i18n system drives all user-visible strings through `t()` calls referencing keys under `setup.templateContent.*` in `locales/fr/common.json` and `locales/en/common.json`.

Three packs are genuinely well-populated and contextual: **courses-essentielles** (age-conditional baby section), **menage-organise** (parent alternation, age-conditional child tasks), and **routines-enfants** (4 age tiers). Four packs are weak or incomplete: **repas-semaine** (no petit-déj on weekdays, no goûter, format is plain bullets), **budget-familial** (monthly file is empty sections), **anniversaires** (children only, no family), **vie-de-famille** (1 example per file — too skeletal). Two new packs are missing that would add significant day-1 value: **stock initial** (pantry/fridge) and **défis de lancement** (starter family challenges).

**Primary recommendation:** Enrich 4 existing packs in-place and add 2 new packs, with no changes to the `TemplateContext` interface or the setup wizard flow. All improvements are confined to `lib/vault-templates.ts` and the two locale files.

## Pack-by-Pack Analysis

### Pack 1: courses-essentielles — GOOD (minor improvement possible)

**Rating:** 4/5 — Solid content, age-conditional baby section works correctly.
**Current state:** 20 items across frais / fruits & légumes / épicerie / hygiène + conditional produits bébé section. Items have real quantities ("Lait demi-écrémé x2", "Pommes (1kg)").
**Improvement:** Add an `🎒 Goûters & snacks` section when `hasKids` (petit/enfant/ado) — currently missing. Also add a `hasPetit || hasEnfant || hasAdo` branch parallel to the `hasBebe` branch.

### Pack 2: repas-semaine — WEAK (enrichment needed)

**Rating:** 2/5 — Content exists but is not contextual to family composition.
**Current state:** 7-day plan with real meals (Pâtes bolognaise, Poulet rôti…). Only 2 meals/day on weekdays (déjeuner + dîner), 3 on weekends (petit-déj + déjeuner + dîner).
**Problems:**
- Weekdays have no petit-déj — odd since families with children need to plan it
- No goûter section for families with children (typically 16h snack)
- All families get identical meals regardless of composition
**Improvement:** Add `petitDej` row to weekdays. Add optional `gouter` row when `hasChildren`. Optionally vary Sunday dinner text for families with babies ("Purée maison" vs "Restes de la semaine").

### Pack 3: menage-organise — GOOD (no change needed)

**Rating:** 5/5 — Best pack in the system. Parent alternation via `assign()`, 4 age-conditional child sections, monthly + saissonnier tasks. Already "lived in."

### Pack 4: suivi-medical — ADEQUATE (minor improvement)

**Rating:** 3/5 — File structure is correct (YAML frontmatter, questions, notes). Problem: `heure: ""` and `médecin: ""` empty fields look like unfilled forms.
**Improvement:** Replace empty `heure` and `médecin` with placeholder hints: `heure: "À définir"` and `médecin: "À définir"`. Add a `lieu: "Cabinet médical habituel"` default. This makes the file look "in-progress" rather than a blank form.

### Pack 5: routines-enfants — GOOD (no change needed)

**Rating:** 4/5 — 4 age tiers (bebe skipped intentionally, petit/enfant/ado), morning+evening structure, proper recurrence markers. Content is real and usable.

### Pack 6: budget-familial — WEAK (enrichment needed)

**Rating:** 2/5 — config.md is good (categories with limits). Monthly file is just 7 empty sections — opening it shows nothing.
**Problem:** The `parseBudgetMonth()` parser expects entries in format `- YYYY-MM-DD | category | amount | label`. A completely empty monthly file gives zero value for first-time users.
**Improvement:** Add 3–5 realistic example entries per month — one per major category, clearly marked as examples. The `serializeBudgetEntry()` format is: `- ${date} | ${category} | ${amount.toFixed(2)} | ${label}`. Example entries should be dated at the start of the current month and labeled with a comment like "(exemple — à remplacer)".
**Note:** The budget category names in `budget-familial` pack use FR labels (Alimentation, Transport…) while `DEFAULT_BUDGET_CONFIG` in `budget.ts` uses different names (Courses, Bébé…). These must match: the monthly file's category strings must match what `parseBudgetConfig()` reads from config.md to be linked. The current pack produces categories like "🛒 Alimentation" but budget.ts defaults use "🛒 Courses". The template pack's config and month files must align — use the budget.ts defaults as the source of truth, or update both.

### Pack 7: anniversaires — WEAK (significant enrichment needed)

**Rating:** 2/5 — Only adds children with known birthdates; returns [] if none exist.
**Problems:**
- No extended family (grands-parents, cousins, amis) — user opens the screen and sees only their children
- Early exit if no birthdate: packs that produce 0 files should still produce a file with placeholder rows
**Improvement:**
- Always generate the file, even without children
- Add 4–6 placeholder family rows with `MM-DD` format dates but generic names the user can edit: "Grand-mère Maternelle", "Grand-père Paternel", "Oncle/Tante 1", "Ami(e) 1"
- Keep placeholder rows in a separate `## À compléter` comment section so they're visually distinct from real data
- The parser `parseAnniversaries()` only processes `| Nom |` table rows — placeholder rows must conform to the table format to be editable

### Pack 8: vie-de-famille — WEAK (enrichment needed)

**Rating:** 2/5 — 1 example entry per file is too skeletal to inspire the pattern.
**Problems:**
- Gratitude: 1 entry, generic text
- Moods: 1 entry in table
- Quotes: 1 entry
- Wishlist: 1 item per profile
**Improvement:** Add 3–5 entries per file, spanning different days across the past week. Use the family's names. For quotes, use child-specific funny examples. For wishlist, show items with `| budget | occasion` format. This makes the feature feel "in use" and teaches format by example.

## New Pack Ideas — Feasibility

### New Pack: stock-initial (RECOMMENDED — HIGH feasibility)

**Value:** The stock system already has `parseStock()`, `StockItem` type, and the scaffold already creates `01 - Enfants/Commun/Stock & fournitures.md` with baby/school items. But there is no household pantry/fridge stock template.
**File target:** `02 - Maison/Stock maison.md` (same pattern as `01 - Enfants/Commun/Stock & fournitures.md`).
**Format from `_stockContent()` in vault.ts:**
```
---
tags:
  - stock
  - maison
cssclasses:
  - stock
---
> ← [[00 - Dashboard/Dashboard|Dashboard]]

# Stock maison

## Placards — Épicerie

| Produit | Détail | Qté restante | Seuil | Qté/achat |
| ------- | ------ | ------------ | ----- | --------- |
| Pâtes   |        | 3            | 1     | 3         |

## Frigo

| Produit | Détail | Qté restante | Seuil | Qté/achat |
| ------- | ------ | ------------ | ----- | --------- |
| Lait    | 1L     | 2            | 1     | 3         |
```
**Personalization:** Add baby-specific pantry items when `hasBebe`. No new context needed.
**i18n approach:** Either use i18n keys (consistent with other packs) or use inline French/English content (faster). Recommend i18n for consistency with other packs.

### New Pack: défis-lancement (RECOMMENDED — HIGH feasibility)

**Value:** The défis screen (`app/(tabs)/defis.tsx`) reads `defis.md` via `parseDefis()`. The file format is well-defined. A starter pack with 2–3 active challenges gives the gamification system immediate traction.
**File target:** `defis.md` (root of vault — this is where scaffold places it, confirmed by parser).
**Format from `serializeDefis()` in parser.ts:**
```
---
tags:
  - defis
---
# Défis familiaux

## Soirée en famille
id: defi_lancement_1
type: daily
emoji: 👨‍👩‍👧
difficulty: facile
startDate: {today}
endDate: {today+7}
targetDays: 7
participants: {all profile ids comma-separated}
status: active
rewardPoints: 15
rewardLootBoxes: 0

### Progression
```
**Personalization:** Use all parent+child profile IDs in `participants`. Start date = today, end date = today+7.
**CRITICAL:** Profile IDs are generated as `name.toLowerCase().normalize('NFD').replace(...).replace(/\s+/g, '-')`. The same slug formula is used in `scaffoldVault()` and `installTemplates()` context construction.
**i18n:** Use inline strings (défis are primarily in gamification namespace, keeping template content in common.json is cleaner).

### New Pack: recettes-favorites (LOWER PRIORITY — complex)

**Vault path:** `03 - Cuisine/Recettes/{Category}/{Name}.cook` (Cooklang format).
**Problem:** The cooklang format is custom, and `lib/cooklang.ts` has known pre-existing TypeScript errors. Adding a recettes pack risks generating malformed `.cook` files. Defer to a separate phase.

### New Pack: journal-bebe-starters (LOWER PRIORITY — narrow audience)

**Only relevant for bebe ageCategory.** The scaffold already creates `03 - Journal/{child.name}/` directory and the jalons file. Adding journal entries requires knowing the exact journal entry format from `todayJournalPath()` in parser.ts. Feasible but narrow value. Defer.

## TemplateContext Extension Analysis

**Current interface:**
```typescript
export interface TemplateContext {
  parents: Array<{ name: string; avatar: string }>;
  children: Array<{ name: string; avatar: string; birthdate: string; ageCategory: string }>;
  today: string; // YYYY-MM-DD
}
```

**What's already available:** parent names, all children names with ageCategory (bebe/petit/enfant/ado), today's date.

**What's missing for recommended improvements:**
- Profile IDs (slug form of names) — needed for `défis-lancement` pack participants field. These can be computed inside the pack's `generate()` function using the same slug formula from `scaffoldVault()` — no context change needed.
- Family size signals (hasBebe, hasChildren, etc.) — already computable inside each pack's `generate()`.

**Verdict:** No TemplateContext interface change is required for all recommended improvements. All derived values can be computed locally within each pack's `generate()` function.

## i18n System — How It Works for Templates

All template string content goes through `t()` calls from `i18next`. The pattern is:
1. `const p = 'setup.templateContent.packName'`
2. `t(`${p}.keyName`)` — returns the string for current locale

The two locale files must stay in sync: every key added to `locales/fr/common.json` must have a corresponding key in `locales/en/common.json`.

**Key namespace:** All template content lives under `setup.templateContent.*` in `common.json`.

**What needs new i18n keys for each improvement:**
- `repas-semaine`: `petitDejLundi..Dimanche` (7 keys × FR+EN), `gouterLabel` (1 key × 2)
- `budget-familial`: `exempleCourses`, `exempleEssence`, `exemplePharmacie`, `exempleEcole`, `exempleDivers` (5 keys × 2 locales), plus a `exempleLabel` suffix hint
- `anniversaires`: placeholder row names (4–6 keys), section header `aCompleter`
- `vie-de-famille`: 3–4 additional example keys per sub-section (gratitude: 3 more, moods: 3, quotes: 3, wishlist: 3)
- `stock-initial` (new pack): ~20 pantry/fridge items
- `défis-lancement` (new pack): 2–3 défi titles + descriptions

**Total new i18n keys estimate:** ~60–80 keys (×2 locales = ~120–160 strings). This is the bulk of the work.

## File Format Reference

### Budget monthly file — exact format parseBudgetMonth() expects
```
---
tags:
  - budget
  - 2026-04
---
# Budget — Avril 2026

## Dépenses
- 2026-04-01 | 🛒 Courses | 85.50 | Supermarché (exemple)
- 2026-04-02 | 🚗 Transport | 60.00 | Carburant (exemple)
- 2026-04-03 | 🏥 Santé | 25.00 | Pharmacie (exemple)
```
**CRITICAL alignment:** Category strings in monthly entries must exactly match what `parseBudgetConfig()` reads from config.md. The current `budget-familial` pack uses "🛒 Alimentation" in config but `budget.ts` defaults use "🛒 Courses". Align on one set — recommend using the budget.ts defaults: Courses, Transport, Santé, Loisirs, Enfants, Maison, Divers.

### Anniversaires file — exact format parseAnniversaries() expects
```
# Anniversaires

| Nom | Date | Année | Catégorie | Contact ID | Notes |
|-----|------|-------|-----------|------------|-------|
| {childName} | {MM-DD} | {birthYear} | Famille |  |  |
| Grand-mère Maternelle | 03-15 |  | Famille |  | À mettre à jour |
```
Date must be `MM-DD` format — no year in the date column.

### Défis file — exact format parseDefis() expects
Key-value props are flat (not YAML frontmatter), each on its own line after the `## Title` header:
```
## Soirée en famille
id: defi_launch_1
type: daily
emoji: 👨‍👩‍👧
difficulty: facile
startDate: 2026-04-03
endDate: 2026-04-10
targetDays: 7
participants: parent1,parent2,enfant1
status: active
rewardPoints: 15
rewardLootBoxes: 0
description: Passer une soirée sans écran ensemble

### Progression
```

### Stock file — exact format parseStock() expects
Uses `EmplacementId` (`bebe`, `frigo`, `congelateur`, `placard-epicerie`, etc.) mapped from section headers. The section header must match known patterns in `parseStock()`. Safe approach: use generic `## Épicerie` and `## Frigo` section headers (no emplacement mapping needed for template content).

## Architecture Patterns

### How pack.generate() is called
```typescript
// In installTemplates():
const ctx: TemplateContext = {
  parents,
  children: children.map(c => ({
    ...c,
    ageCategory: this._getAgeCategory(c.birthdate),
  })),
  today: format(new Date(), 'yyyy-MM-dd'),
};
const files = pack.generate(ctx);
for (const file of files) {
  if (file.append) {
    // appends to existing file
  } else {
    // writes only if file doesn't exist or has no real content
  }
}
```

**Append behavior:** `append: true` means content is appended to existing file (`existing.trimEnd() + '\n\n' + file.content`). Useful for menage and routines which add to `Tâches récurrentes.md`. Budget, anniversaires, vie-de-famille, and new packs should NOT use append.

**Skip logic:** A non-append file is skipped if it exists AND has "real content" (lines starting with `- [` or `- ` with a colon and non-empty value). Empty budget sections DO pass this test — they have no `- ` content lines, so the template WILL be installed even if the scaffold created the file first.

### Anti-Pattern to Avoid
Do NOT embed hardcoded French-only strings in `generate()`. Even for content that feels static (example budget entries), run it through `t()` so the EN locale works. The setup wizard may be used by English-speaking families.

## Common Pitfalls

### Pitfall 1: Budget category name mismatch
**What goes wrong:** Template pack generates config.md with category "🛒 Alimentation" and monthly file with entries using "🛒 Alimentation", but the app's budget screen renders using `parseBudgetConfig()` which may differ.
**Root cause:** The `budget-familial` pack was written independently from `lib/budget.ts`'s `DEFAULT_BUDGET_CONFIG`.
**How to avoid:** Cross-reference the category names in the pack with `DEFAULT_BUDGET_CONFIG`. Use exact same emoji+name combinations. Example: `🛒 Courses` not `🛒 Alimentation`.
**Warning signs:** Budget screen shows 0 entries even though monthly file has data.

### Pitfall 2: Anniversaires date format
**What goes wrong:** Dates formatted as `YYYY-MM-DD` or `DD/MM/YYYY` instead of `MM-DD` are rejected by the parser (`/^\d{2}-\d{2}$/` regex).
**Root cause:** Inconsistency between how birthdates are stored in famille.md (YYYY or YYYY-MM-DD) and what anniversaires.md requires (MM-DD).
**How to avoid:** Always format anniversary dates as `MM-DD` in generated content. The year goes in the `Année` column, not the `Date` column.

### Pitfall 3: Défis participants field referencing wrong profile IDs
**What goes wrong:** Template generates `participants: Jean,Marie` but the actual profile IDs are `jean` and `marie` (lowercase, normalized). Défi screen shows 0 participants.
**Root cause:** Profile IDs are computed as `name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '-')`.
**How to avoid:** Apply the same slug formula inside the défis pack's generate() function: `const slug = (name: string) => name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '-')`.

### Pitfall 4: i18n keys out of sync between FR and EN
**What goes wrong:** App crashes or shows key path as text ("setup.templateContent.stockInitial.lait") in EN locale.
**How to avoid:** Always add keys to both locale files in the same PR. Use a consistent key structure. Add new keys at the END of the `templateContent` block in both files.

### Pitfall 5: Pack generates 0 files for valid families
**What goes wrong:** `anniversaires` pack returns `[]` if no child has a birthdate — user selects it, nothing happens, no feedback.
**How to avoid:** All packs should always generate at least 1 file. Even if the family has no children, anniversaires should generate a file with placeholder rows. The planner should add a minimum-file guarantee to packs.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Age detection | Custom age calculator | `getAgeCategory()` helper already in vault-templates.ts | Already handles YYYY-only and YYYY-MM-DD formats |
| Profile ID slugging | Ad-hoc toLowerCase | Same slug formula from `scaffoldVault()` | Must be identical to produce matching IDs |
| Date arithmetic | Manual date math | `date-fns` already imported (`addDays`, `format`, `futureDate()`) | Already available, handles timezone correctly |
| Budget entry format | Custom serializer | `serializeBudgetEntry()` from `lib/budget.ts` | Parser expects exact format |
| i18n | Hardcoded strings | `t()` from i18next (already imported in vault-templates.ts) | Required for EN locale support |

## Environment Availability

Step 2.6: SKIPPED — this phase is purely content/code changes with no external tool dependencies. No CLI tools, databases, or services are required beyond the existing project setup.

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| Hardcoded French strings in scaffold (`_mealsContent()`) | i18n via `t()` in template packs | Template packs must continue using t() — scaffold private methods are exempt |
| Single gamification.md | Per-profile `gami-{id}.md` (Phase 8.1) | No impact on templates |
| routines-enfants skips bebe (bebe handled by scaffold) | Intentional design | Don't add bebe routines to routines-enfants pack |

## Open Questions

1. **Défis pack vs. existing defis.md**
   - What we know: `installTemplates()` skips non-append files if they have "real content"
   - What's unclear: If user already has defis.md from scaffold, the skip logic checks for `- [` or `- key: value` lines — défis use `id: xxx` format which would pass the "hasRealContent" check and skip installation
   - Recommendation: The défis pack should use `append: true` mode OR check that defis.md doesn't already exist with content before writing

2. **Budget category alignment**
   - What we know: `budget-familial` pack uses "Alimentation/Transport/Santé/Loisirs/Enfants/Maison/Divers", `DEFAULT_BUDGET_CONFIG` uses "Courses/Transport/Santé/Loisirs/Enfants/Maison/Divers" (same except Alimentation→Courses and no Abonnements)
   - What's unclear: Which set the budget screen actually uses for display
   - Recommendation: Read `lib/budget.ts` `DEFAULT_BUDGET_CONFIG` as ground truth, update the pack to match exactly

3. **Scaffold vs. template pack duplication**
   - What we know: `scaffoldVault()` creates `02 - Maison/Repas de la semaine.md` via `_mealsContent()` (empty format), and `repas-semaine` pack also writes to that file. `installTemplates()` will skip it if `_mealsContent()` created content. The `_mealsContent()` file contains lines like `- Déjeuner:` which have a colon but empty value after — the `hasRealContent` check requires `l.split(':')[1]?.trim().length > 0`, so `"- Déjeuner:"` would return empty string = skip. This means the repas pack WOULD be installed over the scaffold file.
   - Verification: Confirmed — empty scaffold meals file has `- Déjeuner:` (empty after colon), so `hasRealContent = false`, template pack WILL overwrite.
   - No action needed.

## Sources

### Primary (HIGH confidence)
- Direct source code analysis: `lib/vault-templates.ts` (714 lines, all 7 packs read)
- Direct source code analysis: `lib/vault.ts` (`installTemplates`, `scaffoldVault`, all private content generators)
- Direct source code analysis: `lib/budget.ts` (parser, serializer, DEFAULT_BUDGET_CONFIG)
- Direct source code analysis: `lib/parser.ts` (`parseAnniversaries`, `parseDefis`, `parseMoods`, `parseGratitude`, `parseQuotes`, format validation)
- Direct source code analysis: `app/setup.tsx` (9-step wizard, pain point mapping, handleCreate flow)
- Direct source code analysis: `locales/fr/common.json` (all templateContent keys, 193–386)
- Direct source code analysis: `locales/en/common.json` (mirrors FR structure)
- Direct source code analysis: `constants/defiTemplates.ts` (DEFI_TEMPLATES, DefiType, format)

## Metadata

**Confidence breakdown:**
- Current system analysis: HIGH — read complete source
- Pack improvement recommendations: HIGH — based on verified file formats and parser expectations
- New pack feasibility: HIGH — défis and stock formats fully verified; recettes/journal-bebe deferred with justified reason
- i18n key count estimate: MEDIUM — approximate, actual count depends on final content decisions

**Research date:** 2026-04-03
**Valid until:** 2026-05-03 (stable codebase, no external dependencies)

<phase_requirements>
## Phase Requirements

No formal REQ-IDs assigned to this phase (Phase 12 was added to the roadmap outside the v1.1 requirements matrix). Requirements are derived from the phase description.

| Implied Requirement | Description | Research Support |
|--------------------|-------------|------------------|
| TMPL-01 | repas-semaine enrichi avec petit-déj semaine et goûter enfants | Pack 2 analysis — t() keys needed, no format change |
| TMPL-02 | budget-familial monthly file has example entries | Budget format section — must align category names with DEFAULT_BUDGET_CONFIG |
| TMPL-03 | anniversaires includes placeholder extended family rows | Parser format verified — MM-DD required, always generate file |
| TMPL-04 | vie-de-famille has 3–5 examples per file | Parser formats verified for moods/gratitude/quotes/wishlist |
| TMPL-05 | suivi-medical RDV have non-empty heure/médecin/lieu defaults | Minor — replace empty strings with "À définir" hints |
| TMPL-06 | New pack: stock-initial (pantry + fridge) | Stock format from _stockContent() verified |
| TMPL-07 | New pack: défis-lancement (2–3 starter family challenges) | Défis format from serializeDefis() verified, profile ID slug pitfall documented |
| TMPL-08 | All improvements bilingual (FR + EN i18n keys) | i18n system verified — t() already imported in vault-templates.ts |
</phase_requirements>
