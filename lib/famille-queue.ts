/**
 * famille-queue.ts — File d'attente partagée pour les écritures sur famille.md
 *
 * Serialise toutes les écritures concurrentes sur famille.md entre useFarm.ts et useVault.ts
 * pour éviter les race conditions (read-modify-write concurrent).
 *
 * Module pure TS — aucun import React, aucun import vault.
 */

// Variable module-level partagée entre tous les importeurs
let _familleWriteQueue: Promise<void> = Promise.resolve();

/**
 * Enfile une opération d'écriture dans la queue.
 * Toute écriture sur famille.md doit passer par cette fonction.
 */
export function enqueueWrite<T = void>(fn: () => Promise<T>): Promise<T> {
  const next = _familleWriteQueue.then(fn);
  _familleWriteQueue = next.then(() => {}, () => {});
  return next;
}

/**
 * Met à jour un champ d'un profil dans les lignes de famille.md (in-place).
 * Cherche la section `### {profileId}` et met à jour ou insère `{fieldKey}: {value}`.
 */
export function patchProfileField(lines: string[], profileId: string, fieldKey: string, value: string): void {
  let inSection = false;
  let fieldLine = -1;
  let lastPropIdx = -1;

  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith('### ')) {
      if (inSection) break;
      if (lines[i].replace('### ', '').trim() === profileId) inSection = true;
    } else if (inSection && lines[i].includes(': ')) {
      lastPropIdx = i;
      if (lines[i].trim().startsWith(`${fieldKey}:`)) fieldLine = i;
    }
  }

  const newValue = `${fieldKey}: ${value}`;
  if (fieldLine >= 0) {
    lines[fieldLine] = newValue;
  } else if (lastPropIdx >= 0) {
    lines.splice(lastPropIdx + 1, 0, newValue);
  }
}

/**
 * Met à jour plusieurs champs d'un profil dans les lignes de famille.md (in-place).
 * Cherche la section `### {profileId}` et met à jour ou insère chaque champ.
 */
export function patchProfileFields(lines: string[], profileId: string, fields: Record<string, string>): void {
  let inSection = false;
  let lastPropIdx = -1;
  const fieldLines: Record<string, number> = {};

  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith('### ')) {
      if (inSection) break;
      if (lines[i].replace('### ', '').trim() === profileId) inSection = true;
    } else if (inSection && lines[i].includes(': ')) {
      lastPropIdx = i;
      for (const key of Object.keys(fields)) {
        if (lines[i].trim().startsWith(`${key}:`)) fieldLines[key] = i;
      }
    }
  }

  for (const [key, lineIdx] of Object.entries(fieldLines)) {
    lines[lineIdx] = `${key}: ${fields[key]}`;
  }

  let insertOffset = 0;
  for (const [key, value] of Object.entries(fields)) {
    if (fieldLines[key] === undefined && lastPropIdx >= 0) {
      lines.splice(lastPropIdx + 1 + insertOffset, 0, `${key}: ${value}`);
      insertOffset++;
    }
  }
}
