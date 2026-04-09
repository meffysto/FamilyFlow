// lib/__tests__/derive.test.ts
// Tests unitaires de deriveTaskCategory — Phase 19 v1.3 Seed.
// Couvre SEMANTIC-01 (filepath), SEMANTIC-02 (section), SEMANTIC-03 (tags),
// SEMANTIC-04 (fallback null), ARCH-03 (régression zéro).

import { deriveTaskCategory } from '../semantic';
import type { Task } from '../types';

/**
 * Factory helper : construit une Task minimale pour les tests.
 * Champs optionnels non utilisés par deriveTaskCategory sont castés.
 */
function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'test:0',
    text: 'Tâche test',
    completed: false,
    tags: [],
    mentions: [],
    sourceFile: '',
    lineIndex: 0,
    ...overrides,
  } as Task;
}

describe('deriveTaskCategory — happy path par catégorie', () => {
  it('détecte courses via tag #courses', () => {
    const task = makeTask({ tags: ['courses'], sourceFile: '02 - Maison/Liste de courses.md' });
    const match = deriveTaskCategory(task);
    expect(match).not.toBeNull();
    expect(match!.id).toBe('courses');
    expect(match!.matchedBy).toBe('tag');
  });

  it('détecte bebe_soins via section Biberons', () => {
    const task = makeTask({
      sourceFile: '01 - Enfants/Emma/Tâches récurrentes.md',
      section: 'Biberons',
    });
    const match = deriveTaskCategory(task);
    expect(match?.id).toBe('bebe_soins');
    expect(match?.matchedBy).toBe('section');
  });

  it('détecte enfants_devoirs via tag #devoirs', () => {
    const task = makeTask({
      tags: ['devoirs'],
      sourceFile: '01 - Enfants/Lucas/Tâches récurrentes.md',
    });
    const match = deriveTaskCategory(task);
    expect(match?.id).toBe('enfants_devoirs');
    expect(match?.matchedBy).toBe('tag');
  });

  it('détecte menage_quotidien via section Quotidien', () => {
    const task = makeTask({
      sourceFile: '02 - Maison/Tâches récurrentes.md',
      section: 'Quotidien',
    });
    const match = deriveTaskCategory(task);
    expect(match?.id).toBe('menage_quotidien');
    expect(match?.matchedBy).toBe('section');
  });

  it('détecte menage_hebdo via section Ménage hebdomadaire', () => {
    const task = makeTask({
      sourceFile: '02 - Maison/Tâches récurrentes.md',
      section: 'Ménage hebdomadaire',
    });
    const match = deriveTaskCategory(task);
    expect(match?.id).toBe('menage_hebdo');
    expect(match?.matchedBy).toBe('section');
  });

  it('détecte enfants_routines via filepath 01 - Enfants (SEMANTIC-01)', () => {
    const task = makeTask({ sourceFile: '01 - Enfants/Lucas/Tâches récurrentes.md' });
    const match = deriveTaskCategory(task);
    expect(match?.id).toBe('enfants_routines');
    expect(match?.matchedBy).toBe('filepath');
  });

  it('détecte cuisine_repas via filepath 03 - Cuisine (SEMANTIC-01)', () => {
    const task = makeTask({ sourceFile: '03 - Cuisine/Recettes/Entrées/soupe.cook' });
    const match = deriveTaskCategory(task);
    expect(match?.id).toBe('cuisine_repas');
    expect(match?.matchedBy).toBe('filepath');
  });

  it('détecte rendez_vous via filepath 04 - Rendez-vous (SEMANTIC-01)', () => {
    const task = makeTask({ sourceFile: '04 - Rendez-vous/medical.md' });
    const match = deriveTaskCategory(task);
    expect(match?.id).toBe('rendez_vous');
    expect(match?.matchedBy).toBe('filepath');
  });

  it('détecte budget_admin via filepath 05 - Budget (SEMANTIC-01)', () => {
    const task = makeTask({ sourceFile: '05 - Budget/Factures.md' });
    const match = deriveTaskCategory(task);
    expect(match?.id).toBe('budget_admin');
    expect(match?.matchedBy).toBe('filepath');
  });

  it('détecte gratitude_famille via filepath 06 - Mémoires (SEMANTIC-01)', () => {
    const task = makeTask({ sourceFile: '06 - Mémoires/Gratitude familiale.md' });
    const match = deriveTaskCategory(task);
    expect(match?.id).toBe('gratitude_famille');
    expect(match?.matchedBy).toBe('filepath');
  });
});

describe('deriveTaskCategory — 3 signaux explicites (tag / section / filepath)', () => {
  it('signal tag : matchedBy="tag" avec evidence = valeur brute du tag', () => {
    const task = makeTask({ tags: ['courses'], sourceFile: '99 - Inconnu/x.md' });
    const match = deriveTaskCategory(task);
    expect(match?.matchedBy).toBe('tag');
    expect(match?.evidence).toBe('courses');
  });

  it('signal section : matchedBy="section" avec evidence = valeur brute de la section', () => {
    const task = makeTask({ sourceFile: '02 - Maison/x.md', section: 'Ménage hebdomadaire' });
    const match = deriveTaskCategory(task);
    expect(match?.matchedBy).toBe('section');
    expect(match?.evidence).toBe('Ménage hebdomadaire');
  });

  it('signal filepath : matchedBy="filepath" avec evidence = premier segment brut', () => {
    const task = makeTask({ sourceFile: '03 - Cuisine/Repas.md' });
    const match = deriveTaskCategory(task);
    expect(match?.matchedBy).toBe('filepath');
    expect(match?.evidence).toBe('03 - Cuisine');
  });
});

