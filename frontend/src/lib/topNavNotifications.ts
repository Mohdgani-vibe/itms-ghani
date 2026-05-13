export interface TopNavNotificationAccess {
  announcements: boolean;
  chat: boolean;
  requests: boolean;
}

export function getTopNavNotificationAccess(role: string): TopNavNotificationAccess {
  const isAuditor = role === 'auditor';

  return {
    announcements: true,
    chat: !isAuditor,
    requests: !isAuditor,
  };
}