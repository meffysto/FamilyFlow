/**
 * parser-slot.test.ts — Tests parser pour les emojis slot (Phase quick-260516-oj6).
 *
 * Couvre :
 * - Extraction timeSlot depuis emoji marker en début de label
 * - Stripping correct de l'emoji (text propre, autres emojis préservés)
 * - Round-trip : verrou utilisateur (jamais d'emoji ajouté tout seul)
 * - Cohabitation avec 📅/⏰/🔁/⭐
 */

import { parseTask } from '../parser';

describe('parseTask — emojis slot (Phase quick-260516-oj6)', () => {
  describe('Extraction du timeSlot depuis emoji marker', () => {
    it('reconnaît ☀️ → timeSlot=matin et strippe l\'emoji', () => {
      const task = parseTask('- [ ] ☀️ Faire le petit-déj', 0, 'tasks.md');
      expect(task).not.toBeNull();
      expect(task!.timeSlot).toBe('matin');
      expect(task!.text).toBe('Faire le petit-déj');
    });

    it('reconnaît 🍽️ → timeSlot=midi', () => {
      const task = parseTask('- [ ] 🍽️ Préparer le déjeuner', 0, 'tasks.md');
      expect(task).not.toBeNull();
      expect(task!.timeSlot).toBe('midi');
      expect(task!.text).toBe('Préparer le déjeuner');
    });

    it('reconnaît ☕ → timeSlot=aprem', () => {
      const task = parseTask('- [ ] ☕ Goûter Lucas', 0, 'tasks.md');
      expect(task).not.toBeNull();
      expect(task!.timeSlot).toBe('aprem');
      expect(task!.text).toBe('Goûter Lucas');
    });

    it('reconnaît 🌙 → timeSlot=soir', () => {
      const task = parseTask('- [ ] 🌙 Bain Emma', 0, 'tasks.md');
      expect(task).not.toBeNull();
      expect(task!.timeSlot).toBe('soir');
      expect(task!.text).toBe('Bain Emma');
    });

    it('sans emoji slot → timeSlot undefined', () => {
      const task = parseTask('- [ ] Acheter du pain', 0, 'tasks.md');
      expect(task).not.toBeNull();
      expect(task!.timeSlot).toBeUndefined();
      expect(task!.text).toBe('Acheter du pain');
    });

    it('reconnaît tâche cochée avec emoji slot', () => {
      const task = parseTask('- [x] 🌙 Brossage de dents', 3, 'tasks.md');
      expect(task).not.toBeNull();
      expect(task!.completed).toBe(true);
      expect(task!.timeSlot).toBe('soir');
      expect(task!.text).toBe('Brossage de dents');
    });
  });

  describe('Cohabitation avec autres emojis (📅⏰🔁⭐)', () => {
    it('emoji slot + dueDate + reminderTime — tous extraits correctement', () => {
      const task = parseTask('- [ ] ☀️ Matin 📅 2026-05-16 ⏰ 07:30', 0, 'tasks.md');
      expect(task).not.toBeNull();
      expect(task!.timeSlot).toBe('matin');
      expect(task!.dueDate).toBe('2026-05-16');
      expect(task!.reminderTime).toBe('07:30');
      expect(task!.text).toBe('Matin');
    });

    it('emoji slot + recurrence + xpOverride', () => {
      const task = parseTask('- [ ] 🍽️ Préparer repas 🔁 every day ⭐ 20', 0, 'tasks.md');
      expect(task).not.toBeNull();
      expect(task!.timeSlot).toBe('midi');
      expect(task!.recurrence).toBe('every day');
      expect(task!.xpOverride).toBe(20);
      expect(task!.text).toBe('Préparer repas');
    });

    it('tags et mentions préservés après strip emoji slot', () => {
      const task = parseTask('- [ ] ☕ Goûter @lucas #santé', 0, 'tasks.md');
      expect(task).not.toBeNull();
      expect(task!.timeSlot).toBe('aprem');
      expect(task!.tags).toContain('santé');
      expect(task!.mentions).toContain('lucas');
    });
  });

  describe('Regex anchored — emoji slot uniquement EN DÉBUT', () => {
    it('emoji slot au milieu du texte → timeSlot undefined', () => {
      // Le user pourrait écrire un texte contenant ☀️ — on ne doit pas le matcher
      const task = parseTask('- [ ] Texte ☀️ avec emoji au milieu', 0, 'tasks.md');
      expect(task).not.toBeNull();
      expect(task!.timeSlot).toBeUndefined();
      // Le texte conserve son emoji du milieu (pas strippé car non en début)
      expect(task!.text).toContain('☀️');
    });

    it('emoji slot à la fin → timeSlot undefined', () => {
      const task = parseTask('- [ ] Tâche du soir 🌙', 0, 'tasks.md');
      expect(task).not.toBeNull();
      expect(task!.timeSlot).toBeUndefined();
      expect(task!.text).toContain('🌙');
    });
  });

  describe('Verrou utilisateur — pas de pollution vault', () => {
    it('tâche sans emoji → timeSlot undefined (jamais auto-attribué par parser)', () => {
      const task = parseTask('- [ ] Faire la vaisselle', 0, 'tasks.md');
      expect(task).not.toBeNull();
      expect(task!.timeSlot).toBeUndefined();
    });

    it('tâche avec reminderTime mais sans emoji slot → timeSlot reste undefined', () => {
      // C'est le moteur computeAutoSlot qui dérivera 'matin' à l'affichage,
      // mais le parser ne doit JAMAIS injecter timeSlot tout seul.
      const task = parseTask('- [ ] Méditer ⏰ 07:00', 0, 'tasks.md');
      expect(task).not.toBeNull();
      expect(task!.timeSlot).toBeUndefined();
      expect(task!.reminderTime).toBe('07:00');
    });
  });

  describe('Round-trip — emoji marker reconstruit uniquement si timeSlot défini', () => {
    // Le serializer est inline dans hooks/useVaultTasks.ts (editTask + setTaskSlot).
    // On simule ici la reconstruction de la ligne markdown pour valider la règle.
    const SLOT_EMOJI: Record<string, string> = {
      matin: '☀️',
      midi: '🍽️',
      aprem: '☕',
      soir: '🌙',
    };

    function reconstructLine(task: { completed: boolean; text: string; timeSlot?: string }): string {
      const prefix = task.timeSlot ? `${SLOT_EMOJI[task.timeSlot]} ` : '';
      return `- [${task.completed ? 'x' : ' '}] ${prefix}${task.text}`;
    }

    it('parse → reconstruct → parse : timeSlot préservé', () => {
      const original = '- [ ] ☀️ Petit-déj';
      const parsed = parseTask(original, 0, 'tasks.md')!;
      const reconstructed = reconstructLine(parsed);
      expect(reconstructed).toBe('- [ ] ☀️ Petit-déj');
      const reparsed = parseTask(reconstructed, 0, 'tasks.md')!;
      expect(reparsed.timeSlot).toBe('matin');
      expect(reparsed.text).toBe('Petit-déj');
    });

    it('tâche sans timeSlot ne gagne JAMAIS d\'emoji slot au reserialize', () => {
      const original = '- [ ] Acheter du pain';
      const parsed = parseTask(original, 0, 'tasks.md')!;
      expect(parsed.timeSlot).toBeUndefined();
      const reconstructed = reconstructLine(parsed);
      expect(reconstructed).toBe('- [ ] Acheter du pain');
      expect(reconstructed).not.toMatch(/☀️|🍽️|☕|🌙/);
    });
  });
});
