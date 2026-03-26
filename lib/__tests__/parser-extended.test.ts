/**
 * Tests unitaires étendus — parser.ts
 *
 * Couvre les fonctions NON testées dans parser.test.ts :
 * parseSecretMissions, serializeSecretMissions, parseHealthRecord (croissance + vaccins),
 * parseAnniversaries, parseNightFeeds, parseMoods, parseQuotes, parseGratitude,
 * parseDateInput (cas supplémentaires), formatDateForDisplay (cas supplémentaires),
 * isRdvUpcoming.
 */

import {
  parseSecretMissions,
  serializeSecretMissions,
  parseHealthRecord,
  parseAnniversaries,
  parseNightFeeds,
  parseMoods,
  parseQuotes,
  parseGratitude,
  parseDateInput,
  formatDateForDisplay,
  isRdvUpcoming,
} from '../parser';
import type { Profile, Task } from '../types';

// ─── parseSecretMissions ─────────────────────────────────────────────────────

describe('parseSecretMissions', () => {
  it('parse une mission active ([ ])', () => {
    const content = `# Missions secrètes

## lucas
- [ ] Ranger sa chambre en secret 📅2026-03-21
`;
    const missions = parseSecretMissions(content);
    expect(missions).toHaveLength(1);
    expect(missions[0].text).toBe('Ranger sa chambre en secret');
    expect(missions[0].secretStatus).toBe('active');
    expect(missions[0].completed).toBe(false);
    expect(missions[0].dueDate).toBe('2026-03-21');
    expect(missions[0].secret).toBe(true);
    expect(missions[0].targetProfileId).toBe('lucas');
  });

  it('parse une mission pending ([p])', () => {
    const content = `## emma
- [p] Faire un dessin pour maman 📅2026-03-20
`;
    const missions = parseSecretMissions(content);
    expect(missions).toHaveLength(1);
    expect(missions[0].secretStatus).toBe('pending');
    expect(missions[0].completed).toBe(false);
  });

  it('parse une mission validée ([x])', () => {
    const content = `## lucas
- [x] Aider à mettre la table 📅2026-03-18 ✅2026-03-19
`;
    const missions = parseSecretMissions(content);
    expect(missions).toHaveLength(1);
    expect(missions[0].secretStatus).toBe('validated');
    expect(missions[0].completed).toBe(true);
    expect(missions[0].dueDate).toBe('2026-03-18');
    expect(missions[0].completedDate).toBe('2026-03-19');
  });

  it('parse une mission validée avec [X] majuscule', () => {
    const content = `## lucas
- [X] Mission majuscule 📅2026-03-18
`;
    const missions = parseSecretMissions(content);
    expect(missions).toHaveLength(1);
    expect(missions[0].secretStatus).toBe('validated');
    expect(missions[0].completed).toBe(true);
  });

  it('parse plusieurs profils avec plusieurs missions', () => {
    const content = `# Missions secrètes

## lucas
- [ ] Mission 1 📅2026-03-21
- [p] Mission 2 📅2026-03-20

## emma
- [x] Mission 3 📅2026-03-18 ✅2026-03-19
- [ ] Mission 4 📅2026-03-22
`;
    const missions = parseSecretMissions(content);
    expect(missions).toHaveLength(4);

    const lucasMissions = missions.filter(m => m.targetProfileId === 'lucas');
    const emmaMissions = missions.filter(m => m.targetProfileId === 'emma');
    expect(lucasMissions).toHaveLength(2);
    expect(emmaMissions).toHaveLength(2);
  });

  it('retourne un tableau vide pour un fichier vide', () => {
    const missions = parseSecretMissions('');
    expect(missions).toEqual([]);
  });

  it('retourne un tableau vide pour un fichier sans missions', () => {
    const content = `# Missions secrètes

Pas de missions pour le moment.
`;
    const missions = parseSecretMissions(content);
    expect(missions).toEqual([]);
  });

  it('ignore les lignes non-mission sous un profil', () => {
    const content = `## lucas
Texte libre
- Pas de checkbox
- [ ] Vraie mission 📅2026-03-21
`;
    const missions = parseSecretMissions(content);
    expect(missions).toHaveLength(1);
    expect(missions[0].text).toBe('Vraie mission');
  });

  it('génère un id avec sourceFile et lineIndex', () => {
    const content = `## lucas
- [ ] Test 📅2026-03-21
`;
    const missions = parseSecretMissions(content, 'missions.md');
    expect(missions[0].id).toBe('missions.md:1');
    expect(missions[0].sourceFile).toBe('missions.md');
  });

  it('nettoie le texte des marqueurs de date', () => {
    const content = `## lucas
- [x] Faire le ménage 📅2026-03-18 ✅2026-03-19
`;
    const missions = parseSecretMissions(content);
    expect(missions[0].text).toBe('Faire le ménage');
    expect(missions[0].text).not.toContain('📅');
    expect(missions[0].text).not.toContain('✅');
  });

  it('gère une mission sans date', () => {
    const content = `## lucas
- [ ] Mission sans date
`;
    const missions = parseSecretMissions(content);
    expect(missions).toHaveLength(1);
    expect(missions[0].text).toBe('Mission sans date');
    expect(missions[0].dueDate).toBeUndefined();
  });

  it('ignore les lignes avant le premier ## profil', () => {
    const content = `# Missions secrètes
- [ ] Orpheline ignorée 📅2026-03-21

## lucas
- [ ] Vraie mission 📅2026-03-21
`;
    const missions = parseSecretMissions(content);
    expect(missions).toHaveLength(1);
    expect(missions[0].targetProfileId).toBe('lucas');
  });
});

