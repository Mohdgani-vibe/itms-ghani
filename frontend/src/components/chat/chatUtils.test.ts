import { describe, expect, it } from 'vitest';

import { normalizeWorkflowSettings } from './chatUtils';

describe('normalizeWorkflowSettings', () => {
  it('fails closed for chat auto-create by default', () => {
    expect(normalizeWorkflowSettings()).toEqual({
      chatAutoCreateEnabled: false,
      chatMemberIds: [],
    });
  });

  it('preserves an enabled chat auto-create flag', () => {
    expect(normalizeWorkflowSettings({ chatAutoCreateEnabled: true, chatMemberIds: [] })).toEqual({
      chatAutoCreateEnabled: true,
      chatMemberIds: [],
    });
  });

  it('filters invalid chat member ids', () => {
    expect(
      normalizeWorkflowSettings({
        chatAutoCreateEnabled: false,
        chatMemberIds: ['member-1', '', '   ', 'member-2'] as string[],
      }),
    ).toEqual({
      chatAutoCreateEnabled: false,
      chatMemberIds: ['member-1', 'member-2'],
    });
  });
});