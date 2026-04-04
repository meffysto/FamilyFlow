/**
 * wear-engine.ts — Systeme d'usure et degradation de la ferme
 *
 * Genere des evenements aleatoires (cloture cassee, toit abime, mauvaises
 * herbes, nuisibles) qui donnent au joueur une raison de revenir. Les
 * consequences restent legeres : parcelle bloquee, production reduite,
 * perte minime de ressources. Toutes les fonctions sont pures.
 */

import type { PlacedBuilding, PlantedCrop } from './types';

// ── Types ──────────────────────────────────────────────────────────

export type WearEventType = 'broken_fence' | 'damaged_roof' | 'weeds' | 'pests';

export interface WearEvent {
  id: string;
  type: WearEventType;
  targetId: string;       // plotIndex (string) pour fence/weeds, cellId pour roof/pests
  startedAt: string;      // ISO date
  repairedAt?: string;    // ISO date si repare
}

export interface WearEffects {
  blockedPlots: number[];       // parcelles inutilisables (broken_fence)
  damagedBuildings: string[];   // cellIds avec production -50% (damaged_roof)
  weedyPlots: number[];         // parcelles avec mauvaises herbes (visuel)
  pestBuildings: string[];      // cellIds perdant des ressources (pests)
}

// ── Constantes ─────────────────────────────────────────────────────

/** Cout de reparation en feuilles par type */
export const REPAIR_COSTS: Record<WearEventType, number> = {
  broken_fence: 15,
  damaged_roof: 25,
  weeds: 0,
  pests: 0,
};

/** Probabilite journaliere de declenchement (check ~1x/jour a l'ouverture) */
export const DAILY_CHANCE: Record<WearEventType, number> = {
  broken_fence: 0.33,
  damaged_roof: 0.20,
  weeds: 1.0,       // conditionnel a parcelle vide >48h
  pests: 1.0,       // conditionnel a batiment plein >48h
};

/** Nombre maximum d'evenements actifs (non repares) simultanes */
export const MAX_ACTIVE_EVENTS = 2;

const CLEANUP_DELAY_MS = 7 * 24 * 3600 * 1000;       // 7 jours
const INACTIVITY_THRESHOLD_MS = 48 * 3600 * 1000;     // 48h
const MAX_PEST_LOSS = 3;
const MS_PER_DAY = 24 * 3600 * 1000;

// ── Helpers prives ─────────────────────────────────────────────────