// ─── serializeSecretMissions ─────────────────────────────────────────────────

describe('serializeSecretMissions', () => {
  const profiles: Profile[] = [
    { id: 'lucas', name: 'Lucas', role: 'enfant', avatar: '🧒', points: 0, coins: 0, level: 1, streak: 0, lootBoxesAvailable: 0, multiplier: 1, multiplierRemaining: 0, pityCounter: 0, mascotDecorations: [], mascotInhabitants: [] },
    { id: 'emma', name: 'Emma', role: 'enfant', avatar: '👧', points: 0, coins: 0, level: 1, streak: 0, lootBoxesAvailable: 0, multiplier: 1, multiplierRemaining: 0, pityCounter: 0, mascotDecorations: [], mascotInhabitants: [] },
  ];

  it('sérialise des missions groupées par profil', () => {
    const missions: Task[] = [
      { id: '1', text: 'Ranger', completed: false, tags: [], mentions: [], sourceFile: 'f.md', lineIndex: 0, secret: true, targetProfileId: 'lucas', secretStatus: 'active', dueDate: '2026-03-21' },
      { id: '2', text: 'Dessiner', completed: true, tags: [], mentions: [], sourceFile: 'f.md', lineIndex: 1, secret: true, targetProfileId: 'emma', secretStatus: 'validated', dueDate: '2026-03-18', completedDate: '2026-03-19' },
    ];

    const md = serializeSecretMissions(missions, profiles);
    expect(md).toContain('## lucas');
    expect(md).toContain('## emma');
    expect(md).toContain('- [ ] Ranger 📅2026-03-21');
    expect(md).toContain('- [x] Dessiner 📅2026-03-18 ✅2026-03-19');
  });

  it('sérialise les missions pending avec [p]', () => {
    const missions: Task[] = [
      { id: '1', text: 'En attente', completed: false, tags: [], mentions: [], sourceFile: 'f.md', lineIndex: 0, secret: true, targetProfileId: 'lucas', secretStatus: 'pending', dueDate: '2026-03-20' },
    ];

    const md = serializeSecretMissions(missions, profiles);
    expect(md).toContain('- [p] En attente 📅2026-03-20');
  });

  it('round-trip : serialize → parse préserve les données', () => {
    const original: Task[] = [
      { id: '1', text: 'Mission A', completed: false, tags: [], mentions: [], sourceFile: 'missions.md', lineIndex: 0, secret: true, targetProfileId: 'lucas', secretStatus: 'active', dueDate: '2026-03-21' },
      { id: '2', text: 'Mission B', completed: false, tags: [], mentions: [], sourceFile: 'missions.md', lineIndex: 1, secret: true, targetProfileId: 'lucas', secretStatus: 'pending', dueDate: '2026-03-20' },
      { id: '3', text: 'Mission C', completed: true, tags: [], mentions: [], sourceFile: 'missions.md', lineIndex: 2, secret: true, targetProfileId: 'emma', secretStatus: 'validated', dueDate: '2026-03-18', completedDate: '2026-03-19' },
    ];

    const md = serializeSecretMissions(original, profiles);
    const parsed = parseSecretMissions(md, 'missions.md');

    expect(parsed).toHaveLength(3);
    expect(parsed[0].text).toBe('Mission A');
    expect(parsed[0].secretStatus).toBe('active');
    expect(parsed[1].text).toBe('Mission B');
    expect(parsed[1].secretStatus).toBe('pending');
    expect(parsed[2].text).toBe('Mission C');
    expect(parsed[2].secretStatus).toBe('validated');
    expect(parsed[2].completedDate).toBe('2026-03-19');
  });

  it('respecte l\'ordre des profils fournis', () => {
    const missions: Task[] = [
      { id: '1', text: 'M1', completed: false, tags: [], mentions: [], sourceFile: 'f.md', lineIndex: 0, secret: true, targetProfileId: 'emma', secretStatus: 'active' },
      { id: '2', text: 'M2', completed: false, tags: [], mentions: [], sourceFile: 'f.md', lineIndex: 1, secret: true, targetProfileId: 'lucas', secretStatus: 'active' },
    ];

    const md = serializeSecretMissions(missions, profiles);
    const lucasIdx = md.indexOf('## lucas');
    const emmaIdx = md.indexOf('## emma');
    // lucas est premier dans profiles, donc doit apparaître avant emma
    expect(lucasIdx).toBeLessThan(emmaIdx);
  });

  it('gère les profils inconnus (non dans la liste)', () => {
    const missions: Task[] = [
      { id: '1', text: 'M1', completed: false, tags: [], mentions: [], sourceFile: 'f.md', lineIndex: 0, secret: true, targetProfileId: 'inconnu-profil', secretStatus: 'active' },
    ];

    const md = serializeSecretMissions(missions, profiles);
    expect(md).toContain('## inconnu-profil');
  });
});

