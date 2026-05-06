/**
 * lib/eval/__tests__/llm-eval.test.ts — Phase 52-03 (EVAL-05)
 *
 * Couvre evaluateStoryWithLlm() : parse OK, strip fences markdown, retry sur
 * JSON invalide, fallback neutre 5/10, fetch error, idempotence G7,
 * model/max_tokens/temperature, anonymisation pré-LLM.
 */

import { evaluateStoryWithLlm } from '../llm-eval';
import { isEvalEnabled } from '../feature-flag';

jest.mock('../feature-flag', () => ({ isEvalEnabled: jest.fn(() => true) }));

const mockFetch = (response: string, ok = true) => {
  (global as any).fetch = jest.fn(async () => ({
    ok,
    status: ok ? 200 : 500,
    json: async () => ({ content: [{ type: 'text', text: response }] }),
  }));
};

const baseStory = {
  id: '1',
  texte: 'Histoire test.',
  llm_judge: undefined,
  trancheAge: '3-5',
} as any;
const baseChild = { id: 'c1', name: 'Enfant 1' } as any;
const cfg = { apiKey: 'test', model: 'sonnet' } as any;

beforeEach(() => {
  (isEvalEnabled as jest.Mock).mockReturnValue(true);
});

describe('llm-eval (EVAL-05)', () => {
  it('parse JSON valide', async () => {
    mockFetch(
      '{"rythme":8,"originalite":7,"charge_emotionnelle":9,"fluidite":9,"justification":"OK."}',
    );
    const r = await evaluateStoryWithLlm(baseStory, baseChild, cfg);
    expect(r).toEqual({
      rythme: 8,
      originalite: 7,
      charge_emotionnelle: 9,
      fluidite: 9,
      justification: 'OK.',
    });
  });

  it('strip markdown fences', async () => {
    mockFetch(
      '```json\n{"rythme":5,"originalite":5,"charge_emotionnelle":5,"fluidite":5,"justification":"x"}\n```',
    );
    const r = await evaluateStoryWithLlm(baseStory, baseChild, cfg);
    expect(r?.rythme).toBe(5);
  });

  it('retry sur JSON invalide puis valide au 2ème appel', async () => {
    let n = 0;
    (global as any).fetch = jest.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => {
        n++;
        if (n === 1) return { content: [{ type: 'text', text: 'pas du json' }] };
        return {
          content: [
            {
              type: 'text',
              text: '{"rythme":7,"originalite":6,"charge_emotionnelle":8,"fluidite":8,"justification":"y"}',
            },
          ],
        };
      },
    }));
    const r = await evaluateStoryWithLlm(baseStory, baseChild, cfg);
    expect(r?.rythme).toBe(7);
    expect((global as any).fetch).toHaveBeenCalledTimes(2);
  });

  it('fallback neutre sur 2 échecs JSON consécutifs', async () => {
    let n = 0;
    (global as any).fetch = jest.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ content: [{ type: 'text', text: 'pas du json ' + ++n }] }),
    }));
    const r = await evaluateStoryWithLlm(baseStory, baseChild, cfg);
    expect(r?.rythme).toBe(5);
    expect(r?.originalite).toBe(5);
    expect(r?.charge_emotionnelle).toBe(5);
    expect(r?.fluidite).toBe(5);
    expect(r?.justification).toMatch(/Score neutre/);
  });

  it('fallback neutre sur fetch error', async () => {
    (global as any).fetch = jest.fn(async () => {
      throw new Error('network');
    });
    const r = await evaluateStoryWithLlm(baseStory, baseChild, cfg);
    expect(r?.rythme).toBe(5);
  });

  it('fallback neutre sur HTTP 500', async () => {
    (global as any).fetch = jest.fn(async () => ({
      ok: false,
      status: 500,
      json: async () => ({}),
    }));
    const r = await evaluateStoryWithLlm(baseStory, baseChild, cfg);
    expect(r?.rythme).toBe(5);
  });

  it('skip si flag off (G7)', async () => {
    (isEvalEnabled as jest.Mock).mockReturnValueOnce(false);
    (global as any).fetch = jest.fn();
    const r = await evaluateStoryWithLlm(baseStory, baseChild, cfg);
    expect(r).toBeNull();
    expect((global as any).fetch).not.toHaveBeenCalled();
  });

  it('skip si llm_judge déjà rempli (idempotence)', async () => {
    (global as any).fetch = jest.fn();
    const story = { ...baseStory, llm_judge: { rythme: 8 } };
    const r = await evaluateStoryWithLlm(story, baseChild, cfg);
    expect(r).toBeNull();
    expect((global as any).fetch).not.toHaveBeenCalled();
  });

  it('utilise model claude-haiku-4-5-20251001 + max_tokens 300 + temp 0', async () => {
    mockFetch(
      '{"rythme":5,"originalite":5,"charge_emotionnelle":5,"fluidite":5,"justification":"x"}',
    );
    await evaluateStoryWithLlm(baseStory, baseChild, cfg);
    const callBody = JSON.parse(((global as any).fetch as jest.Mock).mock.calls[0][1].body);
    expect(callBody.model).toBe('claude-haiku-4-5-20251001');
    expect(callBody.max_tokens).toBe(300);
    expect(callBody.temperature).toBe(0);
  });

  it('anonymise le prénom enfant avant envoi (T-52-03-01)', async () => {
    mockFetch(
      '{"rythme":5,"originalite":5,"charge_emotionnelle":5,"fluidite":5,"justification":"x"}',
    );
    const story = { ...baseStory, texte: 'Lucas marchait dans la forêt.' };
    const child = { ...baseChild, name: 'Lucas' };
    await evaluateStoryWithLlm(story, child, cfg);
    const callBody = JSON.parse(((global as any).fetch as jest.Mock).mock.calls[0][1].body);
    const userContent = callBody.messages[0].content as string;
    expect(userContent).not.toMatch(/Lucas/);
    expect(userContent).toMatch(/Enfant/);
  });
});
