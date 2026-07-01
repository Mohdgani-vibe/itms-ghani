import { apiRequest } from './api';

export interface PatchDashboard {
  summary: {
    total_devices: number;
    pending_updates: number;
    up_to_date: number;
    last_scan: string;
  };
  by_department: Array<{
    department: string;
    total: number;
    pending: number;
    up_to_date: number;
  }>;
  by_os: Array<{
    os_name: string;
    total: number;
    pending: number;
  }>;
  recent_patches: Array<{
    id: string;
    hostname: string;
    patches_installed: number;
    status: string;
    completed_at: string;
  }>;
}

export interface PatchDevice {
  id: string;
  hostname: string;
  os_name: string;
  os_version: string;
  pending_updates: number;
  last_scan: string;
  department?: string;
  status: string;
}

export interface PatchJob {
  id: string;
  target: string;
  status: string;
  started_at: string;
  completed_at?: string;
  patches_installed: number;
  output?: string;
}

export interface PatchReport {
  id: string;
  run_date: string;
  total_devices: number;
  successful: number;
  failed: number;
  patches_installed: number;
  created_by: string;
}

export interface PatchDevicesQueryParams {
  page?: number;
  page_size?: number;
  department?: string;
  os?: string;
  status?: string;
  search?: string;
}

export async function fetchPatchDashboard(): Promise<PatchDashboard> {
  return apiRequest<PatchDashboard>('/api/patch/dashboard');
}

export async function fetchPatchDevices(params?: PatchDevicesQueryParams): Promise<{ items: PatchDevice[]; total: number }> {
  const queryParams = new URLSearchParams();
  
  if (params) {
    if (params.page) queryParams.set('page', params.page.toString());
    if (params.page_size) queryParams.set('page_size', params.page_size.toString());
    if (params.department) queryParams.set('department', params.department);
    if (params.os) queryParams.set('os', params.os);
    if (params.status) queryParams.set('status', params.status);
    if (params.search) queryParams.set('search', params.search);
  }

  const url = `/api/patch/devices${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
  return apiRequest<{ items: PatchDevice[]; total: number }>(url);
}

export async function fetchPatchJobs(): Promise<{ items: PatchJob[] }> {
  return apiRequest<{ items: PatchJob[] }>('/api/patch/jobs');
}

export async function runPatchUpdate(target: string, patches?: string[]): Promise<{ job_id: string }> {
  return apiRequest<{ job_id: string }>('/api/patch/run', {
    method: 'POST',
    body: JSON.stringify({ target, patches })
  });
}

export async function fetchPatchReports(): Promise<{ items: PatchReport[] }> {
  return apiRequest<{ items: PatchReport[] }>('/api/patch/reports');
}

export async function fetchPatchReport(id: string): Promise<PatchReport> {
  return apiRequest<PatchReport>(`/api/patch/reports/${id}`);
}

export async function createPatchReport(data: {
  run_date: string;
  total_devices: number;
  successful: number;
  failed: number;
  patches_installed: number;
}): Promise<{ id: string }> {
  return apiRequest<{ id: string }>('/api/patch/reports', {
    method: 'POST',
    body: JSON.stringify(data)
  });
}