// ─── parseHealthRecord (croissance + vaccins) ────────────────────────────────

describe('parseHealthRecord — croissance', () => {
  it('parse des entrées de croissance avec toutes les colonnes', () => {
    const content = `## Croissance
| Date | Poids (kg) | Taille (cm) | PC (cm) | Notes |
| ---- | ---------- | ----------- | ------- | ----- |
| 2026-01-15 | 8.5 | 72 | 45 | RAS |
| 2026-03-15 | 9.2 | 75 | 46.5 | Bonne prise |
`;
    const record = parseHealthRecord('Lucas', 'lucas', content);
    expect(record.croissance).toHaveLength(2);
    expect(record.croissance[0]).toEqual({
      date: '2026-01-15',
      poids: 8.5,
      taille: 72,
      perimetre: 45,
      note: 'RAS',
    });
    expect(record.croissance[1].poids).toBe(9.2);
    expect(record.croissance[1].perimetre).toBe(46.5);
  });

  it('gère les colonnes vides (slice(1,-1) fix)', () => {
    const content = `## Croissance
| Date | Poids (kg) | Taille (cm) | PC (cm) | Notes |
| ---- | ---------- | ----------- | ------- | ----- |
| 2026-01-15 | 8.5 |  |  |  |
`;
    const record = parseHealthRecord('Lucas', 'lucas', content);
    expect(record.croissance).toHaveLength(1);
    expect(record.croissance[0].poids).toBe(8.5);
    expect(record.croissance[0].taille).toBeUndefined();
    expect(record.croissance[0].perimetre).toBeUndefined();
    expect(record.croissance[0].note).toBeUndefined();
  });

  it('ignore les lignes avec date invalide', () => {
    const content = `## Croissance
| Date | Poids (kg) | Taille (cm) | PC (cm) | Notes |
| ---- | ---------- | ----------- | ------- | ----- |
| pas-une-date | 8.5 | 72 | 45 | RAS |
| 2026-01-15 | 9.0 | 73 | 45.5 |  |
`;
    const record = parseHealthRecord('Lucas', 'lucas', content);
    expect(record.croissance).toHaveLength(1);
    expect(record.croissance[0].date).toBe('2026-01-15');
  });

  it('ignore les en-têtes de table', () => {
    const content = `## Croissance
| Date | Poids (kg) | Taille (cm) | PC (cm) | Notes |
| ---- | ---------- | ----------- | ------- | ----- |
`;
    const record = parseHealthRecord('Lucas', 'lucas', content);
    expect(record.croissance).toHaveLength(0);
  });

  it('retourne un tableau vide sans section croissance', () => {
    const content = `## Allergies
- Arachides
`;
    const record = parseHealthRecord('Lucas', 'lucas', content);
    expect(record.croissance).toEqual([]);
  });

  it('parse des poids décimaux correctement', () => {
    const content = `## Croissance
| Date | Poids (kg) | Taille (cm) | PC (cm) | Notes |
| ---- | ---------- | ----------- | ------- | ----- |
| 2026-02-01 | 10.35 | 80.5 | 47.2 |  |
`;
    const record = parseHealthRecord('Lucas', 'lucas', content);
    expect(record.croissance[0].poids).toBe(10.35);
    expect(record.croissance[0].taille).toBe(80.5);
    expect(record.croissance[0].perimetre).toBe(47.2);
  });
});

