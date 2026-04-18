// Phase 39 Plan 01 — Tests round-trip weight_override Profile <-> famille.md
// Couvre : backward-compat profil legacy + 5 valeurs WagerAgeCategory valides + rejet bogus.

import { parseFamille, serializeFamille } from '../parser';
import type { Profile } from '../types';

type ParsedProfile = ReturnType<typeof parseFamille>[number];

function makeFixture(body: string): string {
  // Format minimal famille.md — 1 profil lucas_adulte
  return `### lucas_adulte\nname: Lucas\nrole: adulte\navatar: 👨\n${body}`;
}

describe('parseFamille weight_override', () => {
  it('Test 1 : parse profil avec weight_override: adulte → "adulte"', () => {
    const content = makeFixture('weight_override: adulte\n');
    const [p] = parseFamille(content);
    expect(p.weight_override).toBe('adulte');
  });

  it('Test 2 : parse profil SANS weight_override → undefined (backward-compat)', () => {
    const content = makeFixture('');
    const [p] = parseFamille(content);
    expect(p.weight_override).toBeUndefined();
  });

  it('Test 3 : parse profil avec valeur invalide → ignoré (undefined), pas de throw', () => {
    const content = makeFixture('weight_override: bogus\n');
    const [p] = parseFamille(content);
    expect(p.weight_override).toBeUndefined();
  });

  it('Test 4 : serialize profil avec weight_override="enfant" → ligne weight_override: enfant présente', () => {
    const base: ParsedProfile = {
      id: 'emma_adulte',
      name: 'Emma',
      role: 'adulte',
      avatar: '👩',
      mascotDecorations: [],
      mascotInhabitants: [],
      mascotPlacements: {},
      weight_override: 'enfant',
    } as ParsedProfile;
    const out = serializeFamille([base]);
    expect(out).toContain('weight_override: enfant');
  });

  it('Test 5 : serialize profil SANS weight_override → AUCUNE ligne weight_override', () => {
    const base: ParsedProfile = {
      id: 'emma_adulte',
      name: 'Emma',
      role: 'adulte',
      avatar: '👩',
      mascotDecorations: [],
      mascotInhabitants: [],
      mascotPlacements: {},
    } as ParsedProfile;
    const out = serializeFamille([base]);
    expect(out).not.toContain('weight_override');
  });

  it('Test 6 : round-trip parse(serialize(parse(input))) préservé sur les 5 valeurs valides', () => {
    const valides: Profile['weight_override'][] = ['adulte', 'ado', 'enfant', 'jeune', 'bebe'];
    for (const v of valides) {
      const input = makeFixture(`weight_override: ${v}\n`);
      const first = parseFamille(input);
      const serialized = serializeFamille(first);
      const second = parseFamille(serialized);
      expect(second[0].weight_override).toBe(v);
    }
  });
});
