import ConfirmDialog from '../ConfirmDialog';

interface PendingAssetAction {
  assetId: string;
  action: 'delete' | 'unassign';
}

interface PendingUserAction {
  userId: string;
  action: 'deactivate' | 'reactivate';
}

interface PendingBulkUserAction {
  action: 'deactivate' | 'reactivate';
  count: number;
}

interface UsersPageDialogsProps {
  pendingAssetAction: PendingAssetAction | null;
  pendingUserAction: PendingUserAction | null;
  pendingBulkUserAction: PendingBulkUserAction | null;
  assetActionLoadingId: string;
  userActionLoadingId: string;
  bulkUserActionLoading: boolean;
  onCloseAssetAction: () => void;
  onConfirmAssetAction: () => void;
  onCloseUserAction: () => void;
  onConfirmUserAction: () => void;
  onCloseBulkUserAction: () => void;
  onConfirmBulkUserAction: () => void;
}

export default function UsersPageDialogs({
  pendingAssetAction,
  pendingUserAction,
  pendingBulkUserAction,
  assetActionLoadingId,
  userActionLoadingId,
  bulkUserActionLoading,
  onCloseAssetAction,
  onConfirmAssetAction,
  onCloseUserAction,
  onConfirmUserAction,
  onCloseBulkUserAction,
  onConfirmBulkUserAction,
}: UsersPageDialogsProps) {
  return (
    <>
      <ConfirmDialog
        open={Boolean(pendingAssetAction)}
        title={pendingAssetAction?.action === 'delete' ? 'Delete Asset' : 'Remove Asset From User'}
        message={pendingAssetAction?.action === 'delete' ? 'This will permanently delete the asset from ITMS and cannot be undone.' : 'This will remove the asset assignment from the selected user but keep the asset in ITMS.'}
        confirmLabel={pendingAssetAction?.action === 'delete' ? 'Delete Asset' : 'Remove From User'}
        tone={pendingAssetAction?.action === 'delete' ? 'danger' : 'default'}
        busy={Boolean(pendingAssetAction && assetActionLoadingId === pendingAssetAction.assetId)}
        onClose={onCloseAssetAction}
        onConfirm={onConfirmAssetAction}
      />

      <ConfirmDialog
        open={Boolean(pendingUserAction)}
        title={pendingUserAction?.action === 'deactivate' ? 'Deactivate User' : 'Reactivate User'}
        message={pendingUserAction?.action === 'deactivate' ? 'This will prevent the user from signing in and using ITMS until reactivated.' : 'This will restore the user account and allow sign-in again.'}
        confirmLabel={pendingUserAction?.action === 'deactivate' ? 'Deactivate User' : 'Reactivate User'}
        tone={pendingUserAction?.action === 'deactivate' ? 'danger' : 'default'}
        busy={Boolean(pendingUserAction && userActionLoadingId === pendingUserAction.userId)}
        onClose={onCloseUserAction}
        onConfirm={onConfirmUserAction}
      />

      <ConfirmDialog
        open={Boolean(pendingBulkUserAction)}
        title={pendingBulkUserAction?.action === 'deactivate' ? 'Deactivate Selected Users' : 'Reactivate Selected Users'}
        message={pendingBulkUserAction?.action === 'deactivate' ? `This will deactivate ${pendingBulkUserAction?.count || 0} selected user account(s).` : `This will reactivate ${pendingBulkUserAction?.count || 0} selected user account(s).`}
        confirmLabel={pendingBulkUserAction?.action === 'deactivate' ? 'Deactivate Selected' : 'Reactivate Selected'}
        tone={pendingBulkUserAction?.action === 'deactivate' ? 'danger' : 'default'}
        busy={bulkUserActionLoading}
        onClose={onCloseBulkUserAction}
        onConfirm={onConfirmBulkUserAction}
      />
    </>
  );
}