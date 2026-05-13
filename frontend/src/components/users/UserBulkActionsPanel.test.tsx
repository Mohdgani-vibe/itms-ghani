import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import UserBulkActionsPanel from './UserBulkActionsPanel';

describe('UserBulkActionsPanel', () => {
  it('renders enabled bulk actions and selected count', () => {
    const markup = renderToStaticMarkup(
      <UserBulkActionsPanel
        allVisibleBulkUsersSelected={true}
        hasSelectableUsers={true}
        selectedUserCount={3}
        onToggleSelectAll={vi.fn()}
        onDeactivateSelected={vi.fn()}
        onReactivateSelected={vi.fn()}
      />,
    );

    expect(markup).toContain('Select all users on this page');
    expect(markup).toContain('Deactivate Selected');
    expect(markup).toContain('Reactivate Selected');
    expect(markup).toContain('3 user(s) selected on the current page.');
    expect(markup).toContain('checked=""');
  });

  it('disables the select-all and action buttons when nothing is selectable', () => {
    const markup = renderToStaticMarkup(
      <UserBulkActionsPanel
        allVisibleBulkUsersSelected={false}
        hasSelectableUsers={false}
        selectedUserCount={0}
        onToggleSelectAll={vi.fn()}
        onDeactivateSelected={vi.fn()}
        onReactivateSelected={vi.fn()}
      />,
    );

    expect(markup).toContain('disabled=""');
  });
});