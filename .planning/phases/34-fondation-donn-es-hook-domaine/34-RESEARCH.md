# Phase 34: Fondation données & hook domaine (v1.6 Love Notes) — Research

**Researched:** 2026-04-16
**Domain:** Markdown vault data layer — parser par-fichier (1 note = 1 fichier), hook domaine avec CRUD, cache vault
**Confidence:** HIGH (tous les patterns sont déjà éprouvés dans le codebase — aucune invention nécessaire)

## Summary

Phase 34 est la réplique directe du couple Phases 25 + 26 (Jardin Familial) appliqué à un nouveau domaine : **LoveNote**. Zéro nouvelle invention, zéro nouvelle dépendance npm. Le travail se décompose en 3 couches :

1. **Parser bidirectionnel** (lib/parser.ts ou nouveau module) — pattern exact de `parseNote`/`serializeNote` (file-per-entity avec frontmatter YAML + body markdown), avec helpers path `loveNotePath()` + `loveNoteFileName()`.
2. **Hook domaine** `useVaultLoveNotes.ts` — pattern exact de `useVaultNotes.ts` (scan récursif de dossier, CRUD via VaultManager), câblé dans `hooks/useVault.ts` (loadVaultData + VaultState + useMemo deps).
3. **Cache** — ajout du champ `loveNotes` dans `VaultCacheState`, bump `CACHE_VERSION` de 1 → 2, hydrate + save dans `useVault.ts`.

**Différence notable avec Phases 25/26 (Jardin) :** Le jardin utilise un **fichier partagé unique** (`jardin-familial.md`) avec contributions append-only. Love Notes utilise un **fichier par note** classé par destinataire (`03 - Famille/LoveNotes/{to-profileId}/{slug}.md`). Le pattern source à copier est donc **Notes** (fichier par note, CRUD, `listFilesRecursive`) plutôt que Village (fichier partagé, append-only). Les deux patterns coexistent déjà dans le codebase.

**Primary recommendation:** Suivre structurellement `useVaultNotes.ts` + `parseNote`/`serializeNote` de `lib/parser.ts`. Le domaine est 100% `useVault()`-compatible. Aucun `useGarden`-équivalent n'est nécessaire en Phase 34 — le hook domaine retourne directement CRUD + liste filtrable. La logique métier (notifications, reveal cycle) est reportée à Phase 36.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

**Pas de CONTEXT.md pour Phase 34** — aucune phase `/gsd:discuss-phase` n'a été exécutée pour cette phase. Les contraintes proviennent directement du roadmap v1.6 et de la section "Decisions" de STATE.md (Init v1.6).

### Locked Decisions (héritées de Init v1.6 — STATE.md)

- **Phase 34 isolée de toute UI** — livre type + parser + hook + cache + tests en invisible avant toute vue (minimise risque de régression)
- **Chemin vault** : `03 - Famille/LoveNotes/{to-profileId}/{YYYY-MM-DD-slug}.md` — classement par destinataire pour simplifier le scan et respecter le pattern Obsidian par dossier
- **Frontmatter YAML obligatoire** : `from`, `to`, `createdAt`, `revealAt`, `status` (enum: `pending|revealed|read`), `readAt?` — lisible manuellement dans Obsidian desktop
- **Zéro nouvelle dépendance npm** — `expo-notifications`, `expo-haptics`, `react-native-reanimated` déjà installés (reconduit v1.6 depuis v1.2)
- **Bump CACHE_VERSION** dans `lib/vault-cache.ts` — évite invalidation silencieuse au premier boot post-migration
- **Hook exposé** : `useVault().loveNotes` (pattern identique aux 21 hooks domaine existants)
- **Tests Jest** : `lib/__tests__/parser-lovenotes.test.ts` — parse/serialize roundtrip, gestion frontmatter invalide, listing par destinataire
- **Qualité** : `npx tsc --noEmit` + `npx jest --no-coverage` clean (LOVE-16)
- **Backward compat Obsidian vault** obligatoire — fichiers markdown lisibles/éditables manuellement (Constraint CLAUDE.md)
- **Langue UI/commits/commentaires FR** (CLAUDE.md)
- **Pas de noms personnels réels** dans docs/commits → génériques Lucas, Emma, Dupont (CLAUDE.md)

### Claude's Discretion

- Emplacement exact du parser : module dédié `lib/lovenotes/` (pattern Phase 25 `lib/village/`) vs bloc dans `lib/parser.ts` (pattern Notes existant ~ligne 2688)
- Emplacement exact du hook : `hooks/useVaultLoveNotes.ts` (pattern `useVaultNotes.ts`) vs extraction comme `useGarden.ts`
- Algo de génération du slug (titre extrait du body vs timestamp pur vs nanoid-like)
- Format exact du timestamp `createdAt`/`revealAt` (ISO 8601 local sans Z vs avec Z vs epoch)
- Gestion des fuseaux horaires pour `revealAt` (stocker en local vs UTC vs heure de l'appareil au moment de l'écriture)
- Forme exacte de l'API retournée par le hook (CRUD minimal vs avec helpers `filterByRecipient`, `getPending`, etc.)
- Inclusion ou non d'un `LOVENOTES_DIR` constant exporté (recommandé pour cohérence avec `NOTES_DIR`, `SKILLS_DIR`)
- Choix d'inclure ou non un titre dans le frontmatter (simplification : pas de titre explicite, le body markdown commence directement)

### Deferred Ideas (OUT OF SCOPE — v1.6 Future)

- Déclencheurs contextuels (`trigger: 'level_up' | 'birthday'`) — LOVE-F01
- Capsule audio 10s attachée — LOVE-F02
- Chaîne de gratitude (reply) — LOVE-F03
- Notifications push distantes (backend) — LOVE-F04
- Bibliothèque de templates — LOVE-F05
- Chiffrement E2E — hors scope (core value : vault privé famille suffit)
- Toute UI (carte enveloppe, écran boîte, composition, reveal, notifications, toggle parental) — Phases 35, 36, 37
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| **LOVE-01** | User voit ses love notes persister dans le vault Obsidian au chemin `03 - Famille/LoveNotes/{to-profileId}/{YYYY-MM-DD-slug}.md` (un fichier = une note, classé par destinataire) | Pattern `parseNote`/`serializeNote` + `noteFileName()` de `lib/parser.ts:2688-2751` ; `VaultManager.writeFile()` gère création récursive du dossier ; helper `loveNotePath(to, slug)` à créer |
| **LOVE-02** | User voit chaque love note conserver ses métadonnées (`from`, `to`, `createdAt`, `revealAt`, `status`, `readAt?`) dans un frontmatter YAML lisible | `parseFrontmatter()` de `lib/parser.ts:191-206` (gray-matter avec fallback manuel) ; `serializeNote` comme modèle de serialization YAML manuelle propre (lignes 2723-2751) |
| **LOVE-03** | User voit les love notes hydratées en mémoire au démarrage via `useVault().loveNotes` exposé par `VaultContext` | Pattern `useVaultNotes.ts` répliqué en `useVaultLoveNotes.ts` ; câblage dans `hooks/useVault.ts` (VaultState + useState + loadVaultData[N+1] + return useMemo + deps) ; VaultContext auto-propage (aucune modif) |
| **LOVE-04** | User voit les love notes survivre à un restart à froid sans re-parse (cache) | `VaultCacheState` (`lib/vault-cache.ts:70-96`) étendue avec `loveNotes: LoveNote[]` ; `CACHE_VERSION` bumpé 1 → 2 ligne 44 ; hydrate + save dans `useVault.ts` boot sequence |
| **LOVE-17** | User a un parser love notes testé par suite Jest couvrant parse/serialize roundtrip, gestion frontmatter invalide, listing par destinataire | `lib/__tests__/parser-lovenotes.test.ts` mirroring `lib/__tests__/village-parser.test.ts` (22.9K — 21+ tests) et `lib/__tests__/parser.test.ts` |
</phase_requirements>

