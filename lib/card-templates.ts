/**
 * card-templates.ts — Contenu par défaut pour les cartes dashboard
 *
 * Permet aux utilisateurs de découvrir les fonctions de l'app en "activant"
 * une carte vide → crée les fichiers template nécessaires dans le vault.
 */

import { format } from 'date-fns';

export interface CardTemplate {
  /** Description affichée sur la carte vide */
  description: string;
  /** Génère les fichiers à créer dans le vault */
  generateFiles: (ctx: CardTemplateContext) => CardTemplateFile[];
}

export interface CardTemplateContext {
  today: string; // YYYY-MM-DD
  childrenNames: string[];
}

export interface CardTemplateFile {
  path: string;
  content: string;
}

const CARD_TEMPLATES: Record<string, CardTemplate> = {
  menage: {
    description: 'Organisez le ménage par jour avec des tâches récurrentes',
    generateFiles: (ctx) => [{
      path: '02 - Maison/Tâches récurrentes.md',
      content: `## Ménage hebdomadaire

### Tous les jours
- [ ] Faire les lits 🔁 every day 📅 ${ctx.today}
- [ ] Ranger la cuisine après les repas 🔁 every day 📅 ${ctx.today}
- [ ] 10 minutes de rangement rapide 🔁 every day 📅 ${ctx.today}

### Lundi — Ménage général
- [ ] Aspirer toute la maison 🔁 every week 📅 ${ctx.today}

### Mardi — Salle de bain
- [ ] Nettoyer les salles de bain 🔁 every week 📅 ${ctx.today}

### Jeudi — Chambre
- [ ] Changer les draps 🔁 every week 📅 ${ctx.today}

### Vendredi — Sols
- [ ] Serpillière sols durs 🔁 every week 📅 ${ctx.today}

### Samedi — Courses
- [ ] Faire les courses 🔁 every week 📅 ${ctx.today}
`,
    }],
  },

  meals: {
    description: 'Planifiez les repas de la semaine pour toute la famille',
    generateFiles: () => [{
      path: '02 - Maison/Repas de la semaine.md',
      content: `# Repas de la semaine

## Lundi
- Déjeuner:
- Dîner:

## Mardi
- Déjeuner:
- Dîner:

## Mercredi
- Déjeuner:
- Dîner:

## Jeudi
- Déjeuner:
- Dîner:

## Vendredi
- Déjeuner:
- Dîner:

## Samedi
- Petit-déj:
- Déjeuner:
- Dîner:

## Dimanche
- Petit-déj:
- Déjeuner:
- Dîner:
`,
    }],
  },

  stock: {
    description: 'Suivez vos stocks de produits et soyez alerté quand il faut racheter',
    generateFiles: () => [{
      path: '01 - Enfants/Commun/Stock & fournitures.md',
      content: `# Stock & Fournitures

## Hygiène
| Produit | Détail | Quantité | Seuil | Qté achat |
|---------|--------|----------|-------|-----------|
| Savon mains | | 3 | 1 | 2 |
| Papier toilette | | 6 | 2 | 6 |
| Lessive | | 2 | 1 | 1 |
| Éponges | | 4 | 1 | 3 |

## Cuisine
| Produit | Détail | Quantité | Seuil | Qté achat |
|---------|--------|----------|-------|-----------|
| Huile d'olive | | 2 | 1 | 1 |
| Sel | | 1 | 1 | 1 |
| Poivre | | 1 | 1 | 1 |
`,
    }],
  },

  rdvs: {
    description: 'Centralisez les rendez-vous médicaux et administratifs',
    generateFiles: (ctx) => {
      const files: CardTemplateFile[] = [];
      // Créer un RDV exemple pour chaque enfant, ou un générique
      const names = ctx.childrenNames.length > 0 ? ctx.childrenNames : [''];
      for (const name of names.slice(0, 1)) {
        const label = name || 'Famille';
        files.push({
          path: `04 - Rendez-vous/Médecin ${label}.md`,
          content: `---
date: ${ctx.today}
heure: ""
médecin: ""
spécialité: Médecin traitant
enfant: ${name}
lieu: ""
statut: planifié
---

## Questions à poser
-

## Notes
(à compléter après le RDV)
`,
        });
      }
      return files;
    },
  },

  recipes: {
    description: 'Ajoutez vos recettes favorites au format Cooklang',
    generateFiles: () => [{
      path: '03 - Cuisine/Recettes/Basiques/Pâtes bolognaise.cook',
      content: `Faire revenir @oignon{1} émincé dans @huile d'olive{2%cl}.
Ajouter @viande hachée{500%g} et faire dorer.
Ajouter @tomates concassées{1%boîte} et @concentré de tomates{2%cs}.
Assaisonner avec @sel{} @poivre{} @herbes de Provence{1%cc}.
Laisser mijoter ~{30%minutes} à feu doux.
Cuire @pâtes{500%g} dans l'eau bouillante salée ~{10%minutes}.
Servir les pâtes nappées de sauce.
`,
    }, {
      path: '03 - Cuisine/Recettes/Basiques/Crêpes.cook',
      content: `Mélanger @farine{250%g} et @sucre{50%g} dans un saladier.
Ajouter @oeufs{3} un par un en mélangeant.
Verser @lait{50%cl} petit à petit.
Ajouter @beurre fondu{30%g} et @extrait de vanille{1%cc}.
Laisser reposer la pâte ~{30%minutes}.
Cuire les crêpes dans une poêle chaude beurrée ~{2%minutes} par face.
`,
    }],
  },

  quicknotifs: {
    description: 'Envoyez des notifications rapides à la famille en un tap',
    generateFiles: () => [{
      path: 'notifications.md',
      content: `---
tags:
  - notifications
---
# Notifications

<!-- Family Vault — configuration des notifications. -->

## task_completed
label: Tâche terminée
emoji: ✅
enabled: true
template: {{profile.avatar}} <b>{{profile.name}}</b> a terminé une tâche !\\n\\n📋 <i>{{task.text}}</i>\\n+{{points.gained}} pts → Total : <b>{{profile.points}} pts</b>

## loot_box_opened
label: Loot box ouverte
emoji: 🎁
enabled: true
template: {{box.emoji}} <b>{{profile.name}}</b> a ouvert une loot box !\\n\\n{{box.emoji}} <b>{{box.rarity}}</b>\\n🎁 {{box.reward}}

## all_tasks_done
label: Journée terminée
emoji: 🎉
enabled: true
template: 🎉 <b>Journée terminée !</b>\\n\\n✅ {{tasks.completedCount}} tâche(s) complétée(s)\\n\\n🏆 <b>Classement</b>\\n{{leaderboard}}\\nBravo à toute la famille ! 💪

## leaderboard
label: Classement
emoji: 🏆
enabled: false
template: 🏆 <b>Classement du jour</b>\\n\\n{{leaderboard}}

## daily_summary
label: Résumé du jour
emoji: 📋
enabled: false
template: 📋 <b>Résumé du {{date}}</b>\\n\\n✅ {{tasks.completedCount}} terminée(s) | ⏳ {{tasks.pendingCount}} restante(s)\\n\\n🏆 {{leaderboard}}

## custom_a_table
label: À table !
emoji: 🍽️
enabled: true
template: {{profile.avatar}} {{profile.name}} : À table ! Le repas est prêt 🍽️
isCustom: true
event: manual

## custom_au_bain
label: Au bain !
emoji: 🛁
enabled: true
template: {{profile.avatar}} {{profile.name}} : C'est l'heure du bain ! 🛁
isCustom: true
event: manual

## custom_au_dodo
label: Au dodo !
emoji: 😴
enabled: true
template: {{profile.avatar}} {{profile.name}} : C'est l'heure d'aller dormir 😴
isCustom: true
event: manual

## custom_on_rentre
label: On rentre !
emoji: 🏠
enabled: true
template: {{profile.avatar}} {{profile.name}} : On est en route, on arrive bientôt ! 🏠
isCustom: true
event: manual

## custom_je_pars
label: Je pars !
emoji: 🚗
enabled: true
template: {{profile.avatar}} {{profile.name}} part, à tout à l'heure ! ({{time}})
isCustom: true
event: manual

## custom_ecole
label: C'est parti !
emoji: 🏫
enabled: true
template: {{profile.avatar}} {{profile.name}} : Départ pour l'école ! 🏫 ({{time}})
isCustom: true
event: manual

## custom_courses
label: Courses
emoji: 🛒
enabled: true
template: {{profile.avatar}} {{profile.name}} fait les courses — besoin de quelque chose ? 🛒
isCustom: true
event: manual

## custom_medicament
label: Médicament !
emoji: 💊
enabled: true
template: ⚠️ Rappel de {{profile.name}} : n'oubliez pas le médicament ! 💊
isCustom: true
event: manual

## custom_cles
label: Tu as tes clés ?
emoji: 🔑
enabled: true
template: {{profile.avatar}} {{profile.name}} : Vérifiez vos clés avant de partir ! 🔑
isCustom: true
event: manual

## custom_je_taime
label: Je t'aime
emoji: ❤️
enabled: true
template: {{profile.avatar}} {{profile.name}} vous envoie un gros bisou ❤️
isCustom: true
event: manual

## custom_bravo
label: Bravo !
emoji: 🎉
enabled: true
template: {{profile.avatar}} {{profile.name}} : Bravo, on est fiers de toi ! 🎉
isCustom: true
event: manual
`,
    }],
  },

  budget: {
    description: 'Suivez les dépenses familiales par catégorie avec des plafonds',
    generateFiles: (ctx) => {
      const today = new Date(ctx.today + 'T12:00:00');
      const moisNum = format(today, 'yyyy-MM');
      const mois = today.toLocaleDateString('fr-FR', { month: 'long' });
      const annee = today.getFullYear();

      return [
        {
          path: '05 - Budget/config.md',
          content: `---
tags:
  - budget
---
# Configuration budget

## Catégories
- 🛒 Alimentation: 600
- 🚗 Transport: 200
- 🏥 Santé: 150
- 🎉 Loisirs: 200
- 👶 Enfants: 300
- 🏠 Maison: 300
- 🎁 Divers: 250
`,
        },
        {
          path: `05 - Budget/${moisNum}.md`,
          content: `---
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
`,
        },
      ];
    },
  },
};

export function getCardTemplate(cardId: string): CardTemplate | undefined {
  return CARD_TEMPLATES[cardId];
}

export function hasCardTemplate(cardId: string): boolean {
  return cardId in CARD_TEMPLATES;
}
