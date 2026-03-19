/**
 * Tests unitaires — parser.ts
 *
 * Couvre les fonctions critiques de parsing/sérialisation du vault markdown.
 */

import {
  parseTask,
  parseTaskFile,
  parseFrontmatter,
  parseRDV,
  serializeRDV,
  parseCourses,
  parseStock,
  serializeStockRow,
  formatDateForDisplay,
  parseDateInput,
} from '../parser';

// ─── parseTask ───────────────────────────────────────────────────────────────

describe('parseTask', () => {
  it('parse une tâche non cochée avec texte simple', () => {
    const task = parseTask('- [ ] Faire les courses', 0, 'tasks.md');
    expect(task).not.toBeNull();
    expect(task!.text).toBe('Faire les courses');
    expect(task!.completed).toBe(false);
    expect(task!.lineIndex).toBe(0);
    expect(task!.sourceFile).toBe('tasks.md');
  });

  it('parse une tâche cochée', () => {
    const task = parseTask('- [x] Ranger la chambre', 5, 'tasks.md');
    expect(task).not.toBeNull();
    expect(task!.completed).toBe(true);
    expect(task!.text).toBe('Ranger la chambre');
  });

  it('parse une tâche cochée en majuscule [X]', () => {
    const task = parseTask('- [X] Tâche faite', 0, 'tasks.md');
    expect(task).not.toBeNull();
    expect(task!.completed).toBe(true);
  });

  it('extrait les tags #tag', () => {
    const task = parseTask('- [ ] Faire les courses @lucas #urgent #maison', 0, 'tasks.md');
    expect(task).not.toBeNull();
    expect(task!.tags).toEqual(['urgent', 'maison']);
  });

  it('extrait les mentions @user', () => {
    const task = parseTask('- [ ] Faire les courses @lucas @emma', 0, 'tasks.md');
    expect(task).not.toBeNull();
    expect(task!.mentions).toEqual(['lucas', 'emma']);
  });

  it('extrait la date due 📅', () => {
    const task = parseTask('- [ ] RDV médecin 📅 2026-03-20', 0, 'tasks.md');
    expect(task).not.toBeNull();
    expect(task!.dueDate).toBe('2026-03-20');
    // Le texte ne doit pas contenir la date emoji
    expect(task!.text).not.toContain('📅');
    expect(task!.text).not.toContain('2026-03-20');
  });

  it('extrait la récurrence 🔁', () => {
    const task = parseTask('- [x] Sortir poubelles 🔁 every week', 0, 'tasks.md');
    expect(task).not.toBeNull();
    expect(task!.recurrence).toBe('every week');
    expect(task!.text).not.toContain('🔁');
  });

  it('extrait la date complétée ✅', () => {
    const task = parseTask('- [x] Ménage ✅ 2026-03-15', 0, 'tasks.md');
    expect(task).not.toBeNull();
    expect(task!.completedDate).toBe('2026-03-15');
  });

  it('gère une tâche avec tous les attributs', () => {
    const task = parseTask(
      '- [x] Nettoyer @emma #ménage 📅 2026-03-18 🔁 every day ✅ 2026-03-18',
      3,
      'taches.md',
      'Quotidien'
    );
    expect(task).not.toBeNull();
    expect(task!.completed).toBe(true);
    expect(task!.dueDate).toBe('2026-03-18');
    expect(task!.recurrence).toBe('every day');
    expect(task!.completedDate).toBe('2026-03-18');
    expect(task!.tags).toEqual(['ménage']);
    expect(task!.mentions).toEqual(['emma']);
    expect(task!.section).toBe('Quotidien');
  });

  it('retourne null pour une ligne vide', () => {
    expect(parseTask('', 0, 'tasks.md')).toBeNull();
  });

  it('retourne null pour une ligne non-tâche', () => {
    expect(parseTask('## Section', 0, 'tasks.md')).toBeNull();
    expect(parseTask('Texte normal', 0, 'tasks.md')).toBeNull();
    expect(parseTask('- Pas de checkbox', 0, 'tasks.md')).toBeNull();
  });

  it('génère un id basé sur sourceFile et lineIndex', () => {
    const task = parseTask('- [ ] Test', 42, 'path/to/file.md');
    expect(task!.id).toBe('path/to/file.md:42');
  });

  it('gère une tâche indentée', () => {
    const task = parseTask('  - [ ] Sous-tâche indentée', 0, 'tasks.md');
    expect(task).not.toBeNull();
    expect(task!.text).toBe('Sous-tâche indentée');
  });

  it('gère les accents dans les tags et mentions', () => {
    const task = parseTask('- [ ] Tâche @père-noël #félicité', 0, 'tasks.md');
    expect(task).not.toBeNull();
    expect(task!.mentions).toEqual(['père-noël']);
    expect(task!.tags).toEqual(['félicité']);
  });
});

