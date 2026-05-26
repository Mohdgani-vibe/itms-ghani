const AUDIENCE_OPTIONS = ['All Employees', 'IT Team', 'Super Admin'] as const;

export function formatAnnouncementTimestamp(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '-' : date.toLocaleString();
}

export function getVisibleAudiences(role: string, canPost: boolean) {
  if (canPost) {
    return [...AUDIENCE_OPTIONS];
  }

  if (role === 'super_admin') {
    return ['All Employees', 'Super Admin'];
  }

  if (role === 'it_team') {
    return ['All Employees', 'IT Team'];
  }

  return ['All Employees'];
}
