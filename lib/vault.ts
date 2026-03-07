/**
 * vault.ts — VaultManager
 *
 * Core abstraction over expo-file-system v55 (new File/Directory API).
 * Uses legacy import for compatibility.
 * All read/write operations preserve Obsidian compatibility:
 * - UTF-8 encoding
 * - LF line endings (\n)
 * - YAML frontmatter intact
 * - Emoji markers (🔁 📅 ✅) preserved
 *
 * Sample vault structure (coffre):
 *   01 - Enfants/Maxence/Tâches récurrentes.md
 *   02 - Maison/Liste de courses.md
 *   02 - Maison/Ménage hebdo.md
 *   03 - Journal/YYYY-MM-DD.md
 *   03 - Journal/Maxence/YYYY-MM-DD Maxence.md
 *   04 - Rendez-vous/*.md
 *   famille.md
 *   gamification.md
 */

// Use legacy API for broader compatibility across expo-file-system versions
import * as FileSystem from 'expo-file-system/legacy';
import { Profile } from './types';
import { format } from 'date-fns';
import { nextOccurrence } from './recurrence';

export class VaultManager {
  vaultPath: string;

  constructor(vaultPath: string) {
    // Normalize: remove trailing slash
    this.vaultPath = vaultPath.replace(/\/$/, '');
  }

  /** Absolute URI for a relative vault path */
  private uri(relativePath: string): string {
    const path = `${this.vaultPath}/${relativePath}`;
    // Ensure file:// prefix for expo-file-system
    if (path.startsWith('file://') || path.startsWith('content://')) return path;
    return `file://${path}`;
  }

