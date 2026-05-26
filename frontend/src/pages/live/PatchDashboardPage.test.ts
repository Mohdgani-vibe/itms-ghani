import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../lib/session', () => ({
  getStoredSession: () => ({
    token: 'token',
    shortName: 'SA',
    user: {
      id: 'user-1',
      email: 'sa@example.com',
      fullName: 'System Admin',
      role: 'super_admin',
      defaultPortal: '/admin/dashboard',
      portals: ['super_admin'],
    },
  }),
}));

vi.mock('../../components/DepartmentSaltConsolePickerModal', () => ({
  default: () => null,
}));

vi.mock('../../components/EmbeddedConsoleModal', () => ({
  default: () => null,
}));

vi.mock('../../components/PatchRunReportModal', () => ({
  default: () => null,
}));

import PatchDashboardPage from './PatchDashboardPage';
import { parsePatchWorkspaceView } from './PatchDashboardPage.helpers';
import { shouldResetOpeningReportId } from './patchDashboardState';

function renderPatchDashboard(initialEntry: string) {
  return renderToStaticMarkup(
    createElement(
      MemoryRouter,
      { initialEntries: [initialEntry] },
      createElement(PatchDashboardPage),
    ),
  );
}

describe('shouldResetOpeningReportId', () => {
  it('returns true when a report open button is still marked loading after the modal and reportId are both gone', () => {
    expect(shouldResetOpeningReportId('report-1', null, null)).toBe(true);
  });

  it('returns false while the matching modal is still open', () => {
    expect(shouldResetOpeningReportId('report-1', {
      id: 'report-1',
      scopeLabel: 'All departments',
      requestedAt: '2026-04-27T07:32:13.366Z',
      completedAt: '2026-04-27T07:33:13.460Z',
      successCount: 1,
      failedCount: 5,
      rows: [],
    }, null)).toBe(false);
  });

  it('returns false while the URL is still targeting a report to load', () => {
    expect(shouldResetOpeningReportId('report-1', null, 'report-1')).toBe(false);
  });

  it('returns false when no report action is currently marked loading', () => {
    expect(shouldResetOpeningReportId('', null, null)).toBe(false);
  });
});

describe('parsePatchWorkspaceView', () => {
  it('maps legacy views into the terminal workspace', () => {
    expect(parsePatchWorkspaceView('reports', true)).toBe('terminal');
    expect(parsePatchWorkspaceView('terminal', true)).toBe('terminal');
    expect(parsePatchWorkspaceView('scripts', true)).toBe('terminal');
    expect(parsePatchWorkspaceView('history', true)).toBe('terminal');
    expect(parsePatchWorkspaceView('systems', true)).toBe('systems');
    expect(parsePatchWorkspaceView(null, true)).toBe('systems');
  });

  it('falls back to systems when terminal access is unavailable', () => {
    expect(parsePatchWorkspaceView('reports', false)).toBe('systems');
    expect(parsePatchWorkspaceView('scripts', false)).toBe('systems');
  });
});

describe('PatchDashboardPage', () => {
  it('renders the systems workspace shell by default', () => {
    const markup = renderPatchDashboard('/admin/patch');

    expect(markup).toContain('Patch Workspace');
    expect(markup).toContain('Patch workspace for systems and terminal operations.');
    expect(markup).toContain('Systems');
    expect(markup).toContain('Terminal');
    expect(markup).toContain('Patch status counts across the current fleet scope');
    expect(markup).toContain('All departments in view');
  });

  it('renders the terminal workspace shell from the reports view query', () => {
    const markup = renderPatchDashboard('/admin/patch?view=reports');

    expect(markup).toContain('Terminal');
    expect(markup).toContain('Saved scripts, job history, and report archive');
    expect(markup).toContain('Featured Report');
    expect(markup).toContain('Latest verified run in the current scope');
    expect(markup).toContain('Report Archive');
  });
});