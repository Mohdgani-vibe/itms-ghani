interface AssignedUserSummary {
  fullName?: string;
  employeeCode?: string;
  email?: string;
  status?: string | null;
}

interface DepartmentSummary {
  name?: string;
}

interface SuggestedAssignmentUser {
  fullName: string;
  employeeCode: string;
  email: string;
}

interface AssignmentUserOption {
  id: string;
  fullName: string;
  employeeCode: string;
  email: string;
}

interface EnrollmentRequestSummary {
  title: string;
}

interface DeviceAssignmentPanelProps {
  assignedUser?: AssignedUserSummary | null;
  deviceStatus?: string | null;
  department?: DepartmentSummary | null;
  canOperate: boolean;
  isAssigned: boolean;
  assetActionLoading: boolean;
  pendingAssetActionKind?: 'unassign' | 'delete';
  enrollmentRequest?: EnrollmentRequestSummary | null;
  enrollmentDetails: Record<string, string>;
  suggestedAssignmentUser?: SuggestedAssignmentUser | null;
  assignmentUsersLoading: boolean;
  assignmentSearchQuery: string;
  assignableUsers: AssignmentUserOption[];
  selectedAssignmentUserId: string;
  assigningDevice: boolean;
  onUnassignAsset: () => void;
  onDeleteAsset: () => void;
  onAssignmentSearchQueryChange: (value: string) => void;
  onSelectedAssignmentUserIdChange: (value: string) => void;
  onAssignDevice: () => void;
}

export function deviceAssignmentActionsReadOnly(canOperate: boolean, deviceStatus?: string | null, assignedUserStatus?: string | null) {
  return !canOperate || (deviceStatus || '').trim().toLowerCase() === 'retired' || assignedUserStatus === 'inactive';
}

export default function DeviceAssignmentPanel({
  assignedUser,
  deviceStatus,
  department,
  canOperate,
  isAssigned,
  assetActionLoading,
  pendingAssetActionKind,
  enrollmentRequest,
  enrollmentDetails,
  suggestedAssignmentUser,
  assignmentUsersLoading,
  assignmentSearchQuery,
  assignableUsers,
  selectedAssignmentUserId,
  assigningDevice,
  onUnassignAsset,
  onDeleteAsset,
  onAssignmentSearchQueryChange,
  onSelectedAssignmentUserIdChange,
  onAssignDevice,
}: DeviceAssignmentPanelProps) {
  const actionsReadOnly = deviceAssignmentActionsReadOnly(canOperate, deviceStatus, assignedUser?.status);

  return <>
    <div className="rounded-xl border border-zinc-100 bg-zinc-50 p-4">
      <div className="mb-2 text-xs font-bold uppercase tracking-wider text-zinc-500">Assignment</div>
      <div className="space-y-2 text-sm text-zinc-700">
        <div>Employee: {assignedUser?.fullName || 'Unassigned'}</div>
        <div>Employee ID: {assignedUser?.employeeCode || '-'}</div>
        <div>Email: {assignedUser?.email || '-'}</div>
        <div>Department: {department?.name || 'Unassigned'}</div>
      </div>
      {assignedUser?.status === 'inactive' ? (
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          This user is inactive. Asset actions are read-only until the account is reactivated.
        </div>
      ) : null}
      {(deviceStatus || '').trim().toLowerCase() === 'retired' ? (
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          This asset is retired. Assignment actions are read-only until the asset returns to an active lifecycle state.
        </div>
      ) : null}
      {!actionsReadOnly ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {isAssigned ? (
            <button
              type="button"
              onClick={onUnassignAsset}
              disabled={assetActionLoading}
              className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs font-bold text-zinc-700 hover:bg-zinc-50 disabled:opacity-60"
            >
              {assetActionLoading && pendingAssetActionKind === 'unassign' ? 'Working...' : 'Remove From User'}
            </button>
          ) : null}
          <button
            type="button"
            onClick={onDeleteAsset}
            disabled={assetActionLoading}
            className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700 hover:bg-rose-100 disabled:opacity-60"
          >
            {assetActionLoading && pendingAssetActionKind === 'delete' ? 'Working...' : 'Delete Asset'}
          </button>
        </div>
      ) : null}
    </div>

    {!actionsReadOnly && !isAssigned ? <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50/70 p-4">
      <div className="mb-2 text-xs font-bold uppercase tracking-wider text-amber-700">Assign Imported System</div>
      <div className="space-y-3 text-sm text-zinc-700">
        {enrollmentRequest ? (
          <div className="rounded-lg border border-amber-100 bg-white px-3 py-3">
            <div className="text-xs font-bold uppercase tracking-wider text-zinc-500">Enrollment signal</div>
            <div className="mt-2">Requester: <span className="font-semibold text-zinc-900">{enrollmentDetails['requester name'] || 'Unknown'}</span></div>
            <div>Email: <span className="font-semibold text-zinc-900">{enrollmentDetails['requester email'] || '-'}</span></div>
            <div>Employee ID: <span className="font-semibold text-zinc-900">{enrollmentDetails['employee id'] || '-'}</span></div>
          </div>
        ) : null}

        {suggestedAssignmentUser ? (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-3 text-emerald-800">
            Suggested user match: <span className="font-semibold">{suggestedAssignmentUser.fullName}</span> ({suggestedAssignmentUser.employeeCode || suggestedAssignmentUser.email})
          </div>
        ) : enrollmentRequest ? (
          <div className="rounded-lg border border-zinc-200 bg-white px-3 py-3 text-zinc-600">
            No exact user match was found from the enrollment details. Select the correct user manually.
          </div>
        ) : null}

        {assignmentUsersLoading ? <div className="text-zinc-500">Loading users...</div> : null}
        <label className="block">
          <div className="mb-2 text-xs font-bold uppercase tracking-wider text-zinc-500">Search User</div>
          <input
            value={assignmentSearchQuery}
            onChange={(event) => onAssignmentSearchQueryChange(event.target.value)}
            placeholder="Search by employee name, email, or employee ID"
            className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-3 text-sm text-zinc-900"
          />
        </label>

        {!assignmentUsersLoading && assignableUsers.length ? (
          <label className="block">
            <div className="mb-2 text-xs font-bold uppercase tracking-wider text-zinc-500">Assign To</div>
            <select
              value={selectedAssignmentUserId}
              onChange={(event) => onSelectedAssignmentUserIdChange(event.target.value)}
              className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-3 text-sm text-zinc-900"
            >
              {assignableUsers.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.fullName} • {user.employeeCode || user.email}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        {!assignmentUsersLoading && !assignableUsers.length ? <div className="rounded-lg border border-zinc-200 bg-white px-3 py-3 text-zinc-600">{assignmentSearchQuery.trim() ? 'No matching users were found for this search.' : 'Search for a user to assign this system.'}</div> : null}

        <button
          type="button"
          onClick={onAssignDevice}
          disabled={assigningDevice || !selectedAssignmentUserId || assignmentUsersLoading}
          className="rounded-xl bg-amber-600 px-4 py-2 text-sm font-bold text-white hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {assigningDevice ? 'Assigning...' : 'Assign Device'}
        </button>
      </div>
    </div> : null}
  </>;
}