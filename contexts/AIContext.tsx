/**
 * AIContext.tsx — Provider pour la couche IA optionnelle
 *
 * Gère la clé API Claude (SecureStore), le modèle sélectionné,
 * et expose les fonctions IA (ask, suggestions).
 *
 * Sans clé API = tout est désactivé/masqué.
 */

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import * as SecureStore from 'expo-secure-store';
import { askVault, generateAISuggestions, type AIConfig, type AIMessage, type AIResponse, type VaultContext as AIVaultContext } from '../lib/ai-service';

// ─── Constantes ──────────────────────────────────────────────────────────────────

const API_KEY_STORAGE = 'ai_api_key';
const MODEL_STORAGE = 'ai_model';
const DEFAULT_MODEL = 'claude-haiku-4-5-20251001';

export const AVAILABLE_MODELS = [
  { id: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5 (rapide, économique)' },
  { id: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6 (équilibré)' },
] as const;

// ─── Types ──────────────────────────────────────────────────────────────────────

interface AIState {
  /** true si une clé API est configurée */
  isConfigured: boolean;
  /** Modèle sélectionné */
  model: string;
  /** true pendant un appel API */
  isLoading: boolean;
  /** Enregistrer la clé API */
  setApiKey: (key: string) => Promise<void>;
  /** Supprimer la clé API */
  clearApiKey: () => Promise<void>;
  /** Changer le modèle */
  setModel: (model: string) => Promise<void>;
  /** Poser une question sur le vault */
  ask: (question: string, vaultCtx: AIVaultContext, history?: AIMessage[]) => Promise<AIResponse>;
  /** Générer des suggestions IA */
  getSuggestions: (vaultCtx: AIVaultContext) => Promise<AIResponse>;
}

// ─── Context ────────────────────────────────────────────────────────────────────

const AICtx = createContext<AIState | null>(null);

export function AIProvider({ children }: { children: React.ReactNode }) {
  const [apiKey, setApiKeyState] = useState<string>('');
  const [model, setModelState] = useState<string>(DEFAULT_MODEL);
  const [isLoading, setIsLoading] = useState(false);

  // Charger la config au mount
  useEffect(() => {
    Promise.all([
      SecureStore.getItemAsync(API_KEY_STORAGE),
      SecureStore.getItemAsync(MODEL_STORAGE),
    ]).then(([key, savedModel]) => {
      if (key) setApiKeyState(key);
      if (savedModel) setModelState(savedModel);
    });
  }, []);

  const isConfigured = apiKey.length > 0;

  const config: AIConfig | null = useMemo(
    () => (isConfigured ? { apiKey, model } : null),
    [apiKey, model, isConfigured],
  );

  const setApiKey = useCallback(async (key: string) => {
    const trimmed = key.trim();
    if (trimmed) {
      await SecureStore.setItemAsync(API_KEY_STORAGE, trimmed);
    } else {
      await SecureStore.deleteItemAsync(API_KEY_STORAGE);
    }
    setApiKeyState(trimmed);
  }, []);

  const clearApiKey = useCallback(async () => {
    await SecureStore.deleteItemAsync(API_KEY_STORAGE);
    setApiKeyState('');
  }, []);

  const setModel = useCallback(async (m: string) => {
    await SecureStore.setItemAsync(MODEL_STORAGE, m);
    setModelState(m);
  }, []);

  const ask = useCallback(
    async (question: string, vaultCtx: AIVaultContext, history: AIMessage[] = []): Promise<AIResponse> => {
      if (!config) return { text: '', error: 'IA non configurée' };
      setIsLoading(true);
      try {
        return await askVault(config, question, vaultCtx, history);
      } finally {
        setIsLoading(false);
      }
    },
    [config],
  );

  const getSuggestions = useCallback(
    async (vaultCtx: AIVaultContext): Promise<AIResponse> => {
      if (!config) return { text: '', error: 'IA non configurée' };
      setIsLoading(true);
      try {
        return await generateAISuggestions(config, vaultCtx);
      } finally {
        setIsLoading(false);
      }
    },
    [config],
  );

  const value: AIState = useMemo(
    () => ({ isConfigured, model, isLoading, setApiKey, clearApiKey, setModel, ask, getSuggestions }),
    [isConfigured, model, isLoading, setApiKey, clearApiKey, setModel, ask, getSuggestions],
  );

  return <AICtx.Provider value={value}>{children}</AICtx.Provider>;
}

export function useAI(): AIState {
  const ctx = useContext(AICtx);
  if (!ctx) {
    throw new Error('useAI doit être utilisé dans un AIProvider');
  }
  return ctx;
}
