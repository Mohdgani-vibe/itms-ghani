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
import { buildPatchWorkspaceSearch, parsePatchWorkspaceRouteState, resolveRequestedPatchWorkspaceView, shouldResetOpeningReportId } from './patchDashboardState';

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
  it('maps legacy views into the patch workspace tabs', () => {
    expect(parsePatchWorkspaceView('reports', true)).toBe('reports');
    expect(parsePatchWorkspaceView('terminal', true)).toBe('terminal');
    expect(parsePatchWorkspaceView('scripts', true)).toBe('terminal');
    expect(parsePatchWorkspaceView('automation', true)).toBe('automation');
    expect(parsePatchWorkspaceView('history', true)).toBe('logs');
    expect(parsePatchWorkspaceView('systems', true)).toBe('dashboard');
    expect(parsePatchWorkspaceView(null, true)).toBe('dashboard');
  });

  it('falls back to dashboard when terminal access is unavailable', () => {
    expect(parsePatchWorkspaceView('reports', false)).toBe('dashboard');
    expect(parsePatchWorkspaceView('scripts', false)).toBe('dashboard');
  });
});

describe('resolveRequestedPatchWorkspaceView', () => {
  it('opens reports when a reportId is requested without an explicit view', () => {
    expect(resolveRequestedPatchWorkspaceView(null, 'report-1', true)).toBe('reports');
  });

  it('keeps explicit non-report views stable even when reportId is present', () => {
    expect(resolveRequestedPatchWorkspaceView('logs', 'report-1', true)).toBe('logs');
    expect(resolveRequestedPatchWorkspaceView('terminal', 'report-1', true)).toBe('terminal');
    expect(resolveRequestedPatchWorkspaceView('automation', 'report-1', true)).toBe('automation');
  });

  it('still resolves reports when the explicit view is reports', () => {
    expect(resolveRequestedPatchWorkspaceView('reports', 'report-1', true)).toBe('reports');
  });
});

describe('parsePatchWorkspaceRouteState', () => {
  it('parses all supported patch workspace query options', () => {
    expect(parsePatchWorkspaceRouteState('?view=logs&department=IT%20Team,Unassigned&reportDepartment=Unassigned&reportRange=7d&reportQuery=vim&reportSort=oldest&reportsExpanded=1&reportId=report-1', true)).toEqual({
      activeSubView: 'logs',
      selectedDepartments: ['IT Team', 'Unassigned'],
      reportDepartmentFilter: 'Unassigned',
      reportDateRange: '7d',
      reportSearchQuery: 'vim',
      reportSort: 'oldest',
      showAllReports: true,
      requestedReportId: 'report-1',
    });
  });

  it('keeps an explicit dashboard view when reportId is also present', () => {
    expect(parsePatchWorkspaceRouteState('?view=dashboard&reportId=report-1', true)).toEqual({
      activeSubView: 'dashboard',
      selectedDepartments: [],
      reportDepartmentFilter: 'all',
      reportDateRange: '30d',
      reportSearchQuery: '',
      reportSort: 'newest',
      showAllReports: false,
      requestedReportId: 'report-1',
    });
  });
});

describe('buildPatchWorkspaceSearch', () => {
  it('serializes all supported patch workspace query options', () => {
    expect(buildPatchWorkspaceSearch({
      activeSubView: 'terminal',
      canViewReports: true,
      selectedDepartments: ['IT Team', 'Unassigned'],
      reportDepartmentFilter: 'Unassigned',
      reportDateRange: '7d',
      reportSearchQuery: 'vim',
      reportSort: 'oldest',
      showAllReports: true,
      reportId: 'report-1',
    })).toBe('view=terminal&department=IT+Team%2CUnassigned&reportDepartment=Unassigned&reportRange=7d&reportQuery=vim&reportSort=oldest&reportsExpanded=1&reportId=report-1');
  });

  it('omits default values from the URL', () => {
    expect(buildPatchWorkspaceSearch({
      activeSubView: 'dashboard',
      canViewReports: true,
      selectedDepartments: [],
      reportDepartmentFilter: 'all',
      reportDateRange: '30d',
      reportSearchQuery: '',
      reportSort: 'newest',
      showAllReports: false,
      reportId: '',
    })).toBe('');
  });

  it('keeps an explicit dashboard view in the URL when a reportId is present', () => {
    expect(buildPatchWorkspaceSearch({
      activeSubView: 'dashboard',
      canViewReports: true,
      selectedDepartments: [],
      reportDepartmentFilter: 'all',
      reportDateRange: '30d',
      reportSearchQuery: '',
      reportSort: 'newest',
      showAllReports: false,
      reportId: 'report-1',
    })).toBe('view=dashboard&reportId=report-1');
  });

  it('keeps the reports view in the URL when focusing a report from the archive', () => {
    expect(buildPatchWorkspaceSearch({
      activeSubView: 'reports',
      canViewReports: true,
      selectedDepartments: ['IT Team'],
      reportDepartmentFilter: 'all',
      reportDateRange: '30d',
      reportSearchQuery: '',
      reportSort: 'newest',
      showAllReports: false,
      reportId: 'report-9',
    })).toBe('view=reports&department=IT+Team&reportId=report-9');
  });

  it('round-trips an explicit dashboard view with a reportId', () => {
    const search = buildPatchWorkspaceSearch({
      activeSubView: 'dashboard',
      canViewReports: true,
      selectedDepartments: [],
      reportDepartmentFilter: 'all',
      reportDateRange: '30d',
      reportSearchQuery: '',
      reportSort: 'newest',
      showAllReports: false,
      reportId: 'report-1',
    });

    expect(parsePatchWorkspaceRouteState(`?${search}`, true)).toEqual({
      activeSubView: 'dashboard',
      selectedDepartments: [],
      reportDepartmentFilter: 'all',
      reportDateRange: '30d',
      reportSearchQuery: '',
      reportSort: 'newest',
      showAllReports: false,
      requestedReportId: 'report-1',
    });
  });
});