---

## Standard Stack

### Core (zéro nouvelle dépendance — reconduit ARCH-05)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| gray-matter | déjà installé | YAML frontmatter parse | Utilisé pour tous fichiers avec frontmatter (Notes, RDV, Gratitude, Anniversaires, etc.) |
| React hooks (useState, useCallback) | SDK 54 | State local + handlers stables | Pattern obligatoire codebase |
| VaultManager (`lib/vault.ts`) | existing | readFile / writeFile / deleteFile / listFilesRecursive / ensureDir / exists | File I/O sûr avec iCloud coordination + enqueueWrite |
| Jest | déjà installé | Tests unitaires parser | Framework établi Phase 19, pattern `lib/__tests__/*.test.ts` |

### Version verification

Tous packages **déjà présents** dans `node_modules` (gray-matter, jest, react). Aucun `npm install` requis. **Contrainte reconduite** : zéro dépendance npm en v1.6.

---

## Architecture Patterns

### Option A (Recommandée) : Bloc dans `lib/parser.ts`, hook dans `hooks/useVaultLoveNotes.ts`

**Raisonnement :** Le domaine Love Notes est une **réplique quasi-exacte du domaine Notes** (file-per-entity, frontmatter + body markdown, CRUD simple). Le pattern Notes est déjà implémenté dans `lib/parser.ts` (lignes 2688-2751) sans créer de sous-module. Répliquer ce pattern minimise la divergence.

**Structure :**

```
lib/parser.ts
├── (existants ~ligne 2688) NOTES_DIR, noteCategoryLabel, noteFileName, parseNote, serializeNote
└── (nouveau ~après ligne 2751)
    ├── LOVENOTES_DIR = '03 - Famille/LoveNotes'
    ├── loveNoteFileName(slug: string): string
    ├── loveNotePath(toProfileId: string, createdAt: string, slug: string): string
    ├── parseLoveNote(relativePath: string, content: string): LoveNote | null
    └── serializeLoveNote(note: Omit<LoveNote, 'sourceFile'>): string

lib/types.ts
└── (nouveau) LoveNote, LoveNoteStatus

hooks/useVaultLoveNotes.ts (nouveau fichier)
└── useVaultLoveNotes(vaultRef)
    ├── state: LoveNote[]
    ├── loadLoveNotes(vault)
    ├── addLoveNote(note)
    ├── updateLoveNoteStatus(sourceFile, status, readAt?)
    ├── deleteLoveNote(sourceFile)
    ├── resetLoveNotes()
    └── filterByRecipient(toProfileId) — helper utilitaire (optionnel)

hooks/useVault.ts (modifié)
├── import { useVaultLoveNotes } from './useVaultLoveNotes' — ligne ~90 avec les autres
├── const loveNotesHook = useVaultLoveNotes(vaultRef) — section sous-hooks
├── VaultState interface: ajouter loveNotes, addLoveNote, updateLoveNoteStatus, deleteLoveNote
├── loadVaultData Promise.allSettled: ajouter [23] loveNotesHook.loadLoveNotes(vault)
├── dans traitement résultats: loveNotesHook.setLoveNotes(val(results[23], []))
├── hydrate cache: loveNotesHook.setLoveNotes(cached.loveNotes)
├── return useMemo: loveNotes: loveNotesHook.loveNotes, addLoveNote: loveNotesHook.addLoveNote, etc.
└── deps array: ...loveNotesHook.loveNotes

lib/vault-cache.ts (modifié)
├── CACHE_VERSION = 2 (bump 1 → 2)
├── CACHE_FILE_URI = ... + 'vault-cache-v2.json' (bump aussi pour cohérence)
├── import type { LoveNote } from './types'
└── VaultCacheState: + loveNotes: LoveNote[]

lib/__tests__/parser-lovenotes.test.ts (nouveau)
```

### Option B (Alternative rejetée) : Module isolé `lib/lovenotes/`

**Rejeté car :** Le domaine Love Notes n'a pas besoin de grille, templates, engine dédié, ou logique append-only. Le pattern Notes (bloc dans `lib/parser.ts`) est plus léger et adapté. Module isolé `lib/village/` était justifié par **append-only log + grid + templates + BUILDINGS_CATALOG** — le load sur parser.ts aurait été disproportionné. Pour Love Notes, un bloc de 30 lignes dans parser.ts est équivalent au pattern Notes existant et cohérent.

**Nota bene :** Si le planner juge que le domaine Love Notes grossira rapidement (reveal engine Phase 36, moderation engine Phase 37), un module `lib/lovenotes/` dédié reste valide. Les deux patterns coexistent déjà (Notes = bloc parser, Village = module isolé). Décision déléguée au plan-checker.

### Pattern 1: Type canonique `LoveNote` (pattern Note existant)

**Source :** `lib/types.ts` — pattern `Note` (ligne à localiser, chercher `export interface Note`) et `Anniversary`.

```typescript
// lib/types.ts — ajouter avec les autres types de domaine

/** Statut de révélation d'une love note (cycle pending → revealed → read) */
export type LoveNoteStatus = 'pending' | 'revealed' | 'read';

/** Une note affective programmée entre membres de la famille */
export interface LoveNote {
  /** ID du profil émetteur (expéditeur) */
  from: string;
  /** ID du profil destinataire (récipiendaire) */
  to: string;
  /** Timestamp ISO 8601 de création — YYYY-MM-DDTHH:mm:ss (sans Z, convention museum/village) */
  createdAt: string;
  /** Timestamp ISO 8601 de révélation programmée — YYYY-MM-DDTHH:mm:ss */
  revealAt: string;
  /** Statut actuel : pending (en attente), revealed (révélée, pas lue), read (lue) */
  status: LoveNoteStatus;
  /** Timestamp ISO 8601 de lecture (optionnel — présent uniquement si status === 'read') */
  readAt?: string;
  /** Corps markdown de la note (message de l'expéditeur) */
  body: string;
  /** Chemin relatif dans le vault — non sérialisé, utilisé pour update/delete */
  sourceFile: string;
}
```

**Pourquoi sans `title` :** Les love notes sont courtes et intimes — un titre explicite serait artificiel. Le body markdown parle de lui-même. Le slug du fichier est généré depuis createdAt + un suffixe court. Décision Claude's discretion — documenter en commentaire.

### Pattern 2: Parser bidirectionnel (pattern `parseNote`/`serializeNote`)

**Source :** `lib/parser.ts:2707-2751`.

