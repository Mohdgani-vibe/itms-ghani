interface UserBulkActionsPanelProps {
  allVisibleBulkUsersSelected: boolean;
  hasSelectableUsers: boolean;
  selectedUserCount: number;
  onToggleSelectAll: (checked: boolean) => void;
  onDeactivateSelected: () => void;
  onReactivateSelected: () => void;
}

export default function UserBulkActionsPanel({
  allVisibleBulkUsersSelected,
  hasSelectableUsers,
  selectedUserCount,
  onToggleSelectAll,
  onDeactivateSelected,
  onReactivateSelected,
}: UserBulkActionsPanelProps) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="flex items-center gap-3 text-sm font-semibold text-zinc-700">
          <input
            type="checkbox"
            checked={allVisibleBulkUsersSelected}
            onChange={(event) => onToggleSelectAll(event.target.checked)}
            disabled={!hasSelectableUsers}
            className="h-4 w-4 rounded border-zinc-300 text-brand-600 focus:ring-brand-500"
          />
          Select all users on this page
        </label>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onDeactivateSelected}
            disabled={selectedUserCount === 0}
            className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700 hover:bg-rose-100 disabled:opacity-60"
          >
            Deactivate Selected
          </button>
          <button
            type="button"
            onClick={onReactivateSelected}
            disabled={selectedUserCount === 0}
            className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700 hover:bg-emerald-100 disabled:opacity-60"
          >
            Reactivate Selected
          </button>
        </div>
      </div>
      <div className="mt-2 text-xs text-zinc-500">{selectedUserCount} user(s) selected on the current page.</div>
    </div>
  );
}