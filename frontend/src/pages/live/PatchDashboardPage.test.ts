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

import PatchDashboardPage, { parsePatchWorkspaceView } from './PatchDashboardPage';
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
  it('maps legacy reports queries into the terminal workspace', () => {
    expect(parsePatchWorkspaceView('reports', true)).toBe('terminal');
    expect(parsePatchWorkspaceView('terminal', true)).toBe('terminal');
    expect(parsePatchWorkspaceView(null, true)).toBe('systems');
  });

  it('forces systems view when report access is unavailable', () => {
    expect(parsePatchWorkspaceView('terminal', false)).toBe('systems');
  });
});

describe('PatchDashboardPage', () => {
  it('renders the systems workspace shell with the inventory layout', () => {
    const markup = renderPatchDashboard('/admin/patch');

    expect(markup).toContain('Patch Command Deck');
    expect(markup).toContain('Department deck');
    expect(markup).toContain('Patch operations with a live systems view, not a flat admin list.');
    expect(markup).toContain('Department Control');
    expect(markup).toContain('Department scope');
    expect(markup).toContain('Open device list');
  });

  it('renders the terminal workspace shell and maps legacy reports view', () => {
    const markup = renderPatchDashboard('/admin/patch?view=reports');

    expect(markup).toContain('Report archive');
    expect(markup).toContain('Featured Report');
    expect(markup).toContain('Latest verified run in the current scope');
    expect(markup).toContain('Report Archive');
  });
});