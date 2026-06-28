const ENROLLMENT_REQUEST_TYPE = 'device_enrollment';

export interface QueueComment {
  id: string;
  author: string;
  note: string;
  createdAt: string;
}

export interface QueuePerson {
  id?: string;
  fullName?: string;
}

export interface QueueRequest {
  id: string;
  type: string;
  title: string;
  description: string;
  status: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
  slaDeadline?: string | null;
  requester: QueuePerson;
  assignee: QueuePerson;
  comments: QueueComment[];
}

export interface WorkflowSettings {
  ticketAssigneeIds: string[];
}

export type QueueSectionId = 'enrollment' | 'support';

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
    shell: 'border-sky-100 bg-white/95 shadow-sm backdrop-blur',
    badge: 'bg-sky-100 text-sky-700',
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

export function formatSLACountdown(slaDeadline: string, createdAt: string): { label: string; tone: string } | null {
  const deadlineTime = new Date(slaDeadline).getTime();
  const createdTime = new Date(createdAt).getTime();
  const now = Date.now();
  
  if (Number.isNaN(deadlineTime) || Number.isNaN(createdTime)) {
    return null;
  }
  
  const remainingMs = deadlineTime - now;
  const totalDuration = deadlineTime - createdTime;
  const percentRemaining = Math.max(0, (remainingMs / totalDuration) * 100);
  
  if (remainingMs <= 0) {
    return { label: 'Overdue', tone: 'bg-rose-100 text-rose-700' };
  }
  
  const hours = Math.floor(remainingMs / 3600000);
  const minutes = Math.floor((remainingMs % 3600000) / 60000);
  
  let label = '';
  if (hours > 24) {
    const days = Math.floor(hours / 24);
    label = `${days}d ${hours % 24}h remaining`;
  } else if (hours > 0) {
    label = `${hours}h ${minutes}m remaining`;
  } else {
    label = `${minutes}m remaining`;
  }
  
  const tone = percentRemaining < 20 ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700';
  
  return { label, tone };
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