// ─── parseTaskFile ───────────────────────────────────────────────────────────

describe('parseTaskFile', () => {
  it('parse un fichier avec sections et tâches', () => {
    const content = `# Tâches

## Quotidien
- [ ] Faire le lit
- [x] Préparer le petit-déj

## Courses
- [ ] Acheter du pain
`;
    const tasks = parseTaskFile('taches.md', content);
    expect(tasks).toHaveLength(3);
    expect(tasks[0].section).toBe('Quotidien');
    expect(tasks[0].text).toBe('Faire le lit');
    expect(tasks[1].section).toBe('Quotidien');
    expect(tasks[1].completed).toBe(true);
    expect(tasks[2].section).toBe('Courses');
  });

  it('retourne un tableau vide pour un fichier sans tâches', () => {
    const tasks = parseTaskFile('notes.md', '# Notes\n\nBlabla.');
    expect(tasks).toEqual([]);
  });
});

// ─── parseFrontmatter (manualParseFrontmatter) ──────────────────────────────

describe('parseFrontmatter', () => {
  it('parse un frontmatter simple', () => {
    const content = `---
date_rdv: "2026-03-19"
heure: "10:30"
type_rdv: pédiatre
---
Corps du document`;
    const { data, content: body } = parseFrontmatter(content);
    expect(data.date_rdv).toBe('2026-03-19');
    expect(data.heure).toBe('10:30');
    expect(data.type_rdv).toBe('pédiatre');
    expect(body).toContain('Corps du document');
  });

  it('parse des clés avec accents (médecin)', () => {
    const content = `---
médecin: Dr Dupont
lieu: Cabinet
---
`;
    const { data } = parseFrontmatter(content);
    // gray-matter ou manual parser — les deux doivent fonctionner
    expect(data['médecin'] || data.médecin).toBeTruthy();
  });

  it('parse des valeurs entre guillemets', () => {
    const content = `---
title: "Mon titre"
date: '2026-03-19'
---
`;
    const { data } = parseFrontmatter(content);
    expect(data.title).toBe('Mon titre');
  });

  it('retourne un objet vide si pas de frontmatter', () => {
    const { data, content: body } = parseFrontmatter('Pas de frontmatter ici.');
    expect(Object.keys(data)).toHaveLength(0);
    expect(body).toContain('Pas de frontmatter');
  });

  it('parse même avec un seul --- (pas de fermeture)', () => {
    const { data } = parseFrontmatter('---\nkey: value');
    // Le parser accepte le frontmatter sans --- de fermeture
    expect(data.key).toBe('value');
  });
});

// ─── parseRDV ────────────────────────────────────────────────────────────────

