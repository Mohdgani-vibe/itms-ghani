import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

import DepartmentSaltConsolePickerModal from './DepartmentSaltConsolePickerModal';

vi.mock('react-dom', async () => {
  const actual = await vi.importActual<typeof import('react-dom')>('react-dom');
  return {
    ...actual,
    createPortal: (node: React.ReactNode) => node,
  };
});

describe('DepartmentSaltConsolePickerModal', () => {
  afterEach(() => {
    Reflect.deleteProperty(globalThis, 'document');
  });

  it('renders nothing when closed', () => {
    const markup = renderToStaticMarkup(
      <DepartmentSaltConsolePickerModal
        open={false}
        title="Finance Department"
        devices={[]}
        onSelect={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    expect(markup).toBe('');
  });

  it('renders the empty-state guidance when no devices are available', () => {
    Object.assign(globalThis, { document: { body: {} } });

    const markup = renderToStaticMarkup(
      <DepartmentSaltConsolePickerModal
        open={true}
        title="Finance Department"
        devices={[]}
        onSelect={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    expect(markup).toContain('Department Salt Console');
    expect(markup).toContain('Finance Department');
    expect(markup).toContain('0 devices available');
    expect(markup).toContain('Department Scope');
    expect(markup).toContain('No Salt-enabled systems are available in the current department view.');
  });

  it('renders device rows and the busy state label', () => {
    Object.assign(globalThis, { document: { body: {} } });

    const markup = renderToStaticMarkup(
      <DepartmentSaltConsolePickerModal
        open={true}
        title="Finance Department"
        devices={[
          {
            id: 'device-1',
            hostname: 'fin-laptop-01',
            osName: 'Ubuntu 24.04',
            minionId: 'fin-minion-01',
            department: { name: 'Finance' },
            user: { fullName: 'Asha Patel' },
          },
          {
            id: 'device-2',
            hostname: 'fin-laptop-02',
            osName: 'Windows 11',
            department: { name: 'Finance' },
          },
        ]}
        busyDeviceId="device-1"
        onSelect={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    expect(markup).toContain('2 devices available');
    expect(markup).toContain('fin-laptop-01');
    expect(markup).toContain('Ubuntu 24.04');
    expect(markup).toContain('Asha Patel');
    expect(markup).toContain('Finance');
    expect(markup).toContain('Asset ID device-1');
    expect(markup).toContain('fin-minion-01');
    expect(markup).toContain('Salt target pending');
    expect(markup).toContain('Opening...');
    expect(markup).toContain('Open Console');
  });
});