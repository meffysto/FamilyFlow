# Testing Patterns

**Analysis Date:** 2026-03-28

## Test Framework

**Runner:**
- Jest 29.7.0
- Config: `jest.config.js`
- TypeScript via `ts-jest` 29.4.6
- Separate tsconfig for tests: `tsconfig.jest.json`

**Assertion Library:**
- Jest built-in (`expect`, `toBe`, `toEqual`, `toContain`, `toBeNull`, etc.)

**Run Commands:**
```bash
npm test                # Run all tests (jest)
npx jest               # Direct invocation
npx jest --watch       # Watch mode
npx jest --coverage    # Coverage report
npx tsc --noEmit       # Type check only (no test suite — used as primary CI check)
```

## Test File Organization

**Location:** Centralized `__tests__/` directory under `lib/`:
```
lib/
  __tests__/
    __mocks__/
      expo-secure-store.ts
      expo-localization.ts
      widget-bridge.ts
    parser.test.ts
    parser-extended.test.ts
    cooklang.test.ts
    gamification.test.ts
    insights.test.ts
    anonymizer.test.ts
    i18n.test.ts
    mascot-engine.test.ts
    seasons.test.ts
    weekly-recap.test.ts
    auto-courses.test.ts
    calendar-aggregator.test.ts
    adventures.test.ts
```

**Naming:** `{module-name}.test.ts` — always `.ts`, never `.tsx` (tests are pure logic, no JSX)

**Scope:** Tests cover `lib/` modules only. No tests for `components/`, `hooks/`, `contexts/`, or `app/` screens.

## Jest Configuration

**`jest.config.js`:**
```javascript
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/lib'],
  testMatch: ['**/__tests__/**/*.test.ts'],
  moduleFileExtensions: ['ts', 'tsx', 'js'],
  globals: { __DEV__: false },
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: 'tsconfig.jest.json' }],
  },
  moduleNameMapper: {
    '^expo-secure-store$': '<rootDir>/lib/__tests__/__mocks__/expo-secure-store.ts',
    '^expo-localization$': '<rootDir>/lib/__tests__/__mocks__/expo-localization.ts',
    '^\\.\\./widget-bridge$': '<rootDir>/lib/__tests__/__mocks__/widget-bridge.ts',
    '^\\.\\./\\.\\./widget-bridge$': '<rootDir>/lib/__tests__/__mocks__/widget-bridge.ts',
    '^\\./widget-bridge$': '<rootDir>/lib/__tests__/__mocks__/widget-bridge.ts',
  },
};
```

**Key points:**
- `testEnvironment: 'node'` — no DOM, no React Native runtime
- `__DEV__` set to `false` in globals
- Expo modules mocked via `moduleNameMapper` (not `jest.mock()`)
- Separate `tsconfig.jest.json` with `module: 'commonjs'` and `target: 'ESNext'`

## Test Structure

**Suite organization:**
```typescript
/**
 * Tests unitaires — parser.ts
 *
 * Couvre les fonctions critiques de parsing/serialisation du vault markdown.
 */

import { parseTask, parseTaskFile, parseFrontmatter } from '../parser';

// --- Section Name -------------------------------------------

describe('parseTask', () => {
  it('parse une tache non cochee avec texte simple', () => {
    const task = parseTask('- [ ] Faire les courses', 0, 'tasks.md');
    expect(task).not.toBeNull();
    expect(task!.text).toBe('Faire les courses');
    expect(task!.completed).toBe(false);
  });

  it('extrait les tags #tag', () => {
    const task = parseTask('- [ ] Courses @lucas #urgent #maison', 0, 'tasks.md');
    expect(task!.tags).toEqual(['urgent', 'maison']);
  });
});
```

**Patterns:**
- File-level JSDoc comment describing what the test covers
- `describe` blocks per function under test
- `it` descriptions in French, starting with a verb (`parse`, `retourne`, `extrait`, `gere`)
- Non-null assertion (`task!.text`) used after `toBeNull()` guard
- Section dividers with ASCII art between test groups

**Setup/teardown:**
```typescript
beforeEach(async () => {
  await i18n.changeLanguage('fr');
});
```
Used sparingly — only when tests need shared initialization (e.g., i18n language reset).

## Mocking

**Framework:** Jest manual mocks via `moduleNameMapper` + custom mock files.

**Mock files in `lib/__tests__/__mocks__/`:**

**`expo-secure-store.ts`** — in-memory key-value store:
```typescript
const store: Record<string, string> = {};
export async function getItemAsync(key: string): Promise<string | null> {
  return store[key] ?? null;
}
export async function setItemAsync(key: string, value: string): Promise<void> {
  store[key] = value;
}
export async function deleteItemAsync(key: string): Promise<void> {
  delete store[key];
}
```

**`expo-localization.ts`** — hardcoded French locale:
```typescript
export function getLocales() {
  return [{ languageCode: 'fr', languageTag: 'fr-FR' }];
}
export function getCalendars() {
  return [{ calendar: 'gregory', timeZone: 'Europe/Paris', uses24hourClock: true }];
}
```

**`widget-bridge.ts`** — no-op stubs:
```typescript
export function refreshWidget() {}
export function refreshJournalWidget() {}
export function refreshWidgetLanguage() {}
```

**What to mock:**
- Expo native modules (`expo-secure-store`, `expo-localization`)
- Widget bridge (`lib/widget-bridge.ts`)
- Any module requiring React Native runtime

