import { getAllowedPortalSegments, getPreferredPortalPath, type SessionUser } from './session';

const AUDITOR_RESTRICTED_AUDIT_PATHS = [
  /^\/audit\/chat(?:\/|$)/,
  /^\/audit\/patch(?:\/|$)/,
  /^\/audit\/requests(?:\/|$)/,
  /^\/audit\/settings(?:\/|$)/,
];

export function getPortalAccessRedirect(pathname: string, user: SessionUser) {
  const currentPortalMatch = pathname.match(/^\/(admin|it|audit|emp)(?:\/|$)/);
  if (!currentPortalMatch) {
    return null;
  }

  const allowedPortals = getAllowedPortalSegments(user);
  if (allowedPortals.includes(currentPortalMatch[1])) {
    return null;
  }

  return getPreferredPortalPath(user);
}

export function getPageAccessRedirect(pathname: string, user: SessionUser) {
  if (user.role === 'auditor' && AUDITOR_RESTRICTED_AUDIT_PATHS.some((pattern) => pattern.test(pathname))) {
    return getPreferredPortalPath(user);
  }

  return null;
}

export function getRoleAccessRedirect(user: SessionUser, roles: string[]) {
  if (roles.includes(user.role)) {
    return null;
  }

  return getPreferredPortalPath(user);
}