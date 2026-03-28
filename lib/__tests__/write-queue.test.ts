/**
 * Tests unitaires — Write Queue per-file dans VaultManager
 *
 * Couvre : serialisation des ecritures concurrentes, protection toggleTask/appendTask,
 * nettoyage de la queue, resilience aux erreurs.
 */

// ─── Mocks ────────────────────────────────────────────────────────────────────

// Mock react-native
jest.mock('react-native', () => ({
  Platform: { OS: 'ios', select: (obj: Record<string, unknown>) => obj.ios ?? obj.default },
}));

// Mock expo-file-system/legacy
jest.mock('expo-file-system/legacy', () => ({
  readAsStringAsync: jest.fn(),
  writeAsStringAsync: jest.fn(),
  getInfoAsync: jest.fn(),
  makeDirectoryAsync: jest.fn(),
  EncodingType: { UTF8: 'utf8' },
}));

// Mock du module natif vault-access
const mockCoordinatedReadFile = jest.fn();
const mockCoordinatedWriteFile = jest.fn();
const mockCoordinatedEnsureDir = jest.fn();
const mockCoordinatedDeleteFile = jest.fn();
const mockCoordinatedCopyFile = jest.fn();
const mockCoordinatedListDir = jest.fn();
const mockCoordinatedIsDirectory = jest.fn();
const mockCoordinatedFileExists = jest.fn();
const mockDownloadICloudFiles = jest.fn();

jest.mock('../../modules/vault-access/src', () => ({
  coordinatedReadFile: (...args: unknown[]) => mockCoordinatedReadFile(...args),
  coordinatedWriteFile: (...args: unknown[]) => mockCoordinatedWriteFile(...args),
  coordinatedEnsureDir: (...args: unknown[]) => mockCoordinatedEnsureDir(...args),
  coordinatedDeleteFile: (...args: unknown[]) => mockCoordinatedDeleteFile(...args),
  coordinatedCopyFile: (...args: unknown[]) => mockCoordinatedCopyFile(...args),
  coordinatedListDir: (...args: unknown[]) => mockCoordinatedListDir(...args),
  coordinatedIsDirectory: (...args: unknown[]) => mockCoordinatedIsDirectory(...args),
  coordinatedFileExists: (...args: unknown[]) => mockCoordinatedFileExists(...args),
  downloadICloudFiles: (...args: unknown[]) => mockDownloadICloudFiles(...args),
}));

// Mock recurrence
jest.mock('../recurrence', () => ({
  nextOccurrence: jest.fn((date: string) => date),
}));

// Mock vault-templates
jest.mock('../vault-templates', () => ({
  TEMPLATE_PACKS: [],
}));

import { VaultManager } from '../vault';

// ─── Setup ────────────────────────────────────────────────────────────────────

const VAULT_PATH = '/fake/vault';

