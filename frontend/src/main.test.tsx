import { beforeEach, describe, expect, it, vi } from 'vitest';

const mainMocks = vi.hoisted(() => ({
  applyStoredThemeMock: vi.fn(),
  renderMock: vi.fn(),
  createRootMock: vi.fn(),
  getElementByIdMock: vi.fn(),
}));

vi.mock('react-dom/client', () => ({
  createRoot: mainMocks.createRootMock,
}));

vi.mock('./App.tsx', () => ({
  default: () => <div>app-root</div>,
}));

vi.mock('./components/AppErrorBoundary.tsx', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div data-boundary="app">{children}</div>,
}));

vi.mock('./lib/theme', () => ({
  applyStoredTheme: mainMocks.applyStoredThemeMock,
}));

describe('main', () => {
  beforeEach(() => {
    mainMocks.applyStoredThemeMock.mockReset();
    mainMocks.renderMock.mockReset();
    mainMocks.createRootMock.mockReset();
    mainMocks.getElementByIdMock.mockReset();
    mainMocks.createRootMock.mockReturnValue({ render: mainMocks.renderMock });
    mainMocks.getElementByIdMock.mockReturnValue({ id: 'root' });
    vi.stubGlobal('document', {
      getElementById: mainMocks.getElementByIdMock,
    });
    vi.resetModules();
  });

  it('applies the stored theme and renders the app into the root container', async () => {
    await import('./main.tsx');

    expect(mainMocks.applyStoredThemeMock).toHaveBeenCalled();
    expect(mainMocks.getElementByIdMock).toHaveBeenCalledWith('root');
    expect(mainMocks.createRootMock).toHaveBeenCalledWith({ id: 'root' });
    expect(mainMocks.renderMock).toHaveBeenCalledTimes(1);
  });
});