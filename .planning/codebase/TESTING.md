# Testing Patterns

**Analysis Date:** 2026-03-07

## Test Framework

**Runner:** Not configured

No test framework is installed or configured in this project. The `package.json` contains no test runner (`jest`, `vitest`, `mocha`, etc.) in either `dependencies` or `devDependencies`. No `jest.config.*`, `vitest.config.*`, or equivalent config file exists at the project root.

**Run Commands:**
```bash
# No test commands configured in package.json scripts
# Scripts present: start, android, ios, web
```

## Test File Organization

**Location:** No test files exist outside `node_modules/`

A search across the entire project found zero `.test.ts`, `.test.tsx`, `.spec.ts`, or `.spec.tsx` files in the application source tree (`app/`, `components/`, `hooks/`, `lib/`, `contexts/`, `constants/`).

**Naming:** No established pattern — none present to observe.

## Current Test Coverage

**Unit Tests:** None
**Integration Tests:** None
**E2E Tests:** None

The codebase has no automated test coverage at any level.

## Testable Units (for future test authoring)

The following modules contain pure functions that are straightforward to unit test without React or Expo dependencies:

**`lib/parser.ts`**
- `parseTask(line, lineIndex, sourceFile, section?)` — returns `Task | null`
- `parseCourses(content)` — returns `CourseItem[]`
- `parseMeals(content)` — returns `MealItem[]`
- `parseStock(content)` — returns `StockItem[]`
- `formatDateForDisplay(date)` — string transformation
- `isRdvUpcoming(rdv)` — boolean predicate

**`lib/gamification.ts`**
- `addPoints(profile, basePoints, note)` — returns `{ profile, entry }`
- `awardTaskCompletion(profile, taskNote)` — returns `{ profile, entry, lootAwarded }`
- `calculateLevel(points)` — number → number
- `buildLeaderboard(profiles)` — sorts and ranks profiles
- `processActiveRewards(rewards)` — filters expired rewards

**`lib/recurrence.ts`**
- `nextOccurrence(recurrenceStr, fromDate)` — date calculation

**`lib/telegram.ts`**
- `buildWeeklyRecapText({ memories, photoCount, enfantNames })` — pure string builder

## Recommended Test Setup (when adding tests)

**Suggested framework:** Jest with `ts-jest` or Vitest (both support TypeScript natively)

**Suggested install:**
```bash
npx expo install jest-expo @types/jest
# or
npm install -D vitest
```

**Suggested config for Expo (jest.config.js):**
```javascript
module.exports = {
  preset: 'jest-expo',
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg)'
  ],
};
```

**Suggested file placement:** Co-located test files next to source:
```
lib/
  parser.ts
  parser.test.ts
  gamification.ts
  gamification.test.ts
hooks/
  useVault.ts
  useVault.test.ts
```

## Mocking Guidance (for future tests)

**What to mock:**
- `expo-secure-store` — replace `getItemAsync`/`setItemAsync` with in-memory store
- `expo-file-system` — mock `readAsStringAsync`/`writeAsStringAsync`
- `expo-image-picker` — mock `launchImageLibraryAsync`/`launchCameraAsync`
- `fetch` — mock for `sendTelegram` and Telegram API calls
- `expo-haptics` — mock `impactAsync` as no-op

**What NOT to mock:**
- `lib/parser.ts` functions — these are pure and should be tested with real input strings
- `lib/gamification.ts` functions — these are pure and should be tested with real `Profile` objects
- `date-fns` — real date library, use fixed date inputs in tests instead

**Mock pattern for SecureStore:**
```typescript
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));
```

## Fixtures and Factories (recommended patterns)

Since no fixtures exist, new tests should create factory helpers:

**Suggested Task factory:**
```typescript
function makeTask(overrides?: Partial<Task>): Task {
  return {
    id: 'test-file.md:0',
    text: 'Tâche test',
    completed: false,
    tags: [],
    mentions: [],
    sourceFile: 'test-file.md',
    lineIndex: 0,
    ...overrides,
  };
}
```

**Suggested Profile factory:**
```typescript
function makeProfile(overrides?: Partial<Profile>): Profile {
  return {
    id: 'test_user',
    name: 'Test',
    role: 'adulte',
    avatar: '👤',
    points: 0,
    level: 1,
    streak: 0,
    lootBoxesAvailable: 0,
    multiplier: 1,
    multiplierRemaining: 0,
    pityCounter: 0,
    ...overrides,
  };
}
```

## Coverage

**Requirements:** None enforced (no coverage configuration present)

**Target recommendation when adding tests:** Start with `lib/parser.ts` and `lib/gamification.ts` — these are the highest-value pure modules with no external dependencies.

---

*Testing analysis: 2026-03-07*
