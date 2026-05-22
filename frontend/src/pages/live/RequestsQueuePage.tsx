import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { apiRequest } from '../../lib/api';
import { getStoredSession } from '../../lib/session';
import RequestsBulkTriagePanel from '../../components/requests/RequestsBulkTriagePanel';
import RequestsCreateForm from '../../components/requests/RequestsCreateForm';
import RequestDetailCommentsPanel from '../../components/requests/RequestDetailCommentsPanel';
import RequestDetailControlsPanel from '../../components/requests/RequestDetailControlsPanel';
import RequestEnrollmentReviewPanel from '../../components/requests/RequestEnrollmentReviewPanel';
import RequestDetailInfoPanel from '../../components/requests/RequestDetailInfoPanel';
import RequestDetailOverviewPanel from '../../components/requests/RequestDetailOverviewPanel';
import RequestQueueTableRow from '../../components/requests/RequestQueueTableRow';
import RequestSelectedDetailPanel from '../../components/requests/RequestSelectedDetailPanel';
import RequestsQueueEmptyState from '../../components/requests/RequestsQueueEmptyState';
import RequestsQueueHero from '../../components/requests/RequestsQueueHero';
import RequestsQueueSection from '../../components/requests/RequestsQueueSection';
import RequestsQueueTablePanel from '../../components/requests/RequestsQueueTablePanel';
import RequestsQueueToolbar from '../../components/requests/RequestsQueueToolbar';
import Pagination from '../../components/Pagination';
import { actionButtonStyles } from '../../lib/buttonStyles';

const ENROLLMENT_REQUEST_TYPE = 'device_enrollment';
const REQUESTS_PAGE_SIZE = 12;
const ASSIGNEE_OPTIONS_PAGE_SIZE = 200;
const REQUESTS_UPDATED_EVENT = 'itms:requests-updated';
const ACTIONABLE_REQUEST_STATUSES = new Set(['pending', 'in_progress']);

interface QueueComment {
  id: string;
  author: string;
  note: string;
  createdAt: string;
}

interface QueuePerson {
  id?: string;
  fullName?: string;
}

interface QueueRequest {
  id: string;
  type: string;
  title: string;
  description: string;
  status: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
  requester: QueuePerson;
  assignee: QueuePerson;
  comments: QueueComment[];
}

interface PaginatedQueueResponse {
  items: QueueRequest[];
  total: number;
  page: number;
  pageSize: number;
  summary?: {
    pending: number;
    inProgress: number;
    resolved: number;
    enrollment: number;
    pendingEnrollment: number;
  };
}

interface UserOption {
  id: string;
  fullName?: string;
  full_name?: string;
  role?: string;
}

interface PaginatedUserOptionsResponse {
  items: UserOption[];
  total: number;
  page: number;
  pageSize: number;
}

interface WorkflowSettings {
  ticketAssigneeIds: string[];
}

export function normalizeWorkflowSettings(settings?: WorkflowSettings | null): WorkflowSettings {
  return {
    ticketAssigneeIds: Array.isArray(settings?.ticketAssigneeIds)
      ? settings.ticketAssigneeIds.filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
      : [],
  };
}

export function normalizeQueueRequest(request: QueueRequest): QueueRequest {
  return {
    ...request,
    title: request.title || '',
    description: request.description || '',
    notes: request.notes || '',
    requester: request.requester || {},
    assignee: request.assignee || {},
    comments: Array.isArray(request.comments) ? request.comments.filter(Boolean) : [],
  };
}

interface QueueDevice {
  id: string;
  assetId: string;
  hostname: string;
}

type QueueSectionId = 'enrollment' | 'support';
type QueueViewMode = 'list' | 'table';
type RequestDetailSection = 'overview' | 'details' | 'comments' | 'controls';

interface BulkActionFeedback {
  tone: 'success' | 'warning';
  actionLabel: string;
  successCount: number;
  failureCount: number;
  failedRequestIds: string[];
  movedOutOfViewCount?: number;
  movedToStatus?: string;
}

interface QueueRequestForm {
  type: string;
  title: string;
  description: string;
}

const STATUS_OPTIONS = ['pending', 'in_progress', 'resolved', 'rejected'];
const DEFAULT_REQUEST_TYPE = 'Laptop change';

export function formatStatusLabel(status: string) {
  return status.replace(/_/g, ' ');
}

export function formatTypeLabel(type: string) {
  if (type === ENROLLMENT_REQUEST_TYPE) {
    return 'Enrollment';
  }

  return type.replace(/_/g, ' ');
}

export function getTypeFilterLabel(type: string) {
  if (type === ENROLLMENT_REQUEST_TYPE) {
    return 'Enrollment reviews';
  }
  if (type === 'other') {
    return 'Other requests';
  }
  return 'All request types';
}

export function getStatusClasses(status: string) {
  if (status === 'resolved') {
    return 'bg-emerald-100 text-emerald-700';
  }
  if (status === 'rejected') {
    return 'bg-rose-100 text-rose-700';
  }
  if (status === 'in_progress') {
    return 'bg-amber-100 text-amber-700';
  }
  return 'bg-zinc-100 text-zinc-700';
}

export function parseEnrollmentDetails(description: string) {
  return description
    .split('\n')
    .map((line) => line.trim())
    .reduce<Record<string, string>>((details, line) => {
      const separator = line.indexOf(':');
      if (separator <= 0) {
        return details;
      }

      const key = line.slice(0, separator).trim().toLowerCase();
      const value = line.slice(separator + 1).trim();
      if (value) {
        details[key] = value;
      }
      return details;
    }, {});
}