describe('parseRDV', () => {
  const rdvContent = `---
date_rdv: "2026-04-15"
heure: "14:30"
type_rdv: pédiatre
enfant: Lucas
médecin: Dr Martin
lieu: Cabinet Santé
statut: planifié
---

# Rendez-vous — 15/04/2026 pédiatre Lucas

## Questions à poser

- Vaccins à jour ?
- Poids normal ?

## Réponses du médecin

Tout va bien, croissance normale.
`;

  it('parse un fichier RDV complet', () => {
    const rdv = parseRDV('04 - RDV/2026-04-15 pédiatre Lucas.md', rdvContent);
    expect(rdv).not.toBeNull();
    expect(rdv!.date_rdv).toBe('2026-04-15');
    expect(rdv!.heure).toBe('14:30');
    expect(rdv!.type_rdv).toBe('pédiatre');
    expect(rdv!.enfant).toBe('Lucas');
    expect(rdv!.médecin).toBe('Dr Martin');
    expect(rdv!.lieu).toBe('Cabinet Santé');
    expect(rdv!.statut).toBe('planifié');
  });

  it('extrait les questions', () => {
    const rdv = parseRDV('rdv.md', rdvContent);
    expect(rdv!.questions).toBeDefined();
    expect(rdv!.questions).toHaveLength(2);
    expect(rdv!.questions![0]).toBe('Vaccins à jour ?');
    expect(rdv!.questions![1]).toBe('Poids normal ?');
  });

  it('extrait les réponses', () => {
    const rdv = parseRDV('rdv.md', rdvContent);
    expect(rdv!.reponses).toContain('Tout va bien');
  });

  it('retourne null sans date_rdv', () => {
    const content = `---
type_rdv: pédiatre
---
`;
    expect(parseRDV('rdv.md', content)).toBeNull();
  });

  it('parse un fichier sans frontmatter → null', () => {
    expect(parseRDV('rdv.md', 'Pas de frontmatter')).toBeNull();
  });

  it('extrait le titre depuis le nom de fichier', () => {
    const rdv = parseRDV('rdv/2026-04-15 vaccin Emma.md', rdvContent);
    expect(rdv!.title).toBe('2026-04-15 vaccin Emma');
  });
});

// ─── serializeRDV round-trip ─────────────────────────────────────────────────

describe('serializeRDV', () => {
  it('sérialise un RDV en markdown avec frontmatter', () => {
    const rdv = {
      date_rdv: '2026-05-10',
      heure: '09:00',
      type_rdv: 'vaccin',
      enfant: 'Emma',
      médecin: 'Dr Dupont',
      lieu: 'PMI Centre',
      statut: 'planifié' as const,
      questions: ['Effets secondaires ?'],
      reponses: '',
    };

    const md = serializeRDV(rdv);
    expect(md).toContain('date_rdv: "2026-05-10"');
    expect(md).toContain('heure: "09:00"');
    expect(md).toContain('type_rdv: vaccin');
    expect(md).toContain('enfant: Emma');
    expect(md).toContain('médecin: Dr Dupont');
    expect(md).toContain('statut: planifié');
    expect(md).toContain('## Questions à poser');
    expect(md).toContain('- Effets secondaires ?');
    expect(md).toContain('## Réponses du médecin');
  });

  it('round-trip : serializeRDV → parseRDV préserve les données', () => {
    const original = {
      date_rdv: '2026-06-01',
      heure: '16:00',
      type_rdv: 'dentiste',
      enfant: 'Lucas',
      médecin: 'Dr Blanc',
      lieu: 'Clinique',
      statut: 'planifié' as const,
      questions: ['Carie ?', 'Brossage OK ?'],
      reponses: 'RAS',
    };

    const md = serializeRDV(original);
    const parsed = parseRDV('test.md', md);

    expect(parsed).not.toBeNull();
    expect(parsed!.date_rdv).toBe(original.date_rdv);
    expect(parsed!.heure).toBe(original.heure);
    expect(parsed!.type_rdv).toBe(original.type_rdv);
    expect(parsed!.enfant).toBe(original.enfant);
    expect(parsed!.statut).toBe(original.statut);
    expect(parsed!.questions).toEqual(original.questions);
    expect(parsed!.reponses).toBe(original.reponses);
  });
});

// ─── parseCourses ────────────────────────────────────────────────────────────

