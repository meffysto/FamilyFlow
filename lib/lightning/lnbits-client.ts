/**
 * LnbitsClient — client REST minimal pour LNbits
 *
 * Spike feat/lightning-farm — voir .planning/spikes/001-lnbits-end-to-end/README.md
 *
 * Endpoints utilisés (API REST v1 officielle, github.com/lnbits/lnbits) :
 *   GET  /api/v1/wallet                  → { name, balance (msat) }
 *   POST /api/v1/payments                → { payment_hash, bolt11, checking_id }
 *   GET  /api/v1/payments/{payment_hash} → { paid: bool, preimage?, status? }
 *
 * Header d'auth : `X-Api-Key: <invoice_key>`
 *
 * Le client n'utilise QUE l'invoice key (pas l'admin key) — création d'invoice
 * entrante et lecture de balance suffisent pour ce spike. Surface réduite.
 */

import type {
  CreateInvoiceResult,
  LnbitsConfig,
  PaymentStatus,
  WalletInfo,
} from './types';
import { LnbitsError } from './types';

const DEFAULT_TIMEOUT_MS = 8000;

export function msatToSat(msat: number): number {
  return Math.floor(msat / 1000);
}

export function satToMsat(sat: number): number {
  return sat * 1000;
}

function normalizeBaseUrl(url: string): string {
  return url.trim().replace(/\/+$/, '');
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
}

export class LnbitsClient {
  private readonly baseUrl: string;
  private readonly invoiceKey: string;

  constructor(config: LnbitsConfig) {
    if (!config.baseUrl || !config.invoiceKey) {
      throw new LnbitsError('LnbitsClient: baseUrl et invoiceKey requis');
    }
    this.baseUrl = normalizeBaseUrl(config.baseUrl);
    this.invoiceKey = config.invoiceKey.trim();
  }

  private async request<T>(
    path: string,
    init: RequestInit = {},
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    let res: Response;
    try {
      res = await fetchWithTimeout(
        url,
        {
          ...init,
          headers: {
            'X-Api-Key': this.invoiceKey,
            'Content-Type': 'application/json',
            Accept: 'application/json',
            ...(init.headers ?? {}),
          },
        },
        DEFAULT_TIMEOUT_MS,
      );
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      throw new LnbitsError(`Réseau indisponible (${reason})`);
    }

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new LnbitsError(
        `LNbits ${res.status} — ${res.statusText || 'erreur'}`,
        { httpStatus: res.status, body },
      );
    }

    return res.json() as Promise<T>;
  }

  /** GET /api/v1/wallet — balance en sats + nom du wallet */
  async getWallet(): Promise<WalletInfo> {
    const raw = await this.request<{ name: string; balance: number }>(
      '/api/v1/wallet',
    );
    return {
      name: raw.name,
      balanceSats: msatToSat(raw.balance),
    };
  }

  /**
   * POST /api/v1/payments — crée une invoice entrante
   * @param amountSats montant en satoshis
   * @param memo description visible dans le wallet payeur
   * @param extra champ optionnel arbitraire injecté dans le body LNbits.
   *   Phase 53 — utilisé comme idempotency tag REQ-6 (taskId + completedDate
   *   + profileId). LNbits accepte un objet arbitraire ; côté client, on
   *   garde aussi un audit local (`findPaidEntry`) pour faire la décision
   *   finale d'idempotence (combinaison ceinture+bretelles).
   */
  async createInvoice(
    amountSats: number,
    memo: string,
    extra?: Record<string, string | number>,
  ): Promise<CreateInvoiceResult> {
    if (!Number.isInteger(amountSats) || amountSats <= 0) {
      throw new LnbitsError('amountSats doit être un entier positif');
    }
    const body: {
      out: false;
      amount: number;
      unit: 'sat';
      memo: string;
      extra?: Record<string, string | number>;
    } = {
      out: false,
      amount: amountSats,
      unit: 'sat',
      memo,
    };
    if (extra) body.extra = extra;
    const raw = await this.request<{
      payment_hash: string;
      bolt11?: string;
      payment_request?: string;
      checking_id?: string;
    }>('/api/v1/payments', {
      method: 'POST',
      body: JSON.stringify(body),
    });

    // Pitfall #4 — double fallback bolt11 / payment_request conservé.
    const bolt11 = raw.bolt11 ?? raw.payment_request;
    if (!raw.payment_hash || !bolt11) {
      throw new LnbitsError('Réponse LNbits incomplète (payment_hash/bolt11 manquant)');
    }
    return {
      paymentHash: raw.payment_hash,
      bolt11,
      checkingId: raw.checking_id,
    };
  }

  /**
   * POST /api/v1/payments avec out:true — paye une invoice bolt11.
   *
   * Nécessite l'admin key (passée en override car le client est instancié
   * avec l'invoice key par défaut, surface réduite). Cette méthode doit
   * être appelée derrière un gate biométrique pour le wallet famille.
   */
  async payInvoice(bolt11: string, adminKey: string): Promise<{ paymentHash: string }> {
    if (!bolt11) throw new LnbitsError('bolt11 requis');
    if (!adminKey) throw new LnbitsError('adminKey requis pour pay-out');
    const url = `${this.baseUrl}/api/v1/payments`;
    let res: Response;
    try {
      res = await fetchWithTimeout(
        url,
        {
          method: 'POST',
          headers: {
            'X-Api-Key': adminKey.trim(),
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify({ out: true, bolt11 }),
        },
        DEFAULT_TIMEOUT_MS,
      );
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      throw new LnbitsError(`Réseau indisponible (${reason})`);
    }
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new LnbitsError(
        `Pay-out LNbits ${res.status} — ${res.statusText || 'erreur'}`,
        { httpStatus: res.status, body },
      );
    }
    const raw = await res.json() as { payment_hash: string };
    if (!raw.payment_hash) {
      throw new LnbitsError('Réponse pay-out incomplète (payment_hash manquant)');
    }
    return { paymentHash: raw.payment_hash };
  }

  /** GET /api/v1/payments/{hash} — statut de l'invoice */
  async getPaymentStatus(paymentHash: string): Promise<PaymentStatus> {
    if (!paymentHash) {
      throw new LnbitsError('paymentHash requis');
    }
    const raw = await this.request<{
      paid: boolean;
      preimage?: string;
      status?: string;
    }>(`/api/v1/payments/${encodeURIComponent(paymentHash)}`);

    if (raw.paid === true) {
      return { status: 'paid', preimage: raw.preimage };
    }
    if (raw.status === 'failed') {
      return { status: 'failed' };
    }
    return { status: 'pending' };
  }
}
