/**
 * useVaultStories.ts — Domaine hook Histoires du soir
 * Pattern: useVaultMemories.ts
 */
import { useState, useCallback } from 'react';
import type { MutableRefObject, Dispatch, SetStateAction } from 'react';
import type { VaultManager } from '../lib/vault';
import type { BedtimeStory, HighlightSpan, SceneSpec, StoryAudioAlignment, StoryScenes, StoryScript } from '../lib/types';
import { parseBedtimeStory, serializeBedtimeStory } from '../lib/parser';
import { parseStoryScript } from '../lib/story-script';
import { STORIES_DIR } from '../lib/stories';
import { deleteStoryAudios } from '../lib/elevenlabs';
import { isValidArchetype } from '../lib/story-illustrations';

/** Convertit `xxx.md` en `xxx.script.json` (sidecar V2) */
function scriptSidecarPath(mdPath: string): string {
  return mdPath.replace(/\.md$/, '.script.json');
}

/** Convertit `xxx.md` en `xxx.alignment.json` (sidecar V2.3 — alignement TTS) */
function alignmentSidecarPath(mdPath: string): string {
  return mdPath.replace(/\.md$/, '.alignment.json');
}

/** Convertit `xxx.md` en `xxx.scenes.json` (sidecar V3 — picture-book) */
function scenesSidecarPath(mdPath: string): string {
  return mdPath.replace(/\.md$/, '.scenes.json');
}

/** Parse tolérant d'un sidecar scenes JSON. Retourne null si inutilisable. */
function parseScenesSidecar(raw: string, textLength: number): StoryScenes | null {
  try {
    const data = JSON.parse(raw);
    if (!data || typeof data !== 'object') return null;
    const scenesRaw = (data as Record<string, unknown>).scenes;
    if (!Array.isArray(scenesRaw)) return null;

    const scenes: SceneSpec[] = [];
    for (const s of scenesRaw) {
      if (!s || typeof s !== 'object') continue;
      const obj = s as Record<string, unknown>;
      const panelIndex = Number(obj.panelIndex);
      const archetype = obj.archetype;
      const textStart = Number(obj.textStart);
      const textEnd = Number(obj.textEnd);
      if (!Number.isFinite(panelIndex) || panelIndex < 1) continue;
      if (!isValidArchetype(archetype)) continue;
      if (!Number.isFinite(textStart) || textStart < 0) continue;
      if (!Number.isFinite(textEnd) || textEnd <= textStart || textEnd > textLength) continue;

      const sceneText = textEnd - textStart;
      const highlightsRaw = Array.isArray(obj.highlights) ? obj.highlights : [];
      const highlights: HighlightSpan[] = [];
      for (const h of highlightsRaw) {
        if (!h || typeof h !== 'object') continue;
        const hObj = h as Record<string, unknown>;
        const startChar = Number(hObj.startChar);
        const endChar = Number(hObj.endChar);
        if (!Number.isFinite(startChar) || !Number.isFinite(endChar)) continue;
        if (startChar < 0 || endChar <= startChar || endChar > sceneText) continue;
        highlights.push({ startChar, endChar, kind: 'keyword' });
      }

      scenes.push({ panelIndex, archetype, textStart, textEnd, highlights });
    }
    if (scenes.length === 0) return null;
    scenes.sort((a, b) => a.panelIndex - b.panelIndex);
    return { version: 1, scenes };
  } catch {
    return null;
  }
}

/** Parse tolérant d'un sidecar alignment JSON */
function parseAlignment(raw: string): StoryAudioAlignment | null {
  try {
    const data = JSON.parse(raw);
    if (!data || typeof data !== 'object') return null;
    const chars = Array.isArray(data.chars) ? data.chars : null;
    const starts = Array.isArray(data.starts) ? data.starts : null;
    const ends = Array.isArray(data.ends) ? data.ends : null;
    if (!chars || !starts || !ends) return null;
    if (chars.length !== starts.length || chars.length !== ends.length) return null;
    return { chars, starts, ends };
  } catch {
    return null;
  }
}

export interface UseVaultStoriesResult {
  stories: BedtimeStory[];
  setStories: Dispatch<SetStateAction<BedtimeStory[]>>;
  loadStories: (vault: VaultManager, enfantNames: string[]) => Promise<BedtimeStory[]>;
  saveStory: (story: BedtimeStory) => Promise<void>;
  deleteStory: (sourceFile: string) => Promise<void>;
  resetStories: () => void;
}

