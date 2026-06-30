import { apiRequest } from './api';

export interface User {
  id: string;
  emp_id: string;
  full_name: string;
  email: string;
  status: string;
  entity_id?: string;
  dept_id?: string;
  location_id?: string;
  role?: string;
  department?: string;
  location?: string;
  asset_count: number;
}

export interface UsersListResponse {
  items: User[];
  total: number;
  page: number;
  pageSize: number;
  summary: {
    departmentCounts: Array<{ label: string; count: number }>;
    assetTotal: number;
  };
}

export interface UserMetaOptions {
  roles: Array<{ id: string; name: string }>;
  entities: Array<{ id: string; name: string }>;
  departments: Array<{ id: string; name: string; entity_id?: string }>;
  locations: Array<{ id: string; name: string; entity_id?: string }>;
}

export interface UsersQueryParams {
  page?: number;
  page_size?: number;
  entity?: string;
  dept?: string;
  location?: string;
  role?: string | string[];
  status?: 'active' | 'inactive' | '';
  search?: string;
  department_label?: string;
}

export async function fetchUsers(params?: UsersQueryParams): Promise<UsersListResponse> {
  const queryParams = new URLSearchParams();
  
  if (params) {
    if (params.page) queryParams.set('page', params.page.toString());
    if (params.page_size) queryParams.set('page_size', params.page_size.toString());
    if (params.entity) queryParams.set('entity', params.entity);
    if (params.dept) queryParams.set('dept', params.dept);
    if (params.location) queryParams.set('location', params.location);
    if (params.role) {
      if (Array.isArray(params.role)) {
        params.role.forEach(r => queryParams.append('role', r));
      } else {
        queryParams.set('role', params.role);
      }
    }
    if (params.status) queryParams.set('status', params.status);
    if (params.search) queryParams.set('search', params.search);
    if (params.department_label) queryParams.set('department_label', params.department_label);
  }

  const url = `/api/users${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
  return apiRequest<UsersListResponse>(url);
}

export async function fetchUserMetaOptions(): Promise<UserMetaOptions> {
  return apiRequest<UserMetaOptions>('/api/users/meta/options');
}

export async function fetchUser(id: string): Promise<User> {
  return apiRequest<User>(`/api/users/${id}`);
}

export async function fetchUserAssets(id: string): Promise<any[]> {
  return apiRequest<any[]>(`/api/users/${id}/assets`);
}