describe('deriveTaskCategory — normalisation accents + casse (SEMANTIC-02 / D-03)', () => {
  it('normalise les accents dans la section : "Ménage" → pattern menage → menage_hebdo', () => {
    const task = makeTask({
      sourceFile: '02 - Maison/X.md',
      section: 'Ménage',
    });
    const match = deriveTaskCategory(task);
    expect(match?.id).toBe('menage_hebdo');
    expect(match?.matchedBy).toBe('section');
  });

  it('normalise majuscules + accents : "MÉNAGE HEBDOMADAIRE" → menage_hebdo', () => {
    const task = makeTask({
      sourceFile: '02 - Maison/X.md',
      section: 'MÉNAGE HEBDOMADAIRE',
    });
    const match = deriveTaskCategory(task);
    expect(match?.id).toBe('menage_hebdo');
  });

  it('normalise les accents dans le filepath : "06 - Mémoires" → memoires → gratitude_famille', () => {
    const task = makeTask({ sourceFile: '06 - Mémoires/x.md' });
    const match = deriveTaskCategory(task);
    expect(match?.id).toBe('gratitude_famille');
  });

  it('normalise le tag avec majuscule : tag "Courses" matche le pattern "courses"', () => {
    const task = makeTask({ tags: ['Courses'], sourceFile: '99 - Inconnu/x.md' });
    const match = deriveTaskCategory(task);
    expect(match?.id).toBe('courses');
    expect(match?.matchedBy).toBe('tag');
  });
});

describe('deriveTaskCategory — ordre de priorité tag > section > filepath (D-02)', () => {
  it('retourne tag quand les 3 signaux matcheraient des catégories différentes', () => {
    // tag 'devoirs' → enfants_devoirs
    // section 'Quotidien' → menage_quotidien
    // filepath '02 - Maison' → menage_hebdo
    const task = makeTask({
      tags: ['devoirs'],
      section: 'Quotidien',
      sourceFile: '02 - Maison/Tâches récurrentes.md',
    });
    const match = deriveTaskCategory(task);
    expect(match?.id).toBe('enfants_devoirs');
    expect(match?.matchedBy).toBe('tag');
  });

  it('retourne section quand tag absent mais section et filepath matcheraient différent (D-02)', () => {
    // section 'Biberons' → bebe_soins
    // filepath '02 - Maison' → menage_hebdo
    const task = makeTask({
      section: 'Biberons',
      sourceFile: '02 - Maison/X.md',
    });
    const match = deriveTaskCategory(task);
    expect(match?.id).toBe('bebe_soins');
    expect(match?.matchedBy).toBe('section');
  });

  it('retourne filepath quand tags=[] et section=undefined', () => {
    const task = makeTask({ sourceFile: '05 - Budget/Factures.md' });
    const match = deriveTaskCategory(task);
    expect(match?.id).toBe('budget_admin');
    expect(match?.matchedBy).toBe('filepath');
  });
});

describe('deriveTaskCategory — evidence est la valeur brute non normalisée (D-04b)', () => {
  it('conserve la casse et les accents de la section', () => {
    const task = makeTask({
      sourceFile: '02 - Maison/X.md',
      section: 'Ménage hebdomadaire',
    });
    expect(deriveTaskCategory(task)?.evidence).toBe('Ménage hebdomadaire');
  });

  it('conserve le tag original sans normalisation (Courses avec majuscule)', () => {
    const task = makeTask({ tags: ['Courses'], sourceFile: 'x/y.md' });
    // 'Courses' normalisé = 'courses' → matche pattern 'courses'
    expect(deriveTaskCategory(task)?.evidence).toBe('Courses');
  });

  it('conserve le premier segment filepath avec préfixe "NN - " (evidence brute)', () => {
    const task = makeTask({ sourceFile: '03 - Cuisine/x.cook' });
    expect(deriveTaskCategory(task)?.evidence).toBe('03 - Cuisine');
  });

  it('conserve le premier segment filepath avec accents : "06 - Mémoires"', () => {
    const task = makeTask({ sourceFile: '06 - Mémoires/Gratitude.md' });
    expect(deriveTaskCategory(task)?.evidence).toBe('06 - Mémoires');
  });
});

describe('deriveTaskCategory — fallback null (SEMANTIC-04 / ARCH-03)', () => {
  it('retourne null pour un sourceFile inconnu sans tags ni section', () => {
    const task = makeTask({ sourceFile: '99 - Inconnu/random.md' });
    expect(deriveTaskCategory(task)).toBeNull();
  });

  it('retourne null pour des signaux tous inconnus (tag, section, filepath inexistants)', () => {
    const task = makeTask({
      tags: ['random_tag_zzz'],
      section: 'Something random zzz',
      sourceFile: 'zzz/file.md',
    });
    expect(deriveTaskCategory(task)).toBeNull();
  });

  it('retourne null pour une tâche à la racine du vault sans tags ni section', () => {
    const task = makeTask({ sourceFile: 'notes.md' });
    expect(deriveTaskCategory(task)).toBeNull();
  });

  it('retourne null pour tags=[], section undefined et sourceFile vide', () => {
    const task = makeTask({});
    expect(deriveTaskCategory(task)).toBeNull();
  });

  it('ne lance pas d\'exception — retourne proprement null (ARCH-03)', () => {
    // Vérification que fallback null ne produit pas d'erreur
    expect(() => deriveTaskCategory(makeTask({ sourceFile: '99 - Inconnu/x.md' }))).not.toThrow();
    expect(deriveTaskCategory(makeTask({ sourceFile: '99 - Inconnu/x.md' }))).toBeNull();
  });
});
