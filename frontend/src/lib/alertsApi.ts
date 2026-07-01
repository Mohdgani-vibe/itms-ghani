import { apiRequest } from './api';

export interface Alert {
  id: string;
  source: string;
  severity: string;
  title: string;
  detail: string;
  acknowledged: boolean;
  resolved: boolean;
  created_at: string;
  asset_id?: string;
  hostname?: string;
}

export interface AlertsDashboard {
  summary: {
    total: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
    acknowledged: number;
    resolved: number;
  };
  by_source: Array<{
    source: string;
    count: number;
  }>;
  by_severity: Array<{
    severity: string;
    count: number;
  }>;
  recent: Alert[];
}

export interface AlertsQueryParams {
  page?: number;
  page_size?: number;
  source?: string;
  severity?: string;
  acknowledged?: boolean;
  resolved?: boolean;
  search?: string;
}

export async function fetchAlertsDashboard(): Promise<AlertsDashboard> {
  return apiRequest<AlertsDashboard>('/api/alerts/dashboard');
}

export async function fetchAlerts(params?: AlertsQueryParams): Promise<{ items: Alert[]; total: number }> {
  const queryParams = new URLSearchParams();
  
  if (params) {
    if (params.page) queryParams.set('page', params.page.toString());
    if (params.page_size) queryParams.set('page_size', params.page_size.toString());
    if (params.source) queryParams.set('source', params.source);
    if (params.severity) queryParams.set('severity', params.severity);
    if (params.acknowledged !== undefined) queryParams.set('acknowledged', params.acknowledged.toString());
    if (params.resolved !== undefined) queryParams.set('resolved', params.resolved.toString());
    if (params.search) queryParams.set('search', params.search);
  }

  const url = `/api/alerts${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
  return apiRequest<{ items: Alert[]; total: number }>(url);
}

export async function acknowledgeAlert(id: string): Promise<void> {
  await apiRequest(`/api/alerts/${id}/acknowledge`, { method: 'PUT' });
}

export async function resolveAlert(id: string): Promise<void> {
  await apiRequest(`/api/alerts/${id}/resolve`, { method: 'PUT' });
}

export async function fetchMyAlertsDashboard(): Promise<AlertsDashboard> {
  return apiRequest<AlertsDashboard>('/api/me/alerts/dashboard');
}

export async function fetchMyAlerts(params?: AlertsQueryParams): Promise<{ items: Alert[]; total: number }> {
  const queryParams = new URLSearchParams();
  
  if (params) {
    if (params.page) queryParams.set('page', params.page.toString());
    if (params.page_size) queryParams.set('page_size', params.page_size.toString());
    if (params.source) queryParams.set('source', params.source);
    if (params.severity) queryParams.set('severity', params.severity);
    if (params.search) queryParams.set('search', params.search);
  }

  const url = `/api/me/alerts${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
  return apiRequest<{ items: Alert[]; total: number }>(url);
}
