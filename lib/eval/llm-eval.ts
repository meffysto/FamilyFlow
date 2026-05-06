/**
 * lib/eval/llm-eval.ts — Phase 52-03 (EVAL-05)
 *
 * LLM-judge async fire-and-forget pour stories du soir.
 * - Modèle Claude Haiku 4.5 (cap coût ≤ $0.005/story via max_tokens=300, temp=0).
 * - Sortie JSON stricte validée par Zod (4 dimensions 0-10 + justification ≤ 280 chars).
 * - 1 retry max sur JSON invalide ⇒ fallback neutre 5/10 si 2 échecs (jamais d'exception).
 * - Anonymisation OBLIGATOIRE du prénom enfant avant envoi (T-52-03-01).
 * - Idempotence G7 : skip si flag off OU si story.llm_judge déjà rempli.
 *
 * NE JAMAIS await sur le chemin critique bedtime — appel post-saveStory uniquement.
 */

import { z } from 'zod';
import type { BedtimeStory, Profile } from '../types';
import type { AIConfig } from '../ai-service';
import { LLM_EVAL_SYSTEM_PROMPT, LLM_EVAL_RETRY_PROMPT } from './prompts';
import { anonymizeStoryText } from './rubric-helpers';
import { isEvalEnabled } from './feature-flag';

export const LlmEvalSchema = z.object({
  rythme: z.number().int().min(0).max(10),
  originalite: z.number().int().min(0).max(10),
  charge_emotionnelle: z.number().int().min(0).max(10),
  fluidite: z.number().int().min(0).max(10),
  justification: z.string().min(1).max(280),
});
export type LlmEvalResponse = z.infer<typeof LlmEvalSchema>;

const HAIKU_MODEL = 'claude-haiku-4-5-20251001';
const MAX_TOKENS = 300; // cap coût ≤ $0.005/story (AI-SPEC §595)

const FALLBACK_NEUTRAL: LlmEvalResponse = {
  rythme: 5,
  originalite: 5,
  charge_emotionnelle: 5,
  fluidite: 5,
  justification: 'Score neutre — validation JSON échouée, fallback automatique.',
};

/**
 * Évalue une story via LLM-judge Haiku 4.5.
 * Retourne null si flag off ou story déjà jugée (idempotence G7).
 * Jamais d'exception — fallback neutre garanti en dernier recours.
 */
export async function evaluateStoryWithLlm(
  story: BedtimeStory,
  child: Profile,
  config: AIConfig,
): Promise<LlmEvalResponse | null> {
  if (!isEvalEnabled()) return null;
  // Idempotence G7 : skip si déjà jugée
  if (story.llm_judge) return null;

  const safeText = anonymizeStoryText(story.texte, child);
  const userMsg = `Tranche d'âge: ${story.trancheAge ?? 'non précisée'}\n\nHistoire:\n${safeText}`;

  try {
    const first = await callJudge(config, LLM_EVAL_SYSTEM_PROMPT, userMsg);
    const parsed = tryParse(first);
    if (parsed.success) return parsed.data;

    if (__DEV__) console.warn('[eval] JSON invalide, retry durci:', parsed.error);
    const second = await callJudge(
      config,
      `${LLM_EVAL_SYSTEM_PROMPT}\n\n${LLM_EVAL_RETRY_PROMPT}`,
      userMsg,
    );
    const reparsed = tryParse(second);
    if (reparsed.success) return reparsed.data;

    if (__DEV__) console.warn('[eval] LLM-judge fallback neutre 5/10');
    return FALLBACK_NEUTRAL;
  } catch (e) {
    if (__DEV__) console.warn('[eval] LLM-judge fetch failed, fallback neutre:', e);
    return FALLBACK_NEUTRAL;
  }
}

async function callJudge(config: AIConfig, system: string, user: string): Promise<string> {
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': config.apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: HAIKU_MODEL,
      max_tokens: MAX_TOKENS,
      temperature: 0,
      system,
      messages: [{ role: 'user', content: user }],
    }),
  });
  if (!r.ok) throw new Error(`Haiku ${r.status}`);
  const data = await r.json();
  return data?.content?.[0]?.text ?? '';
}

function tryParse(
  raw: string,
): { success: true; data: LlmEvalResponse } | { success: false; error: string } {
  // Strip markdown fences ```json ... ``` éventuels (LLMs en mettent souvent malgré l'instruction).
  const cleaned = raw
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/i, '')
    .trim();
  try {
    const json = JSON.parse(cleaned);
    const result = LlmEvalSchema.safeParse(json);
    return result.success
      ? { success: true, data: result.data }
      : { success: false, error: result.error.message };
  } catch (e: any) {
    return { success: false, error: e?.message ?? 'JSON.parse failed' };
  }
}
