import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import UsersPageDialogs from './UsersPageDialogs';

describe('UsersPageDialogs', () => {
  it('renders asset, user, and bulk confirmation dialogs with current labels', () => {
    const markup = renderToStaticMarkup(
      <UsersPageDialogs
        pendingAssetAction={{ assetId: 'asset-1', action: 'delete' }}
        pendingUserAction={{ userId: 'user-1', action: 'deactivate' }}
        pendingBulkUserAction={{ action: 'reactivate', count: 3 }}
        assetActionLoadingId="asset-1"
        userActionLoadingId=""
        bulkUserActionLoading={true}
        onCloseAssetAction={vi.fn()}
        onConfirmAssetAction={vi.fn()}
        onCloseUserAction={vi.fn()}
        onConfirmUserAction={vi.fn()}
        onCloseBulkUserAction={vi.fn()}
        onConfirmBulkUserAction={vi.fn()}
      />,
    );

    expect(markup).toContain('Delete Asset');
    expect(markup).toContain('This will permanently delete the asset from ITMS and cannot be undone.');
    expect(markup).toContain('Deactivate User');
    expect(markup).toContain('This will prevent the user from signing in and using ITMS until reactivated.');
    expect(markup).toContain('Reactivate Selected Users');
    expect(markup).toContain('This will reactivate 3 selected user account(s).');
    expect(markup).toContain('Reactivate Selected');
  });
});