describe('parseCourses', () => {
  it('parse une liste de courses simple', () => {
    const content = `# Liste de courses

## À acheter
- [ ] Pain
- [ ] Lait
- [x] Beurre
`;
    const items = parseCourses(content, 'courses.md');
    expect(items).toHaveLength(3);
    expect(items[0].text).toBe('Pain');
    expect(items[0].completed).toBe(false);
    expect(items[1].text).toBe('Lait');
    expect(items[2].text).toBe('Beurre');
    expect(items[2].completed).toBe(true);
  });

  it('associe les sections aux items', () => {
    const content = `## 🥩 Frais
- [ ] Poulet
- [ ] Saumon

## 🥬 Légumes
- [ ] Carottes
`;
    const items = parseCourses(content, 'courses.md');
    expect(items).toHaveLength(3);
    expect(items[0].section).toBe('🥩 Frais');
    expect(items[1].section).toBe('🥩 Frais');
    expect(items[2].section).toBe('🥬 Légumes');
  });

  it('gère les accents et caractères spéciaux', () => {
    const content = `## Épicerie
- [ ] Pâtes à la crème
- [ ] Café décaféiné
- [x] Bœuf haché
`;
    const items = parseCourses(content, 'courses.md');
    expect(items).toHaveLength(3);
    expect(items[0].text).toBe('Pâtes à la crème');
    expect(items[1].text).toBe('Café décaféiné');
    expect(items[2].text).toBe('Bœuf haché');
  });

  it('ignore les lignes non-checkbox', () => {
    const content = `## Section
Texte normal
- Pas de checkbox
- [ ] Seul item valide
`;
    const items = parseCourses(content, 'courses.md');
    expect(items).toHaveLength(1);
    expect(items[0].text).toBe('Seul item valide');
  });

  it('ignore les items avec texte vide', () => {
    const content = `- [ ]
- [ ] Item réel
`;
    const items = parseCourses(content, 'courses.md');
    expect(items).toHaveLength(1);
    expect(items[0].text).toBe('Item réel');
  });

  it('génère un id avec sourceFile et lineIndex', () => {
    const content = `- [ ] Pain`;
    const items = parseCourses(content, 'liste.md');
    expect(items[0].id).toBe('liste.md:0');
    expect(items[0].lineIndex).toBe(0);
  });
});

// ─── parseStock ──────────────────────────────────────────────────────────────

describe('parseStock', () => {
  it('parse une table de stock standard', () => {
    const content = `## Frigo
| Produit | Détail | Qté | Seuil | Qté achat |
| --- | --- | --- | --- | --- |
| Lait | demi-écrémé | 3 | 2 | 6 |
| Beurre | doux | 1 | 1 | 2 |
`;
    const items = parseStock(content);
    expect(items).toHaveLength(2);
    expect(items[0].produit).toBe('Lait');
    expect(items[0].detail).toBe('demi-écrémé');
    expect(items[0].quantite).toBe(3);
    expect(items[0].seuil).toBe(2);
    expect(items[0].qteAchat).toBe(6);
    expect(items[0].emplacement).toBe('frigo');
  });

  it('utilise split("|").map(trim).filter(length > 0) — pas d\'index décalés', () => {
    // La ligne commence et finit par | → le split naïf donne des cellules vides
    // Le parser doit correctement ignorer les cellules vides de début/fin
    const content = `## Frigo
| Produit | Détail | Qté | Seuil | Qté achat |
| --- | --- | --- | --- | --- |
| Yaourt | nature | 5 | 3 | 6 |
`;
    const items = parseStock(content);
    expect(items).toHaveLength(1);
    expect(items[0].produit).toBe('Yaourt');
    expect(items[0].detail).toBe('nature');
    expect(items[0].quantite).toBe(5);
    expect(items[0].seuil).toBe(3);
    expect(items[0].qteAchat).toBe(6);
  });

  it('gère les cellules avec détail rempli', () => {
    const content = `## Placards
| Produit | Détail | Qté | Seuil | Qté achat |
| --- | --- | --- | --- | --- |
| Riz | basmati | 2 | 1 | 3 |
`;
    const items = parseStock(content);
    expect(items).toHaveLength(1);
    expect(items[0].produit).toBe('Riz');
    expect(items[0].detail).toBe('basmati');
    expect(items[0].quantite).toBe(2);
    expect(items[0].seuil).toBe(1);
    expect(items[0].qteAchat).toBe(3);
  });

  it('associe le bon emplacement selon le header ##', () => {
    const content = `## Frigo
| Produit | Détail | Qté | Seuil | Qté achat |
| --- | --- | --- | --- | --- |
| Lait | demi-écrémé | 3 | 2 | 1 |

## Congélateur
| Produit | Détail | Qté | Seuil | Qté achat |
| --- | --- | --- | --- | --- |
| Glace | vanille | 1 | 1 | 1 |

## Placards — Épicerie
| Produit | Détail | Qté | Seuil | Qté achat |
| --- | --- | --- | --- | --- |
| Pâtes | penne | 4 | 2 | 1 |
`;
    const items = parseStock(content);
    expect(items).toHaveLength(3);
    expect(items[0].emplacement).toBe('frigo');
    expect(items[1].emplacement).toBe('congelateur');
    expect(items[2].emplacement).toBe('placards');
    expect(items[2].section).toBe('Épicerie');
  });

  it('ignore les lignes d\'en-tête et de séparation', () => {
    const content = `## Frigo
| Produit | Détail | Qté | Seuil | Qté achat |
| --- | --- | --- | --- | --- |
| Fromage | comté | 1 | 1 | 1 |
`;
    const items = parseStock(content);
    expect(items).toHaveLength(1);
    expect(items[0].produit).toBe('Fromage');
  });

  it('ignore les lignes avec quantité non numérique', () => {
    const content = `## Frigo
| Produit | Détail | Qté | Seuil | Qté achat |
| --- | --- | --- | --- | --- |
| Test | info | abc | 2 | 1 |
| Bon | frais | 3 | 2 | 1 |
`;
    const items = parseStock(content);
    expect(items).toHaveLength(1);
    expect(items[0].produit).toBe('Bon');
  });

  it('ignore les sections Matériel et À racheter bientôt', () => {
    const content = `## Matériel
| Produit | Détail | Qté | Seuil | Qté achat |
| --- | --- | --- | --- | --- |
| Casserole | grande | 1 | 1 | 1 |

## Frigo
| Produit | Détail | Qté | Seuil | Qté achat |
| --- | --- | --- | --- | --- |
| Lait | entier | 2 | 1 | 1 |
`;
    const items = parseStock(content);
    expect(items).toHaveLength(1);
    expect(items[0].produit).toBe('Lait');
  });

  it('gère les sections bébé legacy', () => {
    const content = `## Couches
| Produit | Détail | Qté | Seuil | Qté achat |
| --- | --- | --- | --- | --- |
| Couches T4 | Pampers | 30 | 20 | 1 |
`;
    const items = parseStock(content);
    expect(items).toHaveLength(1);
    expect(items[0].emplacement).toBe('bebe');
    expect(items[0].section).toBe('Couches');
  });
});