**What NOT to mock:**
- `lib/parser.ts` functions — pure, test with real markdown strings
- `lib/gamification/engine.ts` — pure, test with real Profile/GamificationData objects
- `date-fns` — use fixed date inputs instead of mocking
- `gray-matter` — real frontmatter parsing

## Fixtures and Factories

**Test helper functions** are defined at the top of each test file (not shared across files):

**Profile factory (from `gamification.test.ts`):**
```typescript
function creerProfil(overrides: Partial<Profile> = {}): Profile {
  return {
    id: 'lucas',
    name: 'Lucas',
    role: 'enfant',
    avatar: '🦊',
    points: 0,
    coins: 0,
    level: 1,
    streak: 0,
    lootBoxesAvailable: 0,
    multiplier: 1,
    multiplierRemaining: 0,
    pityCounter: 0,
    mascotDecorations: [],
    mascotInhabitants: [],
    mascotPlacements: {},
    ...overrides,
  };
}
```

**GamificationData factory:**
```typescript
function creerGamiData(overrides: Partial<GamificationData> = {}): GamificationData {
  return {
    profiles: [creerProfil()],
    history: [],
    activeRewards: [],
    ...overrides,
  };
}
```

**Date helper:**
```typescript
function aujourdhui(): string {
  return format(new Date(), 'yyyy-MM-dd');
}
```

**Pattern:** Each test file defines its own factory functions. Factory names are in French. Use `Partial<T>` spread for overrides.

**Location:** Inline at top of each test file. No shared `__fixtures__/` directory.

## Coverage

**Requirements:** None enforced. No coverage thresholds configured.

**Current test files (13):**
| Test File | Module Tested | Size |
|-----------|--------------|------|
| `parser.test.ts` | `lib/parser.ts` | 18.9K |
| `parser-extended.test.ts` | `lib/parser.ts` (extended) | 35.0K |
| `cooklang.test.ts` | `lib/cooklang.ts` | 13.9K |
| `gamification.test.ts` | `lib/gamification/engine.ts` | 27.9K |
| `insights.test.ts` | `lib/insights.ts` | 9.7K |
| `anonymizer.test.ts` | `lib/anonymizer.ts` | 13.2K |
| `i18n.test.ts` | `lib/i18n.ts` + locale helpers | 13.4K |
| `mascot-engine.test.ts` | `lib/mascot/engine.ts` | 7.0K |
| `seasons.test.ts` | `lib/mascot/seasons.ts` or similar | 4.4K |
| `weekly-recap.test.ts` | `lib/weekly-recap.ts` | 25.8K |
| `auto-courses.test.ts` | `lib/auto-courses.ts` | 16.9K |
| `calendar-aggregator.test.ts` | `lib/calendar-aggregator.ts` | 16.1K |
| `adventures.test.ts` | `lib/mascot/adventures.ts` | 2.1K |

## Test Types

**Unit tests only.** All tests are pure function tests running in Node.js (`testEnvironment: 'node'`).

**Integration tests:** None. No tests exercise multiple modules together or test hook/context behavior.

**E2E tests:** None. No Detox, Maestro, or similar framework configured.

**Component tests:** None. No `@testing-library/react-native` or similar installed.

## Common Patterns

**Testing parse/serialize roundtrips:**
```typescript
it('parse une tache non cochee avec texte simple', () => {
  const task = parseTask('- [ ] Faire les courses', 0, 'tasks.md');
  expect(task).not.toBeNull();
  expect(task!.text).toBe('Faire les courses');
  expect(task!.completed).toBe(false);
});
```

**Testing with emoji-rich markdown input:**
```typescript
it('extrait la date due 📅', () => {
  const task = parseTask('- [ ] RDV medecin 📅 2026-03-20', 0, 'tasks.md');
  expect(task!.dueDate).toBe('2026-03-20');
  expect(task!.text).not.toContain('📅');
});
```

**Testing i18n locale switching:**
```typescript
beforeEach(async () => {
  await i18n.changeLanguage('fr');
});

it('retourne les labels francais par defaut', () => {
  expect(getRarityLabel('commun')).toBe('Commun');
});
```

**Testing engine state transitions:**
```typescript
it('retourne graine pour niveaux 1-3', () => {
  expect(getTreeStage(1)).toBe('graine');
  expect(getTreeStage(2)).toBe('graine');
  expect(getTreeStage(3)).toBe('graine');
});
```

## Adding New Tests

When adding a new test file:

1. Create `lib/__tests__/{module-name}.test.ts`
2. Add JSDoc header: `/** Tests unitaires — {module description} */`
3. Import functions under test from `../{module}`
4. Define factory helpers at top of file (French names OK)
5. Organize with `describe` per function, `it` per case (French descriptions)
6. If the module imports Expo native modules, add entries to `moduleNameMapper` in `jest.config.js` or create new mocks in `lib/__tests__/__mocks__/`

## Gaps

- No component tests (React Native rendering)
- No hook tests (`useVault`, `useGamification`)
- No E2E tests
- No coverage enforcement
- Test factories are duplicated across files (no shared fixtures)
- Some lib modules have no tests: `lib/budget.ts`, `lib/search.ts`, `lib/notifications.ts`, `lib/recurrence.ts`, `lib/sharing.ts`

---

*Testing analysis: 2026-03-28*
