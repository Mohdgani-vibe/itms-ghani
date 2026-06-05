import type { PatchRunReport, PatchRunReportDateRange, PatchRunReportSort } from '../../lib/patchReports';
import { parsePatchWorkspaceView, parseReportDateRange, parseReportSort, type PatchWorkspaceView } from './PatchDashboardPage.helpers';

export interface PatchWorkspaceRouteState {
  activeSubView: PatchWorkspaceView;
  selectedDepartments: string[];
  reportDepartmentFilter: string;
  reportDateRange: PatchRunReportDateRange;
  reportSearchQuery: string;
  reportSort: PatchRunReportSort;
  showAllReports: boolean;
  requestedReportId: string;
}

export interface PatchWorkspaceSearchState {
  activeSubView: PatchWorkspaceView;
  canViewReports: boolean;
  selectedDepartments: string[];
  reportDepartmentFilter: string;
  reportDateRange: PatchRunReportDateRange;
  reportSearchQuery: string;
  reportSort: PatchRunReportSort;
  showAllReports: boolean;
  reportId?: string | null;
}

export function parseSelectedDepartments(value: string | null) {
  const normalized = (value || '').trim();
  if (!normalized || normalized.toLowerCase() === 'all') {
    return [] as string[];
  }

  return Array.from(new Set(normalized.split(',').map((item) => item.trim()).filter(Boolean)));
}

export function areDepartmentSelectionsEqual(left: string[], right: string[]) {
  if (left.length !== right.length) {
    return false;
  }

  return left.every((value, index) => value === right[index]);
}

export function shouldResetOpeningReportId(
  openingReportId: string,
  patchReport: PatchRunReport | null,
  requestedReportId: string | null | undefined,
) {
  return Boolean(openingReportId && !patchReport && !(requestedReportId || '').trim());
}

export function resolveRequestedPatchWorkspaceView(
  requestedView: string | null,
  requestedReportId: string | null | undefined,
  canViewReports: boolean,
): PatchWorkspaceView {
  const parsedView = parsePatchWorkspaceView(requestedView, canViewReports);
  if (!canViewReports) {
    return 'dashboard';
  }

  const normalizedView = (requestedView || '').trim().toLowerCase();
  const hasRequestedReportId = Boolean((requestedReportId || '').trim());
  if (!hasRequestedReportId) {
    return parsedView;
  }

  if (!normalizedView || normalizedView === 'reports' || normalizedView === 'archive') {
    return 'reports';
  }

  return parsedView;
}

export function parsePatchWorkspaceRouteState(search: string, canViewReports: boolean): PatchWorkspaceRouteState {
  const params = new URLSearchParams(search);
  const requestedReportId = params.get('reportId')?.trim() || '';

  return {
    activeSubView: resolveRequestedPatchWorkspaceView(params.get('view'), requestedReportId, canViewReports),
    selectedDepartments: parseSelectedDepartments(params.get('department')),
    reportDepartmentFilter: params.get('reportDepartment')?.trim() || 'all',
    reportDateRange: parseReportDateRange(params.get('reportRange')),
    reportSearchQuery: params.get('reportQuery')?.trim() || '',
    reportSort: parseReportSort(params.get('reportSort')),
    showAllReports: params.get('reportsExpanded') === '1',
    requestedReportId,
  };
}

export function buildPatchWorkspaceSearch(state: PatchWorkspaceSearchState) {
  const params = new URLSearchParams();

  const shouldPersistExplicitDashboardView = state.canViewReports && state.activeSubView === 'dashboard' && Boolean((state.reportId || '').trim());

  if (state.canViewReports && (state.activeSubView !== 'dashboard' || shouldPersistExplicitDashboardView)) {
    params.set('view', state.activeSubView);
  }

  if (state.selectedDepartments.length > 0) {
    params.set('department', state.selectedDepartments.join(','));
  }

  if (state.reportDepartmentFilter !== 'all') {
    params.set('reportDepartment', state.reportDepartmentFilter);
  }

  if (state.reportDateRange !== '30d') {
    params.set('reportRange', state.reportDateRange);
  }

  if (state.reportSearchQuery.trim()) {
    params.set('reportQuery', state.reportSearchQuery.trim());
  }

  if (state.reportSort !== 'newest') {
    params.set('reportSort', state.reportSort);
  }

  if (state.showAllReports) {
    params.set('reportsExpanded', '1');
  }

  if ((state.reportId || '').trim()) {
    params.set('reportId', (state.reportId || '').trim());
  }

  return params.toString();
}