// ─── serializeStockRow ───────────────────────────────────────────────────────

describe('serializeStockRow', () => {
  it('sérialise une ligne de stock complète', () => {
    const row = serializeStockRow({
      produit: 'Lait',
      detail: 'demi-écrémé',
      quantite: 3,
      seuil: 2,
      qteAchat: 6,
      emplacement: 'frigo',
    });
    expect(row).toBe('| Lait | demi-écrémé | 3 | 2 | 6 |');
  });

  it('sérialise une ligne sans détail ni qteAchat', () => {
    const row = serializeStockRow({
      produit: 'Riz',
      quantite: 2,
      seuil: 1,
      emplacement: 'placards',
    });
    expect(row).toBe('| Riz |  | 2 | 1 |  |');
  });
});

// ─── formatDateForDisplay / parseDateInput ───────────────────────────────────

describe('formatDateForDisplay', () => {
  it('convertit YYYY-MM-DD en DD/MM/YYYY', () => {
    expect(formatDateForDisplay('2026-03-19')).toBe('19/03/2026');
  });

  it('retourne vide si chaîne vide', () => {
    expect(formatDateForDisplay('')).toBe('');
  });

  it('retourne la chaîne telle quelle si format inconnu', () => {
    expect(formatDateForDisplay('mars 2026')).toBe('mars 2026');
  });
});

describe('parseDateInput', () => {
  it('parse DD/MM/YYYY vers YYYY-MM-DD', () => {
    expect(parseDateInput('19/03/2026')).toBe('2026-03-19');
  });

  it('parse DD-MM-YYYY vers YYYY-MM-DD', () => {
    expect(parseDateInput('19-03-2026')).toBe('2026-03-19');
  });

  it('accepte YYYY-MM-DD directement', () => {
    expect(parseDateInput('2026-03-19')).toBe('2026-03-19');
  });

  it('retourne null pour format invalide', () => {
    expect(parseDateInput('mars 2026')).toBeNull();
    expect(parseDateInput('')).toBeNull();
  });

  it('retourne null pour jour/mois hors limites', () => {
    expect(parseDateInput('32/13/2026')).toBeNull();
    expect(parseDateInput('00/01/2026')).toBeNull();
  });
});