describe('parseHealthRecord — vaccins', () => {
  it('parse des entrées de vaccins complètes', () => {
    const content = `## Vaccins
| Vaccin | Date | Dose | Notes |
| ------ | ---- | ---- | ----- |
| DTP | 2025-06-15 | 1ère dose | OK |
| ROR | 2026-01-10 | 1ère dose | Léger érythème |
`;
    const record = parseHealthRecord('Lucas', 'lucas', content);
    expect(record.vaccins).toHaveLength(2);
    expect(record.vaccins[0]).toEqual({
      nom: 'DTP',
      date: '2025-06-15',
      dose: '1ère dose',
      note: 'OK',
    });
    expect(record.vaccins[1].nom).toBe('ROR');
  });

  it('gère les colonnes vides (dose et notes optionnelles)', () => {
    const content = `## Vaccins
| Vaccin | Date | Dose | Notes |
| ------ | ---- | ---- | ----- |
| BCG | 2025-01-05 |  |  |
`;
    const record = parseHealthRecord('Lucas', 'lucas', content);
    expect(record.vaccins).toHaveLength(1);
    expect(record.vaccins[0].nom).toBe('BCG');
    expect(record.vaccins[0].dose).toBeUndefined();
    expect(record.vaccins[0].note).toBeUndefined();
  });

  it('ignore les en-têtes et séparateurs de table', () => {
    const content = `## Vaccins
| Vaccin | Date | Dose | Notes |
| ------ | ---- | ---- | ----- |
`;
    const record = parseHealthRecord('Lucas', 'lucas', content);
    expect(record.vaccins).toHaveLength(0);
  });

  it('ignore les lignes sans nom de vaccin', () => {
    const content = `## Vaccins
| Vaccin | Date | Dose | Notes |
| ------ | ---- | ---- | ----- |
|  | 2025-06-15 | 1ère dose | Pas de nom |
| DTP | 2025-06-15 | 1ère dose | OK |
`;
    const record = parseHealthRecord('Lucas', 'lucas', content);
    expect(record.vaccins).toHaveLength(1);
    expect(record.vaccins[0].nom).toBe('DTP');
  });

  it('retourne un tableau vide sans section vaccins', () => {
    const content = `## Allergies
- Aucune
`;
    const record = parseHealthRecord('Lucas', 'lucas', content);
    expect(record.vaccins).toEqual([]);
  });
});

// ─── parseAnniversaries ──────────────────────────────────────────────────────

describe('parseAnniversaries', () => {
  it('parse une table d\'anniversaires complète', () => {
    const content = `# Anniversaires

| Nom | Date | Année | Catégorie | Contact ID | Notes |
|-----|------|-------|-----------|------------|-------|
| Lucas | 03-15 | 2020 | famille |  | Mon fils |
| Emma | 07-22 | 2018 | famille | abc123 | Ma fille |
`;
    const items = parseAnniversaries(content);
    expect(items).toHaveLength(2);
    expect(items[0].name).toBe('Lucas');
    expect(items[0].date).toBe('03-15');
    expect(items[0].birthYear).toBe(2020);
    expect(items[0].category).toBe('famille');
    expect(items[0].notes).toBe('Mon fils');
    expect(items[1].contactId).toBe('abc123');
  });

  it('gère les colonnes année vides (pas d\'année de naissance)', () => {
    const content = `| Nom | Date | Année | Catégorie | Contact ID | Notes |
|-----|------|-------|-----------|------------|-------|
| Collègue | 11-05 |  | collègue |  |  |
`;
    const items = parseAnniversaries(content);
    expect(items).toHaveLength(1);
    expect(items[0].name).toBe('Collègue');
    expect(items[0].birthYear).toBeUndefined();
  });

  it('ignore les en-têtes et séparateurs', () => {
    const content = `| Nom | Date | Année | Catégorie | Contact ID | Notes |
|-----|------|-------|-----------|------------|-------|
`;
    const items = parseAnniversaries(content);
    expect(items).toEqual([]);
  });

  it('retourne un tableau vide pour un contenu vide', () => {
    expect(parseAnniversaries('')).toEqual([]);
    expect(parseAnniversaries('   ')).toEqual([]);
  });

  it('ignore les lignes sans nom', () => {
    const content = `| Nom | Date | Année | Catégorie | Contact ID | Notes |
|-----|------|-------|-----------|------------|-------|
|  | 03-15 | 2020 | famille |  |  |
| Valide | 05-10 | 1990 | ami |  |  |
`;
    const items = parseAnniversaries(content);
    expect(items).toHaveLength(1);
    expect(items[0].name).toBe('Valide');
  });

  it('ignore les lignes avec format de date invalide', () => {
    const content = `| Nom | Date | Année | Catégorie | Contact ID | Notes |
|-----|------|-------|-----------|------------|-------|
| Mauvais | 2026-03-15 |  |  |  |  |
| Bon | 03-15 |  |  |  |  |
`;
    const items = parseAnniversaries(content);
    expect(items).toHaveLength(1);
    expect(items[0].name).toBe('Bon');
  });

  it('gère les colonnes optionnelles manquantes', () => {
    const content = `| Nom | Date | Année | Catégorie | Contact ID | Notes |
|-----|------|-------|-----------|------------|-------|
| Simple | 12-25 |  |  |  |  |
`;
    const items = parseAnniversaries(content);
    expect(items).toHaveLength(1);
    expect(items[0].category).toBeUndefined();
    expect(items[0].contactId).toBeUndefined();
    expect(items[0].notes).toBeUndefined();
  });

  it('ignore les lignes non-table', () => {
    const content = `# Anniversaires

Texte normal ici
- Pas une table

| Nom | Date | Année | Catégorie | Contact ID | Notes |
|-----|------|-------|-----------|------------|-------|
| Test | 01-01 | 2000 |  |  |  |
`;
    const items = parseAnniversaries(content);
    expect(items).toHaveLength(1);
  });
});

