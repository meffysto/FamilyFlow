/**
 * useVaultCourses.test.ts — Tests unitaires pour hooks/useVaultCourses.ts
 */

import { renderHook, act } from '@testing-library/react-native';
import { useVaultCourses } from '../useVaultCourses';

// ─── Mock VaultManager ──────────────────────────────────────────────────────

function createMockVault() {
  return {
    readFile: jest.fn(),
    writeFile: jest.fn().mockResolvedValue(undefined),
    appendTask: jest.fn().mockResolvedValue(undefined),
    toggleTask: jest.fn().mockResolvedValue(undefined),
    ensureDir: jest.fn(),
    exists: jest.fn().mockResolvedValue(true),
  };
}

function createVaultRef(mock = createMockVault()) {
  return { current: mock as any };
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const sampleCoursesContent = `# Liste de courses

## 🥬 Légumes
- [ ] 2 courgettes
- [ ] 500g tomates
- [x] 1 salade

## 🧀 Crèmerie
- [ ] 1L lait
`;

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('useVaultCourses', () => {
  beforeEach(() => jest.clearAllMocks());

  it('initialise avec un tableau vide', () => {
    const vaultRef = createVaultRef();
    const { result } = renderHook(() => useVaultCourses(vaultRef, "test://mock"));
    expect(result.current.courses).toEqual([]);
  });

  it('resetCourses remet à []', async () => {
    const vaultRef = createVaultRef();
    const { result } = renderHook(() => useVaultCourses(vaultRef, "test://mock"));

    await act(() => result.current.setCourses([
      { id: '1', text: '2 courgettes', completed: false, lineIndex: 3, sourceFile: 'test.md' } as any,
    ]));
    expect(result.current.courses).toHaveLength(1);

    await act(() => result.current.resetCourses());
    expect(result.current.courses).toEqual([]);
  });

  it('addCourseItem ajoute un article via appendTask', async () => {
    const mock = createMockVault();
    mock.readFile.mockResolvedValue(sampleCoursesContent);
    const vaultRef = createVaultRef(mock);
    const { result } = renderHook(() => useVaultCourses(vaultRef, "test://mock"));

    await act(() => result.current.addCourseItem('3 pommes', '🍎 Fruits'));

    expect(mock.appendTask).toHaveBeenCalledTimes(1);
    expect(mock.appendTask.mock.calls[0][0]).toBe('02 - Maison/Liste de courses.md');
    expect(mock.appendTask.mock.calls[0][2]).toBe('3 pommes');
    expect(mock.readFile).toHaveBeenCalled();
  });

  it('toggleCourseItem bascule l\'état completed', async () => {
    const mock = createMockVault();
    const vaultRef = createVaultRef(mock);
    const { result } = renderHook(() => useVaultCourses(vaultRef, "test://mock"));

    const item = { id: 'test:3', text: '2 courgettes', completed: false, lineIndex: 3, sourceFile: 'test.md' };
    await act(() => result.current.setCourses([item as any]));

    await act(() => result.current.toggleCourseItem(item as any, true));

    expect(mock.toggleTask).toHaveBeenCalledWith('02 - Maison/Liste de courses.md', 3, true);
    expect(result.current.courses[0].completed).toBe(true);
  });

  it('removeCourseItem supprime une ligne', async () => {
    const mock = createMockVault();
    mock.readFile.mockResolvedValue(sampleCoursesContent);
    const vaultRef = createVaultRef(mock);
    const { result } = renderHook(() => useVaultCourses(vaultRef, "test://mock"));

    await act(() => result.current.removeCourseItem(3));

    expect(mock.writeFile).toHaveBeenCalled();
    const written = mock.writeFile.mock.calls[0][1] as string;
    expect(written).not.toContain('2 courgettes');
  });

  it('moveCourseItem déplace un article vers une autre section', async () => {
    const mock = createMockVault();
    mock.readFile.mockResolvedValue(sampleCoursesContent);
    const vaultRef = createVaultRef(mock);
    const { result } = renderHook(() => useVaultCourses(vaultRef, "test://mock"));

    await act(() => result.current.moveCourseItem(3, '2 courgettes', '🧀 Crèmerie'));

    expect(mock.writeFile).toHaveBeenCalled();
    const written = mock.writeFile.mock.calls[0][1] as string;
    // L'article doit être sous la section Crèmerie maintenant
    const cremIndex = written.indexOf('## 🧀 Crèmerie');
    const itemIndex = written.indexOf('- [ ] 2 courgettes', cremIndex);
    expect(itemIndex).toBeGreaterThan(cremIndex);
  });

  it('clearCompletedCourses retire les articles cochés', async () => {
    const mock = createMockVault();
    mock.readFile.mockResolvedValue(sampleCoursesContent);
    const vaultRef = createVaultRef(mock);
    const { result } = renderHook(() => useVaultCourses(vaultRef, "test://mock"));

    await act(() => result.current.clearCompletedCourses());

    expect(mock.writeFile).toHaveBeenCalled();
    const written = mock.writeFile.mock.calls[0][1] as string;
    expect(written).not.toContain('[x]');
    expect(written).toContain('2 courgettes');
  });

  it('mergeCourseIngredients fusionne les quantités existantes', async () => {
    const mock = createMockVault();
    mock.readFile.mockResolvedValue(sampleCoursesContent);
    const vaultRef = createVaultRef(mock);
    const { result } = renderHook(() => useVaultCourses(vaultRef, "test://mock"));

    let res = { added: 0, merged: 0 };
    await act(async () => {
      res = await result.current.mergeCourseIngredients([
        { text: '3 courgettes', name: 'courgettes', quantity: 3, section: '🥬 Légumes' },
        { text: 'sel', name: 'sel', quantity: null, section: '🫙 Condiments' },
      ]);
    });

    expect(mock.writeFile).toHaveBeenCalled();
    const written = mock.writeFile.mock.calls[0][1] as string;
    // 2 + 3 = 5 courgettes (fusion)
    expect(written).toContain('5 courgettes');
    // sel ajouté comme nouvel article
    expect(written).toContain('sel');
    expect(res.merged).toBe(1);
    expect(res.added).toBe(1);
  });

  it('no-op si vaultRef.current est null', async () => {
    const vaultRef = { current: null as any };
    const { result } = renderHook(() => useVaultCourses(vaultRef, "test://mock"));

    await act(() => result.current.addCourseItem('X'));
    await act(() => result.current.toggleCourseItem({ id: '1', lineIndex: 0 } as any, true));
    await act(() => result.current.removeCourseItem(0));
    await act(() => result.current.moveCourseItem(0, 'X', 'Section'));
    await act(() => result.current.clearCompletedCourses());

    let res = { added: 0, merged: 0 };
    await act(async () => {
      res = await result.current.mergeCourseIngredients([]);
    });
    expect(res).toEqual({ added: 0, merged: 0 });

    expect(result.current.courses).toEqual([]);
  });
});
