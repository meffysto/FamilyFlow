/**
 * useVaultTasks.test.ts — Tests unitaires pour hooks/useVaultTasks.ts
 */

import { renderHook, act } from '@testing-library/react-native';
import { useVaultTasks } from '../useVaultTasks';

// ─── Mocks ──────────────────────────────────────────────────────────────────

jest.mock('../../lib/parser', () => ({
  parseTaskFile: jest.fn(() => []),
}));

jest.mock('../../lib/recurrence', () => ({
  nextOccurrence: jest.fn(() => '2024-01-08'),
}));

jest.mock('date-fns', () => ({
  format: jest.fn(() => '2024-01-15'),
  addDays: jest.fn(() => new Date('2024-01-02')),
  parseISO: jest.fn(() => new Date('2024-01-01')),
}));

const { parseTaskFile } = require('../../lib/parser');
const { nextOccurrence } = require('../../lib/recurrence');

// ─── Mock VaultManager ──────────────────────────────────────────────────────

function createMockVault() {
  return {
    readFile: jest.fn(),
    writeFile: jest.fn().mockResolvedValue(undefined),
    toggleTask: jest.fn().mockResolvedValue(undefined),
    skipTask: jest.fn().mockResolvedValue(undefined),
    appendTask: jest.fn().mockResolvedValue(undefined),
  };
}