export function getRequestAssigneeLabel(request: QueueRequest, isEnrollmentRequest: boolean) {
  if (request.assignee?.fullName?.trim()) {
    return request.assignee.fullName.trim();
  }
  if (!isEnrollmentRequest) {
    return 'Unassigned';
  }
  if (request.status === 'resolved') {
    return 'Auto-resolved';
  }
  if (request.status === 'rejected') {
    return 'No IT owner';
  }
  return 'Needs IT review';
}

export function parseRequestDetails(description: string) {
  return description
    .split('\n')
    .map((line) => line.trim())
    .reduce<Record<string, string>>((details, line) => {
      const separator = line.indexOf(':');
      if (separator <= 0) {
        return details;
      }

      const key = line.slice(0, separator).trim().toLowerCase();
      const value = line.slice(separator + 1).trim();
      if (value) {
        details[key] = value;
      }
      return details;
    }, {});
}

export function getSectionTone(section: QueueSectionId) {
  if (section === 'enrollment') {
    return {
      shell: 'border-brand-200 bg-brand-50/40',
      badge: 'bg-brand-100 text-brand-700',
      heading: 'text-brand-900',
      subtext: 'text-brand-700/80',
    };
  }

  return {
    shell: 'border-emerald-100 bg-white/95 shadow-sm backdrop-blur',
    badge: 'bg-emerald-100 text-emerald-700',
    heading: 'text-zinc-950',
    subtext: 'text-zinc-600',
  };
}

export function formatDateTime(value: string) {
  return new Date(value).toLocaleString();
}

export function formatRelativeTime(value: string) {
  const timestamp = new Date(value).getTime();
  const diffMs = Date.now() - timestamp;
  const diffMinutes = Math.max(1, Math.round(diffMs / 60000));

  if (diffMinutes < 60) {
    return `${diffMinutes}m ago`;
  }

  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) {
    return `${diffHours}h ago`;
  }

  const diffDays = Math.round(diffHours / 24);
  return `${diffDays}d ago`;
}

export function getFreshnessTone(value: string) {
  const ageHours = Math.max(0, (Date.now() - new Date(value).getTime()) / 3600000);
  if (ageHours >= 72) {
    return 'bg-rose-100 text-rose-700';
  }
  if (ageHours >= 24) {
    return 'bg-amber-100 text-amber-700';
  }
  return 'bg-emerald-100 text-emerald-700';
}

export function buildNoteTemplate(kind: 'triage' | 'waiting' | 'resolved') {
  if (kind === 'triage') {
    return 'Initial triage completed. Queue owner assigned and next action identified.';
  }
  if (kind === 'waiting') {
    return 'Waiting on requester confirmation, supporting details, or external dependency.';
  }
  return 'Work completed and shared with requester. Monitoring for any follow-up.';
}

