import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

import PatchRunReportModal from './PatchRunReportModal';

vi.mock('react-dom', async () => {
  const actual = await vi.importActual<typeof import('react-dom')>('react-dom');
  return {
    ...actual,
    createPortal: (node: React.ReactNode) => node,
  };
});

describe('PatchRunReportModal', () => {
  afterEach(() => {
    Reflect.deleteProperty(globalThis, 'document');
  });

  it('renders nothing when no report is present', () => {
    const markup = renderToStaticMarkup(
      <PatchRunReportModal report={null} onClose={vi.fn()} />,
    );

    expect(markup).toBe('');
  });

  it('renders completed patch results with package changes', () => {
    Object.assign(globalThis, { document: { body: {} } });

    const markup = renderToStaticMarkup(
      <PatchRunReportModal
        report={{
          scopeLabel: 'Finance patch wave',
          requestedAt: '2026-05-08T09:00:00.000Z',
          completedAt: '2026-05-08T09:12:00.000Z',
          successCount: 1,
          failedCount: 1,
          totalCount: 2,
          rows: [
            {
              deviceId: 'device-1',
              hostname: 'fin-laptop-01',
              department: 'Finance',
              status: 'success',
              patchStatus: 'completed',
              target: 'fin-laptop-01',
              action: 'system-update',
              message: 'state.apply patch.run',
              updatedItems: ['openssl', 'kernel'],
              packageChanges: [
                { name: 'kernel', fromVersion: '6.8.0', toVersion: '6.8.2' },
                { name: 'openssl', fromVersion: '3.0.2', toVersion: '3.0.4' },
              ],
            },
            {
              deviceId: 'device-2',
              hostname: 'fin-laptop-02',
              department: 'Finance',
              status: 'failed',
              patchStatus: 'failed',
              target: 'fin-laptop-02',
              action: 'system-update',
              message: 'Salt run timed out',
              updatedItems: [],
              packageChanges: [],
            },
          ],
        }}
        onClose={vi.fn()}
      />,
    );

    expect(markup).toContain('Patch Report');
    expect(markup).toContain('Finance patch wave');
    expect(markup).toContain('2 device(s) processed');
    expect(markup).toContain('Success');
    expect(markup).toContain('Failed');
    expect(markup).toContain('Completed');
    expect(markup).toContain('fin-laptop-01');
    expect(markup).toContain('kernel');
    expect(markup).toContain('6.8.0 -&gt; 6.8.2');
    expect(markup).toContain('Salt run timed out');
    expect(markup).toContain('Download Updated CSV');
    expect(markup).toContain('Download Full CSV Report');
  });

  it('renders the running empty-state and disables downloads', () => {
    Object.assign(globalThis, { document: { body: {} } });

    const markup = renderToStaticMarkup(
      <PatchRunReportModal
        report={{
          scopeLabel: 'North wing patch wave',
          requestedAt: '2026-05-08T10:00:00.000Z',
          completedAt: '2026-05-08T10:00:00.000Z',
          successCount: 0,
          failedCount: 0,
          totalCount: 4,
          inProgress: true,
          rows: [],
        }}
        onClose={vi.fn()}
      />,
    );

    expect(markup).toContain('Progress');
    expect(markup).toContain('0/4 finished');
    expect(markup).toContain('Patch update is running now.');
    expect(markup).toContain('Waiting for device patch results...');
    expect(markup).toContain('Download Updated CSV');
    expect(markup).toContain('Download Full CSV Report');
    expect(markup).toContain('disabled=""');
  });
});