function createVaultRef(mock = createMockVault()) {
  return { current: mock as any };
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const sampleTask = (overrides: Record<string, any> = {}) => ({
  id: 'task-1',
  text: 'Faire la vaisselle',
  completed: false,
  tags: [],
  mentions: [],
  sourceFile: '02 - Maison/Tâches récurrentes.md',
  lineIndex: 3,
  ...overrides,
});

const triggerWidgetRefresh = jest.fn();
const vacationTasksSetter = jest.fn((updater: any) => updater([]));

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('useVaultTasks', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('initialise avec un tableau vide', () => {
    const vaultRef = createVaultRef();
    const { result } = renderHook(() =>
      useVaultTasks(vaultRef, triggerWidgetRefresh, vacationTasksSetter),
    );
    expect(result.current.tasks).toEqual([]);
  });

  it('resetTasks remet à []', async () => {
    const vaultRef = createVaultRef();
    const { result } = renderHook(() =>
      useVaultTasks(vaultRef, triggerWidgetRefresh, vacationTasksSetter),
    );

    await act(() =>
      result.current.setTasks([sampleTask() as any]),
    );
    expect(result.current.tasks).toHaveLength(1);

    await act(() => result.current.resetTasks());
    expect(result.current.tasks).toEqual([]);
  });

  it('toggleTask écrit et met à jour l\'état', async () => {
    const mock = createMockVault();
    const vaultRef = createVaultRef(mock);
    const { result } = renderHook(() =>
      useVaultTasks(vaultRef, triggerWidgetRefresh, vacationTasksSetter),
    );

    const task = sampleTask() as any;
    await act(() => result.current.setTasks([task]));

    await act(() => result.current.toggleTask(task, true));

    expect(mock.toggleTask).toHaveBeenCalledWith(
      task.sourceFile,
      task.lineIndex,
      true,
    );
    expect(result.current.tasks[0].completed).toBe(true);
    expect(result.current.tasks[0].completedDate).toBe('2024-01-15');
  });

  it('toggleTask tâche récurrente avance la date', async () => {
    const mock = createMockVault();
    const vaultRef = createVaultRef(mock);
    const { result } = renderHook(() =>
      useVaultTasks(vaultRef, triggerWidgetRefresh, vacationTasksSetter),
    );

    const task = sampleTask({
      recurrence: 'every week',
      dueDate: '2024-01-01',
    }) as any;
    await act(() => result.current.setTasks([task]));

    await act(() => result.current.toggleTask(task, true));

    expect(nextOccurrence).toHaveBeenCalledWith('2024-01-01', 'every week');
    expect(result.current.tasks[0].dueDate).toBe('2024-01-08');
    expect(result.current.tasks[0].completed).toBe(false);
  });

  it('skipTask avance la date', async () => {
    const mock = createMockVault();
    const vaultRef = createVaultRef(mock);
    const { result } = renderHook(() =>
      useVaultTasks(vaultRef, triggerWidgetRefresh, vacationTasksSetter),
    );

    const task = sampleTask({
      recurrence: 'every week',
      dueDate: '2024-01-01',
    }) as any;
    await act(() => result.current.setTasks([task]));

    await act(() => result.current.skipTask(task));

    expect(mock.skipTask).toHaveBeenCalledWith(task.sourceFile, task.lineIndex);
    expect(nextOccurrence).toHaveBeenCalledWith('2024-01-01', 'every week');
    expect(result.current.tasks[0].dueDate).toBe('2024-01-08');
    expect(result.current.tasks[0].completed).toBe(false);
  });

  it('addTask appelle appendTask et re-parse', async () => {
    const mock = createMockVault();
    mock.readFile.mockResolvedValue('- [ ] Nouvelle tâche');
    parseTaskFile.mockReturnValue([
      sampleTask({ id: 'new-1', text: 'Nouvelle tâche' }),
    ]);
    const vaultRef = createVaultRef(mock);
    const { result } = renderHook(() =>
      useVaultTasks(vaultRef, triggerWidgetRefresh, vacationTasksSetter),
    );

    await act(() =>
      result.current.addTask(
        'Nouvelle tâche',
        '02 - Maison/Tâches récurrentes.md',
      ),
    );

    expect(mock.appendTask).toHaveBeenCalledWith(
      '02 - Maison/Tâches récurrentes.md',
      null,
      'Nouvelle tâche',
    );
    expect(mock.readFile).toHaveBeenCalledWith(
      '02 - Maison/Tâches récurrentes.md',
    );
    expect(parseTaskFile).toHaveBeenCalled();
    expect(result.current.tasks).toHaveLength(1);
    expect(result.current.tasks[0].text).toBe('Nouvelle tâche');
  });

  it('editTask en place', async () => {
    const mock = createMockVault();
    const fileContent = '# Tâches\n\n## Ménage\n- [ ] Faire la vaisselle\n- [ ] Passer l\'aspirateur';
    mock.readFile.mockResolvedValue(fileContent);
    const vaultRef = createVaultRef(mock);
    const { result } = renderHook(() =>
      useVaultTasks(vaultRef, triggerWidgetRefresh, vacationTasksSetter),
    );

    const task = sampleTask() as any;
    await act(() => result.current.setTasks([task]));

    await act(() =>
      result.current.editTask(task, { text: 'Faire le ménage' }),
    );

    expect(mock.readFile).toHaveBeenCalledWith(task.sourceFile);
    expect(mock.writeFile).toHaveBeenCalledWith(
      task.sourceFile,
      expect.stringContaining('Faire le ménage'),
    );
    expect(result.current.tasks[0].text).toBe('Faire le ménage');
  });

  it('deleteTask supprime la ligne', async () => {
    const mock = createMockVault();
    const fileContent = '# Tâches\n\n## Ménage\n- [ ] Faire la vaisselle\n- [ ] Passer l\'aspirateur';
    mock.readFile.mockResolvedValue(fileContent);
    parseTaskFile.mockReturnValue([
      sampleTask({ id: 'task-2', text: 'Passer l\'aspirateur', lineIndex: 4 }),
    ]);
    const vaultRef = createVaultRef(mock);
    const { result } = renderHook(() =>
      useVaultTasks(vaultRef, triggerWidgetRefresh, vacationTasksSetter),
    );

    const task = sampleTask() as any;
    await act(() => result.current.setTasks([task]));

    await act(() => result.current.deleteTask(task.sourceFile, task.lineIndex));

    expect(mock.readFile).toHaveBeenCalledWith(task.sourceFile);
    expect(mock.writeFile).toHaveBeenCalled();
    const written = mock.writeFile.mock.calls[0][1] as string;
    expect(written).not.toContain('Faire la vaisselle');
  });

  it('no-op si vaultRef.current est null', async () => {
    const vaultRef = { current: null as any };
    const { result } = renderHook(() =>
      useVaultTasks(vaultRef, triggerWidgetRefresh, vacationTasksSetter),
    );

    const task = sampleTask() as any;
    await act(() => result.current.toggleTask(task, true));
    await act(() => result.current.skipTask(task));
    await act(() => result.current.addTask('Test', 'file.md'));
    await act(() => result.current.editTask(task, { text: 'X' }));
    await act(() => result.current.deleteTask('file.md', 0));

    expect(result.current.tasks).toEqual([]);
  });
});