function generateWearId(): string {
  return `wear_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
}

function getActiveEvents(events: WearEvent[]): WearEvent[] {
  return events.filter(e => !e.repairedAt);
}

// ── Fonctions publiques ────────────────────────────────────────────

/**
 * Verifie les conditions et genere de nouveaux evenements d'usure.
 *
 * @param activeEvents   - evenements existants (actifs + repares)
 * @param crops          - cultures plantees actuellement
 * @param buildings      - batiments places
 * @param totalPlots     - nombre total de parcelles deverrouillees
 * @param fullBuildingSince - cellId -> ISO date ou le batiment est devenu plein
 * @param now            - date courante
 * @returns nouveaux evenements a ajouter (peut etre vide)
 */
export function checkWearEvents(
  activeEvents: WearEvent[],
  crops: PlantedCrop[],
  buildings: PlacedBuilding[],
  totalPlots: number,
  fullBuildingSince: Record<string, string>,
  now: Date = new Date(),
): WearEvent[] {
  const active = getActiveEvents(activeEvents);
  if (active.length >= MAX_ACTIVE_EVENTS) return [];

  const newEvents: WearEvent[] = [];
  const remaining = MAX_ACTIVE_EVENTS - active.length;

  const activeTargets = new Set(active.map(e => `${e.type}:${e.targetId}`));
  const occupiedPlots = new Set(crops.map(c => c.plotIndex));

  // ── Broken fence ──
  if (remaining - newEvents.length > 0 && Math.random() < DAILY_CHANCE.broken_fence) {
    // Cible une parcelle pas deja bloquee
    const candidates: number[] = [];
    for (let i = 0; i < totalPlots; i++) {
      if (!activeTargets.has(`broken_fence:${i}`)) candidates.push(i);
    }
    if (candidates.length > 0) {
      const idx = candidates[Math.floor(Math.random() * candidates.length)];
      newEvents.push({
        id: generateWearId(),
        type: 'broken_fence',
        targetId: String(idx),
        startedAt: now.toISOString(),
      });
    }
  }

  // ── Damaged roof ──
  if (remaining - newEvents.length > 0 && Math.random() < DAILY_CHANCE.damaged_roof) {
    const candidates = buildings.filter(
      b => !activeTargets.has(`damaged_roof:${b.cellId}`),
    );
    if (candidates.length > 0) {
      const b = candidates[Math.floor(Math.random() * candidates.length)];
      newEvents.push({
        id: generateWearId(),
        type: 'damaged_roof',
        targetId: b.cellId,
        startedAt: now.toISOString(),
      });
    }
  }

  // ── Weeds (parcelle vide >48h) ──
  if (remaining - newEvents.length > 0) {
    for (let i = 0; i < totalPlots; i++) {
      if (remaining - newEvents.length <= 0) break;
      if (occupiedPlots.has(i)) continue;
      if (activeTargets.has(`weeds:${i}`)) continue;
      // Parcelle vide — verifier si vide depuis assez longtemps
      // On utilise un heuristique : si aucun crop n'a ete plante sur cette parcelle
      // dans les activeEvents recents, on considere >48h
      // Simplification : on genere si Math.random() < DAILY_CHANCE.weeds (= 1.0)
      // La condition "vide >48h" est approximee par le fait que la parcelle est vide
      // et que le check se fait ~1x/jour
      if (Math.random() < DAILY_CHANCE.weeds) {
        newEvents.push({
          id: generateWearId(),
          type: 'weeds',
          targetId: String(i),
          startedAt: now.toISOString(),
        });
        break; // max 1 weeds par check
      }
    }
  }

  // ── Pests (batiment plein >48h) ──
  if (remaining - newEvents.length > 0) {
    for (const b of buildings) {
      if (remaining - newEvents.length <= 0) break;
      if (activeTargets.has(`pests:${b.cellId}`)) continue;
      const fullSince = fullBuildingSince[b.cellId];
      if (!fullSince) continue;
      const fullMs = now.getTime() - new Date(fullSince).getTime();
      if (fullMs < INACTIVITY_THRESHOLD_MS) continue;
      if (Math.random() < DAILY_CHANCE.pests) {
        newEvents.push({
          id: generateWearId(),
          type: 'pests',
          targetId: b.cellId,
          startedAt: now.toISOString(),
        });
        break; // max 1 pests par check
      }
    }
  }

  return newEvents;
}

/** Reparer un evenement d'usure. Retourne null si impossible. */
export function repairWearEvent(
  events: WearEvent[],
  eventId: string,
  currentCoins: number,
  now: Date = new Date(),
): { events: WearEvent[]; cost: number } | null {
  const event = events.find(e => e.id === eventId);
  if (!event || event.repairedAt) return null;

  const cost = REPAIR_COSTS[event.type];
  if (currentCoins < cost) return null;

  const updatedEvents = events.map(e =>
    e.id === eventId ? { ...e, repairedAt: now.toISOString() } : e,
  );

  return { events: updatedEvents, cost };
}

/** Calculer les effets actifs de tous les evenements non repares */
export function getActiveWearEffects(events: WearEvent[]): WearEffects {
  const effects: WearEffects = {
    blockedPlots: [],
    damagedBuildings: [],
    weedyPlots: [],
    pestBuildings: [],
  };

  for (const e of getActiveEvents(events)) {
    switch (e.type) {
      case 'broken_fence':
        effects.blockedPlots.push(parseInt(e.targetId, 10));
        break;
      case 'damaged_roof':
        effects.damagedBuildings.push(e.targetId);
        break;
      case 'weeds':
        effects.weedyPlots.push(parseInt(e.targetId, 10));
        break;
      case 'pests':
        effects.pestBuildings.push(e.targetId);
        break;
    }
  }

  return effects;
}

/** Calculer les pertes de ressources dues aux nuisibles (1/24h, max 3) */
export function getPestLoss(
  events: WearEvent[],
  now: Date = new Date(),
): { cellId: string; lostCount: number }[] {
  const losses: { cellId: string; lostCount: number }[] = [];

  for (const e of getActiveEvents(events)) {
    if (e.type !== 'pests') continue;
    const elapsed = now.getTime() - new Date(e.startedAt).getTime();
    const lost = Math.min(Math.floor(elapsed / MS_PER_DAY), MAX_PEST_LOSS);
    if (lost > 0) {
      losses.push({ cellId: e.targetId, lostCount: lost });
    }
  }

  return losses;
}

// ── Serialisation ──────────────────────────────────────────────────

/** Serialiser en CSV : type:targetId:startedAt:repairedAt (pipe-separated) */
export function serializeWearEvents(events: WearEvent[]): string {
  if (events.length === 0) return '';
  return events
    .map(e => `${e.type}:${e.targetId}:${e.startedAt}:${e.repairedAt ?? '_'}`)
    .join('|');
}

/** Parser depuis CSV (backward-compatible, retourne [] si vide) */
export function parseWearEvents(csv: string | undefined): WearEvent[] {
  if (!csv || csv.trim() === '') return [];
  return csv
    .split('|')
    .map((entry, idx) => {
      const parts = entry.trim().split(':');
      if (parts.length < 3) return null;
      const [type, targetId, ...rest] = parts;
      // startedAt est une ISO date qui contient des ':'
      // Format: type:targetId:YYYY-MM-DDTHH:MM:SS.sssZ:repairedAt
      // On sait que repairedAt est soit '_' soit une ISO date
      const joined = rest.join(':');
      // Trouver le dernier segment (repairedAt ou '_')
      const lastPipe = joined.lastIndexOf(':');
      let startedAt: string;
      let repairedAt: string | undefined;

      if (joined.endsWith(':_')) {
        startedAt = joined.slice(0, -2);
        repairedAt = undefined;
      } else {
        // Le repairedAt est aussi une ISO date — chercher le 'T' separator
        // Format garanti : ...startedAt:repairedAt ou ...startedAt:_
        // ISO dates: 2026-04-04T12:00:00.000Z (24 chars)
        // On split sur le pattern de date
        const isoLen = 24; // YYYY-MM-DDTHH:MM:SS.sssZ
        if (joined.length > isoLen + 1) {
          // Il y a probablement un repairedAt
          const candidateRepaired = joined.slice(-isoLen);
          if (candidateRepaired.includes('T') && candidateRepaired.endsWith('Z')) {
            startedAt = joined.slice(0, -(isoLen + 1)); // -1 pour le ':'
            repairedAt = candidateRepaired;
          } else {
            startedAt = joined;
            repairedAt = undefined;
          }
        } else {
          startedAt = joined;
          repairedAt = undefined;
        }
      }

      return {
        id: `wear_restored_${idx}`,
        type: type as WearEventType,
        targetId,
        startedAt,
        repairedAt,
      } as WearEvent;
    })
    .filter((e): e is WearEvent => e !== null);
}

/** Nettoyer les evenements repares depuis plus de 7 jours */
export function cleanupOldEvents(events: WearEvent[], now: Date = new Date()): WearEvent[] {
  return events.filter(e => {
    if (!e.repairedAt) return true; // garder les actifs
    const repairedMs = now.getTime() - new Date(e.repairedAt).getTime();
    return repairedMs < CLEANUP_DELAY_MS;
  });
}