export default function RequestsQueuePage() {
  const session = getStoredSession();
  const isAuditor = session?.user.role === 'auditor';
  const [requests, setRequests] = useState<QueueRequest[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [workflowSettings, setWorkflowSettings] = useState<WorkflowSettings | null>(null);
  const [devices, setDevices] = useState<QueueDevice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [assigneeDrafts, setAssigneeDrafts] = useState<Record<string, string>>({});
  const [statusDrafts, setStatusDrafts] = useState<Record<string, string>>({});
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState('');
  const [totalRequests, setTotalRequests] = useState(0);
  const [requestSummary, setRequestSummary] = useState({ pending: 0, inProgress: 0, resolved: 0, enrollment: 0, pendingEnrollment: 0 });
  const [viewMode, setViewMode] = useState<QueueViewMode>('list');
  const [selectedTableRequestId, setSelectedTableRequestId] = useState('');
  const [selectedBulkRequestIds, setSelectedBulkRequestIds] = useState<string[]>([]);
  const [bulkAssigneeId, setBulkAssigneeId] = useState('');
  const [bulkStatus, setBulkStatus] = useState('in_progress');
  const [bulkSaving, setBulkSaving] = useState(false);
  const [bulkFeedback, setBulkFeedback] = useState<BulkActionFeedback | null>(null);
  const [requestForm, setRequestForm] = useState<QueueRequestForm>({ type: DEFAULT_REQUEST_TYPE, title: '', description: '' });
  const [requestSubmitting, setRequestSubmitting] = useState(false);
  const [detailSectionByRequestId, setDetailSectionByRequestId] = useState<Record<string, RequestDetailSection>>({});
  const navigate = useNavigate();
  const location = useLocation();
  const basePath = location.pathname.split('/requests')[0];
  const previousFiltersRef = useRef({ searchQuery, statusFilter, typeFilter });

  const loadQueuePage = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ paginate: '1', page: String(currentPage), page_size: String(REQUESTS_PAGE_SIZE) });
      if (searchQuery.trim()) {
        params.set('search', searchQuery.trim());
      }
      if (statusFilter !== 'all') {
        params.set('status', statusFilter);
      }
      if (typeFilter !== 'all') {
        params.set('type', typeFilter);
      }
      const queue = await apiRequest<PaginatedQueueResponse>(`/api/requests?${params.toString()}`);
      const normalizedItems = Array.isArray(queue.items) ? queue.items.map(normalizeQueueRequest) : [];
      setRequests(normalizedItems);
      setTotalRequests(queue.total || 0);
      setRequestSummary({
        pending: queue.summary?.pending || 0,
        inProgress: queue.summary?.inProgress || 0,
        resolved: queue.summary?.resolved || 0,
        enrollment: queue.summary?.enrollment || 0,
        pendingEnrollment: queue.summary?.pendingEnrollment || 0,
      });
      setAssigneeDrafts(Object.fromEntries(normalizedItems.map((item) => [item.id, item.assignee?.id || ''])));
      setStatusDrafts(Object.fromEntries(normalizedItems.map((item) => [item.id, item.status])));
      setNoteDrafts(Object.fromEntries(normalizedItems.map((item) => [item.id, item.notes || ''])));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Failed to load support queue');
    } finally {
      setLoading(false);
    }
  }, [currentPage, searchQuery, statusFilter, typeFilter]);

  useEffect(() => {
    const previousFilters = previousFiltersRef.current;
    const filtersChanged = previousFilters.searchQuery !== searchQuery || previousFilters.statusFilter !== statusFilter || previousFilters.typeFilter !== typeFilter;

    if (filtersChanged && currentPage !== 1) {
      return;
    }

    previousFiltersRef.current = { searchQuery, statusFilter, typeFilter };
    void loadQueuePage();
  }, [currentPage, loadQueuePage, searchQuery, statusFilter, typeFilter]);

  useEffect(() => {
    let cancelled = false;

    const loadAuxiliaryData = async () => {
      try {
        const params = new URLSearchParams({
          paginate: '1',
          page: '1',
          page_size: String(ASSIGNEE_OPTIONS_PAGE_SIZE),
        });
        params.append('role', 'it_team');
        params.append('role', 'super_admin');
        const [userList, workflowData] = await Promise.all([
          apiRequest<PaginatedUserOptionsResponse>(`/api/users?${params.toString()}`),
          apiRequest<WorkflowSettings>('/api/settings/workflow'),
        ]);
        if (!cancelled) {
          setUsers(userList.items);
          setWorkflowSettings(normalizeWorkflowSettings(workflowData));
        }
      } catch (requestError) {
        if (!cancelled) {
          setError(requestError instanceof Error ? requestError.message : 'Failed to load support queue helpers');
        }
      }
    };

    void loadAuxiliaryData();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const lookupKeys = Array.from(new Set(
      requests
        .filter((request) => request.type === ENROLLMENT_REQUEST_TYPE)
        .map((request) => (parseEnrollmentDetails(request.description)['asset tag / host'] || '').trim().toLowerCase())
        .filter(Boolean),
    ));

    if (!lookupKeys.length) {
      setDevices([]);
      return () => {
        cancelled = true;
      };
    }

    const loadLinkedDevices = async () => {
      try {
        const params = new URLSearchParams();
        lookupKeys.forEach((lookup) => params.append('lookup', lookup));
        const deviceList = await apiRequest<QueueDevice[]>(`/api/devices?${params.toString()}`);
        if (!cancelled) {
          setDevices(deviceList || []);
        }
      } catch (requestError) {
        if (!cancelled) {
          setError(requestError instanceof Error ? requestError.message : 'Failed to load linked enrollment devices');
        }
      }
    };

    void loadLinkedDevices();

    return () => {
      cancelled = true;
    };
  }, [requests]);

  useEffect(() => {
    setCurrentPage((current) => (current === 1 ? current : 1));
  }, [searchQuery, statusFilter, typeFilter]);

  useEffect(() => {
    if (isAuditor && viewMode !== 'list') {
      setViewMode('list');
    }
  }, [isAuditor, viewMode]);

  const itUsers = useMemo(
    () => users.filter((user) => {
      const role = (user.role || '').toLowerCase();
      if (role !== 'it_team' && role !== 'super_admin') {
        return false;
      }
      if (!workflowSettings || workflowSettings.ticketAssigneeIds.length === 0) {
        return true;
      }
      return workflowSettings.ticketAssigneeIds.includes(user.id);
    }),
    [users, workflowSettings],
  );

  const enrollmentCount = requestSummary.enrollment;
  const pendingEnrollmentCount = requestSummary.pendingEnrollment;
  const deviceIdByEnrollmentKey = useMemo(() => {
    const index = new Map<string, string>();

    devices.forEach((device) => {
      const assetId = device.assetId?.trim().toLowerCase();
      const hostname = device.hostname?.trim().toLowerCase();
      if (assetId) {
        index.set(assetId, device.id);
      }
      if (hostname) {
        index.set(hostname, device.id);
      }
    });

    return index;
  }, [devices]);

  const sectionedRequests = useMemo(() => {
    const enrollmentItems = requests.filter((request) => request.type === ENROLLMENT_REQUEST_TYPE);
    const supportItems = requests.filter((request) => request.type !== ENROLLMENT_REQUEST_TYPE);

    if (typeFilter === ENROLLMENT_REQUEST_TYPE) {
      return [{
        id: 'enrollment' as QueueSectionId,
        title: 'Enrollment Reviews',
        description: 'New endpoint onboarding requests that need device linkage and approval.',
        items: enrollmentItems,
        emptyMessage: 'No enrollment reviews matched the current filters.',
      }];
    }

    if (typeFilter === 'other') {
      return [{
        id: 'support' as QueueSectionId,
        title: 'Support Requests',
        description: 'General IT queue for access, software, hardware, and employee support work.',
        items: supportItems,
        emptyMessage: 'No support requests matched the current filters.',
      }];
    }

    return [
      {
        id: 'enrollment' as QueueSectionId,
        title: 'Enrollment Reviews',
        description: 'Requests created from imported systems and onboarding flows.',
        items: enrollmentItems,
        emptyMessage: 'No enrollment reviews matched the current filters.',
      },
      {
        id: 'support' as QueueSectionId,
        title: 'Support Requests',
        description: 'All non-enrollment work items in the IT queue.',
        items: supportItems,
        emptyMessage: 'No support requests matched the current filters.',
      },
    ];
  }, [requests, typeFilter]);

  const activeTypeLabel = useMemo(
    () => getTypeFilterLabel(typeFilter),
    [typeFilter],
  );

  const activeStatusLabel = useMemo(
    () => (statusFilter === 'all' ? 'All statuses' : formatStatusLabel(statusFilter)),
    [statusFilter],
  );

  const typeCounts = useMemo(() => ({
    all: totalRequests,
    [ENROLLMENT_REQUEST_TYPE]: enrollmentCount,
    other: Math.max(0, totalRequests - enrollmentCount),
  }), [enrollmentCount, totalRequests]);

  const unassignedCount = useMemo(
    () => requests.filter((request) => !request.assignee?.id && ACTIONABLE_REQUEST_STATUSES.has(request.status)).length,
    [requests],
  );

  const supportNeedsReviewCount = useMemo(
    () => requests.filter((request) => request.type !== ENROLLMENT_REQUEST_TYPE && !request.assignee?.id && ACTIONABLE_REQUEST_STATUSES.has(request.status)).length,
    [requests],
  );

  const needsReviewCount = pendingEnrollmentCount + supportNeedsReviewCount;

  const recentActivityCount = useMemo(
    () => requests.filter((request) => Date.now() - new Date(request.updatedAt).getTime() < 24 * 60 * 60 * 1000).length,
    [requests],
  );

  const hasActiveFilters = searchQuery.trim().length > 0 || statusFilter !== 'all' || typeFilter !== 'all';
  const hasVisibleRequests = requests.length > 0;

  useEffect(() => {
    if (!requests.length) {
      setSelectedTableRequestId('');
      setSelectedBulkRequestIds([]);
      return;
    }

    if (!selectedTableRequestId || !requests.some((request) => request.id === selectedTableRequestId)) {
      setSelectedTableRequestId(requests[0].id);
    }

    setSelectedBulkRequestIds((current) => current.filter((requestId) => requests.some((request) => request.id === requestId)));
  }, [requests, selectedTableRequestId]);

  const bulkSelectedCount = selectedBulkRequestIds.length;

  const canBulkSelectRequest = (requestId: string) => {
    const request = requests.find((entry) => entry.id === requestId);
    return Boolean(request && ACTIONABLE_REQUEST_STATUSES.has(request.status));
  };

  const toggleBulkRequest = (requestId: string) => {
    if (!canBulkSelectRequest(requestId)) {
      return;
    }
    setBulkFeedback(null);
    setSelectedBulkRequestIds((current) => (
      current.includes(requestId)
        ? current.filter((id) => id !== requestId)
        : [...current, requestId]
    ));
  };

  const toggleBulkSection = (requestIds: string[]) => {
    const selectableRequestIds = requestIds.filter((requestId) => canBulkSelectRequest(requestId));
    const everySelected = selectableRequestIds.length > 0 && selectableRequestIds.every((requestId) => selectedBulkRequestIds.includes(requestId));
    setBulkFeedback(null);
    setSelectedBulkRequestIds((current) => {
      if (everySelected) {
        return current.filter((requestId) => !selectableRequestIds.includes(requestId));
      }

      return Array.from(new Set([...current, ...selectableRequestIds]));
    });
  };

  const handleShowBulkStatusResults = () => {
    if (!bulkFeedback?.movedToStatus) {
      return;
    }
    setStatusFilter(bulkFeedback.movedToStatus);
  };

  const handleBulkAssign = async () => {
    if (!bulkAssigneeId || !selectedBulkRequestIds.length) {
      return;
    }

    try {
      const requestIds = [...selectedBulkRequestIds];
      setBulkSaving(true);
      setError('');
      setBulkFeedback(null);
      const results = await Promise.allSettled(requestIds.map((requestId) => apiRequest(`/api/requests/${requestId}/assign`, {
        method: 'POST',
        body: JSON.stringify({ assigneeId: bulkAssigneeId }),
      })));

      const failedRequestIds = results.flatMap((result, index) => (result.status === 'rejected' ? [requestIds[index]] : []));
      const successCount = results.length - failedRequestIds.length;

      setBulkFeedback({
        tone: failedRequestIds.length ? 'warning' : 'success',
        actionLabel: 'assign',
        successCount,
        failureCount: failedRequestIds.length,
        failedRequestIds,
      });
      setSelectedBulkRequestIds(failedRequestIds);
      await loadQueuePage();
      window.dispatchEvent(new Event(REQUESTS_UPDATED_EVENT));
    } finally {
      setBulkSaving(false);
    }
  };

  const handleBulkStatusUpdate = async () => {
    if (!selectedBulkRequestIds.length) {
      return;
    }

    const note = bulkStatus === 'resolved'
      ? buildNoteTemplate('resolved')
      : bulkStatus === 'in_progress'
        ? buildNoteTemplate('triage')
        : buildNoteTemplate('waiting');

    try {
      const requestIds = [...selectedBulkRequestIds];
      setBulkSaving(true);
      setError('');
      setBulkFeedback(null);
      const results = await Promise.allSettled(requestIds.map((requestId) => apiRequest(`/api/requests/${requestId}/status`, {
        method: 'PUT',
        body: JSON.stringify({
          status: bulkStatus,
          notes: noteDrafts[requestId]?.trim() ? noteDrafts[requestId] : note,
        }),
      })));

      const failedRequestIds = results.flatMap((result, index) => (result.status === 'rejected' ? [requestIds[index]] : []));
      const successCount = results.length - failedRequestIds.length;
      const movedOutOfViewCount = statusFilter !== 'all' && bulkStatus !== statusFilter ? successCount : 0;

      setBulkFeedback({
        tone: failedRequestIds.length ? 'warning' : 'success',
        actionLabel: 'status update',
        successCount,
        failureCount: failedRequestIds.length,
        failedRequestIds,
        movedOutOfViewCount,
        movedToStatus: movedOutOfViewCount ? bulkStatus : undefined,
      });
      setSelectedBulkRequestIds(failedRequestIds);
      await loadQueuePage();
      window.dispatchEvent(new Event(REQUESTS_UPDATED_EVENT));
    } finally {
      setBulkSaving(false);
    }
  };

  const handleAssign = async (requestId: string) => {
    const assigneeId = assigneeDrafts[requestId];
    if (!assigneeId) {
      return;
    }

    try {
      setSavingId(requestId);
      setError('');
      await apiRequest(`/api/requests/${requestId}/assign`, {
        method: 'POST',
        body: JSON.stringify({ assigneeId }),
      });
      await loadQueuePage();
      window.dispatchEvent(new Event(REQUESTS_UPDATED_EVENT));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Failed to assign request');
    } finally {
      setSavingId('');
    }
  };

  const handleStatusUpdate = async (requestId: string) => {
    try {
      setSavingId(requestId);
      setError('');
      await apiRequest(`/api/requests/${requestId}/status`, {
        method: 'PUT',
        body: JSON.stringify({
          status: statusDrafts[requestId] || 'pending',
          notes: noteDrafts[requestId] || '',
        }),
      });
      await loadQueuePage();
      window.dispatchEvent(new Event(REQUESTS_UPDATED_EVENT));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Failed to update request');
    } finally {
      setSavingId('');
    }
  };

  const handleQuickStatusUpdate = async (requestId: string, status: string, fallbackNote: string) => {
    setStatusDrafts((current) => ({ ...current, [requestId]: status }));
    setNoteDrafts((current) => ({
      ...current,
      [requestId]: current[requestId]?.trim() ? current[requestId] : fallbackNote,
    }));

    try {
      setSavingId(requestId);
      setError('');
      await apiRequest(`/api/requests/${requestId}/status`, {
        method: 'PUT',
        body: JSON.stringify({
          status,
          notes: noteDrafts[requestId]?.trim() ? noteDrafts[requestId] : fallbackNote,
        }),
      });
      await loadQueuePage();
      window.dispatchEvent(new Event(REQUESTS_UPDATED_EVENT));
      return true;
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Failed to update request');
      return false;
    } finally {
      setSavingId('');
    }
  };

  const handleApproveAndOpenDevice = async (requestId: string, deviceId?: string) => {
    const updated = await handleQuickStatusUpdate(
      requestId,
      'resolved',
      'Endpoint enrollment approved and onboarding review completed.',
    );

    if (updated && deviceId) {
      navigate(`${basePath}/devices/${deviceId}`, {
        state: {
          enrollmentApprovalMessage: 'Enrollment review approved. Device is now ready for follow-up actions.',
          approvedRequestId: requestId,
        },
      });
    }
  };

  const clearFilters = () => {
    setSearchQuery('');
    setStatusFilter('all');
    setTypeFilter('all');
  };

  const handleCreateRequest = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!requestForm.type || !requestForm.title.trim()) {
      return;
    }

    try {
      setRequestSubmitting(true);
      setError('');
      await apiRequest('/api/me/requests', {
        method: 'POST',
        body: JSON.stringify({
          type: requestForm.type,
          title: requestForm.title.trim(),
          description: requestForm.description.trim(),
        }),
      });
      setRequestForm({ type: DEFAULT_REQUEST_TYPE, title: '', description: '' });
      await loadQueuePage();
      window.dispatchEvent(new Event(REQUESTS_UPDATED_EVENT));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Failed to create request');
    } finally {
      setRequestSubmitting(false);
    }
  };

  const renderRequestDetail = (request: QueueRequest, shellClassName = '') => {
    const isEnrollmentRequest = request.type === ENROLLMENT_REQUEST_TYPE;
    const canActOnRequest = !isAuditor && savingId !== request.id && ACTIONABLE_REQUEST_STATUSES.has(request.status);
    const canStartRequest = canActOnRequest && request.status === 'pending';
    const enrollmentDetails = isEnrollmentRequest ? parseEnrollmentDetails(request.description) : null;
    const requestDetails = isEnrollmentRequest ? enrollmentDetails || {} : parseRequestDetails(request.description || '');
    const deviceLookupKey = (enrollmentDetails?.['asset tag / host'] || '').trim().toLowerCase();
    const linkedDeviceId = deviceLookupKey ? deviceIdByEnrollmentKey.get(deviceLookupKey) : undefined;
    const systemLabel = (requestDetails['system'] || requestDetails['hostname'] || requestDetails['device'] || requestDetails['asset tag / host'] || '').trim() || 'Not linked';
    const assetLabel = (requestDetails['asset id'] || requestDetails['asset tag'] || requestDetails['asset'] || requestDetails['asset tag / host'] || '').trim() || 'Not provided';
    const usernameLabel = (requestDetails['username'] || requestDetails['user'] || requestDetails['requester name'] || request.requester?.fullName || '').trim() || '-';
    const assigneeLabel = getRequestAssigneeLabel(request, isEnrollmentRequest);
    const activeDetailSection = detailSectionByRequestId[request.id] || 'overview';
    const detailSections: Array<{ id: RequestDetailSection; label: string }> = [
      { id: 'overview', label: 'Overview' },
      { id: 'details', label: isEnrollmentRequest ? 'Enrollment Details' : 'Request Details' },
      { id: 'comments', label: `Comments ${request.comments.length}` },
    ];

    if (!isAuditor) {
      detailSections.push({ id: 'controls', label: 'Queue Controls' });
    }

    return (
      <article key={request.id} className={shellClassName || 'rounded-2xl border border-emerald-100 bg-white/95 px-5 py-5 shadow-sm'}>
        <div className="space-y-4">
          <div className="grid gap-3 rounded-2xl border border-emerald-100 bg-[linear-gradient(180deg,_#ffffff_0%,_#f4fbf6_100%)] p-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)_minmax(0,1.2fr)_minmax(0,0.9fr)_auto]">
            <div className="rounded-xl border border-emerald-100 bg-white px-4 py-3 shadow-sm">
              <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-zinc-500">System / Asset</div>
              <div className="mt-2 text-sm font-semibold text-zinc-950">{systemLabel}</div>
              <div className="mt-1 text-xs text-zinc-500">{assetLabel}</div>
            </div>
            <div className="rounded-xl border border-emerald-100 bg-white px-4 py-3 shadow-sm">
              <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-zinc-500">Username</div>
              <div className="mt-2 text-sm font-semibold text-zinc-950">{usernameLabel}</div>
              <div className="mt-1 text-xs text-zinc-500">Requester</div>
            </div>
            <div className="rounded-xl border border-emerald-100 bg-white px-4 py-3 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-zinc-500">Request</div>
                <span className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-emerald-700">{formatTypeLabel(request.type)}</span>
              </div>
              <div className="mt-2 text-sm font-semibold text-zinc-950">{request.title}</div>
              <div className="mt-1 text-xs text-zinc-500">{request.id.slice(0, 8)} • {request.comments.length} comments</div>
            </div>
            <div className="rounded-xl border border-emerald-100 bg-white px-4 py-3 shadow-sm">
              <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-zinc-500">Assigned IT</div>
              <div className="mt-2 text-sm font-semibold text-zinc-950">{assigneeLabel}</div>
              <div className="mt-1 text-xs text-zinc-500">Updated {formatRelativeTime(request.updatedAt)}</div>
            </div>
            <div className="rounded-xl border border-emerald-100 bg-white px-4 py-3 shadow-sm">
              <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-zinc-500">Status</div>
              <div className="mt-2">
                <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${getStatusClasses(request.status)}`}>{formatStatusLabel(request.status)}</span>
              </div>
              <div className="mt-2 text-xs text-zinc-500">Created {formatRelativeTime(request.createdAt)}</div>
            </div>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-emerald-100 bg-emerald-50/70 px-3 py-3">
            <div className="flex min-w-max gap-2">
              {detailSections.map((section) => (
                <button
                  key={section.id}
                  type="button"
                  onClick={() => setDetailSectionByRequestId((current) => ({ ...current, [request.id]: section.id }))}
                  className={`rounded-full border px-3 py-2 text-xs font-bold uppercase tracking-wider ${activeDetailSection === section.id ? `${actionButtonStyles.save} shadow-sm` : 'border-emerald-200 bg-white text-emerald-800 hover:bg-emerald-50'}`}
                >
                  {section.label}
                </button>
              ))}
            </div>
          </div>

          {activeDetailSection === 'overview' ? (
            <RequestDetailOverviewPanel
              requestIdLabel={request.id.slice(0, 8)}
              typeLabel={formatTypeLabel(request.type)}
              statusLabel={formatStatusLabel(request.status)}
              statusClassName={getStatusClasses(request.status)}
              freshnessLabel={formatRelativeTime(request.updatedAt)}
              freshnessClassName={getFreshnessTone(request.updatedAt)}
              commentsLabel={`${request.comments.length} comments`}
              title={request.title}
              description={request.description || 'No description provided.'}
              requesterName={usernameLabel}
              assigneeName={assigneeLabel}
              updatedAtLabel={formatDateTime(request.updatedAt)}
              createdAtLabel={formatRelativeTime(request.createdAt)}
            />
          ) : null}

            {activeDetailSection === 'details' && isEnrollmentRequest ? (
              <RequestEnrollmentReviewPanel
                assetLabel={enrollmentDetails?.['asset tag / host'] || '-'}
                requesterName={enrollmentDetails?.['requester name'] || request.requester?.fullName || '-'}
                requesterEmail={enrollmentDetails?.['requester email'] || 'Email not provided'}
                employeeIdLabel={enrollmentDetails?.['employee id'] || '-'}
                departmentLabel={enrollmentDetails?.department || '-'}
                modelLabel={enrollmentDetails?.model || 'Model pending'}
                osLabel={enrollmentDetails?.os || 'OS details pending'}
                canOpenDevice={Boolean(linkedDeviceId)}
                canStartReview={canStartRequest}
                canApproveAndOpen={canActOnRequest && Boolean(linkedDeviceId)}
                canApprove={canActOnRequest}
                canReject={canActOnRequest}
                openDeviceLabel={linkedDeviceId ? 'Open Device' : 'Device Pending Sync'}
                approveAndOpenLabel={isAuditor ? 'Read-only' : linkedDeviceId ? 'Approve and Open Device' : 'Await Device Sync'}
                onOpenDevice={() => {
                  if (linkedDeviceId) {
                    navigate(`${basePath}/devices/${linkedDeviceId}`);
                  }
                }}
                onStartReview={() => { void handleQuickStatusUpdate(request.id, 'in_progress', 'Enrollment review started by IT team.'); }}
                onApproveAndOpen={() => { void handleApproveAndOpenDevice(request.id, linkedDeviceId); }}
                onApprove={() => { void handleQuickStatusUpdate(request.id, 'resolved', 'Endpoint enrollment approved and onboarding review completed.'); }}
                onReject={() => { void handleQuickStatusUpdate(request.id, 'rejected', 'Endpoint enrollment rejected during IT review.'); }}
              />
            ) : null}

            {activeDetailSection === 'details' && !isEnrollmentRequest ? (
              <RequestDetailInfoPanel
                requesterName={usernameLabel}
                assigneeName={assigneeLabel}
                createdAtLabel={formatDateTime(request.createdAt)}
                updatedAtLabel={formatRelativeTime(request.updatedAt)}
                canOpenRequester={Boolean(request.requester?.id)}
                canOpenAssignee={Boolean(request.assignee?.id)}
                onOpenRequester={() => navigate(`${basePath}/users/${request.requester?.id}`)}
                onOpenAssignee={() => navigate(`${basePath}/users/${request.assignee?.id}`)}
              />
            ) : null}

          {activeDetailSection === 'comments' ? <RequestDetailCommentsPanel comments={request.comments} /> : null}

          {activeDetailSection === 'controls' ? (
            <RequestDetailControlsPanel
              assigneeDraft={assigneeDrafts[request.id] || ''}
              statusDraft={statusDrafts[request.id] || request.status}
              noteDraft={noteDrafts[request.id] || ''}
              assigneeOptions={itUsers.map((user) => ({ value: user.id, label: user.fullName || user.full_name || user.id }))}
              statusOptions={STATUS_OPTIONS.map((status) => ({ value: status, label: formatStatusLabel(status) }))}
              saving={savingId === request.id}
              onAssigneeDraftChange={(value) => setAssigneeDrafts((current) => ({ ...current, [request.id]: value }))}
              onAssign={() => { void handleAssign(request.id); }}
              onStatusDraftChange={(value) => setStatusDrafts((current) => ({ ...current, [request.id]: value }))}
              onNoteDraftChange={(value) => setNoteDrafts((current) => ({ ...current, [request.id]: value }))}
              onApplyNoteTemplate={(templateId) => setNoteDrafts((current) => ({ ...current, [request.id]: buildNoteTemplate(templateId) }))}
              onUpdateRequest={() => { void handleStatusUpdate(request.id); }}
            />
          ) : null}
        </div>
      </article>
    );
  };

  return (
    <div className="space-y-6 rounded-[32px] border border-zinc-200 bg-[linear-gradient(180deg,_#f8fcff_0%,_#eef6ff_100%)] p-4 shadow-[0_20px_60px_rgba(14,165,233,0.08)] lg:p-6">
      <RequestsQueueHero
        totalRequests={totalRequests}
        pendingCount={requestSummary.pending}
        inProgressCount={requestSummary.inProgress}
        resolvedCount={requestSummary.resolved}
        pendingEnrollmentCount={pendingEnrollmentCount}
        enrollmentCount={enrollmentCount}
      />

      {error ? <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</div> : null}

      {isAuditor ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          Auditor access is read-only on requests. You can review queue state, comments, and linked devices, but creating, assigning, and status changes are disabled.
        </div>
      ) : null}

      {!isAuditor ? (
        <RequestsCreateForm
          requestForm={requestForm}
          requestSubmitting={requestSubmitting}
          onSubmit={handleCreateRequest}
          onTypeChange={(value) => setRequestForm((current) => ({ ...current, type: value }))}
          onTitleChange={(value) => setRequestForm((current) => ({ ...current, title: value }))}
          onDescriptionChange={(value) => setRequestForm((current) => ({ ...current, description: value }))}
        />
      ) : null}

      <RequestsQueueToolbar
        searchQuery={searchQuery}
        typeFilter={typeFilter}
        statusFilter={statusFilter}
        totalRequests={totalRequests}
        requestSummary={requestSummary}
        typeCounts={typeCounts}
        activeTypeLabel={activeTypeLabel}
        activeStatusLabel={activeStatusLabel}
        viewMode={isAuditor ? 'list' : viewMode}
        unassignedCount={unassignedCount}
        needsReviewCount={needsReviewCount}
        recentActivityCount={recentActivityCount}
        hasActiveFilters={hasActiveFilters}
        onSearchChange={setSearchQuery}
        onTypeFilterChange={setTypeFilter}
        onStatusFilterChange={setStatusFilter}
        onViewModeChange={isAuditor ? () => undefined : setViewMode}
      />

      {loading ? <div className="rounded-2xl border border-emerald-100 bg-white p-8 text-center text-sm text-zinc-600 shadow-sm">Loading request queue...</div> : null}
      {!loading && !hasVisibleRequests ? (
        <RequestsQueueEmptyState
          hasActiveFilters={hasActiveFilters}
          onResetFilters={clearFilters}
          onOpenDashboard={() => navigate(`${basePath}/dashboard`)}
        />
      ) : null}

      {!loading && hasVisibleRequests && sectionedRequests.map((section) => {
        const tone = getSectionTone(section.id);

        return (
          <RequestsQueueSection
            key={section.id}
            title={section.title}
            description={section.description}
            emptyMessage={section.emptyMessage}
            visibleItems={section.items.length}
            tone={tone}
          >
            {(isAuditor ? 'list' : viewMode) === 'list' ? section.items.map((request, index) => renderRequestDetail(request, `${index > 0 ? 'border-t border-emerald-100 ' : ''}bg-white px-5 py-5`)) : null}
            {!isAuditor && viewMode === 'table' && section.items.length ? (
              <div className="rounded-2xl border border-emerald-100 bg-white/95 p-5 shadow-sm">
                <RequestsBulkTriagePanel
                  bulkSelectedCount={bulkSelectedCount}
                  bulkAssigneeId={bulkAssigneeId}
                  bulkStatus={bulkStatus}
                  bulkSaving={bulkSaving}
                  bulkFeedback={bulkFeedback ? {
                    ...bulkFeedback,
                    movedToStatusLabel: formatStatusLabel(bulkFeedback.movedToStatus || ''),
                  } : null}
                  assigneeOptions={itUsers.map((user) => ({ value: user.id, label: user.fullName || user.full_name || user.id }))}
                  statusOptions={STATUS_OPTIONS.map((status) => ({ value: status, label: formatStatusLabel(status) }))}
                  onAssigneeChange={setBulkAssigneeId}
                  onStatusChange={setBulkStatus}
                  onAssignSelected={() => { void handleBulkAssign(); }}
                  onUpdateStatus={() => { void handleBulkStatusUpdate(); }}
                  onShowMovedStatusResults={handleShowBulkStatusResults}
                />
                <RequestsQueueTablePanel
                  allSelected={section.items.some((request) => canBulkSelectRequest(request.id)) && section.items.filter((request) => canBulkSelectRequest(request.id)).every((request) => selectedBulkRequestIds.includes(request.id))}
                  onToggleAll={() => toggleBulkSection(section.items.map((request) => request.id))}
                  rows={section.items.map((request) => {
                    const isSelected = selectedTableRequestId === request.id;
                    const isEnrollmentRequest = request.type === ENROLLMENT_REQUEST_TYPE;
                    const canActOnRequest = !isAuditor && savingId !== request.id && ACTIONABLE_REQUEST_STATUSES.has(request.status);
                    const canStartRequest = canActOnRequest && request.status === 'pending';
                    const enrollmentDetails = isEnrollmentRequest ? parseEnrollmentDetails(request.description) : null;
                    const deviceLookupKey = (enrollmentDetails?.['asset tag / host'] || '').trim().toLowerCase();
                    const linkedDeviceId = deviceLookupKey ? deviceIdByEnrollmentKey.get(deviceLookupKey) : undefined;
                    const enrollmentOwner = enrollmentDetails?.['requester name'] || request.requester?.fullName || '-';
                    const enrollmentAsset = enrollmentDetails?.['asset tag / host'] || 'Pending asset match';
                    const enrollmentDepartment = enrollmentDetails?.department || 'Department pending';
                    const requestDetails = isEnrollmentRequest ? enrollmentDetails || {} : parseRequestDetails(request.description || '');
                    const usernameLabel = (requestDetails['username'] || requestDetails['user'] || requestDetails['requester name'] || request.requester?.fullName || '').trim() || '-';
                    const isBulkSelected = selectedBulkRequestIds.includes(request.id);

                    return (
                      <RequestQueueTableRow
                        key={request.id}
                        requestIdLabel={request.id.slice(0, 8)}
                        title={request.title}
                        typeLabel={formatTypeLabel(request.type)}
                        commentsLabel={`${request.comments.length} comments`}
                        statusLabel={formatStatusLabel(request.status)}
                        statusClassName={getStatusClasses(request.status)}
                        updatedAtLabel={formatRelativeTime(request.updatedAt)}
                        requesterName={usernameLabel}
                        assigneeName={getRequestAssigneeLabel(request, isEnrollmentRequest)}
                        isSelected={isSelected}
                        isEnrollmentRequest={isEnrollmentRequest}
                        isBulkSelected={isBulkSelected}
                        canStart={canStartRequest}
                        canApproveAndOpen={canActOnRequest}
                        hasLinkedDevice={Boolean(linkedDeviceId)}
                        enrollmentAsset={enrollmentAsset}
                        enrollmentOwner={enrollmentOwner}
                        enrollmentDepartment={enrollmentDepartment}
                        deviceLinkLabel={linkedDeviceId ? 'Device linked' : 'Awaiting device link'}
                        inspectButtonClassName={`rounded-lg px-3 py-2 text-xs font-bold transition ${actionButtonStyles.add}`}
                        onToggleBulkSelect={() => toggleBulkRequest(request.id)}
                        onInspect={() => setSelectedTableRequestId(request.id)}
                        onStart={() => {
                          void handleQuickStatusUpdate(
                            request.id,
                            'in_progress',
                            isEnrollmentRequest ? 'Enrollment review started by IT team.' : 'Support request moved into active handling.',
                          );
                        }}
                        onApproveAndOpen={() => { void handleApproveAndOpenDevice(request.id, linkedDeviceId); }}
                      />
                    );
                  })}
                  selectedDetail={(() => {
                    const selectedRequest = section.items.find((request) => request.id === selectedTableRequestId) || section.items[0];
                    return selectedRequest ? (
                      <RequestSelectedDetailPanel>
                        {renderRequestDetail(selectedRequest, 'bg-white px-5 py-5')}
                      </RequestSelectedDetailPanel>
                    ) : null;
                  })()}
                />
              </div>
            ) : null}
          </RequestsQueueSection>
        );
      })}

      <div className="rounded-xl border border-emerald-100 bg-white shadow-sm">
        <Pagination
          currentPage={currentPage}
          totalItems={totalRequests}
          pageSize={REQUESTS_PAGE_SIZE}
          onPageChange={setCurrentPage}
          itemLabel="requests"
        />
      </div>
    </div>
  );
}