  /** Read a file, returns content string */
  async readFile(relativePath: string): Promise<string> {
    const uri = this.uri(relativePath);
    try {
      const content = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.UTF8,
      });
      return content;
    } catch (e) {
      throw new Error(`VaultManager.readFile: cannot read "${relativePath}": ${e}`);
    }
  }

  /** Write a file (creates if missing, overwrites if exists) */
  async writeFile(relativePath: string, content: string): Promise<void> {
    const uri = this.uri(relativePath);
    // Ensure parent directory exists
    const parts = relativePath.split('/');
    if (parts.length > 1) {
      const dir = parts.slice(0, -1).join('/');
      await this.ensureDir(dir);
    }
    await FileSystem.writeAsStringAsync(uri, content, {
      encoding: FileSystem.EncodingType.UTF8,
    });
  }

  /** Delete a file from the vault */
  async deleteFile(relativePath: string): Promise<void> {
    const uri = this.uri(relativePath);
    await FileSystem.deleteAsync(uri, { idempotent: true });
  }

  /** Check if a file or directory exists */
  async exists(relativePath: string): Promise<boolean> {
    const uri = this.uri(relativePath);
    try {
      const info = await FileSystem.getInfoAsync(uri);
      return info.exists;
    } catch {
      return false;
    }
  }

  /** Ensure a directory exists (recursive) */
  async ensureDir(relativeDir: string): Promise<void> {
    const uri = this.uri(relativeDir);
    const info = await FileSystem.getInfoAsync(uri);
    if (!info.exists) {
      await FileSystem.makeDirectoryAsync(uri, { intermediates: true });
    }
  }

  /** List files in a directory (non-recursive) */
  async listDir(relativeDir: string): Promise<string[]> {
    const uri = this.uri(relativeDir);
    try {
      const entries = await FileSystem.readDirectoryAsync(uri);
      return entries;
    } catch {
      return [];
    }
  }

  /** List all .md files in a directory recursively */
  async listMarkdownFiles(relativeDir: string): Promise<string[]> {
    const entries = await this.listDir(relativeDir);
    const results: string[] = [];
    for (const entry of entries) {
      const entryPath = relativeDir ? `${relativeDir}/${entry}` : entry;
      if (entry.endsWith('.md')) {
        results.push(entryPath);
      } else if (!entry.startsWith('.')) {
        const info = await FileSystem.getInfoAsync(this.uri(entryPath));
        if ('isDirectory' in info && info.isDirectory) {
          const sub = await this.listMarkdownFiles(entryPath);
          results.push(...sub);
        }
      }
    }
    return results;
  }

  /** Copy a file (e.g. image) into the vault */
  async copyFileToVault(sourceUri: string, relativePath: string): Promise<void> {
    const parts = relativePath.split('/');
    if (parts.length > 1) {
      const dir = parts.slice(0, -1).join('/');
      await this.ensureDir(dir);
    }
    const destUri = this.uri(relativePath);
    await FileSystem.copyAsync({ from: sourceUri, to: destUri });
  }

  /** List dates (YYYY-MM-DD) that have photos for a given child */
  async listPhotoDates(enfantName: string): Promise<string[]> {
    const dir = `07 - Photos/${enfantName}`;
    const files = await this.listDir(dir);
    const dates = files
      .filter((f) => f.endsWith('.jpg'))
      .map((f) => f.replace('.jpg', ''))
      .filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d))
      .sort();
    return dates;
  }

  /** Get the file URI for a child's photo on a given date */
  getPhotoUri(enfantName: string, date: string): string {
    return this.uri(`07 - Photos/${enfantName}/${date}.jpg`);
  }

  /**
   * Toggle a task checkbox on a specific line.
   *
   * Recurring tasks (🔁): Instead of marking [x], advance the due date
   * to the next occurrence and keep the task as [ ]. This replaces the
   * batch maintenance script approach.
   *
   * Non-recurring tasks: Sets `- [x]` + `✅ YYYY-MM-DD` on complete,
   * `- [ ]` and removes `✅` on uncomplete.
   */
  async toggleTask(
    relativePath: string,
    lineIndex: number,
    completed: boolean
  ): Promise<void> {
    const content = await this.readFile(relativePath);
    const lines = content.split('\n');
    if (lineIndex >= lines.length) return;

    const today = format(new Date(), 'yyyy-MM-dd');
    let line = lines[lineIndex];

    if (completed) {
      // Check if this is a recurring task
      const recurrenceMatch = line.match(/🔁\s*(every\s+\S+(?:\s+\S+)?)/);
      const dueDateMatch = line.match(/📅\s*(\d{4}-\d{2}-\d{2})/);

      if (recurrenceMatch && dueDateMatch) {
        // Recurring task: advance the date, keep unchecked
        const currentDate = dueDateMatch[1];
        const recurrence = recurrenceMatch[1];
        const newDate = nextOccurrence(currentDate, recurrence);
        line = line.replace(/📅\s*\d{4}-\d{2}-\d{2}/, `📅 ${newDate}`);
        // Ensure it stays unchecked (in case it was somehow checked)
        line = line.replace(/- \[x\]/i, '- [ ]');
        // Remove any completion date
        line = line.replace(/\s*✅\s*\d{4}-\d{2}-\d{2}/, '');
      } else {
        // Non-recurring: mark completed
        line = line.replace(/- \[ \]/, '- [x]');
        if (!line.includes('✅')) {
          line = line.trimEnd() + ` ✅ ${today}`;
        }
      }
    } else {
      line = line.replace(/- \[x\]/i, '- [ ]');
      line = line.replace(/\s*✅\s*\d{4}-\d{2}-\d{2}/, '');
    }

    lines[lineIndex] = line;
    await this.writeFile(relativePath, lines.join('\n'));
  }

  /**
   * Append a new task to a specific section in a file.
   * If section not found, appends at end of file.
   */
  async appendTask(
    relativePath: string,
    section: string | null,
    taskText: string
  ): Promise<void> {
    const content = await this.readFile(relativePath);
    const lines = content.split('\n');
    const taskLine = `- [ ] ${taskText}`;

    if (!section) {
      lines.push(taskLine);
      await this.writeFile(relativePath, lines.join('\n'));
      return;
    }

    let sectionStart = -1;
    for (let i = 0; i < lines.length; i++) {
      if (
        (lines[i].startsWith('## ') || lines[i].startsWith('### ')) &&
        lines[i].includes(section)
      ) {
        sectionStart = i;
        break;
      }
    }

    if (sectionStart === -1) {
      lines.push(taskLine);
    } else {
      let insertAt = lines.length;
      for (let i = sectionStart + 1; i < lines.length; i++) {
        if (lines[i].startsWith('## ') || lines[i].startsWith('### ')) {
          insertAt = i;
          break;
        }
      }
      lines.splice(insertAt, 0, taskLine);
    }

    await this.writeFile(relativePath, lines.join('\n'));
  }

  /**
   * Initialize vault with famille.md and gamification.md if missing.
   */
  async initVault(profiles: Profile[]): Promise<void> {
    if (!(await this.exists('famille.md'))) {
      const profileSections = profiles
        .map(
          (p) =>
            `### ${p.id}\nname: ${p.name}\nrole: ${p.role}\navatar: ${p.avatar}${
              p.birthdate ? `\nbirthdate: ${p.birthdate}` : ''
            }${p.theme ? `\ntheme: ${p.theme}` : ''}`
        )
        .join('\n\n');

      const familleContent = `---\ntags:\n  - famille\n---\n# Famille\n\n> ← [[00 - Dashboard/Dashboard|Dashboard]]\n\n<!-- Family Vault — profils famille. Éditable dans Obsidian ou dans l'app. -->\n\n## Profils\n\n${profileSections}\n`;
      await this.writeFile('famille.md', familleContent);
    }

    if (!(await this.exists('gamification.md'))) {
      const profileSections = profiles
        .map(
          (p) =>
            `## ${p.name}\npoints: 0\nlevel: 1\nstreak: 0\nloot_boxes_available: 0\nmultiplier: 1\nmultiplier_remaining: 0`
        )
        .join('\n\n');

      const gamiContent = `---\ntags:\n  - gamification\n---\n# Gamification\n\n<!-- Family Vault — historique des points et loot boxes. -->\n\n${profileSections}\n\n## Journal des gains\n`;
      await this.writeFile('gamification.md', gamiContent);
    }
  }

  /**
   * Scaffold a complete vault from scratch.
   * Creates all folders + template files. Never overwrites existing files.
   */
  async scaffoldVault(
    parents: Array<{ name: string; avatar: string }>,
    children: Array<{ name: string; avatar: string; birthdate: string }>
  ): Promise<void> {
    const today = format(new Date(), 'yyyy-MM-dd');
    const allProfiles: Profile[] = [
      ...parents.map((p, i) => ({
        id: p.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '-'),
        name: p.name,
        role: 'adulte' as const,
        avatar: p.avatar,
        points: 0,
        level: 1,
        streak: 0,
        lootBoxesAvailable: 0,
        multiplier: 1,
        multiplierRemaining: 0,
        pityCounter: 0,
      })),
      ...children.map((c, i) => ({
        id: c.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '-'),
        name: c.name,
        role: 'enfant' as const,
        avatar: c.avatar,
        birthdate: c.birthdate,
        points: 0,
        level: 1,
        streak: 0,
        lootBoxesAvailable: 0,
        multiplier: 1,
        multiplierRemaining: 0,
        pityCounter: 0,
      })),
    ];

    // --- famille.md + gamification.md ---
    await this.initVault(allProfiles);

    // --- 00 - Dashboard ---
    await this._writeIfMissing('00 - Dashboard/Dashboard.md', this._dashboardContent(children));

    // --- 01 - Enfants (only if children exist) ---
    if (children.length > 0) {
      for (const child of children) {
        const dir = `01 - Enfants/${child.name}`;
        await this._writeIfMissing(
          `${dir}/Tâches récurrentes.md`,
          this._childTasksContent(child.name, today)
        );
      }
      await this._writeIfMissing(
        '01 - Enfants/Commun/Stock bébé.md',
        this._stockContent()
      );
    }

    // --- 02 - Maison ---
    await this._writeIfMissing('02 - Maison/Tâches récurrentes.md', this._maisonTasksContent(today));
    await this._writeIfMissing('02 - Maison/Liste de courses.md', this._coursesContent());
    await this._writeIfMissing('02 - Maison/Ménage hebdo.md', this._menageContent());
    await this._writeIfMissing('02 - Maison/Repas de la semaine.md', this._mealsContent());

    // --- 03 - Journal (dirs only, per child) ---
    if (children.length > 0) {
      for (const child of children) {
        await this.ensureDir(`03 - Journal/${child.name}`);
      }
    }

    // --- 04 - Rendez-vous ---
    await this.ensureDir('04 - Rendez-vous');

    // --- 07 - Photos (per child) ---
    if (children.length > 0) {
      for (const child of children) {
        await this.ensureDir(`07 - Photos/${child.name}`);
      }
    }
  }

  /** Write file only if it doesn't exist yet */
  private async _writeIfMissing(path: string, content: string): Promise<void> {
    if (!(await this.exists(path))) {
      await this.writeFile(path, content);
    }
  }

  private _dashboardContent(children: Array<{ name: string }>): string {
    const childLinks = children.map(
      (c) => `- [[01 - Enfants/${c.name}/Tâches récurrentes|${c.name} — Tâches]]`
    ).join('\n');

    return `---\ntags:\n  - dashboard\n---\n# Dashboard Famille\n\n## Enfants\n${childLinks || '*(Pas d\'enfants configurés)*'}\n\n## Maison\n- [[02 - Maison/Ménage hebdo|Ménage hebdo]]\n- [[02 - Maison/Liste de courses|Liste de courses]]\n- [[02 - Maison/Tâches récurrentes|Tâches maison]]\n\n## Rendez-vous\n- [[04 - Rendez-vous|Tous les rendez-vous]]\n`;
  }

  private _childTasksContent(childName: string, today: string): string {
    const slug = childName.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '-');
    return `---\ntags:\n  - taches\n  - ${slug}\n---\n> ← [[00 - Dashboard/Dashboard|Dashboard]]\n\n# Tâches récurrentes — ${childName}\n\n## Quotidien\n- [ ] Préparer les biberons 🔁 every day 📅 ${today}\n- [ ] Laver biberons / tétines 🔁 every day 📅 ${today}\n- [ ] Vider la poubelle à couches 🔁 every day 📅 ${today}\n- [ ] Nettoyer le tapis à langer 🔁 every day 📅 ${today}\n- [ ] Bain 🔁 every day 📅 ${today}\n- [ ] Vérifier le stock de couches 🔁 every day 📅 ${today}\n- [ ] Vérifier le stock de lait 🔁 every day 📅 ${today}\n\n## Hebdomadaire\n- [ ] Laver le linge bébé 🔁 every week 📅 ${today}\n- [ ] Stériliser les accessoires 🔁 every week 📅 ${today}\n- [ ] Nettoyer le lit / berceau 🔁 every week 📅 ${today}\n\n## Mensuel\n- [ ] Vérifier la taille des vêtements 🔁 every month 📅 ${today}\n- [ ] Trier les vêtements trop petits 🔁 every month 📅 ${today}\n- [ ] Vérifier les produits de soin 🔁 every month 📅 ${today}\n`;
  }

  private _stockContent(): string {
    return `---\ntags:\n  - stock\n---\n> ← [[00 - Dashboard/Dashboard|Dashboard]]\n\n# Stock bébé\n\n## Couches\n- Taille actuelle : \n- Stock restant : \n\n## Lait\n- Marque : \n- Stock restant : \n\n## Produits de soin\n- Liniment : \n- Sérum physiologique : \n- Crème : \n`;
  }

  private _maisonTasksContent(today: string): string {
    return `---\ntags:\n  - taches\n  - maison\n---\n> ← [[00 - Dashboard/Dashboard|Dashboard]]\n\n# Tâches récurrentes — Maison\n\n## Tous les 3 jours\n\n## Hebdomadaire\n\n## Mensuel\n`;
  }

  private _coursesContent(): string {
    return `---\ntags:\n  - maison\n  - courses\n---\n> ← [[00 - Dashboard/Dashboard|Dashboard]]\n\n# Liste de courses\n\n## 🥩 Frais\n- [ ] \n\n## 🥦 Fruits & légumes\n- [ ] \n\n## 👶 Produits bébé\n- [ ] Couches\n- [ ] Lingettes\n\n## 🧴 Hygiène\n- [ ] \n\n## 🏠 Maison\n- [ ] \n\n## 🍞 Épicerie\n- [ ] \n`;
  }

  private _menageContent(): string {
    return `---\ntags:\n  - maison\n  - menage\n---\n> ← [[00 - Dashboard/Dashboard|Dashboard]]\n\n# Ménage hebdomadaire\n\n## Lundi — Cuisine\n- [ ] Nettoyer la cuisine\n- [ ] Lave vaisselle\n- [ ] Changer les serviettes\n\n## Mardi — Salle de bain\n- [ ] Nettoyer lavabo & miroir\n- [ ] Nettoyer les toilettes\n- [ ] Sortir les poubelles\n\n## Mercredi — Cuisine\n- [ ] Nettoyer les plans de travail\n- [ ] Nettoyer l'évier\n- [ ] Lave vaisselle\n\n## Jeudi — Chambres\n- [ ] Changer les draps\n- [ ] Aspirer les chambres\n- [ ] Ranger\n\n## Vendredi — Sols & Courses\n- [ ] Aspirer le salon\n- [ ] Passer la serpillière\n- [ ] Faire les courses\n\n## Samedi — Sols\n- [ ] Aspirer tout le rez-de-chaussée\n- [ ] Passer la serpillière\n- [ ] Nettoyer les vitres (si nécessaire)\n\n## Dimanche — Repos / rattrapage\n- [ ] Rattraper les tâches en retard\n- [ ] Préparer la semaine\n`;
  }

  private _mealsContent(): string {
    return `# Repas de la semaine

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
`;
  }

  /** Validate that vaultPath points to a real directory */
  static async validate(vaultPath: string): Promise<boolean> {
    try {
      const uri = vaultPath.startsWith('file://') ? vaultPath : `file://${vaultPath}`;
      const info = await FileSystem.getInfoAsync(uri);
      return info.exists && ('isDirectory' in info ? (info.isDirectory ?? false) : false);
    } catch {
      return false;
    }
  }
}