```typescript
// lib/parser.ts — ajouter après la section Notes existante

/** Répertoire racine des love notes dans le vault */
export const LOVENOTES_DIR = '03 - Famille/LoveNotes';

/**
 * Génère un nom de fichier slug à partir d'un timestamp createdAt et d'un petit suffix.
 * Format : YYYY-MM-DD-{suffix}.md
 * Suffix : 4 caractères alphanum dérivés de la milliseconde (stable, non-collidable en pratique).
 */
export function loveNoteFileName(createdAt: string): string {
  const datePart = createdAt.slice(0, 10); // YYYY-MM-DD
  // Suffix déterministe depuis les secondes + ms (ex: T14:32:17 → base36 de 14*3600+32*60+17 sur ~4 char)
  const timePart = createdAt.slice(11, 19); // HH:mm:ss
  const hash = timePart.replace(/:/g, '');  // ex: 143217
  const suffix = Number(hash).toString(36);  // base36 compact
  return `${datePart}-${suffix}.md`;
}

/**
 * Construit le chemin relatif complet d'une love note pour un destinataire donné.
 * Pattern : 03 - Famille/LoveNotes/{to}/{YYYY-MM-DD-suffix}.md
 */
export function loveNotePath(toProfileId: string, createdAt: string): string {
  return `${LOVENOTES_DIR}/${toProfileId}/${loveNoteFileName(createdAt)}`;
}

/** Parse une love note markdown avec frontmatter YAML. Retourne null si frontmatter invalide. */
export function parseLoveNote(relativePath: string, content: string): LoveNote | null {
  const { data, content: body } = parseFrontmatter(content);

  // Validation stricte — tous les champs requis doivent être présents et valides
  if (!data.from || !data.to || !data.createdAt || !data.revealAt || !data.status) return null;

  const status = String(data.status);
  if (status !== 'pending' && status !== 'revealed' && status !== 'read') return null;

  return {
    from: String(data.from),
    to: String(data.to),
    createdAt: String(data.createdAt),
    revealAt: String(data.revealAt),
    status: status as LoveNoteStatus,
    readAt: data.readAt ? String(data.readAt) : undefined,
    body: body.trim(),
    sourceFile: relativePath,
  };
}

/** Sérialise une love note en markdown avec frontmatter YAML propre (manuel, pas matter.stringify — voir Pitfall). */
export function serializeLoveNote(note: Omit<LoveNote, 'sourceFile'>): string {
  const lines = [
    '---',
    `from: "${note.from}"`,
    `to: "${note.to}"`,
    `createdAt: "${note.createdAt}"`,
    `revealAt: "${note.revealAt}"`,
    `status: "${note.status}"`,
  ];
  if (note.readAt) {
    lines.push(`readAt: "${note.readAt}"`);
  }
  lines.push('---');
  lines.push('');
  lines.push(note.body);
  lines.push('');
  return lines.join('\n');
}
```

### Pattern 3: Hook domaine (pattern `useVaultNotes`)

**Source :** `hooks/useVaultNotes.ts` (copié intégralement comme modèle).

```typescript
// hooks/useVaultLoveNotes.ts

import { useState, useCallback } from 'react';
import type React from 'react';
import type { LoveNote, LoveNoteStatus } from '../lib/types';
import {
  LOVENOTES_DIR,
  parseLoveNote,
  serializeLoveNote,
  loveNotePath,
} from '../lib/parser';
import type { VaultManager } from '../lib/vault';

function isFileNotFound(e: unknown): boolean {
  const msg = String(e);
  return msg.includes('cannot read') || msg.includes('not exist') || msg.includes('no such') || msg.includes('ENOENT');
}
function warnUnexpected(context: string, e: unknown) {
  if (!isFileNotFound(e)) console.warn(`[useVaultLoveNotes] ${context}:`, e);
}

export interface UseVaultLoveNotesResult {
  loveNotes: LoveNote[];
  loadLoveNotes: (vault: VaultManager) => Promise<LoveNote[]>;
  setLoveNotes: React.Dispatch<React.SetStateAction<LoveNote[]>>;
  addLoveNote: (note: Omit<LoveNote, 'sourceFile'>) => Promise<void>;
  updateLoveNoteStatus: (sourceFile: string, status: LoveNoteStatus, readAt?: string) => Promise<void>;
  deleteLoveNote: (sourceFile: string) => Promise<void>;
  resetLoveNotes: () => void;
}

export function useVaultLoveNotes(
  vaultRef: React.MutableRefObject<VaultManager | null>
): UseVaultLoveNotesResult {
  const [loveNotes, setLoveNotes] = useState<LoveNote[]>([]);

  const resetLoveNotes = useCallback(() => {
    setLoveNotes([]);
  }, []);

  const loadLoveNotes = useCallback(async (vault: VaultManager): Promise<LoveNote[]> => {
    try {
      await vault.ensureDir(LOVENOTES_DIR);
      const files = await vault.listFilesRecursive(LOVENOTES_DIR, '.md');
      const results = await Promise.all(
        files.map(async (file) => {
          try {
            const content = await vault.readFile(file);
            return parseLoveNote(file, content);
          } catch (e) { warnUnexpected(`loveNote(${file})`, e); return null; }
        })
      );
      const loaded = results.filter((n): n is LoveNote => n !== null);
      // Tri par createdAt desc (les plus récentes en premier — cohérent avec notes)
      loaded.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      return loaded;
    } catch {
      return [];
    }
  }, []);

  const addLoveNote = useCallback(async (note: Omit<LoveNote, 'sourceFile'>) => {
    if (!vaultRef.current) return;
    const dir = `${LOVENOTES_DIR}/${note.to}`;
    await vaultRef.current.ensureDir(dir);
    const relPath = loveNotePath(note.to, note.createdAt);
    await vaultRef.current.writeFile(relPath, serializeLoveNote(note));
    const exists = await vaultRef.current.exists(relPath);
    if (!exists) throw new Error('Échec de l\'écriture de la love note');
    setLoveNotes((prev) => [{ ...note, sourceFile: relPath }, ...prev]);
  }, [vaultRef]);

  const updateLoveNoteStatus = useCallback(async (
    sourceFile: string,
    status: LoveNoteStatus,
    readAt?: string,
  ) => {
    if (!vaultRef.current) return;
    const current = await vaultRef.current.readFile(sourceFile).catch(() => '');
    const parsed = parseLoveNote(sourceFile, current);
    if (!parsed) return;
    const updated: Omit<LoveNote, 'sourceFile'> = {
      ...parsed,
      status,
      readAt: status === 'read' ? (readAt ?? new Date().toISOString().slice(0, 19)) : parsed.readAt,
    };
    await vaultRef.current.writeFile(sourceFile, serializeLoveNote(updated));
    setLoveNotes((prev) => prev.map((n) =>
      n.sourceFile === sourceFile ? { ...updated, sourceFile } : n
    ));
  }, [vaultRef]);

  const deleteLoveNote = useCallback(async (sourceFile: string) => {
    if (!vaultRef.current) return;
    await vaultRef.current.deleteFile(sourceFile);
    setLoveNotes((prev) => prev.filter((n) => n.sourceFile !== sourceFile));
  }, [vaultRef]);

  return {
    loveNotes,
    loadLoveNotes,
    setLoveNotes,
    addLoveNote,
    updateLoveNoteStatus,
    deleteLoveNote,
    resetLoveNotes,
  };
}
```