// ─── parseNightFeeds ─────────────────────────────────────────────────────────

describe('parseNightFeeds', () => {
  it('parse des tétées avec côté et durée', () => {
    const content = `## Alimentation
| Heure | Type | Détail (ml) | Notes |
| ----- | ---- | ----------- | ----- |
| 01:15 | Tétée | Gauche — 12 min |  |
| 03:30 | Tétée | Droite — 15 min | Agité |
`;
    const entries = parseNightFeeds(content, 'Lucas', 'lucas');
    expect(entries).toHaveLength(2);
    expect(entries[0].type).toBe('allaitement');
    expect(entries[0].side).toBe('gauche');
    expect(entries[0].durationSeconds).toBe(720); // 12 * 60
    expect(entries[0].startedAt).toBe('01:15');
    expect(entries[0].enfant).toBe('Lucas');
    expect(entries[0].enfantId).toBe('lucas');
    expect(entries[1].side).toBe('droite');
    expect(entries[1].note).toBe('Agité');
  });

  it('parse des biberons avec volume et durée', () => {
    const content = `## Alimentation
| Heure | Type | Détail (ml) | Notes |
| ----- | ---- | ----------- | ----- |
| 02:00 | Biberon | 120 ml — 8 min |  |
`;
    const entries = parseNightFeeds(content, 'Lucas', 'lucas');
    expect(entries).toHaveLength(1);
    expect(entries[0].type).toBe('biberon');
    expect(entries[0].volumeMl).toBe(120);
    expect(entries[0].durationSeconds).toBe(480); // 8 * 60
    expect(entries[0].side).toBeUndefined();
  });

  it('ignore les en-têtes et séparateurs de table', () => {
    const content = `## Alimentation
| Heure | Type | Détail (ml) | Notes |
| ----- | ---- | ----------- | ----- |
`;
    const entries = parseNightFeeds(content);
    expect(entries).toEqual([]);
  });

  it('ignore les types non Tétée/Biberon', () => {
    const content = `## Alimentation
| Heure | Type | Détail (ml) | Notes |
| ----- | ---- | ----------- | ----- |
| 08:00 | Compote | Pomme — 50g |  |
| 09:00 | Tétée | Gauche — 10 min |  |
`;
    const entries = parseNightFeeds(content);
    expect(entries).toHaveLength(1);
    expect(entries[0].type).toBe('allaitement');
  });

  it('s\'arrête à la section suivante', () => {
    const content = `## Alimentation
| Heure | Type | Détail (ml) | Notes |
| ----- | ---- | ----------- | ----- |
| 01:15 | Tétée | Gauche — 12 min |  |

## Couches
| Heure | Type | Notes |
| ----- | ---- | ----- |
| 02:00 | Mouillée |  |
`;
    const entries = parseNightFeeds(content);
    expect(entries).toHaveLength(1);
  });

  it('gère les notes vides (pas de note)', () => {
    const content = `## Alimentation
| Heure | Type | Détail (ml) | Notes |
| ----- | ---- | ----------- | ----- |
| 01:15 | Tétée | Gauche — 12 min |  |
`;
    const entries = parseNightFeeds(content);
    expect(entries).toHaveLength(1);
    expect(entries[0].note).toBeUndefined();
  });

  it('retourne un tableau vide sans section Alimentation', () => {
    const content = `## Sommeil
| Début | Fin | Durée | Notes |
| ----- | --- | ----- | ----- |
`;
    const entries = parseNightFeeds(content);
    expect(entries).toEqual([]);
  });

  it('génère un id basé sur l\'heure', () => {
    const content = `## Alimentation
| Heure | Type | Détail (ml) | Notes |
| ----- | ---- | ----------- | ----- |
| 03:30 | Biberon | 90 ml — 5 min |  |
`;
    const entries = parseNightFeeds(content);
    expect(entries[0].id).toBe('feed-03:30');
  });
});

// ─── parseMoods ──────────────────────────────────────────────────────────────

