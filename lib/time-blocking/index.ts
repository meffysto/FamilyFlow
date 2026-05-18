/**
 * Barrel — Phase quick-260516-oj6 — Time-blocking mode Journée.
 *
 * Module pur (slot-mapping + auto-placement) + wrapper SecureStore
 * (completion-history). Aucune dépendance React/RN dans slot-mapping
 * et auto-placement → testables en Node sans mocks.
 */

export * from './slot-mapping';
export * from './auto-placement';
export * from './completion-history';
