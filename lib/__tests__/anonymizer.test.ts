/**
 * Tests unitaires — anonymizer.ts
 *
 * Couvre l'anonymisation aller-retour des données personnelles :
 * - buildAnonymizationMap (construction du mapping)
 * - anonymize (remplacement données réelles → pseudonymes)
 * - deanonymize (restauration pseudonymes → données réelles)
 * - Aller-retour (roundtrip) anonymize + deanonymize
 * - Cas limites : accents, sous-chaînes, texte vide
 */

import {
  buildAnonymizationMap,
  anonymize,
  deanonymize,
  type AnonymizationMap,
} from '../anonymizer';
import type { Profile, RDV, HealthRecord } from '../types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeProfile(name: string, role: Profile['role']): Profile {
  return {
    id: name.toLowerCase(),
    name,
    role,
    avatar: '👤',
    points: 0,
    coins: 0,
    level: 1,
    streak: 0,
    lootBoxesAvailable: 0,
    multiplier: 1,
    multiplierRemaining: 0,
    pityCounter: 0,
    mascotDecorations: [],
    mascotInhabitants: [],
    mascotPlacements: {},
  };
}

function makeRDV(overrides: Partial<RDV> = {}): RDV {
  return {
    title: 'Visite',
    date_rdv: '2026-03-15',
    heure: '10:00',
    type_rdv: 'pédiatre',
    enfant: 'Lucas',
    médecin: 'Dr Martin',
    lieu: 'Cabinet Pasteur',
    statut: 'planifié',
    sourceFile: 'rdv.md',
    ...overrides,
  };
}

function makeHealthRecord(overrides: Partial<HealthRecord> = {}): HealthRecord {
  return {
    enfant: 'Lucas',
    enfantId: 'lucas',
    allergies: [],
    antecedents: [],
    medicamentsEnCours: [],
    croissance: [],
    vaccins: [],
    ...overrides,
  };
}

// ─── buildAnonymizationMap ──────────────────────────────────────────────────

describe('buildAnonymizationMap', () => {
  it('mappe les enfants vers "Enfant 1", "Enfant 2", etc.', () => {
    const profiles = [makeProfile('Lucas', 'enfant'), makeProfile('Emma', 'enfant')];
    const map = buildAnonymizationMap(profiles, []);
    expect(map.forward.get('Lucas')).toBe('Enfant 1');
    expect(map.forward.get('Emma')).toBe('Enfant 2');
  });

  it('mappe les adultes vers "Parent 1", "Parent 2"', () => {
    const profiles = [makeProfile('Papa', 'adulte'), makeProfile('Maman', 'adulte')];
    const map = buildAnonymizationMap(profiles, []);
    expect(map.forward.get('Papa')).toBe('Parent 1');
    expect(map.forward.get('Maman')).toBe('Parent 2');
  });

  it('mappe les ados comme des enfants', () => {
    const profiles = [makeProfile('Lucas', 'ado')];
    const map = buildAnonymizationMap(profiles, []);
    expect(map.forward.get('Lucas')).toBe('Enfant 1');
  });

  it('mappe les médecins depuis les RDVs', () => {
    const profiles = [makeProfile('Lucas', 'enfant')];
    const rdvs = [makeRDV({ médecin: 'Dr Martin' }), makeRDV({ médecin: 'Dr Bernard' })];
    const map = buildAnonymizationMap(profiles, rdvs);
    expect(map.forward.get('Dr Martin')).toBe('Médecin A');
    expect(map.forward.get('Dr Bernard')).toBe('Médecin B');
  });

  it('mappe les lieux depuis les RDVs', () => {
    const rdvs = [makeRDV({ lieu: 'Hôpital Central' })];
    const map = buildAnonymizationMap([], rdvs);
    expect(map.forward.get('Hôpital Central')).toBe('Lieu 1');
  });

  it('déduplique les médecins (case insensitive)', () => {
    const rdvs = [
      makeRDV({ médecin: 'Dr Martin' }),
      makeRDV({ médecin: 'Dr Martin' }), // doublon
    ];
    const map = buildAnonymizationMap([], rdvs);
    // Un seul mapping
    let count = 0;
    map.forward.forEach((v) => { if (v.startsWith('Médecin')) count++; });
    expect(count).toBe(1);
  });

  it('construit le reverse map correctement', () => {
    const profiles = [makeProfile('Lucas', 'enfant')];
    const map = buildAnonymizationMap(profiles, []);
    expect(map.reverse.get('Enfant 1')).toBe('Lucas');
  });

  it('mappe les allergies depuis les dossiers santé', () => {
    const health = [makeHealthRecord({ allergies: ['Arachides', 'Gluten'] })];
    const map = buildAnonymizationMap([], [], health);
    expect(map.forward.get('Arachides')).toBe('Allergie 1');
    expect(map.forward.get('Gluten')).toBe('Allergie 2');
  });

  it('mappe les médicaments depuis les dossiers santé', () => {
    const health = [makeHealthRecord({ medicamentsEnCours: ['Doliprane', 'Ventoline'] })];
    const map = buildAnonymizationMap([], [], health);
    expect(map.forward.get('Doliprane')).toBe('Médicament 1');
    expect(map.forward.get('Ventoline')).toBe('Médicament 2');
  });

  it('mappe les antécédents depuis les dossiers santé', () => {
    const health = [makeHealthRecord({ antecedents: ['Varicelle', 'Otite'] })];
    const map = buildAnonymizationMap([], [], health);
    expect(map.forward.get('Varicelle')).toBe('Antécédent 1');
    expect(map.forward.get('Otite')).toBe('Antécédent 2');
  });

  it('ignore les valeurs vides', () => {
    const rdvs = [makeRDV({ médecin: '', lieu: '' })];
    const map = buildAnonymizationMap([], rdvs);
    expect(map.forward.size).toBe(0);
  });
});