### Pattern 4: Câblage `hooks/useVault.ts` (pattern gardenRaw/storiesHook)

**Source :** `hooks/useVault.ts` — gardenRaw ligne 588, storiesHook ligne 585, results[22] ligne 1211.

Cinq endroits à modifier (comptage précis pour respecter boundary ~12-15 lignes) :

1. **Import du hook** (vers ligne 90-102 avec les autres `useVaultX`) :
   ```typescript
   import { useVaultLoveNotes } from './useVaultLoveNotes';
   ```

2. **Instanciation du sous-hook** (section "Sous-hooks par domaine", après storiesHook ligne 585) :
   ```typescript
   // Domaine Love Notes délégué à useVaultLoveNotes (Phase 34)
   const loveNotesHook = useVaultLoveNotes(vaultRef);
   ```

3. **Interface `VaultState`** (après ligne 287 `setGardenRaw:`, avant `stories:` ligne 288) :
   ```typescript
   loveNotes: LoveNote[];
   addLoveNote: (note: Omit<LoveNote, 'sourceFile'>) => Promise<void>;
   updateLoveNoteStatus: (sourceFile: string, status: LoveNoteStatus, readAt?: string) => Promise<void>;
   deleteLoveNote: (sourceFile: string) => Promise<void>;
   ```
   Et ajouter l'import au-dessus : `import type { LoveNote, LoveNoteStatus } from '../lib/types';` (déjà dans l'import `../lib/types` ligne 74 — ajouter au listing).

4. **`loadVaultData` — Promise.allSettled** (après ligne 1211 `storiesHook.loadStories(...)`) :
   ```typescript
   // [23] Love Notes — 1 fichier par note classé par destinataire (Phase 34)
   loveNotesHook.loadLoveNotes(vault).catch(() => [] as LoveNote[]),
   ```
   Et dans le traitement des résultats (après ligne 1287 `storiesHook.setStories(...)`) :
   ```typescript
   loveNotesHook.setLoveNotes(val(results[23] as PromiseSettledResult<LoveNote[]>, []));
   ```

5. **Hydrate cache** (dans le bloc `cached && cached.vaultPath === stored`, après `missionsHook.setSecretMissions(cached.secretMissions)` ligne 685) :
   ```typescript
   loveNotesHook.setLoveNotes(cached.loveNotes);
   ```

6. **Return useMemo** (après ligne 1850 `setGardenRaw,`) :
   ```typescript
   loveNotes: loveNotesHook.loveNotes,
   addLoveNote: loveNotesHook.addLoveNote,
   updateLoveNoteStatus: loveNotesHook.updateLoveNoteStatus,
   deleteLoveNote: loveNotesHook.deleteLoveNote,
   ```

7. **Deps array useMemo** (dans la ligne des state values ~1862) :
   ```typescript
   ..., gardenRaw, storiesHook.stories, loveNotesHook.loveNotes,
   ```
   Et dans la partie callbacks (~ligne 1879) : `..., loveNotesHook,`

**Total : ~14 lignes ajoutées dans useVault.ts.** Respecte boundary.

### Pattern 5: Cache (bump CACHE_VERSION)

**Source :** `lib/vault-cache.ts:44`, `lib/vault-cache.ts:70-96`.

```typescript
// lib/vault-cache.ts — modifications

// Ligne 44 — bump version
const CACHE_VERSION = 2;  // ⚠️ bump 1 → 2 pour invalider les caches v1 existants

// Ligne 45 — bump URI correspondant (best practice, pas obligatoire)
const CACHE_FILE_URI = FileSystem.documentDirectory + 'vault-cache-v2.json';

// Ligne 20-42 — ajouter LoveNote à l'import
import type {
  // ... existants
  LoveNote,
} from './types';

// Ligne 70-96 — étendre VaultCacheState
export interface VaultCacheState {
  // ... champs existants
  secretMissions: Task[];
  loveNotes: LoveNote[];  // ← AJOUT
}
```

**Pourquoi bump obligatoire :** L'ajout d'un champ au shape `VaultCacheState` casse le contrat. Sans bump, `hydrateFromCache()` retournerait `undefined` pour `loveNotes` (destructuring) et le code lirait `loveNotes` comme `undefined[]`, crashant au `.filter()` ou `.length`. Le bump force l'invalidation propre : `parsed.version !== CACHE_VERSION` retourne `null`, le cache est supprimé, loadVaultData tourne frais.

**Justifications CLAUDE.md (section Cache) :**
> Bumper `CACHE_VERSION` quand : ajout/retrait d'un domaine dans `VaultCacheState`

Cet ajout entre dans cette catégorie.

### Pattern 6: Barrel LoveNote export (non requis — pattern Notes)

Pas de nouveau barrel nécessaire. Pattern Notes n'a pas de sous-module — tout dans `lib/parser.ts`. Le type `LoveNote` est dans `lib/types.ts`. Helpers dans `lib/parser.ts`. Hook dans `hooks/useVaultLoveNotes.ts`. Cohérent avec Notes.

### Anti-Patterns à éviter