export function useVaultStories(
  vaultRef: MutableRefObject<VaultManager | null>,
): UseVaultStoriesResult {
  const [stories, setStories] = useState<BedtimeStory[]>([]);

  const loadStories = useCallback(async (
    vault: VaultManager,
    enfantNames: string[],
  ): Promise<BedtimeStory[]> => {
    const allStories: BedtimeStory[] = [];

    await Promise.all(enfantNames.map(async (name) => {
      try {
        const dir = `${STORIES_DIR}/${name}`;
        await vault.ensureDir(dir);
        const files = await vault.listDir(dir);
        const mdFiles = files.filter(f => f.endsWith('.md'));

        await Promise.all(mdFiles.map(async (file) => {
          try {
            const relPath = `${dir}/${file}`;
            const content = await vault.readFile(relPath);
            const story = parseBedtimeStory(relPath, content);
            if (!story) return;

            // V2 — charger le sidecar script.json si présent (best-effort)
            if (story.spectacle) {
              try {
                const sidecar = await vault.readFile(scriptSidecarPath(relPath));
                const script = parseStoryScript(sidecar);
                if (script) story.script = script;
              } catch { /* sidecar absent — histoire spectacle V1 (ambiance seule) */ }

              // V2.3 — alignement caractère→timestamp (best-effort)
              try {
                const raw = await vault.readFile(alignmentSidecarPath(relPath));
                const align = parseAlignment(raw);
                if (align) story.alignment = align;
              } catch { /* alignment absent — fallback ratio en V2.2 */ }
            }

            // V3 — scènes illustrées (best-effort, indépendant du script.json)
            try {
              const raw = await vault.readFile(scenesSidecarPath(relPath));
              const scenes = parseScenesSidecar(raw, story.texte.length);
              if (scenes) story.scenes = scenes;
            } catch { /* scenes absent — histoire sans illustrations, fallback texte */ }

            allStories.push(story);
          } catch {
            // fichier illisible — ignorer
          }
        }));
      } catch {
        // dossier enfant inexistant — ignorer
      }
    }));

    const sorted = allStories.sort((a, b) => b.date.localeCompare(a.date));
    return sorted;
  }, []);

  const saveStory = useCallback(async (story: BedtimeStory) => {
    // 1) Optimistic update — l'histoire apparaît IMMÉDIATEMENT dans la bibliothèque,
    //    même si la sync vault échoue ou tarde. Le MP3 ElevenLabs est de toute façon
    //    caché indépendamment dans documentDirectory/stories-audio/.
    setStories(prev => {
      const without = prev.filter(s => s.sourceFile !== story.sourceFile);
      const next = [story, ...without].sort((a, b) => b.date.localeCompare(a.date));
      if (__DEV__) console.log('[useVaultStories] saveStory: optimistic', prev.length, '→', next.length);
      return next;
    });

    // 2) Persistance vault en best-effort. Si elle échoue (iCloud lent, vault non
    //    initialisé), on log mais on ne re-throw pas : l'histoire reste visible
    //    en mémoire pour la session, et sera re-tentée à un prochain saveStory.
    if (!vaultRef.current) {
      if (__DEV__) console.warn('[useVaultStories] saveStory: vaultRef null, persistance différée');
      return;
    }

    const vault = vaultRef.current;
    const dir = `${STORIES_DIR}/${story.enfant}`;

    try {
      await vault.ensureDir(dir);
      const content = serializeBedtimeStory(story);
      await vault.writeFile(story.sourceFile, content);
      if (__DEV__) console.log('[useVaultStories] saveStory: vault write OK', story.sourceFile);

      // V2 — sidecar script.json (Mode Spectacle enrichi)
      if (story.script) {
        try {
          await vault.writeFile(scriptSidecarPath(story.sourceFile), JSON.stringify(story.script, null, 2));
          if (__DEV__) console.log('[useVaultStories] saveStory: sidecar OK');
        } catch (e) {
          if (__DEV__) console.warn('[useVaultStories] sidecar failed:', e);
        }
      }

      // V2.3 — sidecar alignment.json (timing SFX word-level)
      if (story.alignment) {
        try {
          await vault.writeFile(
            alignmentSidecarPath(story.sourceFile),
            JSON.stringify(story.alignment),
          );
          if (__DEV__) console.log('[useVaultStories] saveStory: alignment sidecar OK');
        } catch (e) {
          if (__DEV__) console.warn('[useVaultStories] alignment sidecar failed:', e);
        }
      }

      // V3 — sidecar scenes.json (mode picture-book)
      if (story.scenes) {
        try {
          await vault.writeFile(
            scenesSidecarPath(story.sourceFile),
            JSON.stringify(story.scenes, null, 2),
          );
          if (__DEV__) console.log('[useVaultStories] saveStory: scenes sidecar OK');
        } catch (e) {
          if (__DEV__) console.warn('[useVaultStories] scenes sidecar failed:', e);
        }
      }
    } catch (e) {
      if (__DEV__) console.warn('[useVaultStories] vault persist failed (history still in memory):', e);
      throw e; // signale au caller pour qu'il puisse afficher un toast non-bloquant
    }
  }, [vaultRef]);

  const deleteStory = useCallback(async (sourceFile: string) => {
    if (!vaultRef.current) return;
    try {
      await vaultRef.current.deleteFile(sourceFile);
    } catch { /* non-critique */ }
    // V2 — supprime aussi le sidecar script.json si présent
    try {
      await vaultRef.current.deleteFile(scriptSidecarPath(sourceFile));
    } catch { /* sidecar absent — pas grave */ }
    // V2.3 — supprime aussi le sidecar alignment.json si présent
    try {
      await vaultRef.current.deleteFile(alignmentSidecarPath(sourceFile));
    } catch { /* sidecar absent — pas grave */ }
    // V3 — supprime aussi le sidecar scenes.json si présent
    try {
      await vaultRef.current.deleteFile(scenesSidecarPath(sourceFile));
    } catch { /* sidecar absent — pas grave */ }
    setStories(prev => {
      const story = prev.find(s => s.sourceFile === sourceFile);
      if (story) {
        deleteStoryAudios(story.id).catch(() => { /* non-critique */ });
      }
      return prev.filter(s => s.sourceFile !== sourceFile);
    });
  }, [vaultRef]);

  const resetStories = useCallback(() => {
    setStories([]);
  }, []);

  return { stories, setStories, loadStories, saveStory, deleteStory, resetStories };
}
