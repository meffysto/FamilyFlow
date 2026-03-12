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
import { Platform } from 'react-native';
import {
  coordinatedReadFile,
  coordinatedWriteFile,
  coordinatedEnsureDir,
  coordinatedDeleteFile,
  coordinatedCopyFile,
  coordinatedListDir,
  coordinatedIsDirectory,
  coordinatedFileExists,
  downloadICloudFiles,
} from '../modules/vault-access/src';
import { Profile } from './types';
import { format } from 'date-fns';
import { nextOccurrence } from './recurrence';
import { TEMPLATE_PACKS, TemplateContext } from './vault-templates';

export class VaultManager {
  vaultPath: string;

  constructor(vaultPath: string) {
    // Normalize: remove trailing slash
    this.vaultPath = vaultPath.replace(/\/$/, '');
  }

  /** Absolute URI for a relative vault path */
  private uri(relativePath: string): string {
    // When vaultPath is already a URI (file:// or content://), encode relative path components
    const isUri = this.vaultPath.startsWith('file://') || this.vaultPath.startsWith('content://');
    const rel = isUri
      ? relativePath.split('/').map((c) => encodeURIComponent(c)).join('/')
      : relativePath;
    const path = `${this.vaultPath}/${rel}`;
    if (isUri) return path;
    return `file://${path}`;
  }