describe('PatchDashboardPage', () => {
  it('renders the dashboard workspace shell by default', () => {
    const markup = renderPatchDashboard('/admin/patch');

    expect(markup).toContain('Patch dashboard');
    expect(markup).toContain('Dashboard');
    expect(markup).toContain('Salt Terminal');
    expect(markup).toContain('Logs');
    expect(markup).toContain('Reports');
    expect(markup).toContain('Systems summary');
    expect(markup).toContain('Total system count');
    expect(markup).toContain('Online system count');
    expect(markup).toContain('Offline system count');
    expect(markup).toContain('Charts');
    expect(markup).toContain('Update activity for last 1 day, 7 days, and 1 month');
    expect(markup).toContain('Recent 10 updates done');
  });

  it('renders the reports workspace shell from the reports view query', () => {
    const markup = renderPatchDashboard('/admin/patch?view=reports');

    expect(markup).toContain('Reports');
    expect(markup).toContain('Export patch results as CSV, JSON, or PDF');
    expect(markup).toContain('Saved reports');
    expect(markup).toContain('Needs review');
    expect(markup).toContain('Recent items');
  });

  it('renders the logs workspace shell from the history view query', () => {
    const markup = renderPatchDashboard('/admin/patch?view=history');

    expect(markup).toContain('Logs');
    expect(markup).toContain('Execution logs by minion, function, status, and package changes');
    expect(markup).toContain('Recent workspace runs');
    expect(markup).toContain('Recent patch execution history');
    expect(markup).toContain('Recent items');
    expect(markup).toContain('All statuses');
    expect(markup).toContain('log item(s) match the current status filter');
  });

  it('renders the terminal workspace as a patch command runner page', () => {
    const markup = renderPatchDashboard('/admin/patch?view=terminal');

    expect(markup).toContain('Operations control deck');
    expect(markup).toContain('Assemble one guarded Salt action');
    expect(markup).toContain('Single department');
    expect(markup).toContain('Multiple departments');
    expect(markup).toContain('Department selection');
    expect(markup).toContain('Option');
    expect(markup).toContain('Execute');
    expect(markup).toContain('Terminal');
    expect(markup).toContain('Tracker');
    expect(markup).not.toContain('Scope builder');
    expect(markup).not.toContain('Dry run');
    expect(markup).not.toContain('Run sheet');
    expect(markup).not.toContain('Mission brief');
    expect(markup).not.toContain('Execution name');
    expect(markup).not.toContain('Open Logs');
    expect(markup).not.toContain('Run execution');
    expect(markup).not.toContain('Execution terminal');
    expect(markup).not.toContain('Execution tracker');
    expect(markup).not.toContain('Saved .sls template');
    expect(markup).not.toContain('Copy');
    expect(markup).not.toContain('state.apply -&gt; Department');
    expect(markup).not.toContain('Execution preview');
    expect(markup).not.toContain('Arguments');
    expect(markup).not.toContain('Systems summary');
    expect(markup).not.toContain('Total system count');
    expect(markup).not.toContain('Online system count');
    expect(markup).not.toContain('Offline system count');
    expect(markup).not.toContain('Charts');
    expect(markup).not.toContain('Update activity for last 1 day, 7 days, and 1 month');
    expect(markup).not.toContain('Recent updates done');
    expect(markup).not.toContain('Recent 10 updates done');
    expect(markup).not.toContain('Saved Salt states and shell scripts');
    expect(markup).not.toContain('Terminal Job History');
  });

  it('renders the automation workspace for saved sls and shell templates', () => {
    const markup = renderPatchDashboard('/admin/patch?view=automation');

    expect(markup).toContain('Automation');
    expect(markup).toContain('Automation studio');
    expect(markup).toContain('Template builder');
    expect(markup).toContain('Create one saved automation template');
    expect(markup).toContain('.sls state');
    expect(markup).toContain('.sh script');
    expect(markup).toContain('Save template');
    expect(markup).toContain('Saved templates');
    expect(markup).toContain('No saved `.sls` or `.sh` templates yet.');
  });
});