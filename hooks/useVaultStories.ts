/**
 * useVaultStories.ts — Domaine hook Histoires du soir
 * Pattern: useVaultMemories.ts
 */
import { useState, useCallback } from 'react';
import type { MutableRefObject, Dispatch, SetStateAction } from 'react';
import type { VaultManager } from '../lib/vault';
import type { BedtimeStory } from '../lib/types';
import { parseBedtimeStory, serializeBedtimeStory } from '../lib/parser';
import { STORIES_DIR } from '../lib/stories';
import { deleteStoryAudios } from '../lib/elevenlabs';

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
            if (story) allStories.push(story);
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
    if (!vaultRef.current) return;
    const vault = vaultRef.current;
    const dir = `${STORIES_DIR}/${story.enfant}`;
    await vault.ensureDir(dir);
    const content = serializeBedtimeStory(story);
    await vault.writeFile(story.sourceFile, content);
    setStories(prev => {
      const without = prev.filter(s => s.sourceFile !== story.sourceFile);
      return [story, ...without].sort((a, b) => b.date.localeCompare(a.date));
    });
  }, [vaultRef]);

  const deleteStory = useCallback(async (sourceFile: string) => {
    if (!vaultRef.current) return;
    try {
      await vaultRef.current.deleteFile(sourceFile);
    } catch { /* non-critique */ }
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