describe('parseMoods', () => {
  it('parse le format 5 colonnes (Date | ID | Profil | Humeur | Note)', () => {
    const content = `# Météo des humeurs

| Date | ID | Profil | Humeur | Note |
| --- | --- | --- | --- | --- |
| 21/03/2026 | lucas | Lucas | 4 | Bonne journée |
| 21/03/2026 | emma | Emma | 3 |  |
`;
    const entries = parseMoods(content);
    expect(entries).toHaveLength(2);
    // Trié par date desc puis profileName asc → Emma avant Lucas (même date)
    const lucas = entries.find(e => e.profileId === 'lucas')!;
    const emma = entries.find(e => e.profileId === 'emma')!;
    expect(lucas.date).toBe('2026-03-21');
    expect(lucas.profileName).toBe('Lucas');
    expect(lucas.level).toBe(4);
    expect(lucas.note).toBe('Bonne journée');
    expect(emma.profileName).toBe('Emma');
    expect(emma.level).toBe(3);
  });

  it('gère les notes manquantes', () => {
    const content = `| Date | ID | Profil | Humeur | Note |
| --- | --- | --- | --- | --- |
| 21/03/2026 | lucas | Lucas | 5 |  |
`;
    const entries = parseMoods(content);
    expect(entries).toHaveLength(1);
    expect(entries[0].note).toBeUndefined();
  });

  it('ignore les niveaux d\'humeur invalides', () => {
    const content = `| Date | ID | Profil | Humeur | Note |
| --- | --- | --- | --- | --- |
| 21/03/2026 | lucas | Lucas | 0 | Trop bas |
| 21/03/2026 | emma | Emma | 6 | Trop haut |
| 21/03/2026 | papa | Papa | abc | NaN |
| 21/03/2026 | maman | Maman | 3 | OK |
`;
    const entries = parseMoods(content);
    expect(entries).toHaveLength(1);
    expect(entries[0].profileName).toBe('Maman');
  });

  it('trie par date descendante puis profil ascendant', () => {
    const content = `| Date | ID | Profil | Humeur | Note |
| --- | --- | --- | --- | --- |
| 20/03/2026 | lucas | Lucas | 4 |  |
| 21/03/2026 | emma | Emma | 3 |  |
| 21/03/2026 | alice | Alice | 5 |  |
`;
    const entries = parseMoods(content);
    expect(entries).toHaveLength(3);
    // 21/03 avant 20/03, et Alice avant Emma le même jour
    expect(entries[0].profileName).toBe('Alice');
    expect(entries[1].profileName).toBe('Emma');
    expect(entries[2].profileName).toBe('Lucas');
  });

  it('convertit la date DD/MM/YYYY en YYYY-MM-DD', () => {
    const content = `| Date | ID | Profil | Humeur | Note |
| --- | --- | --- | --- | --- |
| 15/01/2026 | test | Test | 3 |  |
`;
    const entries = parseMoods(content);
    expect(entries[0].date).toBe('2026-01-15');
  });

  it('retourne un tableau vide pour un contenu sans table', () => {
    const content = `# Météo des humeurs

Pas encore d'entrées.
`;
    const entries = parseMoods(content);
    expect(entries).toEqual([]);
  });

  it('ignore les lignes après la fin de la table', () => {
    const content = `| Date | ID | Profil | Humeur | Note |
| --- | --- | --- | --- | --- |
| 21/03/2026 | lucas | Lucas | 4 |  |

Texte en dehors de la table
| 22/03/2026 | emma | Emma | 3 |  |
`;
    const entries = parseMoods(content);
    // La seconde ligne est après une ligne non-table, donc inTable = false
    expect(entries).toHaveLength(1);
  });

  it('utilise le sourceFile par défaut', () => {
    const content = `| Date | ID | Profil | Humeur | Note |
| --- | --- | --- | --- | --- |
| 21/03/2026 | lucas | Lucas | 4 |  |
`;
    const entries = parseMoods(content);
    expect(entries[0].sourceFile).toBe('05 - Famille/Humeurs.md');
  });

  it('accepte un sourceFile personnalisé', () => {
    const content = `| Date | ID | Profil | Humeur | Note |
| --- | --- | --- | --- | --- |
| 21/03/2026 | lucas | Lucas | 4 |  |
`;
    const entries = parseMoods(content, 'custom.md');
    expect(entries[0].sourceFile).toBe('custom.md');
  });
});

// ─── parseQuotes ─────────────────────────────────────────────────────────────

