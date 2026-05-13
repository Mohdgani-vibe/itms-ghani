import { afterEach, describe, expect, it, vi } from 'vitest';

import { applyStoredTheme, applyTheme, getStoredTheme, toggleStoredTheme } from './theme';

function createStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  };
}

describe('theme', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('applies and stores explicit themes', () => {
    const storage = createStorage();
    const toggle = vi.fn();
    vi.stubGlobal('window', {
      localStorage: storage,
      matchMedia: vi.fn(() => ({ matches: false })),
    });
    vi.stubGlobal('document', {
      documentElement: {
        classList: { toggle },
      },
    });

    expect(applyTheme('dark')).toBe('dark');
    expect(toggle).toHaveBeenCalledWith('dark', true);
    expect(storage.getItem('itms_theme')).toBe('dark');
  });

  it('reads, applies, and toggles stored themes with system fallback', () => {
    const storage = createStorage();
    const toggle = vi.fn();
    vi.stubGlobal('window', {
      localStorage: storage,
      matchMedia: vi.fn(() => ({ matches: true })),
    });
    vi.stubGlobal('document', {
      documentElement: {
        classList: { toggle },
      },
    });

    expect(getStoredTheme()).toBe('dark');
    expect(applyStoredTheme()).toBe('dark');

    storage.setItem('itms_theme', 'dark');
    expect(toggleStoredTheme()).toBe('light');
    expect(storage.getItem('itms_theme')).toBe('light');
  });
});