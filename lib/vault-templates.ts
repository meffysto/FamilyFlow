/**
 * vault-templates.ts — Packs de templates préconstruits
 *
 * 6 packs thématiques de vrai contenu utile (pas du démo jetable).
 * Chaque pack génère des fichiers markdown adaptés à la configuration familiale.
 */

import { format, addDays, nextMonday, nextTuesday, nextWednesday, nextThursday, nextFriday, nextSaturday } from 'date-fns';
import { t } from 'i18next';

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
    const p = 'setup.templateContent.courses';

    let content = `> [!tip] ${t(`${p}.tip`)}

## 🥩 ${t(`${p}.frais`)}
- [ ] ${t(`${p}.lait`)}
- [ ] ${t(`${p}.yaourts`)}
- [ ] ${t(`${p}.beurre`)}
- [ ] ${t(`${p}.oeufs`)}
- [ ] ${t(`${p}.fromageRape`)}
- [ ] ${t(`${p}.jambon`)}

## 🥦 ${t(`${p}.fruitsLegumes`)}
- [ ] ${t(`${p}.pommes`)}
- [ ] ${t(`${p}.bananes`)}
- [ ] ${t(`${p}.carottes`)}
- [ ] ${t(`${p}.tomates`)}
- [ ] ${t(`${p}.salade`)}

## 🍞 ${t(`${p}.epicerie`)}
- [ ] ${t(`${p}.pates`)}
- [ ] ${t(`${p}.riz`)}
- [ ] ${t(`${p}.huile`)}
- [ ] ${t(`${p}.farine`)}
- [ ] ${t(`${p}.sucre`)}

## 🧴 ${t(`${p}.hygiene`)}
- [ ] ${t(`${p}.savon`)}
- [ ] ${t(`${p}.papierToilette`)}
- [ ] ${t(`${p}.lessive`)}`;

    if (hasBebe) {
      content += `

## 👶 ${t(`${p}.produitsBebe`)}
- [ ] ${t(`${p}.couches`)}
- [ ] ${t(`${p}.lingettes`)}
- [ ] ${t(`${p}.serum`)}`;
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
    const p = 'setup.templateContent.repas';
    const content = `# ${t(`${p}.title`)}

> [!info] Organisation
> ${t(`${p}.tip`)}

## ${t(`${p}.lundi`)}
- ${t(`${p}.dejeuner`)}: ${t(`${p}.lundiDej`)}
- ${t(`${p}.diner`)}: ${t(`${p}.lundiDin`)}

## ${t(`${p}.mardi`)}
- ${t(`${p}.dejeuner`)}: ${t(`${p}.mardiDej`)}
- ${t(`${p}.diner`)}: ${t(`${p}.mardiDin`)}

## ${t(`${p}.mercredi`)}
- ${t(`${p}.dejeuner`)}: ${t(`${p}.mercrediDej`)}
- ${t(`${p}.diner`)}: ${t(`${p}.mercrediDin`)}

## ${t(`${p}.jeudi`)}
- ${t(`${p}.dejeuner`)}: ${t(`${p}.jeudiDej`)}
- ${t(`${p}.diner`)}: ${t(`${p}.jeudiDin`)}

## ${t(`${p}.vendredi`)}
- ${t(`${p}.dejeuner`)}: ${t(`${p}.vendrediDej`)}
- ${t(`${p}.diner`)}: ${t(`${p}.vendrediDin`)}

---

## ${t(`${p}.samedi`)}
- ${t(`${p}.petitDej`)}: ${t(`${p}.samediPetitDej`)}
- ${t(`${p}.dejeuner`)}: ${t(`${p}.samediDej`)}
- ${t(`${p}.diner`)}: ${t(`${p}.samediDin`)}

## ${t(`${p}.dimanche`)}
- ${t(`${p}.petitDej`)}: ${t(`${p}.dimanchePetitDej`)}
- ${t(`${p}.dejeuner`)}: ${t(`${p}.dimancheDej`)}
- ${t(`${p}.diner`)}: ${t(`${p}.dimancheDin`)}
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
    const p = 'setup.templateContent.menage';

    const content = `## ${t(`${p}.quotidien`)}
- [ ] ${t(`${p}.faireLits`)} 🔁 every day 📅 ${ctx.today}
- [ ] ${t(`${p}.rangerCuisine`)} 🔁 every day 📅 ${ctx.today}
- [ ] ${t(`${p}.machine`)} 🔁 every day 📅 ${ctx.today}
- [ ] ${t(`${p}.rangementRapide`)} 🔁 every day 📅 ${ctx.today}

## ${t(`${p}.menageHeader`)}
- [ ] ${t(`${p}.aspirer`)} 🔁 every week 📅 ${lundi}
- [ ] ${t(`${p}.sallesDeBain`)} 🔁 every week 📅 ${mardi}
- [ ] ${t(`${p}.draps`)} 🔁 every week 📅 ${jeudi}
- [ ] ${t(`${p}.serpilliere`)} 🔁 every week 📅 ${vendredi}
- [ ] ${t(`${p}.courses`)} 🔁 every week 📅 ${samedi}

## ${t(`${p}.mensuel`)}
- [ ] ${t(`${p}.frigo`)} 🔁 every month 📅 ${ctx.today}
- [ ] ${t(`${p}.poussiere`)} 🔁 every month 📅 ${ctx.today}
- [ ] ${t(`${p}.vitres`)} 🔁 every month 📅 ${ctx.today}
- [ ] ${t(`${p}.stocksMenagers`)} 🔁 every month 📅 ${ctx.today}
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
    const p = 'setup.templateContent.medical';

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

## ${t(`${p}.questionsHeader`)}
- [ ] ${t(`${p}.bebe.courbe`)}
- [ ] ${t(`${p}.bebe.vaccins`)}
- [ ] ${t(`${p}.bebe.developpement`)}

## ${t(`${p}.notesHeader`)}
> [!note] ${t(`${p}.noteAfterRDV`)}
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

## ${t(`${p}.bebe.vaccinsTitle`)}
- ${t(`${p}.bebe.vaccinsRappel`)}

> [!warning] Important
> ${t(`${p}.bebe.vaccinsWarning`)}

## ${t(`${p}.notesHeader`)}
> [!note] ${t(`${p}.noteAfterRDV`)}
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

## ${t(`${p}.questionsHeader`)}
- [ ] ${t(`${p}.petit.courbe`)}
- [ ] ${t(`${p}.petit.developpement`)}
- [ ] ${t(`${p}.petit.vaccins`)}

## ${t(`${p}.notesHeader`)}
> [!note] ${t(`${p}.noteAfterRDV`)}
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

## ${t(`${p}.notesHeader`)}
${t(`${p}.petit.dentiste`)}

> [!note] ${t(`${p}.noteAfterRDV`)}
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

## ${t(`${p}.questionsHeader`)}
- [ ] ${t(`${p}.enfantAdo.visiteAnnuelle`)}
- [ ] ${t(`${p}.enfantAdo.vaccins`)}

## ${t(`${p}.notesHeader`)}
> [!note] ${t(`${p}.noteAfterRDV`)}
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

## ${t(`${p}.notesHeader`)}
${t(`${p}.enfantAdo.dentiste`)}

> [!note] ${t(`${p}.noteAfterRDV`)}
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

## ${t(`${p}.notesHeader`)}
${t(`${p}.parent.visiteAnnuelle`)}

> [!note] ${t(`${p}.noteAfterRDV`)}
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

## ${t(`${p}.notesHeader`)}
${t(`${p}.parent.dentiste`)}

> [!note] ${t(`${p}.noteAfterRDV`)}
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
        const p = 'setup.templateContent.routinesEnfants';
        content = `## ${t(`${p}.morningHeader`)}
- [ ] ${t(`${p}.petit.wakeUp`)} 🔁 every day 📅 ${ctx.today}
- [ ] ${t(`${p}.petit.breakfast`)} 🔁 every day 📅 ${ctx.today}
- [ ] ${t(`${p}.petit.brushTeeth`)} 🔁 every day 📅 ${ctx.today}
- [ ] ${t(`${p}.petit.getDressed`)} 🔁 every day 📅 ${ctx.today}

## ${t(`${p}.eveningHeader`)}
- [ ] ${t(`${p}.petit.putAwayToys`)} 🔁 every day 📅 ${ctx.today}
- [ ] ${t(`${p}.petit.bath`)} 🔁 every day 📅 ${ctx.today}
- [ ] ${t(`${p}.petit.pajamas`)} 🔁 every day 📅 ${ctx.today}
- [ ] ${t(`${p}.petit.brushTeeth`)} 🔁 every day 📅 ${ctx.today}
- [ ] ${t(`${p}.petit.bedtimeStory`)} 🔁 every day 📅 ${ctx.today}
`;
      } else if (cat === 'enfant') {
        const p = 'setup.templateContent.routinesEnfants';
        content = `## ${t(`${p}.morningHeader`)}
- [ ] ${t(`${p}.enfant.getUp`)} 🔁 every day 📅 ${ctx.today}
- [ ] ${t(`${p}.enfant.breakfast`)} 🔁 every day 📅 ${ctx.today}
- [ ] ${t(`${p}.enfant.brushTeeth`)} 🔁 every day 📅 ${ctx.today}
- [ ] ${t(`${p}.enfant.packBag`)} 🔁 every day 📅 ${ctx.today}
- [ ] ${t(`${p}.enfant.checkSnack`)} 🔁 every day 📅 ${ctx.today}

## ${t(`${p}.eveningHeader`)}
- [ ] ${t(`${p}.enfant.snackHomework`)} 🔁 every day 📅 ${ctx.today}
- [ ] ${t(`${p}.enfant.freeTime`)} 🔁 every day 📅 ${ctx.today}
- [ ] ${t(`${p}.enfant.shower`)} 🔁 every day 📅 ${ctx.today}
- [ ] ${t(`${p}.enfant.prepareTomorrow`)} 🔁 every day 📅 ${ctx.today}
- [ ] ${t(`${p}.enfant.readingQuietTime`)} 🔁 every day 📅 ${ctx.today}
`;
      } else {
        // ado
        const p = 'setup.templateContent.routinesEnfants';
        content = `## ${t(`${p}.morningHeader`)}
- [ ] ${t(`${p}.ado.wakeUp`)} 🔁 every day 📅 ${ctx.today}
- [ ] ${t(`${p}.ado.breakfast`)} 🔁 every day 📅 ${ctx.today}
- [ ] ${t(`${p}.ado.hygiene`)} 🔁 every day 📅 ${ctx.today}
- [ ] ${t(`${p}.ado.checkSchedule`)} 🔁 every day 📅 ${ctx.today}

## ${t(`${p}.eveningHeader`)}
- [ ] ${t(`${p}.ado.homework`)} 🔁 every day 📅 ${ctx.today}
- [ ] ${t(`${p}.ado.tidyRoom`)} 🔁 every day 📅 ${ctx.today}
- [ ] ${t(`${p}.ado.prepareThings`)} 🔁 every day 📅 ${ctx.today}
- [ ] ${t(`${p}.ado.noScreens`)} 🔁 every day 📅 ${ctx.today}
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
    const p = 'setup.templateContent.budget';

    // Budget config
    const configContent = `---
tags:
  - budget
---
# ${t(`${p}.configTitle`)}

> [!info] ${t(`${p}.plafonds`)}
> ${t(`${p}.plafondsDesc`)}

## ${t(`${p}.categories`)}
- 🛒 ${t(`${p}.alimentation`)}: 600
- 🚗 ${t(`${p}.transport`)}: 200
- 🏥 ${t(`${p}.sante`)}: 150
- 🎉 ${t(`${p}.loisirs`)}: 200
- 👶 ${t(`${p}.enfants`)}: 300
- 🏠 ${t(`${p}.maison`)}: 300
- 🎁 ${t(`${p}.divers`)}: 250
`;

    // Budget du mois courant
    const monthTitle = t(`${p}.monthTitle`, { month: mois.charAt(0).toUpperCase() + mois.slice(1), year: annee });
    const monthContent = `---
tags:
  - budget
mois: ${moisNum}
---
# ${monthTitle}

## 🛒 ${t(`${p}.alimentation`)}

## 🚗 ${t(`${p}.transport`)}

## 🏥 ${t(`${p}.sante`)}

## 🎉 ${t(`${p}.loisirs`)}

## 👶 ${t(`${p}.enfants`)}

## 🏠 ${t(`${p}.maison`)}

## 🎁 ${t(`${p}.divers`)}
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