describe('parseQuotes', () => {
  it('parse une table de mots d\'enfants', () => {
    const content = `# Mots d'enfants

| Date | Enfant | Citation | Contexte |
| --- | --- | --- | --- |
| 21/03/2026 | Lucas | Maman, les nuages c'est du coton ! | Au parc |
| 20/03/2026 | Emma | Je veux être un chat quand je serai grande | Avant de dormir |
`;
    const quotes = parseQuotes(content);
    expect(quotes).toHaveLength(2);
    expect(quotes[0].date).toBe('2026-03-21');
    expect(quotes[0].enfant).toBe('Lucas');
    expect(quotes[0].citation).toBe('Maman, les nuages c\'est du coton !');
    expect(quotes[0].contexte).toBe('Au parc');
  });

  it('gère les contextes vides', () => {
    const content = `| Date | Enfant | Citation | Contexte |
| --- | --- | --- | --- |
| 21/03/2026 | Lucas | Belle phrase |  |
`;
    const quotes = parseQuotes(content);
    expect(quotes).toHaveLength(1);
    expect(quotes[0].contexte).toBeUndefined();
  });

  it('ignore les lignes sans enfant ou citation', () => {
    const content = `| Date | Enfant | Citation | Contexte |
| --- | --- | --- | --- |
| 21/03/2026 |  | Citation orpheline |  |
| 21/03/2026 | Lucas |  |  |
| 21/03/2026 | Emma | Valide | Contexte |
`;
    const quotes = parseQuotes(content);
    expect(quotes).toHaveLength(1);
    expect(quotes[0].enfant).toBe('Emma');
  });

  it('trie par date descendante', () => {
    const content = `| Date | Enfant | Citation | Contexte |
| --- | --- | --- | --- |
| 15/03/2026 | Lucas | Ancien |  |
| 21/03/2026 | Emma | Récent |  |
`;
    const quotes = parseQuotes(content);
    expect(quotes[0].citation).toBe('Récent');
    expect(quotes[1].citation).toBe('Ancien');
  });

  it('convertit la date DD/MM/YYYY en YYYY-MM-DD', () => {
    const content = `| Date | Enfant | Citation | Contexte |
| --- | --- | --- | --- |
| 05/01/2026 | Lucas | Test |  |
`;
    const quotes = parseQuotes(content);
    expect(quotes[0].date).toBe('2026-01-05');
  });

  it('retourne un tableau vide pour un contenu vide', () => {
    const quotes = parseQuotes('# Mots d\'enfants\n\nPas encore de perles.');
    expect(quotes).toEqual([]);
  });

  it('ignore les lignes après la fin de la table', () => {
    const content = `| Date | Enfant | Citation | Contexte |
| --- | --- | --- | --- |
| 21/03/2026 | Lucas | Mot 1 |  |

Texte hors table
| 22/03/2026 | Emma | Mot 2 |  |
`;
    const quotes = parseQuotes(content);
    expect(quotes).toHaveLength(1);
  });

  it('conserve le lineIndex correct', () => {
    const content = `# Titre

| Date | Enfant | Citation | Contexte |
| --- | --- | --- | --- |
| 21/03/2026 | Lucas | Mot |  |
`;
    const quotes = parseQuotes(content);
    expect(quotes[0].lineIndex).toBe(4);
  });
});

// ─── parseGratitude ──────────────────────────────────────────────────────────

describe('parseGratitude', () => {
  it('parse un fichier de gratitude avec entrées', () => {
    const content = `---
tags:
  - gratitude
---

# Livre d'or familial

## 21/03/2026

### 🙏 Papa
Merci à maman pour le super dîner

### 🙏 Lucas
Merci pour la sortie au parc
`;
    const days = parseGratitude(content);
    expect(days).toHaveLength(1);
    expect(days[0].date).toBe('2026-03-21');
    expect(days[0].entries).toHaveLength(2);
    expect(days[0].entries[0].profileName).toBe('Papa');
    expect(days[0].entries[0].text).toBe('Merci à maman pour le super dîner');
    expect(days[0].entries[1].profileName).toBe('Lucas');
  });

  it('génère un profileId normalisé (sans accents, lowercase)', () => {
    const content = `## 21/03/2026

### 🙏 Père Noël
Merci pour les cadeaux
`;
    const days = parseGratitude(content);
    expect(days[0].entries[0].profileId).toBe('pere-noel');
  });

  it('gère plusieurs jours', () => {
    const content = `## 21/03/2026

### 🙏 Papa
Gratitude 1

---

## 20/03/2026

### 🙏 Maman
Gratitude 2
`;
    const days = parseGratitude(content);
    expect(days).toHaveLength(2);
    // Tri desc par date
    expect(days[0].date).toBe('2026-03-21');
    expect(days[1].date).toBe('2026-03-20');
  });

  it('gère les entrées avec texte vide (le fix ?.trim())', () => {
    const content = `## 21/03/2026

### 🙏 Papa

`;
    const days = parseGratitude(content);
    expect(days).toHaveLength(1);
    expect(days[0].entries[0].profileName).toBe('Papa');
    expect(days[0].entries[0].text).toBe('');
  });

  it('retourne un tableau vide pour un contenu sans dates', () => {
    const content = `# Livre d'or familial

Pas encore de gratitude.
`;
    const days = parseGratitude(content);
    expect(days).toEqual([]);
  });

  it('ignore les blocs sans format de date DD/MM/YYYY', () => {
    const content = `## Titre sans date

### 🙏 Papa
Texte

## 21/03/2026

### 🙏 Maman
Vrai
`;
    const days = parseGratitude(content);
    expect(days).toHaveLength(1);
    expect(days[0].date).toBe('2026-03-21');
  });

  it('ignore les --- séparateurs dans le texte', () => {
    const content = `## 21/03/2026

### 🙏 Papa
Merci
---
`;
    const days = parseGratitude(content);
    expect(days[0].entries[0].text).toBe('Merci');
  });

  it('skip les entrées sans profileName', () => {
    const content = `## 21/03/2026

### 🙏
Texte orphelin

### 🙏 Papa
Vrai texte
`;
    const days = parseGratitude(content);
    // L'entrée sans nom devrait être ignorée
    expect(days[0].entries).toHaveLength(1);
    expect(days[0].entries[0].profileName).toBe('Papa');
  });
});