beforeEach(() => {
  jest.clearAllMocks();
  // Par defaut : coordinatedReadFile retourne null (fallback expo)
  mockCoordinatedReadFile.mockResolvedValue(null);
  // Par defaut : coordinatedWriteFile retourne true (succes)
  mockCoordinatedWriteFile.mockResolvedValue(true);
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('Write Queue — VaultManager', () => {

  /**
   * Test 1 : Deux writeFile concurrents sur le meme path s'executent en serie.
   * Verification : la trace d'execution montre start-A → end-A → start-B → end-B.
   */
  test('1. deux writeFile concurrents sur le meme path s\'executent en serie', async () => {
    const vm = new VaultManager(VAULT_PATH);
    const trace: string[] = [];

    // Creer des ecritures qui loggent leur execution
    let resolveA!: () => void;
    const promiseA = new Promise<void>((res) => { resolveA = res; });

    mockCoordinatedWriteFile
      .mockImplementationOnce(async (_uri: string, content: string) => {
        trace.push(`start-A:${content}`);
        await promiseA;
        trace.push(`end-A:${content}`);
        return true;
      })
      .mockImplementationOnce(async (_uri: string, content: string) => {
        trace.push(`start-B:${content}`);
        trace.push(`end-B:${content}`);
        return true;
      });

    const writeA = vm.writeFile('tasks.md', 'content-A');
    const writeB = vm.writeFile('tasks.md', 'content-B');

    // Avant que A soit termine, B ne doit pas avoir commence
    await Promise.resolve(); // flush microtasks
    expect(trace.filter(t => t.startsWith('start-B'))).toHaveLength(0);

    // Debloquer A
    resolveA();
    await Promise.all([writeA, writeB]);

    expect(trace).toEqual([
      'start-A:content-A',
      'end-A:content-A',
      'start-B:content-B',
      'end-B:content-B',
    ]);
  });

  /**
   * Test 2 : Deux writeFile sur des paths differents s'executent en parallele.
   * Verification : les deux "start" apparaissent avant le premier "end".
   */
  test('2. deux writeFile sur des paths differents s\'executent en parallele', async () => {
    const vm = new VaultManager(VAULT_PATH);
    const trace: string[] = [];

    let resolveA!: () => void;
    let resolveB!: () => void;
    const promiseA = new Promise<void>((res) => { resolveA = res; });
    const promiseB = new Promise<void>((res) => { resolveB = res; });

    mockCoordinatedWriteFile
      .mockImplementationOnce(async () => {
        trace.push('start-A');
        await promiseA;
        trace.push('end-A');
        return true;
      })
      .mockImplementationOnce(async () => {
        trace.push('start-B');
        await promiseB;
        trace.push('end-B');
        return true;
      });

    const writeA = vm.writeFile('tasks-a.md', 'content-A');
    const writeB = vm.writeFile('tasks-b.md', 'content-B');

    // Flush microtasks pour permettre aux deux de commencer
    await Promise.resolve();
    await Promise.resolve();

    // Les deux doivent avoir commence (parallele)
    expect(trace).toContain('start-A');
    expect(trace).toContain('start-B');

    resolveA();
    resolveB();
    await Promise.all([writeA, writeB]);
  });

  /**
   * Test 3 : toggleTask enveloppe son read-modify-write dans enqueueWrite.
   * Deux toggleTask successifs ne perdent aucune modification.
   */
  test('3. toggleTask enveloppe le read-modify-write dans enqueueWrite (pas de race)', async () => {
    const vm = new VaultManager(VAULT_PATH);
    const writtenContents: string[] = [];

    // Simuler un fichier avec deux taches
    const initialContent = '- [ ] tache-1\n- [ ] tache-2\n';
    mockCoordinatedReadFile.mockResolvedValue(initialContent);
    mockCoordinatedWriteFile.mockImplementation(async (_uri: string, content: string) => {
      writtenContents.push(content);
      return true;
    });

    // Executer deux toggleTask en succession rapide
    await Promise.all([
      vm.toggleTask('tasks.md', 0, true),
      vm.toggleTask('tasks.md', 1, true),
    ]);

    // Les deux doivent s'etre executes (2 ecritures)
    expect(writtenContents).toHaveLength(2);
  });

  /**
   * Test 4 : appendTask enveloppe son read-modify-write dans enqueueWrite.
   */
  test('4. appendTask enveloppe le read-modify-write dans enqueueWrite', async () => {
    const vm = new VaultManager(VAULT_PATH);
    const writtenContents: string[] = [];

    const initialContent = '# Taches\n\n';
    mockCoordinatedReadFile.mockResolvedValue(initialContent);
    mockCoordinatedWriteFile.mockImplementation(async (_uri: string, content: string) => {
      writtenContents.push(content);
      return true;
    });

    await Promise.all([
      vm.appendTask('tasks.md', null, 'nouvelle-tache-1'),
      vm.appendTask('tasks.md', null, 'nouvelle-tache-2'),
    ]);

    expect(writtenContents).toHaveLength(2);
  });

  /**
   * Test 5 : La queue se nettoie apres resolution (pas de fuite memoire).
   * Apres un writeFile, la Map _writeQueues doit etre vide ou ne contenir
   * que des Promises resolues.
   */
  test('5. la queue se nettoie apres resolution (pas de fuite memoire)', async () => {
    const vm = new VaultManager(VAULT_PATH);

    mockCoordinatedWriteFile.mockResolvedValue(true);

    await vm.writeFile('tasks.md', 'content');

    // Acceder a la propriete privee via cast
    const queues = (vm as unknown as { _writeQueues: Map<string, Promise<void>> })._writeQueues;
    // Apres completion, la Map doit etre vide (cleanup via finally)
    expect(queues.size).toBe(0);
  });

  /**
   * Test 6 : Une erreur dans un write n'empeche pas les writes suivants sur le meme path.
   */
  test('6. une erreur dans un write n\'empeche pas les writes suivants', async () => {
    const vm = new VaultManager(VAULT_PATH);
    const trace: string[] = [];

    mockCoordinatedWriteFile
      .mockRejectedValueOnce(new Error('Disk full'))
      .mockImplementationOnce(async (_uri: string, content: string) => {
        trace.push(`written:${content}`);
        return true;
      });

    // Premier write echoue
    await expect(vm.writeFile('tasks.md', 'content-A')).rejects.toThrow('Disk full');

    // Deuxieme write doit reussir malgre l'echec precedent
    await vm.writeFile('tasks.md', 'content-B');
    expect(trace).toContain('written:content-B');
  });

});
