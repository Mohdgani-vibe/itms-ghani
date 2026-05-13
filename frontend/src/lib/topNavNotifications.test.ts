import { describe, expect, it } from 'vitest';

import { getTopNavNotificationAccess } from './topNavNotifications';

describe('getTopNavNotificationAccess', () => {
  it('keeps announcements enabled for auditors while hiding chat and requests', () => {
    expect(getTopNavNotificationAccess('auditor')).toEqual({
      announcements: true,
      chat: false,
      requests: false,
    });
  });

  it('keeps all notification surfaces enabled for IT roles', () => {
    expect(getTopNavNotificationAccess('it_team')).toEqual({
      announcements: true,
      chat: true,
      requests: true,
    });
  });

  it('keeps employee notifications available', () => {
    expect(getTopNavNotificationAccess('employee')).toEqual({
      announcements: true,
      chat: true,
      requests: true,
    });
  });
});