- **Utiliser `matter.stringify()` pour serializeLoveNote** — lossy (voir Pitfall Phase 25 #5). Construire la string manuellement, cohérent avec `serializeNote`, `serializeAnniversary`, `serializeGardenFile`.
- **Mettre la logique dans `hooks/useVault.ts`** — viole boundary god hook. Tout dans `useVaultLoveNotes.ts`.
- **Créer un `useLoveNotes.ts` au niveau de `useGarden.ts`** — inutile. Pattern Notes (hook sous-domaine dans `hooks/useVaultX.ts`) est suffisant. Pas de dérivation complexe en Phase 34 (c'est Phase 36+).
- **Utiliser gray-matter.stringify pour les dates** — coerce en objets `Date`, corrompt les ISO string (voir Phase 25 Pitfall + `.toISOString().slice(0, 19)` convention). Toujours écrire manuellement avec guillemets : `createdAt: "2026-04-16T14:32:17"`.
- **Parser le titre depuis le body** — pas de titre en frontmatter (discretion Claude's). Le body reste intact.
- **Créer un fichier placeholder `LoveNotes/.gitkeep`** — `VaultManager.writeFile` crée le dossier parent récursivement (`ensureDir` dans `_writeFileDirect` ligne 130). Pas besoin.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| YAML frontmatter parse | Custom YAML parser | `parseFrontmatter()` (`lib/parser.ts:191`) — gray-matter + fallback manuel | Gère édge cases Obsidian (accents, RN edge cases) déjà rodés |
| File I/O dans le vault | `fs.readFile` / custom | `VaultManager.readFile/writeFile/deleteFile` | NSFileCoordinator iOS, SAF Android, enqueueWrite pour race-free |
| Scan récursif fichiers `.md` | `walkDir` custom | `vault.listFilesRecursive(LOVENOTES_DIR, '.md')` | Déjà testé (Notes, Memories, Health) |
| Création de sous-dossier | Manual `mkdir` | `vault.ensureDir(dir)` + `vault.writeFile` (crée récursivement) | Sûr iCloud, idempotent |
| Slug de nom de fichier | Custom hash/uuid | Pattern `noteFileName()` (normalize + remove accents + lowercase + regex) | Cohérent avec Notes, lisible Obsidian |
| Timestamp ISO | `Date.toISOString()` brut | `.toISOString().slice(0, 19)` (sans Z) | Convention locale museum/village/CSV |
| Hook de domaine | Context custom | `useVaultLoveNotes(vaultRef)` appelé depuis `useVaultInternal` | Pattern répliqué 21 fois, VaultContext auto-propage |
| Tests fixtures | Mock complet | String literal multi-ligne (pattern `village-parser.test.ts:26-40`) | Lisible, debuggable |

**Key insight :** 100% des problèmes de Phase 34 sont déjà résolus dans le codebase. Zéro invention nécessaire. La phase est de l'**assemblage de patterns existants**. Le plan-checker doit vérifier qu'aucune tâche ne réinvente ces briques.

---

## Runtime State Inventory

**Context :** Phase 34 crée un nouveau domaine — pas de rename/refactor. Aucun état legacy à migrer. Inventaire fait par acquit de conscience.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | **Aucun** — le domaine `LoveNote` est nouveau, aucun fichier `.md` existant dans le vault de test ne contient de love notes (vérifié par grep `love.?note` sur le repo : uniquement `.planning/*` docs + `lovenote-envelope.html` mockup, zéro code source) | Aucune — cache sera bumpé (1 → 2) pour invalider les snapshots existants qui ignoraient `loveNotes` |
| Live service config | **Aucun** — pas de n8n, pas de service externe, données 100% locales + iCloud | Aucune |
| OS-registered state | **Aucun** — pas de task scheduler, pas de launchd, pas de pm2. Les notifications `expo-notifications` seront scheduled en Phase 36 (hors scope Phase 34) | Aucune en Phase 34 |
| Secrets/env vars | **Aucun** — pas de clé API, pas d'auth header. Vault privé famille + iCloud sync suffit (core value) | Aucune |
| Build artifacts | **Aucun** — pas de package installé en local avec l'ancien nom. Nouveau domaine, nouveau fichier | Aucune |

**Nothing found in category:** Confirmé explicitement pour chaque catégorie. Phase 34 est 100% greenfield dans le domaine.

**Invalidation caches existants (seul effet "runtime") :**
- Utilisateurs déjà sur TestFlight avec `vault-cache-v1.json` verront leur cache invalidé au premier boot post-Phase 34 (bump CACHE_VERSION 1 → 2)
- Effet : un boot "long" (~500ms-1s de loadVaultData) au lieu du boot "instant" cache. Acceptable, documenter dans SUMMARY.

---

## Common Pitfalls

### Pitfall 1: Oublier de bump `CACHE_VERSION`

**What goes wrong :** Ajouter `loveNotes: LoveNote[]` à `VaultCacheState` sans bumper `CACHE_VERSION`. Au premier boot post-deploy, `hydrateFromCache()` retourne l'ancien snapshot (v1) sans `loveNotes`. Le code fait `cached.loveNotes.filter(...)` → TypeError `Cannot read property 'filter' of undefined`.
**Why it happens :** Oubli — la doc CLAUDE.md est claire (section Cache), mais facile à skip.
**How to avoid :** Task 1 du plan doit inclure `CACHE_VERSION = 2` ET extension du type VaultCacheState DANS LE MÊME COMMIT. Vérifier avec `grep "CACHE_VERSION = 2" lib/vault-cache.ts`.
**Warning signs :** Tests passent localement (cache fraîche), mais crash en prod au premier boot.

### Pitfall 2: `matter.stringify()` corrompt les dates ISO

**What goes wrong :** Utiliser `matter.stringify(body, { from, to, createdAt, ... })` pour sérialiser. gray-matter coerce `createdAt: "2026-04-16T14:32:17"` en objet `Date`, puis rewrite en `createdAt: 2026-04-16T14:32:17.000Z` (UTC suffix Z). Le parse round-trip diverge : `parseFrontmatter` retourne un `Date` object, pas une string. Les tests échouent.
**Why it happens :** Tentation d'utiliser la lib "officielle" pour serialize, cohérent avec deserialize.
**How to avoid :** Construire la string manuellement (pattern `serializeNote`, `serializeLoveNote` ci-dessus). Ecrire les dates avec guillemets : `createdAt: "2026-04-16T14:32:17"`. Test round-trip le détecte.
**Warning signs :** Test parseLoveNote(serializeLoveNote(data)) échoue sur `.toEqual(data)` avec diff `createdAt: Date vs string`.

### Pitfall 3: Slug de fichier collision

**What goes wrong :** Deux love notes créées dans la même seconde → même `YYYY-MM-DD-HHMMSS` → même chemin → la deuxième écriture écrase la première.
**Why it happens :** Granularité seconde insuffisante pour batch d'écritures rapprochées.
**How to avoid :** L'implem recommandée ci-dessus utilise le suffix base36 du nombre `HHMMSS` — pas collision-free en pratique si deux créations sont dans la même seconde. Option A (discrétion Claude) : ajouter milliseconde `createdAt.slice(11, 23)` dans le hash. Option B : pré-vérifier `vault.exists(path)` et append `-2`, `-3` si collision. Option C (recommandée) : utiliser `createdAt` complet avec milliseconde `2026-04-16T14:32:17.123` et hasher ces 12 caractères en base36 → suffix plus long mais collision-safe.
**Warning signs :** Test "addLoveNote idempotence" écrasé, ou test "2 addLoveNote en parallèle" retourne 1 fichier au lieu de 2.

### Pitfall 4: `revealAt` timezone ambiguïté

**What goes wrong :** User compose une note à 23h55 locale (Paris CET) avec revealAt "demain 8h". Le code stocke `revealAt: "2026-04-17T08:00:00"` (local). Plus tard, le user voyage (London BST = CET-1h). `new Date(revealAt) > new Date()` est évalué par JS comme heure locale de l'appareil. La note révèle à 7h London au lieu de 8h Paris = 7h London. Comportement correct si "8h chez le user" est l'intention.
**Why it happens :** Ambiguïté sur "8h" (au moment de l'écriture vs au moment de la lecture).
**How to avoid :** Décision à documenter explicitement dans le plan : "revealAt stocké en heure locale de l'appareil à la composition, interprété comme heure locale à la lecture". Cohérent avec stockage museum/village. Claude's discretion — aucune libreau de fuseau (date-fns-tz non installé, pas de nouvelle dép). Si Phase 36 (reveal engine) découvre un besoin de TZ explicite, extension LOVE-F (future).
**Warning signs :** Bug reports "ma note a révélé trop tôt". Phase 34 ne gère pas ce cas (pas de UI reveal) — à tester en Phase 36. En Phase 34, juste documenter la convention dans le commentaire du type `LoveNote.revealAt`.

### Pitfall 5: `LOVENOTES_DIR` avec espace cassant les globs

**What goes wrong :** `03 - Famille/LoveNotes` contient des espaces. Certains test tools ou shell commands (pas bash/zsh) cassent le path. Passer en bash avec quotes résout, mais tests et grep y passent aussi.
**Why it happens :** Convention Obsidian vault existante (tous les dossiers sont `## - Nom`).
**How to avoid :** Cohérent avec `NOTES_DIR = '08 - Notes'`, `SKILLS_DIR = '08 - Compétences'`, `RECIPES_DIR = '03 - Cuisine/Recettes'`. Aucun problème historique — `VaultManager.readFile` accepte les espaces sans échapper. Tests utilisent string literals, pas de shell.
**Warning signs :** Aucun — pattern éprouvé 21 fois.

### Pitfall 6: Scan récursif d'un dossier vide au premier boot

**What goes wrong :** `vault.ensureDir(LOVENOTES_DIR)` crée le dossier, puis `vault.listFilesRecursive(LOVENOTES_DIR, '.md')` retourne `[]`. OK.
**MAIS :** Si le répertoire n'existe pas encore et que `ensureDir` échoue silencieusement (iCloud pas prêt, permission transitoire), `listFilesRecursive` lance une exception → `loadLoveNotes` retourne `[]` via catch. Acceptable.
**Why it happens :** Premier boot post-install, iCloud sync pas encore prêt.
**How to avoid :** Le pattern `useVaultNotes.loadNotes` gère déjà ce cas : `try { ensureDir + listFilesRecursive + ... } catch { return []; }`. Répliquer.
**Warning signs :** Aucun — pattern éprouvé.

### Pitfall 7: Champ optionnel `readAt` dropped by serialize si `undefined`

**What goes wrong :** `serializeLoveNote` avec `readAt: undefined` produit `readAt: "undefined"` (literal string). Round-trip parse voit `readAt: "undefined"` au lieu de `undefined`.
**Why it happens :** Template string naïf `readAt: "${note.readAt}"` ne vérifie pas null.
**How to avoid :** Guard `if (note.readAt) lines.push(\`readAt: "${note.readAt}"\`)` — le pattern est explicite dans `serializeLoveNote` ci-dessus. Test round-trip avec `readAt: undefined` le détecte.
**Warning signs :** Test `parse(serialize(data))` où `data.readAt === undefined` retourne `{..., readAt: "undefined"}` — diff explicite.

### Pitfall 8: Cache stocke `sourceFile` absolu vs relatif

**What goes wrong :** Si le vaultPath change entre deux boots (déplacement iCloud), les `sourceFile` cachés pointent vers l'ancien chemin. Le code tente de `readFile(absolutePath)` alors que `VaultManager` attend un `relativePath`.
**Why it happens :** `sourceFile` est stocké relatif dans les autres domaines (Notes, Memories) — cohérent. Juste un pitfall à ne pas introduire.
**How to avoid :** Le `sourceFile` dans `LoveNote` DOIT être relatif (ex: `"03 - Famille/LoveNotes/emma/2026-04-16-3ex9.md"`), cohérent avec `Note.sourceFile`. `parseLoveNote(relativePath, content)` reçoit déjà le relatif depuis `listFilesRecursive`. Vérifier dans le test "listing par destinataire".
**Warning signs :** Test `update` échoue avec "cannot read" après reboot.

---

## Code Examples

Voir la section "Architecture Patterns" ci-dessus pour le code complet. Résumé des patterns consommés :

### Référence — parseNote/serializeNote (`lib/parser.ts:2707-2751`)
Pattern file-per-entity avec frontmatter, le modèle exact à répliquer.

### Référence — useVaultNotes (`hooks/useVaultNotes.ts`)
Pattern hook domaine CRUD, 116 lignes, le modèle exact à répliquer.

### Référence — gardenRaw wiring (`hooks/useVault.ts:105,286-287,588,1208,1286,1849-1850,1862`)
Pattern câblage 5-endroits-précis dans useVault.ts — dimensionne la taille de modification.

### Référence — village-parser.test.ts (`lib/__tests__/village-parser.test.ts`)
Structure de suite Jest (groupes `describe`, fixtures string literal, round-trip, edge cases). 22.9K = ~800 lignes, 40+ tests. Cible équivalente pour Love Notes mais plus légère (~15 tests suffisent pour LOVE-17 : parse/serialize roundtrip, frontmatter invalide, listing par destinataire).

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Tout dans `parser.ts` monolithique | Modules isolés `lib/village/`, `lib/mascot/` | Phase 23 (museum) | Love Notes : Claude's discretion — **bloc dans parser.ts** (pattern Notes) recommandé car domaine simple. Module isolé `lib/lovenotes/` valide si planner juge que Phases 36-37 grossiront le domaine |
| `useVault.ts` monolithique | 21+ hooks `useVaultX` extraits | Phase 14+ | `useVaultLoveNotes.ts` obligatoire — pattern établi, `useVault.ts` plafonne à +15 lignes |
| Fichier partagé (`jardin-familial.md`) | Fichier-par-entité (Notes, Memories, RDV, Skills) | Phase 23+ | Love Notes = pattern fichier-par-entité classé par dossier destinataire |
| `matter.stringify()` pour serialize | Construction manuelle string | Phase 25 (museum/village) | Love Notes : serialize manuel obligatoire (Pitfall 2) |
| Cache monolithique sans version | `CACHE_VERSION` + shape check | Introduction vault-cache | Bump 1 → 2 obligatoire pour Phase 34 |

---

## Open Questions

Toutes les questions ouvertes relèvent de **Claude's Discretion** — décisions à arrêter par le plan-checker ou dans le code d'implémentation. Aucune n'est bloquante.

1. **Module isolé `lib/lovenotes/` vs bloc dans `lib/parser.ts` ?**
   - What we know : Pattern Notes (bloc) et Village (module) coexistent. Domaine Love Notes simple (pas de grid/engine/templates en Phase 34).
   - Recommendation : **Bloc dans `lib/parser.ts`** (pattern Notes) — minimiser la divergence, 30 lignes ajoutées au fichier 2800-lignes. Si Phase 36 ajoute un "reveal engine" non-trivial, extraire à ce moment-là.
   - Deferral : Planner tranche.

2. **Algorithme de slug de nom de fichier ?**
   - What we know : `noteFileName(title)` dépend d'un titre. Love Notes n'a pas de titre.
   - Options : (a) hash base36 du timestamp HHMMSS, (b) millisecondes ajoutées pour éviter collision, (c) nanoid-like (4 char random), (d) timestamp complet `YYYY-MM-DD-HHMMSS.md`.
   - Recommendation : **Option (b)** — `YYYY-MM-DD-{base36(HHMMSSmmm)}.md` — déterministe, collision-safe 1ms, compact, lisible Obsidian.
   - Pitfall : documenter dans commentaire, test idempotence.

3. **Fuseau horaire pour `revealAt` ?**
   - What we know : Convention codebase = heure locale de l'appareil, ISO sans Z (museum, village).
   - Options : (a) local sans Z (convention), (b) UTC avec Z, (c) local + TZ offset `+02:00`.
   - Recommendation : **Option (a)** — cohérence codebase, aucune nouvelle dép (date-fns-tz non installé). Documenter explicitement dans JSDoc du type `LoveNote.revealAt`. Phase 36 (reveal engine) ré-évaluera si bug reports.

4. **API du hook : CRUD minimal ou avec helpers filter ?**
   - What we know : `useVaultNotes` expose juste `notes, addNote, updateNote, deleteNote, setNotes, loadNotes, resetNotes`. Les composants filtrent eux-mêmes (pas de helpers dans le hook).
   - Options : (a) minimal (réplique Notes), (b) ajouter `filterByRecipient(toProfileId)`, `getPending()`, `getRevealable()`.
   - Recommendation : **Option (a) minimal** — Phase 34 ne voit aucune UI. Les helpers filter apparaîtront naturellement en Phase 35 (LoveNoteCard + screen) ou dans un fichier utilitaire `lib/lovenotes-helpers.ts` si plusieurs composants en ont besoin.

5. **Gérer un titre explicite ou pas ?**
   - What we know : Le mockup `.planning/mockups/lovenote-envelope.html` ne montre pas de titre — juste corps message + expéditeur. Le frontmatter roadmap ne liste pas `title`.
   - Recommendation : **Pas de titre explicite** — le body markdown du message parle de lui-même. Si Phase 36 découvre le besoin, ajout rétrocompatible (champ optionnel).

6. **Purger les fichiers vides / corrompus ?**
   - What we know : `parseLoveNote` retourne `null` si frontmatter invalide. `loadLoveNotes` filter-out les null.
   - Options : (a) laisser les fichiers invalides en place (Obsidian user peut les voir et les corriger manuellement), (b) delete les fichiers invalides au load.
   - Recommendation : **Option (a) — laisser** — philosophie "vault Obsidian privé famille, l'user contrôle ses fichiers". Pas de suppression silencieuse.

---

## Environment Availability

**Step 2.6: SKIPPED** — Phase purement code/config. Aucune dépendance externe au-delà du stack projet existant :
- `gray-matter` ✓ (node_modules)
- `jest` ✓ (node_modules)
- `expo-file-system/legacy` ✓ (node_modules)
- Pas de CLI tool, pas de service externe, pas de runtime spécifique.

Pas de probe commands nécessaire. Le planner peut assumer full availability.

---

## Validation Architecture

**`workflow.nyquist_validation = false`** dans `.planning/config.json:19`. **Section omise volontairement.**

Validation requise (per LOVE-16) :
- `npx tsc --noEmit` clean hors erreurs pré-existantes (MemoryEditor.tsx, cooklang.ts, useVault.ts — per CLAUDE.md)
- `npx jest --no-coverage` clean (inclut `parser-lovenotes.test.ts` à créer)

Commandes documentées dans CLAUDE.md section Testing.

---

## Files Change List

### Nouveaux fichiers (à créer)

| Fichier | Lignes estimées | Contenu |
|---------|-----------------|---------|
| `hooks/useVaultLoveNotes.ts` | ~130 | Hook domaine CRUD, pattern exact `useVaultNotes.ts` |
| `lib/__tests__/parser-lovenotes.test.ts` | ~250 | Tests Jest — parse/serialize roundtrip, frontmatter invalide, listing, slug generation |

### Fichiers existants à modifier

| Fichier | Lignes ajoutées | Sections |
|---------|-----------------|----------|
| `lib/types.ts` | ~15 | `LoveNote` interface + `LoveNoteStatus` type (après les autres types de domaine) |
| `lib/parser.ts` | ~50 | `LOVENOTES_DIR`, `loveNoteFileName`, `loveNotePath`, `parseLoveNote`, `serializeLoveNote` (après section Notes, ligne ~2751) |
| `hooks/useVault.ts` | ~14 | Import hook, instanciation sous-hook, VaultState, Promise.allSettled [23], hydrate cache, return useMemo, deps array |
| `lib/vault-cache.ts` | ~5 | Bump `CACHE_VERSION = 2`, bump `CACHE_FILE_URI v2`, import `LoveNote`, ajout `loveNotes: LoveNote[]` dans `VaultCacheState` |

**Total : 2 nouveaux fichiers + 4 fichiers modifiés ≈ 460 lignes**

### Fichiers explicitement NON modifiés

- `contexts/VaultContext.tsx` — Auto-propage `VaultState` via `useVaultInternal()`, aucune modif
- `app/_layout.tsx` — Aucune modif provider hierarchy
- Aucun composant UI — Phase 34 est invisible

---

## Test Strategy — `parser-lovenotes.test.ts`

Pattern structure inspiré de `village-parser.test.ts`. Cible ~15 tests minimum couvrant LOVE-17.

### Groupes `describe`

1. **`describe('parseLoveNote')`** — 5 tests :
   - `parse un fichier complet valide (pending)` — frontmatter complet, body markdown, retourne LoveNote
   - `parse un fichier valide avec status=read et readAt présent` — champs optionnels
   - `retourne null si frontmatter manque from` — validation stricte
   - `retourne null si frontmatter manque to/createdAt/revealAt/status` — validation
   - `retourne null si status est invalide (ex: "unknown")` — enum strict
   - `ignore body = "" (body vide permis)` — edge case OK

2. **`describe('serializeLoveNote')`** — 3 tests :
   - `produit un frontmatter YAML valide avec tous les champs requis` — format exact
   - `inclut readAt uniquement si présent` — champ optionnel
   - `préserve le body markdown intact (avec newlines, caractères spéciaux)` — no-op body

3. **`describe('round-trip parseLoveNote(serializeLoveNote(data)))`** — 2 tests :
   - `preserve une note complète (status=read avec readAt)` — toEqual strict
   - `preserve une note pending sans readAt` — readAt reste undefined

4. **`describe('loveNoteFileName')`** — 2 tests :
   - `génère un nom .md déterministe depuis createdAt` — stable
   - `deux createdAt différents d'1 ms produisent deux filenames différents` — collision-safe (si millisecondes incluses)

5. **`describe('loveNotePath')`** — 2 tests :
   - `construit le chemin 03 - Famille/LoveNotes/{to}/{slug}.md` — format exact
   - `respecte le toProfileId (différent destinataire → différent dossier)` — classement

6. **`describe('listing par destinataire (LOVE-17)')`** — 2 tests (intégration simulée sans VaultManager réel) :
   - `filter by recipient depuis un LoveNote[]` — helper inline test
   - `tri par createdAt desc (plus récentes en premier)` — pattern loadLoveNotes

**Total : 16 tests.** Cible dépassée sans redondance.

### Fixtures

```typescript
const FULL_LOVENOTE_FILE = `---
from: "lucas"
to: "emma"
createdAt: "2026-04-16T14:32:17"
revealAt: "2026-04-20T08:00:00"
status: "pending"
---

Joyeux anniversaire ma chérie, je t'aime.
`;

const FULL_LOVENOTE_DATA: Omit<LoveNote, 'sourceFile'> = {
  from: 'lucas',
  to: 'emma',
  createdAt: '2026-04-16T14:32:17',
  revealAt: '2026-04-20T08:00:00',
  status: 'pending',
  body: 'Joyeux anniversaire ma chérie, je t\'aime.',
};
```

### Patterns à respecter

- **Pas de mock VaultManager** dans `parser-lovenotes.test.ts` — tests purs du parser. Le hook `useVaultLoveNotes.ts` peut être testé séparément avec mock si utile (non requis par LOVE-17).
- **Pas de mock gray-matter** — utiliser la vraie lib (pattern village-parser.test.ts).
- **Import depuis `../parser` et `../types`** — cohérent avec autres tests.
- **Langue commentaires FR** (CLAUDE.md).

---

## Project Constraints (from CLAUDE.md)

| Directive | Phase 34 Impact |
|-----------|-----------------|
| Stack React Native 0.81.5 + Expo SDK 54 | Phase 34 pur TypeScript — aucune API RN utilisée |
| Données vault Obsidian (gray-matter frontmatter) | Pattern obligatoire — parseLoveNote/serializeLoveNote respectent |
| Type check `npx tsc --noEmit` obligatoire | LOVE-16 — critère de succès |
| Tests `npx jest --no-coverage` | LOVE-17 — fichier test obligatoire |
| Langue UI/commits/commentaires : **français** | Tout code et JSDoc en FR |
| Couleurs via `useThemeColors()` / `colors.*` | N/A Phase 34 (pas d'UI) |
| Fichiers publics : noms génériques Lucas/Emma/Dupont | Fixtures tests, exemples docs — respecter |
| `console.warn`/`console.error` uniquement sous `if (__DEV__)` | `warnUnexpected()` helper du pattern `useVaultNotes` respecte |
| Pattern hook à répliquer : `useVaultNotes.ts` / `useVaultGratitude.ts` | ✓ Confirmé — cf REQUIREMENTS.md |
| Bump `CACHE_VERSION` quand ajout domaine `VaultCacheState` | ✓ Obligatoire — `CACHE_VERSION = 2` |
| Backward compat Obsidian vault obligatoire | ✓ Frontmatter YAML lisible dans Obsidian desktop |
| App sur TestFlight — phases non-cassantes | Phase 34 invisible (pas d'UI) → zéro risque régression visuelle |
| Solo dev — phases incrémentales | Phase 34 ≈ 460 lignes, ~4 tâches logiques découpables en 2-3 plans |

---

## Sources

### Primary (HIGH confidence — codebase source directly read)

- `/Users/gabrielwaltio/Documents/family-vault/lib/parser.ts:191-206` — `parseFrontmatter` (gray-matter + fallback manuel)
- `/Users/gabrielwaltio/Documents/family-vault/lib/parser.ts:2688-2751` — `NOTES_DIR`, `noteFileName`, `parseNote`, `serializeNote` (pattern exact à répliquer)
- `/Users/gabrielwaltio/Documents/family-vault/hooks/useVaultNotes.ts` (intégral, 116 lignes) — pattern hook domaine CRUD
- `/Users/gabrielwaltio/Documents/family-vault/hooks/useVaultGratitude.ts` (intégral, 110 lignes) — pattern alternatif (fichier partagé au lieu de fichier-par-entité) — validé mais non appliqué ici
- `/Users/gabrielwaltio/Documents/family-vault/hooks/useVault.ts` — structure générale, câblage 21 domaines, lignes exactes gardenRaw (105, 286-287, 588, 1208, 1286, 1849-1850, 1862), storiesHook (585, 1211, 1287)
- `/Users/gabrielwaltio/Documents/family-vault/lib/vault-cache.ts` (intégral, 185 lignes) — `CACHE_VERSION = 1`, `VaultCacheState`, hydrate/save
- `/Users/gabrielwaltio/Documents/family-vault/contexts/VaultContext.tsx` (intégral, 37 lignes) — confirmation que VaultContext auto-propage VaultState sans modif
- `/Users/gabrielwaltio/Documents/family-vault/lib/vault.ts:95-250` — `VaultManager` API (readFile, writeFile, deleteFile, listFilesRecursive, ensureDir, exists)
- `/Users/gabrielwaltio/Documents/family-vault/CLAUDE.md` — directives projet (stack, conventions, architecture, cache, testing)
- `/Users/gabrielwaltio/Documents/family-vault/.planning/ROADMAP.md` — Phase 34 specs détaillées
- `/Users/gabrielwaltio/Documents/family-vault/.planning/REQUIREMENTS.md` — LOVE-01 à LOVE-17
- `/Users/gabrielwaltio/Documents/family-vault/.planning/STATE.md` — Decisions Init v1.6 (path, cache bump, zéro deps)
- `/Users/gabrielwaltio/Documents/family-vault/.planning/phases/25-fondation-donn-es-village/25-RESEARCH.md` — précédent pattern Fondation données
- `/Users/gabrielwaltio/Documents/family-vault/.planning/phases/25-fondation-donn-es-village/25-01-PLAN.md` — précédent plan fondation (format decouvert)
- `/Users/gabrielwaltio/Documents/family-vault/.planning/phases/25-fondation-donn-es-village/25-02-PLAN.md` — précédent plan tests fondation
- `/Users/gabrielwaltio/Documents/family-vault/.planning/phases/26-hook-domaine-jardin/26-RESEARCH.md` — précédent pattern Hook domaine
- `/Users/gabrielwaltio/Documents/family-vault/.planning/phases/26-hook-domaine-jardin/26-01-PLAN.md` — précédent câblage useVault
- `/Users/gabrielwaltio/Documents/family-vault/.planning/phases/26-hook-domaine-jardin/26-02-PLAN.md` — précédent création hook
- `/Users/gabrielwaltio/Documents/family-vault/lib/__tests__/village-parser.test.ts` — structure tests Jest
- `/Users/gabrielwaltio/Documents/family-vault/lib/__tests__/parser.test.ts` — pattern tests parser existant
- `/Users/gabrielwaltio/Documents/family-vault/.planning/config.json` — `nyquist_validation: false`
- `/Users/gabrielwaltio/Documents/family-vault/.planning/mockups/lovenote-envelope.html` — mockup visuel confirmant absence de titre explicite

### Secondary (MEDIUM confidence — inferred from patterns)

- Algorithme slug base36 de HHMMSSmmm — inférence raisonnable mais à arrêter au plan
- Gestion fuseau horaire "local sans Z" — convention codebase, mais pas documentée formellement

### Tertiary (LOW confidence — non appliqué)

- Aucune — tous les choix recommandés sont soutenus par sources HIGH.

---

## Metadata

**Confidence breakdown:**

- **Standard stack** : HIGH — zéro nouvelle dépendance, tout vérifié dans `node_modules` + CLAUDE.md
- **Architecture (pattern Notes répliqué)** : HIGH — code source `useVaultNotes.ts` + `parseNote` + `serializeNote` lu intégralement
- **Architecture (câblage useVault.ts)** : HIGH — lignes exactes vérifiées par grep sur le fichier source
- **Cache (bump CACHE_VERSION)** : HIGH — mécanisme vérifié ligne-à-ligne dans `vault-cache.ts`
- **Pitfalls 1-8** : HIGH — 5 dérivés de Phase 25 Pitfalls, 3 nouveaux (3, 4, 7) issus du contexte Love Notes spécifique
- **Slug algorithm** : MEDIUM — recommandation basée sur analyse, mais l'exact choix (millisecondes, base36, ou autre) relève de discrétion Claude
- **Timezone handling `revealAt`** : MEDIUM — convention codebase claire, mais pas de test E2E sur changement TZ
- **Test count** : HIGH — 16 tests dérivés strictement des requirements LOVE-17
- **Files change list** : HIGH — comptage précis par lecture de sources

**Research date:** 2026-04-16
**Valid until:** 2026-05-16 (stable — codebase ne bouge pas sans phases explicites, dépendances non-mouvantes)

---

## RESEARCH COMPLETE
