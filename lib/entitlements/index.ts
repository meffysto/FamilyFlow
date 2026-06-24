/**
 * entitlements/ — Barrel export du système d'entitlements (Phase 54).
 *
 * Re-export nommé de tout ce qui est public (types, moteur pur, parser vault).
 * Consommé par contexts/EntitlementContext.tsx (Wave 2, Plan 54-03).
 */

export * from './types';
export * from './entitlement-engine';
export * from './quota-parser';
