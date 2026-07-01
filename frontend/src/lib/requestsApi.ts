import { apiRequest } from './api';

export interface Request {
  id: string;
  title: string;
  type: string;
  description: string;
  requester_id: string;
  requester_name: string;
  assignee_id?: string;
  assignee_name?: string;
  status: string;
  priority: string;
  created_at: string;
  updated_at: string;
  resolved_at?: string;
}

export interface RequestComment {
  id: string;
  request_id: string;
  user_id: string;
  user_name: string;
  comment: string;
  created_at: string;
}

export interface RequestsQueryParams {
  page?: number;
  page_size?: number;
  type?: string;
  status?: string;
  priority?: string;
  assignee?: string;
  search?: string;
}

export async function fetchRequests(params?: RequestsQueryParams): Promise<{ items: Request[]; total: number }> {
  const queryParams = new URLSearchParams();
  
  if (params) {
    if (params.page) queryParams.set('page', params.page.toString());
    if (params.page_size) queryParams.set('page_size', params.page_size.toString());
    if (params.type) queryParams.set('type', params.type);
    if (params.status) queryParams.set('status', params.status);
    if (params.priority) queryParams.set('priority', params.priority);
    if (params.assignee) queryParams.set('assignee', params.assignee);
    if (params.search) queryParams.set('search', params.search);
  }

  const url = `/api/requests${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
  return apiRequest<{ items: Request[]; total: number }>(url);
}

export async function fetchMyRequests(params?: RequestsQueryParams): Promise<{ items: Request[]; total: number }> {
  const queryParams = new URLSearchParams();
  
  if (params) {
    if (params.page) queryParams.set('page', params.page.toString());
    if (params.page_size) queryParams.set('page_size', params.page_size.toString());
    if (params.type) queryParams.set('type', params.type);
    if (params.status) queryParams.set('status', params.status);
    if (params.search) queryParams.set('search', params.search);
  }

  const url = `/api/me/requests${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
  return apiRequest<{ items: Request[]; total: number }>(url);
}

export async function fetchMyRequest(id: string): Promise<Request> {
  return apiRequest<Request>(`/api/me/requests/${id}`);
}

export async function createMyRequest(data: {
  title: string;
  type: string;
  description: string;
  priority?: string;
}): Promise<{ id: string }> {
  return apiRequest<{ id: string }>('/api/me/requests', {
    method: 'POST',
    body: JSON.stringify(data)
  });
}

export async function commentMyRequest(id: string, comment: string): Promise<void> {
  await apiRequest(`/api/me/requests/${id}/comment`, {
    method: 'POST',
    body: JSON.stringify({ comment })
  });
}

export async function updateRequestStatus(id: string, status: string): Promise<void> {
  await apiRequest(`/api/requests/${id}/status`, {
    method: 'PUT',
    body: JSON.stringify({ status })
  });
}

export async function assignRequest(id: string, assigneeId: string): Promise<void> {
  await apiRequest(`/api/requests/${id}/assign`, {
    method: 'POST',
    body: JSON.stringify({ assignee_id: assigneeId })
  });
}
