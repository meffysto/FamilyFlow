/**
 * Tests LnbitsClient.createInvoice — Phase 53 ajout du paramètre `extra`
 * (idempotency tag REQ-6) + conservation Pitfall #4 (double fallback
 * bolt11 / payment_request).
 */

import { LnbitsClient } from '../lnbits-client';
import { LnbitsError } from '../types';

interface CapturedRequest {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: unknown;
}

let captured: CapturedRequest | null = null;
let mockResponse: { ok: boolean; status: number; statusText?: string; body: unknown } = {
  ok: true,
  status: 200,
  body: { payment_hash: 'abc', bolt11: 'lnbc1...', checking_id: 'check-1' },
};

const originalFetch = globalThis.fetch;

beforeEach(() => {
  captured = null;
  mockResponse = {
    ok: true,
    status: 200,
    body: { payment_hash: 'abc', bolt11: 'lnbc1...', checking_id: 'check-1' },
  };

  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input.toString();
    const method = init?.method ?? 'GET';
    const headers = (init?.headers ?? {}) as Record<string, string>;
    let parsedBody: unknown = undefined;
    if (init?.body && typeof init.body === 'string') {
      try { parsedBody = JSON.parse(init.body); } catch { parsedBody = init.body; }
    }
    captured = { url, method, headers, body: parsedBody };

    return {
      ok: mockResponse.ok,
      status: mockResponse.status,
      statusText: mockResponse.statusText ?? 'OK',
      json: async () => mockResponse.body,
      text: async () => JSON.stringify(mockResponse.body),
    } as unknown as Response;
  }) as typeof fetch;
});

afterAll(() => {
  globalThis.fetch = originalFetch;
});

describe('createInvoice — paramètre `extra` REQ-6', () => {
  it('envoie body.extra quand fourni', async () => {
    const client = new LnbitsClient({ baseUrl: 'https://demo.lnbits.com', invoiceKey: 'k' });
    await client.createInvoice(100, 'Tâche : brush teeth', {
      taskId: 'task-1',
      completedDate: '2026-05-18',
      profileId: 'lucas',
    });

    expect(captured).not.toBeNull();
    const body = captured!.body as Record<string, unknown>;
    expect(body.extra).toEqual({
      taskId: 'task-1',
      completedDate: '2026-05-18',
      profileId: 'lucas',
    });
    expect(body.out).toBe(false);
    expect(body.amount).toBe(100);
    expect(body.unit).toBe('sat');
    expect(body.memo).toBe('Tâche : brush teeth');
  });

  it('omet body.extra quand non fourni', async () => {
    const client = new LnbitsClient({ baseUrl: 'https://demo.lnbits.com', invoiceKey: 'k' });
    await client.createInvoice(100, 'memo');
    const body = captured!.body as Record<string, unknown>;
    expect('extra' in body).toBe(false);
  });

  it('throw si amountSats non entier ou négatif', async () => {
    const client = new LnbitsClient({ baseUrl: 'https://x', invoiceKey: 'k' });
    await expect(client.createInvoice(0, 'm')).rejects.toThrow(LnbitsError);
    await expect(client.createInvoice(-5, 'm')).rejects.toThrow(LnbitsError);
    await expect(client.createInvoice(1.5, 'm')).rejects.toThrow(LnbitsError);
  });
});

describe('createInvoice — Pitfall #4 double fallback bolt11 / payment_request', () => {
  it('lit raw.bolt11 quand présent', async () => {
    mockResponse.body = { payment_hash: 'h', bolt11: 'lnbc-new', checking_id: 'c' };
    const client = new LnbitsClient({ baseUrl: 'https://x', invoiceKey: 'k' });
    const inv = await client.createInvoice(100, 'm');
    expect(inv.bolt11).toBe('lnbc-new');
  });

  it('fallback sur raw.payment_request quand bolt11 absent', async () => {
    mockResponse.body = { payment_hash: 'h', payment_request: 'lnbc-legacy', checking_id: 'c' };
    const client = new LnbitsClient({ baseUrl: 'https://x', invoiceKey: 'k' });
    const inv = await client.createInvoice(100, 'm');
    expect(inv.bolt11).toBe('lnbc-legacy');
  });

  it('throw si ni bolt11 ni payment_request présent', async () => {
    mockResponse.body = { payment_hash: 'h', checking_id: 'c' };
    const client = new LnbitsClient({ baseUrl: 'https://x', invoiceKey: 'k' });
    await expect(client.createInvoice(100, 'm')).rejects.toThrow(/payment_hash\/bolt11/);
  });

  it('throw si payment_hash absent', async () => {
    mockResponse.body = { bolt11: 'lnbc-x' };
    const client = new LnbitsClient({ baseUrl: 'https://x', invoiceKey: 'k' });
    await expect(client.createInvoice(100, 'm')).rejects.toThrow(/payment_hash\/bolt11/);
  });
});