// ─── parseDateInput (cas supplémentaires) ────────────────────────────────────

describe('parseDateInput — cas étendus', () => {
  it('accepte 31/01/2026 (31 jours en janvier)', () => {
    expect(parseDateInput('31/01/2026')).toBe('2026-01-31');
  });

  it('accepte le jour 31 même pour des mois de 30 jours (pas de validation calendaire stricte)', () => {
    // Le parser valide seulement 1-31 pour le jour et 1-12 pour le mois
    // Il n'a pas de validation calendaire complète (31/02 passe comme 2026-02-31)
    const result = parseDateInput('31/02/2026');
    // Le parser autorise car d <= 31 et mo <= 12
    expect(result).toBe('2026-02-31');
  });

  it('rejette le jour 0', () => {
    expect(parseDateInput('00/03/2026')).toBeNull();
  });

  it('rejette le mois 0', () => {
    expect(parseDateInput('15/00/2026')).toBeNull();
  });

  it('rejette le mois 13', () => {
    expect(parseDateInput('15/13/2026')).toBeNull();
  });

  it('gère les espaces autour', () => {
    expect(parseDateInput('  19/03/2026  ')).toBe('2026-03-19');
  });

  it('rejette un format partiel', () => {
    expect(parseDateInput('19/03')).toBeNull();
    expect(parseDateInput('2026')).toBeNull();
  });

  it('rejette les caractères non numériques', () => {
    expect(parseDateInput('ab/cd/efgh')).toBeNull();
  });
});

// ─── formatDateForDisplay (cas supplémentaires) ──────────────────────────────

describe('formatDateForDisplay — cas étendus', () => {
  it('convertit le premier janvier', () => {
    expect(formatDateForDisplay('2026-01-01')).toBe('01/01/2026');
  });

  it('convertit le 31 décembre', () => {
    expect(formatDateForDisplay('2026-12-31')).toBe('31/12/2026');
  });

  it('retourne une date déjà en DD/MM/YYYY telle quelle', () => {
    expect(formatDateForDisplay('19/03/2026')).toBe('19/03/2026');
  });

  it('gère undefined sans crash (via chaîne vide)', () => {
    expect(formatDateForDisplay('')).toBe('');
  });
});

// ─── isRdvUpcoming ───────────────────────────────────────────────────────────

describe('isRdvUpcoming', () => {
  it('retourne true pour un RDV dans le futur', () => {
    expect(isRdvUpcoming({
      date_rdv: '2099-12-31',
      heure: '10:00',
      statut: 'planifié',
    })).toBe(true);
  });

  it('retourne false pour un RDV passé', () => {
    expect(isRdvUpcoming({
      date_rdv: '2020-01-01',
      heure: '10:00',
      statut: 'planifié',
    })).toBe(false);
  });

  it('retourne false si le statut n\'est pas planifié', () => {
    expect(isRdvUpcoming({
      date_rdv: '2099-12-31',
      heure: '10:00',
      statut: 'fait',
    })).toBe(false);

    expect(isRdvUpcoming({
      date_rdv: '2099-12-31',
      heure: '10:00',
      statut: 'annulé',
    })).toBe(false);
  });

  it('retourne true pour un RDV aujourd\'hui sans heure', () => {
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    expect(isRdvUpcoming({
      date_rdv: todayStr,
      statut: 'planifié',
    })).toBe(true);
  });

  it('retourne true pour un RDV aujourd\'hui avec heure future (23:59)', () => {
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    expect(isRdvUpcoming({
      date_rdv: todayStr,
      heure: '23:59',
      statut: 'planifié',
    })).toBe(true);
  });

  it('retourne false pour un RDV aujourd\'hui avec heure passée (00:00)', () => {
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    // 00:00 est toujours dans le passé sauf si on est à exactement minuit
    const result = isRdvUpcoming({
      date_rdv: todayStr,
      heure: '00:00',
      statut: 'planifié',
    });
    // À moins qu'il soit exactement minuit, 00:00 est dans le passé
    if (now.getHours() === 0 && now.getMinutes() === 0) {
      expect(result).toBe(false); // rdvMinutes (0) n'est pas > nowMinutes (0)
    } else {
      expect(result).toBe(false);
    }
  });

  it('retourne true avec heure invalide (considéré upcoming)', () => {
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    expect(isRdvUpcoming({
      date_rdv: todayStr,
      heure: 'invalid',
      statut: 'planifié',
    })).toBe(true);
  });
});
