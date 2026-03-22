/**
 * vault-templates.ts — Packs de templates préconstruits
 *
 * 6 packs thématiques de vrai contenu utile (pas du démo jetable).
 * Chaque pack génère des fichiers markdown adaptés à la configuration familiale.
 */

import { format, addDays, nextMonday, nextTuesday, nextWednesday, nextThursday, nextFriday, nextSaturday } from 'date-fns';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface TemplatePack {
  id: string;
  name: string;
  emoji: string;
  description: string;
  /** Ne montrer que si des enfants existent */
  requiresChildren?: boolean;
  generate: (ctx: TemplateContext) => TemplateFile[];
}

export interface TemplateContext {
  parents: Array<{ name: string; avatar: string }>;
  children: Array<{ name: string; avatar: string; birthdate: string; ageCategory: string }>;
  today: string; // YYYY-MM-DD
}

export interface TemplateFile {
  path: string;
  content: string;
  append?: boolean;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function getNextDayDate(today: Date, dayFn: (d: Date) => Date): string {
  return format(dayFn(today), 'yyyy-MM-dd');
}

function getAgeCategory(birthdate: string): string {
  if (!birthdate) return 'bebe';
  const year = parseInt(birthdate.slice(0, 4), 10);
  if (isNaN(year)) return 'bebe';
  const age = new Date().getFullYear() - year;
  if (age <= 2) return 'bebe';
  if (age <= 5) return 'petit';
  if (age <= 11) return 'enfant';
  return 'ado';
}

function futureDate(today: Date, daysFromNow: number): string {
  return format(addDays(today, daysFromNow), 'yyyy-MM-dd');
}

// ─── Pack 1 : Courses essentielles ──────────────────────────────────────────

const coursesEssentielles: TemplatePack = {
  id: 'courses-essentielles',
  name: 'Courses essentielles',
  emoji: '📋',
  description: 'Une liste de courses type pour la semaine',
  generate: (ctx) => {
    const hasBebe = ctx.children.some(c => c.ageCategory === 'bebe');

    let content = `> [!tip] Astuce
> Cochez les articles au fur et à mesure en magasin !

## 🥩 Frais
- [ ] Lait demi-écrémé x2
- [ ] Yaourts nature x6
- [ ] Beurre
- [ ] Œufs x12
- [ ] Fromage râpé
- [ ] Jambon

## 🥦 Fruits & légumes
- [ ] Pommes (1kg)
- [ ] Bananes
- [ ] Carottes (1kg)
- [ ] Tomates (500g)
- [ ] Salade

## 🍞 Épicerie
- [ ] Pâtes (500g)
- [ ] Riz basmati
- [ ] Huile d'olive
- [ ] Farine
- [ ] Sucre

## 🧴 Hygiène
- [ ] Savon mains
- [ ] Papier toilette
- [ ] Lessive`;

    if (hasBebe) {
      content += `

## 👶 Produits bébé
- [ ] Couches (taille adaptée)
- [ ] Lingettes
- [ ] Sérum physiologique`;
    }

    return [{
      path: '02 - Maison/Liste de courses.md',
      content: content + '\n',
      append: true,
    }];
  },
};

// ─── Pack 2 : Planning repas ────────────────────────────────────────────────

const repasSemaine: TemplatePack = {
  id: 'repas-semaine',
  name: 'Planning repas',
  emoji: '🍽️',
  description: '7 jours de menus équilibrés prêts à l\'emploi',
  generate: () => {
    const content = `# Repas de la semaine

> [!info] Organisation
> Préparez les courses le weekend et faites du ==batch cooking== le dimanche pour gagner du temps en semaine.

## Lundi
- Déjeuner: Pâtes bolognaise + salade verte
- Dîner: Soupe de légumes + pain + fromage

## Mardi
- Déjeuner: Poulet rôti + haricots verts + riz
- Dîner: Omelette + salade composée

## Mercredi
- Déjeuner: Poisson pané + purée de pommes de terre
- Dîner: Pizza maison + crudités

## Jeudi
- Déjeuner: Steak haché + frites + salade
- Dîner: Quiche lorraine + soupe

## Vendredi
- Déjeuner: Poisson grillé + ratatouille
- Dîner: Crêpes salées (jambon-fromage)

---

## Samedi
- Petit-déj: Crêpes + fruits frais
- Déjeuner: Gratin dauphinois + salade
- Dîner: Burger maison + frites

## Dimanche
- Petit-déj: Pancakes + sirop d'érable
- Déjeuner: Rôti de porc + légumes rôtis
- Dîner: Reste de la semaine ou plateaux-repas devant un film
`;

    return [{
      path: '02 - Maison/Repas de la semaine.md',
      content,
    }];
  },
};

// ─── Pack 3 : Ménage organisé ───────────────────────────────────────────────

const menageOrganise: TemplatePack = {
  id: 'menage-organise',
  name: 'Ménage organisé',
  emoji: '🧹',
  description: 'Répartition des tâches ménagères par jour',
  generate: (ctx) => {
    const today = new Date(ctx.today + 'T12:00:00');
    const lundi = getNextDayDate(today, nextMonday);
    const mardi = getNextDayDate(today, nextTuesday);
    const jeudi = getNextDayDate(today, nextThursday);
    const vendredi = getNextDayDate(today, nextFriday);
    const samedi = getNextDayDate(today, nextSaturday);

    const content = `## Quotidien
- [ ] Faire les lits 🔁 every day 📅 ${ctx.today}
- [ ] Ranger la cuisine après les repas 🔁 every day 📅 ${ctx.today}
- [ ] Lancer/étendre une machine 🔁 every day 📅 ${ctx.today}
- [ ] 10 minutes de rangement rapide 🔁 every day 📅 ${ctx.today}

## Ménage
- [ ] Aspirer toute la maison 🔁 every week 📅 ${lundi}
- [ ] Nettoyer les salles de bain 🔁 every week 📅 ${mardi}
- [ ] Changer les draps 🔁 every week 📅 ${jeudi}
- [ ] Serpillière sols durs 🔁 every week 📅 ${vendredi}
- [ ] Faire les courses 🔁 every week 📅 ${samedi}

## Mensuel
- [ ] Nettoyer le réfrigérateur 🔁 every month 📅 ${ctx.today}
- [ ] Dépoussiérer les meubles hauts 🔁 every month 📅 ${ctx.today}
- [ ] Laver les vitres 🔁 every month 📅 ${ctx.today}
- [ ] Vérifier les stocks ménagers 🔁 every month 📅 ${ctx.today}
`;

    return [{
      path: '02 - Maison/Tâches récurrentes.md',
      content,
      append: true,
    }];
  },
};

// ─── Pack 4 : Suivi médical ─────────────────────────────────────────────────

const suiviMedical: TemplatePack = {
  id: 'suivi-medical',
  name: 'Suivi médical',
  emoji: '🏥',
  description: 'RDV types et rappels selon l\'âge',
  generate: (ctx) => {
    const files: TemplateFile[] = [];
    const today = new Date(ctx.today + 'T12:00:00');

    // RDV pour chaque enfant, adaptés à l'âge
    for (const child of ctx.children) {
      const cat = child.ageCategory || getAgeCategory(child.birthdate);

      if (cat === 'bebe') {
        files.push({
          path: `04 - Rendez-vous/Pédiatre ${child.name}.md`,
          content: `---
date: ${futureDate(today, 14)}
heure: ""
médecin: ""
spécialité: Pédiatre
enfant: ${child.name}
lieu: ""
statut: planifié
---

## Questions à poser
- [ ] Courbe de croissance
- [ ] Vaccins à jour ?
- [ ] Développement moteur / langage

## Notes
> [!note] À compléter après le RDV
`,
        });
        files.push({
          path: `04 - Rendez-vous/Vaccins ${child.name}.md`,
          content: `---
date: ${futureDate(today, 30)}
heure: ""
médecin: ""
spécialité: Vaccins
enfant: ${child.name}
lieu: ""
statut: planifié
---

## Vaccins prévus
- Rappel selon carnet de santé (2, 4, 11 mois)

> [!warning] Important
> Apporter le **carnet de santé** au RDV.

## Notes
> [!note] À compléter après le RDV
`,
        });
      } else if (cat === 'petit') {
        files.push({
          path: `04 - Rendez-vous/Pédiatre ${child.name}.md`,
          content: `---
date: ${futureDate(today, 60)}
heure: ""
médecin: ""
spécialité: Pédiatre
enfant: ${child.name}
lieu: ""
statut: planifié
---

## Questions à poser
- [ ] Courbe de croissance
- [ ] Développement langage / motricité
- [ ] Vaccins à jour ?

## Notes
> [!note] À compléter après le RDV
`,
        });
        files.push({
          path: `04 - Rendez-vous/Dentiste ${child.name}.md`,
          content: `---
date: ${futureDate(today, 90)}
heure: ""
médecin: ""
spécialité: Dentiste
enfant: ${child.name}
lieu: ""
statut: planifié
---

## Notes
Contrôle semestriel

> [!note] À compléter après le RDV
`,
        });
      } else {
        // enfant ou ado
        files.push({
          path: `04 - Rendez-vous/Médecin ${child.name}.md`,
          content: `---
date: ${futureDate(today, 90)}
heure: ""
médecin: ""
spécialité: Médecin traitant
enfant: ${child.name}
lieu: ""
statut: planifié
---

## Questions à poser
- [ ] Visite annuelle
- [ ] Vaccins à jour ?

## Notes
> [!note] À compléter après le RDV
`,
        });
        files.push({
          path: `04 - Rendez-vous/Dentiste ${child.name}.md`,
          content: `---
date: ${futureDate(today, 120)}
heure: ""
médecin: ""
spécialité: Dentiste
enfant: ${child.name}
lieu: ""
statut: planifié
---

## Notes
Contrôle semestriel

> [!note] À compléter après le RDV
`,
        });
      }
    }

    // RDV pour chaque parent
    for (const parent of ctx.parents) {
      files.push({
        path: `04 - Rendez-vous/Médecin ${parent.name}.md`,
        content: `---
date: ${futureDate(today, 180)}
heure: ""
médecin: ""
spécialité: Médecin traitant
enfant: ""
lieu: ""
statut: planifié
---

## Notes
Visite annuelle

> [!note] À compléter après le RDV
`,
      });
      files.push({
        path: `04 - Rendez-vous/Dentiste ${parent.name}.md`,
        content: `---
date: ${futureDate(today, 150)}
heure: ""
médecin: ""
spécialité: Dentiste
enfant: ""
lieu: ""
statut: planifié
---

## Notes
Contrôle semestriel

> [!note] À compléter après le RDV
`,
      });
    }

    return files;
  },
};

// ─── Pack 5 : Routines enfants ──────────────────────────────────────────────

const routinesEnfants: TemplatePack = {
  id: 'routines-enfants',
  name: 'Routines enfants',
  emoji: '⏰',
  description: 'Routines matin/soir adaptées à l\'âge',
  requiresChildren: true,
  generate: (ctx) => {
    const files: TemplateFile[] = [];

    for (const child of ctx.children) {
      const cat = child.ageCategory || getAgeCategory(child.birthdate);
      let content = '';

      if (cat === 'bebe') {
        // Les bébés ont déjà des tâches quotidiennes via scaffoldVault, pas de routine formelle
        continue;
      } else if (cat === 'petit') {
        content = `## Routine matin
- [ ] Se réveiller et câlin 🔁 every day 📅 ${ctx.today}
- [ ] Petit-déjeuner 🔁 every day 📅 ${ctx.today}
- [ ] Brossage de dents 🔁 every day 📅 ${ctx.today}
- [ ] S'habiller (choisir ses vêtements) 🔁 every day 📅 ${ctx.today}

## Routine soir
- [ ] Ranger les jouets 🔁 every day 📅 ${ctx.today}
- [ ] Bain / douche 🔁 every day 📅 ${ctx.today}
- [ ] Pyjama 🔁 every day 📅 ${ctx.today}
- [ ] Brossage de dents 🔁 every day 📅 ${ctx.today}
- [ ] Histoire du soir 🔁 every day 📅 ${ctx.today}
`;
      } else if (cat === 'enfant') {
        content = `## Routine matin
- [ ] Se lever à l'heure 🔁 every day 📅 ${ctx.today}
- [ ] Petit-déjeuner 🔁 every day 📅 ${ctx.today}
- [ ] Brossage de dents 🔁 every day 📅 ${ctx.today}
- [ ] Préparer le cartable 🔁 every day 📅 ${ctx.today}
- [ ] Vérifier le goûter 🔁 every day 📅 ${ctx.today}

## Routine soir
- [ ] Goûter + devoirs 🔁 every day 📅 ${ctx.today}
- [ ] Temps libre / activité 🔁 every day 📅 ${ctx.today}
- [ ] Douche 🔁 every day 📅 ${ctx.today}
- [ ] Préparer les affaires du lendemain 🔁 every day 📅 ${ctx.today}
- [ ] Lecture / temps calme 🔁 every day 📅 ${ctx.today}
`;
      } else {
        // ado
        content = `## Routine matin
- [ ] Réveil autonome 🔁 every day 📅 ${ctx.today}
- [ ] Petit-déjeuner 🔁 every day 📅 ${ctx.today}
- [ ] Hygiène 🔁 every day 📅 ${ctx.today}
- [ ] Vérifier l'emploi du temps 🔁 every day 📅 ${ctx.today}

## Routine soir
- [ ] Devoirs / révisions 🔁 every day 📅 ${ctx.today}
- [ ] Ranger sa chambre 🔁 every day 📅 ${ctx.today}
- [ ] Préparer ses affaires 🔁 every day 📅 ${ctx.today}
- [ ] Pas d'écran après 21h 🔁 every day 📅 ${ctx.today}
`;
      }

      if (content) {
        files.push({
          path: `01 - Enfants/${child.name}/Tâches récurrentes.md`,
          content,
          append: true,
        });
      }
    }

    return files;
  },
};

// ─── Pack 6 : Budget familial ───────────────────────────────────────────────

const budgetFamilial: TemplatePack = {
  id: 'budget-familial',
  name: 'Budget familial',
  emoji: '💰',
  description: 'Catégories de dépenses et plafonds mensuels',
  generate: (ctx) => {
    const today = new Date(ctx.today + 'T12:00:00');
    const mois = today.toLocaleDateString('fr-FR', { month: 'long' });
    const annee = today.getFullYear();
    const moisNum = format(today, 'yyyy-MM');

    // Budget config
    const configContent = `---
tags:
  - budget
---
# Configuration budget

> [!info] Plafonds mensuels
> Modifiez les montants ci-dessous pour les adapter à votre situation.

## Catégories
- 🛒 Alimentation: 600
- 🚗 Transport: 200
- 🏥 Santé: 150
- 🎉 Loisirs: 200
- 👶 Enfants: 300
- 🏠 Maison: 300
- 🎁 Divers: 250
`;

    // Budget du mois courant
    const monthContent = `---
tags:
  - budget
mois: ${moisNum}
---
# Budget — ${mois.charAt(0).toUpperCase() + mois.slice(1)} ${annee}

## 🛒 Alimentation

## 🚗 Transport

## 🏥 Santé

## 🎉 Loisirs

## 👶 Enfants

## 🏠 Maison

## 🎁 Divers
`;

    return [
      { path: '05 - Budget/config.md', content: configContent },
      { path: `05 - Budget/${moisNum}.md`, content: monthContent },
    ];
  },
};

// ─── Export ─────────────────────────────────────────────────────────────────

export const TEMPLATE_PACKS: TemplatePack[] = [
  coursesEssentielles,
  repasSemaine,
  menageOrganise,
  suiviMedical,
  routinesEnfants,
  budgetFamilial,
];

/** IDs des packs pré-cochés par défaut dans le setup */
export const DEFAULT_SELECTED_PACKS = [
  'courses-essentielles',
  'repas-semaine',
  'menage-organise',
];