  /** Read a file, returns content string */
  async readFile(relativePath: string): Promise<string> {
    const uri = this.uri(relativePath);
    try {
      // Try coordinated read first (required for iCloud Drive files)
      if (Platform.OS !== 'web') {
        const coordinated = await coordinatedReadFile(uri);
        if (coordinated !== null) return coordinated;
      }
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
    // On iOS, use NSFileCoordinator for file provider compatibility (Obsidian, iCloud…)
    // Falls back to expo-file-system if native module unavailable (Expo Go)
    if (Platform.OS !== 'web') {
      const ok = await coordinatedWriteFile(uri, content);
      if (ok) return;
    }
    // Fallback: expo-file-system (Android, desktop, Expo Go)
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
    if (Platform.OS !== 'web') {
      const ok = await coordinatedDeleteFile(uri);
      if (ok) return;
    }
    await FileSystem.deleteAsync(uri, { idempotent: true });
  }

  /** Check if a file or directory exists */
  async exists(relativePath: string): Promise<boolean> {
    const uri = this.uri(relativePath);
    try {
      // Sur iOS, utiliser FileManager natif (fonctionne avec les dossiers partagés iCloud)
      if (Platform.OS !== 'web') {
        const nativeExists = await coordinatedFileExists(uri);
        if (nativeExists !== null) return nativeExists;
      }
      const info = await FileSystem.getInfoAsync(uri);
      return info.exists;
    } catch {
      return false;
    }
  }

  /** Ensure a directory exists (recursive) */
  async ensureDir(relativeDir: string): Promise<void> {
    const uri = this.uri(relativeDir);
    if (Platform.OS !== 'web') {
      const ok = await coordinatedEnsureDir(uri);
      if (ok) return;
    }
    const info = await FileSystem.getInfoAsync(uri);
    if (!info.exists) {
      await FileSystem.makeDirectoryAsync(uri, { intermediates: true });
    }
  }

  /** List files in a directory (non-recursive) */
  async listDir(relativeDir: string): Promise<string[]> {
    const uri = this.uri(relativeDir);
    try {
      // Sur iOS, utiliser NSFileCoordinator (requis pour les dossiers partagés iCloud)
      if (Platform.OS !== 'web') {
        const coordinated = await coordinatedListDir(uri);
        if (coordinated !== null) return coordinated;
      }
      const entries = await FileSystem.readDirectoryAsync(uri);
      return entries;
    } catch {
      return [];
    }
  }

  /** List all files with a given extension in a directory recursively */
  async listFilesRecursive(relativeDir: string, extension: string = '.md'): Promise<string[]> {
    const entries = await this.listDir(relativeDir);
    const results: string[] = [];
    for (const entry of entries) {
      const entryPath = relativeDir ? `${relativeDir}/${entry}` : entry;
      if (entry.endsWith(extension)) {
        results.push(entryPath);
      } else if (!entry.startsWith('.')) {
        // Sur iOS, utiliser le module natif pour vérifier si c'est un dossier
        const uri = this.uri(entryPath);
        let isDir = false;
        if (Platform.OS !== 'web') {
          const nativeIsDir = await coordinatedIsDirectory(uri);
          if (nativeIsDir !== null) {
            isDir = nativeIsDir;
          } else {
            const info = await FileSystem.getInfoAsync(uri);
            isDir = 'isDirectory' in info && (info.isDirectory ?? false);
          }
        } else {
          const info = await FileSystem.getInfoAsync(uri);
          isDir = 'isDirectory' in info && (info.isDirectory ?? false);
        }
        if (isDir) {
          const sub = await this.listFilesRecursive(entryPath, extension);
          results.push(...sub);
        }
      }
    }
    return results;
  }

  /** List all .md files in a directory recursively */
  async listMarkdownFiles(relativeDir: string): Promise<string[]> {
    return this.listFilesRecursive(relativeDir, '.md');
  }

  /** Copy a file (e.g. image) into the vault */
  async copyFileToVault(sourceUri: string, relativePath: string): Promise<void> {
    const destUri = this.uri(relativePath);
    if (Platform.OS !== 'web') {
      const ok = await coordinatedCopyFile(sourceUri, destUri);
      if (ok) {
        // Vérifier avec le module natif (FileSystem.getInfoAsync ne voit pas les containers iCloud)
        const nativeExists = await coordinatedFileExists(destUri);
        if (nativeExists === false) {
          throw new Error(`Copie échouée.\nSource: ${sourceUri}\nDest: ${destUri}`);
        }
        return;
      }
    }
    // Fallback: expo-file-system (Android, Expo Go)
    const parts = relativePath.split('/');
    if (parts.length > 1) {
      const dir = parts.slice(0, -1).join('/');
      await this.ensureDir(dir);
    }
    await FileSystem.copyAsync({ from: sourceUri, to: destUri });

    const info = await FileSystem.getInfoAsync(destUri);
    if (!info.exists) {
      throw new Error(`Copie échouée.\nSource: ${sourceUri}\nDest: ${destUri}`);
    }
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

  /** Get the file URI for a child's photo on a given date (encoded for Image component) */
  getPhotoUri(enfantName: string, date: string): string {
    const raw = this.uri(`07 - Photos/${enfantName}/${date}.jpg`);
    // Encode spaces for React Native Image component (file:// URIs need %20)
    return raw.replace(/ /g, '%20');
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
      const recurrenceMatch = line.match(/🔁\s*(every\s+(?:\d+\s+)?(?:day|week|month)s?)/);
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
      // Section inexistante → la créer en fin de fichier
      lines.push('', `## ${section}`, taskLine);
      await this.writeFile(relativePath, lines.join('\n'));
      return;
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
            }${p.ageCategory ? `\nageCategory: ${p.ageCategory}` : ''
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
   * Install template packs into the vault.
   * Appends to existing files or creates new ones (never overwrites non-empty files).
   */
  async installTemplates(
    packIds: string[],
    parents: Array<{ name: string; avatar: string }>,
    children: Array<{ name: string; avatar: string; birthdate: string }>
  ): Promise<{ installed: number; skipped: number }> {
    const ctx: TemplateContext = {
      parents,
      children: children.map(c => ({
        ...c,
        ageCategory: this._getAgeCategory(c.birthdate),
      })),
      today: format(new Date(), 'yyyy-MM-dd'),
    };

    let installed = 0;
    let skipped = 0;

    for (const packId of packIds) {
      const pack = TEMPLATE_PACKS.find(p => p.id === packId);
      if (!pack) continue;

      const files = pack.generate(ctx);
      for (const file of files) {
        if (file.append) {
          const existing = await this.readFile(file.path).catch(() => '');
          await this.writeFile(file.path, existing.trimEnd() + '\n\n' + file.content);
          installed++;
        } else {
          // Écrire seulement si le fichier n'existe pas ou est vide/template
          const exists = await this.exists(file.path);
          if (!exists) {
            await this.writeFile(file.path, file.content);
            installed++;
          } else {
            const existing = await this.readFile(file.path);
            // Remplacer si le contenu est essentiellement vide (juste des en-têtes sans données)
            const hasRealContent = existing.split('\n').some(l =>
              l.startsWith('- [') || (l.startsWith('- ') && l.includes(':') && l.split(':')[1]?.trim().length > 0)
            );
            if (!hasRealContent) {
              await this.writeFile(file.path, file.content);
              installed++;
            } else {
              skipped++;
            }
          }
        }
      }
    }

    return { installed, skipped };
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
        ageCategory: this._getAgeCategory(c.birthdate),
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

    // --- Compute age categories ---
    const ageCategories = new Set(children.map((c) => this._getAgeCategory(c.birthdate)));

    // --- 01 - Enfants (only if children exist) ---
    if (children.length > 0) {
      for (const child of children) {
        const dir = `01 - Enfants/${child.name}`;
        await this._writeIfMissing(
          `${dir}/Tâches récurrentes.md`,
          this._childTasksContent(child.name, today, child.birthdate)
        );
      }
      await this._writeIfMissing(
        '01 - Enfants/Commun/Stock & fournitures.md',
        this._stockContent(ageCategories)
      );
    }

    // --- 02 - Maison ---
    await this._writeIfMissing('02 - Maison/Tâches récurrentes.md', this._maisonTasksContent(today));
    await this._writeIfMissing('02 - Maison/Liste de courses.md', this._coursesContent(ageCategories));
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

    // --- 06 - Mémoires (Jalons per child) ---
    if (children.length > 0) {
      for (const child of children) {
        await this._writeIfMissing(
          `06 - Mémoires/${child.name}/Jalons.md`,
          this._jalonsContent(child.name, child.birthdate)
        );
      }
    }

    // --- 07 - Photos (per child) ---
    if (children.length > 0) {
      for (const child of children) {
        await this.ensureDir(`07 - Photos/${child.name}`);
      }
    }
  }

  /**
   * Add a child to an existing vault (post-setup).
   * Creates profile in famille.md + gamification.md + all child files/dirs.
   */
  async addChild(child: { name: string; avatar: string; birthdate: string; propre?: boolean; statut?: 'grossesse'; dateTerme?: string }): Promise<void> {
    const today = format(new Date(), 'yyyy-MM-dd');
    const id = child.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '-');
    const isGrossesse = child.statut === 'grossesse';
    const ageCategory = isGrossesse ? undefined : this._getAgeCategory(child.birthdate);

    // 1. Append profile to famille.md
    const familleContent = await this.readFile('famille.md');
    const profileSection = `\n### ${id}\nname: ${child.name}\nrole: enfant\navatar: ${child.avatar}${
      child.birthdate ? `\nbirthdate: ${child.birthdate}` : ''
    }${ageCategory ? `\nageCategory: ${ageCategory}` : ''
    }${child.propre ? '\npropre: true' : ''
    }${isGrossesse ? '\nstatut: grossesse' : ''
    }${child.dateTerme ? `\ndateTerme: ${child.dateTerme}` : ''}\n`;
    await this.writeFile('famille.md', familleContent.trimEnd() + '\n' + profileSection);

    // 2. Append to gamification.md
    const gamiContent = await this.readFile('gamification.md');
    const gamiSection = `\n## ${child.name}\npoints: 0\nlevel: 1\nstreak: 0\nloot_boxes_available: 0\nmultiplier: 1\nmultiplier_remaining: 0\n`;
    // Insert before "## Journal des gains" if it exists
    const journalIdx = gamiContent.indexOf('## Journal des gains');
    if (journalIdx > 0) {
      const before = gamiContent.slice(0, journalIdx);
      const after = gamiContent.slice(journalIdx);
      await this.writeFile('gamification.md', before.trimEnd() + '\n' + gamiSection + '\n' + after);
    } else {
      await this.writeFile('gamification.md', gamiContent.trimEnd() + '\n' + gamiSection);
    }

    // 3. Create child files
    const dir = `01 - Enfants/${child.name}`;
    if (isGrossesse) {
      await this.writeFile(`${dir}/Tâches récurrentes.md`, this._grossesseTasksContent(child.name, today, child.dateTerme));
      await this._writeIfMissing(`06 - Mémoires/${child.name}/Jalons.md`, this._grossesseJalonsContent(child.name));
    } else {
      await this.writeFile(`${dir}/Tâches récurrentes.md`, this._childTasksContent(child.name, today, child.birthdate));
      await this._writeIfMissing(`06 - Mémoires/${child.name}/Jalons.md`, this._jalonsContent(child.name, child.birthdate));
    }
    await this.ensureDir(`03 - Journal/${child.name}`);
    await this.ensureDir(`07 - Photos/${child.name}`);

    // 4. Update Dashboard.md — add link
    try {
      const dashContent = await this.readFile('00 - Dashboard/Dashboard.md');
      const newLink = `- [[01 - Enfants/${child.name}/Tâches récurrentes|${child.name} — Tâches]]`;
      if (!dashContent.includes(child.name)) {
        const updated = dashContent.replace(
          /## Maison/,
          `${newLink}\n\n## Maison`
        );
        await this.writeFile('00 - Dashboard/Dashboard.md', updated);
      }
    } catch { /* Dashboard.md may not exist */ }
  }

  /**
   * Convert a grossesse profile to a born child.
   * Replaces pregnancy templates with baby templates.
   */
  async convertToBorn(profileId: string, birthdate: string): Promise<void> {
    const today = format(new Date(), 'yyyy-MM-dd');

    // 1. Update famille.md
    const familleContent = await this.readFile('famille.md');
    const lines = familleContent.split('\n');
    let inSection = false;
    let sectionEnd = lines.length;
    let sectionStart = -1;
    let childName = '';

    for (let i = 0; i < lines.length; i++) {
      if (lines[i].startsWith('### ')) {
        if (inSection) { sectionEnd = i; break; }
        if (lines[i].replace('### ', '').trim() === profileId) {
          inSection = true;
          sectionStart = i;
        }
      } else if (inSection && lines[i].includes(': ')) {
        const key = lines[i].slice(0, lines[i].indexOf(':')).trim();
        const val = lines[i].slice(lines[i].indexOf(':') + 1).trim();
        if (key === 'name') childName = val;
      }
    }
    if (sectionStart === -1 || !childName) return;

    // Update fields in section
    let foundBirthdate = false;
    let foundStatut = false;
    let foundDateTerme = false;
    let foundAgeCategory = false;
    for (let i = sectionStart + 1; i < sectionEnd; i++) {
      const key = lines[i].slice(0, lines[i].indexOf(':')).trim();
      if (key === 'birthdate') { lines[i] = `birthdate: ${birthdate}`; foundBirthdate = true; }
      if (key === 'statut') { lines.splice(i, 1); sectionEnd--; i--; foundStatut = true; }
      if (key === 'dateTerme') { lines.splice(i, 1); sectionEnd--; i--; foundDateTerme = true; }
      if (key === 'ageCategory') { lines[i] = `ageCategory: bebe`; foundAgeCategory = true; }
    }
    if (!foundBirthdate) {
      let lastProp = sectionStart;
      for (let i = sectionStart + 1; i < sectionEnd; i++) { if (lines[i].includes(': ')) lastProp = i; }
      lines.splice(lastProp + 1, 0, `birthdate: ${birthdate}`);
      sectionEnd++;
    }
    if (!foundAgeCategory) {
      let lastProp = sectionStart;
      for (let i = sectionStart + 1; i < sectionEnd; i++) { if (lines[i].includes(': ')) lastProp = i; }
      lines.splice(lastProp + 1, 0, `ageCategory: bebe`);
    }
    await this.writeFile('famille.md', lines.join('\n'));

    // 2. Replace tasks with baby templates
    const tasksPath = `01 - Enfants/${childName}/Tâches récurrentes.md`;
    await this.writeFile(tasksPath, this._childTasksContent(childName, today, birthdate));

    // 3. Replace jalons with baby templates
    const jalonsPath = `06 - Mémoires/${childName}/Jalons.md`;
    await this.writeFile(jalonsPath, this._jalonsContent(childName, birthdate));
  }

  /** Write file only if it doesn't exist yet */
  private async _writeIfMissing(path: string, content: string): Promise<void> {
    if (!(await this.exists(path))) {
      await this.writeFile(path, content);
    }
  }

  /** Determine age category from birthdate (YYYY or YYYY-MM-DD) */
  private _getAgeCategory(birthdate?: string): 'bebe' | 'petit' | 'enfant' | 'ado' {
    if (!birthdate) return 'bebe';
    const year = parseInt(birthdate.slice(0, 4), 10);
    if (isNaN(year)) return 'bebe';
    const now = new Date();
    const age = now.getFullYear() - year;
    if (age <= 2) return 'bebe';
    if (age <= 5) return 'petit';
    if (age <= 11) return 'enfant';
    return 'ado';
  }

  private _dashboardContent(children: Array<{ name: string }>): string {
    const childLinks = children.map(
      (c) => `- [[01 - Enfants/${c.name}/Tâches récurrentes|${c.name} — Tâches]]`
    ).join('\n');

    return `---\ntags:\n  - dashboard\n---\n# Dashboard Famille\n\n## Enfants\n${childLinks || '*(Pas d\'enfants configurés)*'}\n\n## Maison\n- [[02 - Maison/Ménage hebdo|Ménage hebdo]]\n- [[02 - Maison/Liste de courses|Liste de courses]]\n- [[02 - Maison/Tâches récurrentes|Tâches maison]]\n\n## Rendez-vous\n- [[04 - Rendez-vous|Tous les rendez-vous]]\n`;
  }

  private _childTasksContent(childName: string, today: string, birthdate?: string): string {
    const slug = childName.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '-');
    const cat = this._getAgeCategory(birthdate);
    const header = `---\ntags:\n  - taches\n  - ${slug}\n---\n> ← [[00 - Dashboard/Dashboard|Dashboard]]\n\n# Tâches récurrentes — ${childName}\n\n`;

    if (cat === 'bebe') {
      return header + `## Quotidien\n- [ ] Préparer les biberons 🔁 every day 📅 ${today}\n- [ ] Laver biberons / tétines 🔁 every day 📅 ${today}\n- [ ] Vider la poubelle à couches 🔁 every day 📅 ${today}\n- [ ] Nettoyer le tapis à langer 🔁 every day 📅 ${today}\n- [ ] Bain 🔁 every day 📅 ${today}\n- [ ] Vérifier le stock de couches 🔁 every day 📅 ${today}\n- [ ] Vérifier le stock de lait 🔁 every day 📅 ${today}\n\n## Hebdomadaire\n- [ ] Laver le linge bébé 🔁 every week 📅 ${today}\n- [ ] Stériliser les accessoires 🔁 every week 📅 ${today}\n- [ ] Nettoyer le lit / berceau 🔁 every week 📅 ${today}\n\n## Mensuel\n- [ ] Vérifier la taille des vêtements 🔁 every month 📅 ${today}\n- [ ] Trier les vêtements trop petits 🔁 every month 📅 ${today}\n- [ ] Vérifier les produits de soin 🔁 every month 📅 ${today}\n`;
    }

    if (cat === 'petit') {
      return header + `## Quotidien\n- [ ] Brossage de dents matin 🔁 every day 📅 ${today}\n- [ ] Brossage de dents soir 🔁 every day 📅 ${today}\n- [ ] S'habiller tout seul 🔁 every day 📅 ${today}\n- [ ] Ranger les jouets 🔁 every day 📅 ${today}\n- [ ] Bain / douche 🔁 every day 📅 ${today}\n\n## Hebdomadaire\n- [ ] Laver le linge 🔁 every week 📅 ${today}\n- [ ] Nettoyer la chambre 🔁 every week 📅 ${today}\n- [ ] Activité / sortie 🔁 every week 📅 ${today}\n\n## Mensuel\n- [ ] Vérifier la taille des vêtements 🔁 every month 📅 ${today}\n- [ ] Vérifier les chaussures 🔁 every month 📅 ${today}\n- [ ] Trier les jouets 🔁 every month 📅 ${today}\n`;
    }

    if (cat === 'enfant') {
      return header + `## Quotidien\n- [ ] Préparer le cartable 🔁 every day 📅 ${today}\n- [ ] Faire les devoirs 🔁 every day 📅 ${today}\n- [ ] Douche 🔁 every day 📅 ${today}\n- [ ] Ranger la chambre 🔁 every day 📅 ${today}\n\n## Hebdomadaire\n- [ ] Laver le linge 🔁 every week 📅 ${today}\n- [ ] Ranger le bureau 🔁 every week 📅 ${today}\n- [ ] Activité extra-scolaire 🔁 every week 📅 ${today}\n\n## Mensuel\n- [ ] Vérifier les fournitures scolaires 🔁 every month 📅 ${today}\n- [ ] Vérifier les vêtements 🔁 every month 📅 ${today}\n`;
    }

    // ado
    return header + `## Quotidien\n- [ ] Ranger la chambre 🔁 every day 📅 ${today}\n- [ ] Mettre le linge sale au panier 🔁 every day 📅 ${today}\n- [ ] Faire les devoirs 🔁 every day 📅 ${today}\n\n## Hebdomadaire\n- [ ] Faire sa lessive 🔁 every week 📅 ${today}\n- [ ] Ménage de la chambre 🔁 every week 📅 ${today}\n- [ ] Aider en cuisine 🔁 every week 📅 ${today}\n\n## Mensuel\n- [ ] Gérer son argent de poche 🔁 every month 📅 ${today}\n- [ ] Vérifier les fournitures scolaires 🔁 every month 📅 ${today}\n`;
  }

  private _stockContent(categories: Set<string>): string {
    const header = `---\ntags:\n  - stock\n  - enfants\ncssclasses:\n  - stock\n---\n> ← [[00 - Dashboard/Dashboard|Dashboard]]\n\n# Stock & fournitures — Enfants\n\n`;
    const sections: string[] = [];

    if (categories.has('bebe')) {
      sections.push(`## Couches\n\n| Produit | Détail | Paquets restants | Seuil | Qté/achat |\n| ------- | ------ | ---------------- | ----- | --------- |\n| Couches | T4     | 3                | 1     | 3         |\n\n## Alimentation bébé\n\n| Produit          | Détail | Paquets restants | Seuil | Qté/achat |\n| ---------------- | ------ | ---------------- | ----- | --------- |\n| Lait infantile   |        | 2                | 1     | 2         |`);
    }

    if (categories.has('bebe') || categories.has('petit')) {
      sections.push(`## Hygiène & soins\n\n| Produit             | Détail | Paquets restants | Seuil | Qté/achat |\n| ------------------- | ------ | ---------------- | ----- | --------- |\n| Lingettes           |        | 2                | 2     | 1         |\n| Sérum physiologique |        | 2                | 1     | 1         |`);
    }

    if (categories.has('enfant') || categories.has('ado')) {
      sections.push(`## Fournitures scolaires\n\n| Produit       | Détail | Qté restante | Seuil | Qté/achat |\n| ------------- | ------ | ------------ | ----- | --------- |\n| Cahiers       |        | 3            | 1     | 3         |\n| Stylos        |        | 5            | 2     | 5         |`);
    }

    if (sections.length === 0) {
      sections.push(`## Hygiène\n\n| Produit | Détail | Paquets restants | Seuil | Qté/achat |\n| ------- | ------ | ---------------- | ----- | --------- |\n| Savon   |        | 2                | 1     | 1         |`);
    }

    return header + sections.join('\n\n') + '\n';
  }

  private _maisonTasksContent(today: string): string {
    return `---\ntags:\n  - taches\n  - maison\n---\n> ← [[00 - Dashboard/Dashboard|Dashboard]]\n\n# Tâches récurrentes — Maison\n\n## Tous les 3 jours\n\n## Hebdomadaire\n\n## Mensuel\n`;
  }

  private _coursesContent(categories: Set<string>): string {
    const hasBebe = categories.has('bebe');
    const hasKids = categories.has('enfant') || categories.has('ado') || categories.has('petit');

    let kidSection = '';
    if (hasBebe) {
      kidSection = `\n## 👶 Produits bébé\n- [ ] Couches\n- [ ] Lingettes\n- [ ] Lait infantile\n`;
    } else if (hasKids) {
      kidSection = `\n## 🎒 Goûters & fournitures\n- [ ] Goûters\n- [ ] Jus de fruits\n`;
    }

    return `---\ntags:\n  - maison\n  - courses\n---\n> ← [[00 - Dashboard/Dashboard|Dashboard]]\n\n# Liste de courses\n\n## 🥩 Frais\n- [ ] \n\n## 🥦 Fruits & légumes\n- [ ] ${kidSection}\n## 🧴 Hygiène\n- [ ] \n\n## 🏠 Maison\n- [ ] \n\n## 🍞 Épicerie\n- [ ] \n`;
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

  private _grossesseTasksContent(childName: string, today: string, dateTerme?: string): string {
    const slug = childName.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '-');
    return `---\ntags:\n  - taches\n  - ${slug}\n  - grossesse\n---\n> ← [[00 - Dashboard/Dashboard|Dashboard]]\n\n# Suivi grossesse — ${childName}\n\n## Suivi médical\n- [ ] Prise de sang T1\n- [ ] Échographie T1 (12 SA)\n- [ ] Prise de sang T2\n- [ ] Échographie T2 (22 SA)\n- [ ] Prise de sang T3\n- [ ] Échographie T3 (32 SA)\n- [ ] Visite sage-femme 🔁 every month 📅 ${today}\n- [ ] Monitoring (dernier mois) 🔁 every week 📅 ${today}\n\n## Préparation\n- [ ] Choisir la maternité\n- [ ] S'inscrire à la maternité\n- [ ] Cours de préparation à l'accouchement\n- [ ] Préparer la chambre bébé\n- [ ] Acheter le lit / berceau\n- [ ] Acheter la poussette\n- [ ] Acheter le siège auto\n\n## Administratif\n- [ ] Déclarer la grossesse (CAF + employeur)\n- [ ] Organiser le congé maternité / paternité\n- [ ] Choisir le prénom\n- [ ] Préparer le dossier de naissance\n\n## Valise maternité\n- [ ] Bodies + pyjamas nouveau-né\n- [ ] Bonnet + chaussettes\n- [ ] Doudou\n- [ ] Couches taille 1\n- [ ] Produits de toilette bébé\n- [ ] Tenue de sortie\n- [ ] Documents (carte vitale, mutuelle, groupe sanguin)\n- [ ] Vêtements confortables maman\n`;
  }

  private _grossesseJalonsContent(childName: string): string {
    const slug = childName.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '-');
    return `---\ntags:\n  - memoires\n  - ${slug}\n  - grossesse\n---\n> ← [[00 - Dashboard/Dashboard|Dashboard]]\n\n# Jalons grossesse — ${childName}\n\n## 🤰 Étapes grossesse\n- Annonce de la grossesse\n- Première échographie\n- Premiers coups ressentis\n- Sexe connu\n- Choix du prénom\n\n## 🎁 Préparatifs\n- Chambre prête\n- Valise prête\n- Siège auto installé\n\n## 💛 Moments forts\n\n`;
  }