// ─── anonymize ──────────────────────────────────────────────────────────────

describe('anonymize', () => {
  let map: AnonymizationMap;

  beforeEach(() => {
    const profiles = [
      makeProfile('Lucas', 'enfant'),
      makeProfile('Emma', 'enfant'),
      makeProfile('Papa', 'adulte'),
    ];
    const rdvs = [makeRDV({ médecin: 'Dr Martin', lieu: 'Cabinet Pasteur' })];
    map = buildAnonymizationMap(profiles, rdvs);
  });

  it('remplace les noms de profils dans le texte', () => {
    const result = anonymize('Lucas a un rendez-vous demain', map);
    expect(result).toBe('Enfant 1 a un rendez-vous demain');
    expect(result).not.toContain('Lucas');
  });

  it('remplace plusieurs noms dans le même texte', () => {
    const result = anonymize('Lucas et Emma jouent ensemble', map);
    expect(result).toContain('Enfant 1');
    expect(result).toContain('Enfant 2');
    expect(result).not.toContain('Lucas');
    expect(result).not.toContain('Emma');
  });

  it('remplace les médecins', () => {
    const result = anonymize('RDV avec Dr Martin à 10h', map);
    expect(result).toContain('Médecin A');
    expect(result).not.toContain('Dr Martin');
  });

  it('remplace les lieux', () => {
    const result = anonymize('Aller au Cabinet Pasteur', map);
    expect(result).toContain('Lieu 1');
    expect(result).not.toContain('Cabinet Pasteur');
  });

  it('retourne le texte original si pas de correspondances', () => {
    const result = anonymize('Il fait beau aujourd\'hui', map);
    expect(result).toBe('Il fait beau aujourd\'hui');
  });

  it('retourne le texte vide inchangé', () => {
    expect(anonymize('', map)).toBe('');
  });

  it('est insensible à la casse', () => {
    const result = anonymize('LUCAS est content', map);
    expect(result).not.toContain('LUCAS');
    expect(result).toContain('Enfant 1');
  });
});

// ─── deanonymize ────────────────────────────────────────────────────────────

describe('deanonymize', () => {
  let map: AnonymizationMap;

  beforeEach(() => {
    const profiles = [
      makeProfile('Lucas', 'enfant'),
      makeProfile('Emma', 'enfant'),
      makeProfile('Papa', 'adulte'),
    ];
    const rdvs = [makeRDV({ médecin: 'Dr Martin', lieu: 'Cabinet Pasteur' })];
    map = buildAnonymizationMap(profiles, rdvs);
  });

  it('restaure les noms de profils', () => {
    const result = deanonymize('Enfant 1 a un rendez-vous demain', map);
    expect(result).toBe('Lucas a un rendez-vous demain');
  });

  it('restaure les médecins', () => {
    const result = deanonymize('RDV avec Médecin A', map);
    expect(result).toContain('Dr Martin');
  });

  it('restaure les lieux', () => {
    const result = deanonymize('Aller au Lieu 1', map);
    expect(result).toContain('Cabinet Pasteur');
  });

  it('retourne le texte original si pas de pseudonymes', () => {
    const result = deanonymize('Il fait beau', map);
    expect(result).toBe('Il fait beau');
  });

  it('retourne le texte vide inchangé', () => {
    expect(deanonymize('', map)).toBe('');
  });
});

// ─── Aller-retour (roundtrip) ───────────────────────────────────────────────

