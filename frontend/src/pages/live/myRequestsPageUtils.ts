export interface RequestComment {
  id: string;
  author: string;
  note: string;
  createdAt: string;
}

export interface RequestRecord {
  id: string;
  type: string;
  title: string;
  description: string;
  status: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
  comments: RequestComment[];
}

export function normalizeRequestRecord(request: RequestRecord): RequestRecord {
  return {
    ...request,
    title: request.title || '',
    description: request.description || '',
    notes: request.notes || '',
    comments: Array.isArray(request.comments) ? request.comments.filter(Boolean) : [],
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
  return 'bg-zinc-100 text-zinc-600';
}