  private _jalonsContent(childName: string, birthdate?: string): string {
    const slug = childName.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '-');
    const cat = this._getAgeCategory(birthdate);
    const header = `---\ntags:\n  - memoires\n  - ${slug}\n---\n> ← [[00 - Dashboard/Dashboard|Dashboard]]\n\n# Jalons — ${childName}\n\n`;

    if (cat === 'bebe') {
      return header + `## 🌟 Premières fois\n- Premier sourire\n- Premier mot\n- Premiers pas\n- Première dent\n\n## 💛 Moments forts\n\n`;
    }
    if (cat === 'petit') {
      return header + `## 🌟 Premières fois\n- Première rentrée\n- Vélo sans roulettes\n- Première nuit chez un copain\n\n## 💛 Moments forts\n\n`;
    }
    if (cat === 'enfant') {
      return header + `## 🎯 Étapes\n- Lire tout seul\n- Première sortie scolaire\n- Premier sport / activité\n\n## 💛 Moments forts\n\n`;
    }
    // ado
    return header + `## 🎯 Moments clés\n- Premier téléphone\n- Premier voyage seul\n- Orientation scolaire\n\n## 💛 Moments forts\n\n`;
  }

  /** Validate that vaultPath points to a real directory */
  static async validate(vaultPath: string): Promise<boolean> {
    try {
      const uri = vaultPath.startsWith('file://') ? vaultPath : `file://${vaultPath}`;
      // Sur iOS, utiliser le module natif (fonctionne avec les dossiers partagés iCloud)
      if (Platform.OS !== 'web') {
        const nativeIsDir = await coordinatedIsDirectory(uri);
        if (nativeIsDir !== null) return nativeIsDir;
      }
      const info = await FileSystem.getInfoAsync(uri);
      return info.exists && ('isDirectory' in info ? (info.isDirectory ?? false) : false);
    } catch {
      return false;
    }
  }
}