describe('roundtrip anonymize → deanonymize', () => {
  let map: AnonymizationMap;

  beforeEach(() => {
    const profiles = [
      makeProfile('Lucas', 'enfant'),
      makeProfile('Emma', 'enfant'),
      makeProfile('Papa', 'adulte'),
      makeProfile('Maman', 'adulte'),
    ];
    const rdvs = [makeRDV({ médecin: 'Dr Martin', lieu: 'Cabinet Pasteur' })];
    const health = [makeHealthRecord({ allergies: ['Arachides'], medicamentsEnCours: ['Doliprane'] })];
    map = buildAnonymizationMap(profiles, rdvs, health);
  });

  it('retrouve le texte original après anonymisation + dé-anonymisation', () => {
    const original = 'Lucas a un RDV avec Dr Martin au Cabinet Pasteur pour ses Arachides';
    const anonymized = anonymize(original, map);
    const restored = deanonymize(anonymized, map);
    expect(restored).toBe(original);
  });

  it('préserve les caractères accentués (é, è, ê, à, ç)', () => {
    const profiles = [makeProfile('Éléonore', 'enfant')];
    const localMap = buildAnonymizationMap(profiles, []);
    const original = 'Éléonore a été très sage à la crèche';
    const anonymized = anonymize(original, localMap);
    expect(anonymized).not.toContain('Éléonore');
    const restored = deanonymize(anonymized, localMap);
    expect(restored).toBe(original);
  });

  it('gère un texte avec plusieurs remplacements', () => {
    const original = 'Papa emmène Lucas et Emma chez Dr Martin au Cabinet Pasteur, il prend le Doliprane';
    const anonymized = anonymize(original, map);
    expect(anonymized).not.toContain('Papa');
    expect(anonymized).not.toContain('Lucas');
    expect(anonymized).not.toContain('Emma');
    expect(anonymized).not.toContain('Dr Martin');
    expect(anonymized).not.toContain('Cabinet Pasteur');
    expect(anonymized).not.toContain('Doliprane');
    const restored = deanonymize(anonymized, map);
    expect(restored).toBe(original);
  });

  it('gère un texte sans aucun nom à remplacer', () => {
    const original = 'La météo est belle aujourd\'hui, il fait 25 degrés';
    const anonymized = anonymize(original, map);
    const restored = deanonymize(anonymized, map);
    expect(restored).toBe(original);
  });
});

// ─── Cas limites ────────────────────────────────────────────────────────────

describe('cas limites', () => {
  it('gère les noms qui sont des sous-chaînes d\'autres noms', () => {
    // "Martin" est une sous-chaîne de "Dr Martin"
    // Le tri par longueur décroissante doit empêcher un remplacement partiel
    const profiles = [makeProfile('Lucas', 'enfant')];
    const rdvs = [makeRDV({ médecin: 'Dr Martin' })];
    const map = buildAnonymizationMap(profiles, rdvs);
    const text = 'RDV avec Dr Martin demain';
    const anonymized = anonymize(text, map);
    // "Dr Martin" doit être remplacé en entier, pas "Martin" seul
    expect(anonymized).toContain('Médecin A');
    expect(anonymized).not.toContain('Martin');
  });

  it('gère un mapping vide (pas de données personnelles)', () => {
    const map = buildAnonymizationMap([], []);
    expect(anonymize('Texte quelconque', map)).toBe('Texte quelconque');
    expect(deanonymize('Texte quelconque', map)).toBe('Texte quelconque');
  });

  it('premier mapping gagne en cas de doublon', () => {
    // Si un nom apparaît à la fois comme enfant et dans un autre contexte,
    // le premier ajout est conservé
    const profiles = [makeProfile('Lucas', 'enfant')];
    const map = buildAnonymizationMap(profiles, []);
    expect(map.forward.get('Lucas')).toBe('Enfant 1');
  });

  it('gère les caractères spéciaux regex dans les noms', () => {
    const profiles = [makeProfile('Lucas (Jr.)', 'enfant')];
    const map = buildAnonymizationMap(profiles, []);
    const text = 'Bonjour Lucas (Jr.)';
    // Ne doit pas crasher malgré les parenthèses et le point
    const anonymized = anonymize(text, map);
    expect(anonymized).toContain('Enfant 1');
  });

  it('la dé-anonymisation est aussi insensible à la casse', () => {
    const profiles = [makeProfile('Lucas', 'enfant')];
    const map = buildAnonymizationMap(profiles, []);
    const result = deanonymize('enfant 1 joue dehors', map);
    expect(result).toContain('Lucas');
  });

  it('mappe les contacts médicaux depuis les dossiers santé', () => {
    const health = [makeHealthRecord({
      contactMedecin: 'Dr Dubois',
      contactPediatre: 'Dr Moreau',
    })];
    const map = buildAnonymizationMap([], [], health);
    // Les contacts médicaux sont mappés comme des médecins
    expect(map.forward.has('Dr Dubois')).toBe(true);
    expect(map.forward.has('Dr Moreau')).toBe(true);
  });
});
