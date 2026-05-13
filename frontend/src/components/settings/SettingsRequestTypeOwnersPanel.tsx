interface DirectoryUser {
  id: string;
  fullName: string;
  email: string;
  role: string;
  employeeCode?: string;
}

interface SettingsRequestTypeOwnersPanelProps {
  canEditWorkflowSettings: boolean;
  requestRouteTypes: string[];
  ticketAssigneeUsers: DirectoryUser[];
  getTypeAssignee: (type: string) => string;
  onTypeChange: (type: string, assigneeId: string) => void;
}

export default function SettingsRequestTypeOwnersPanel({
  canEditWorkflowSettings,
  requestRouteTypes,
  ticketAssigneeUsers,
  getTypeAssignee,
  onTypeChange,
}: SettingsRequestTypeOwnersPanelProps) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
      <div className="mb-3">
        <h3 className="text-sm font-bold text-zinc-900">Request Type Owners</h3>
        <p className="mt-1 text-xs text-zinc-500">Assign fixed owners for the main request categories already used across the portal. Choices come from the request assignee list above, so this will stay limited to active IT/admin accounts until employee users are imported.</p>
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {requestRouteTypes.map((type) => (
          <label key={type} className="rounded-xl border border-zinc-200 bg-white p-3 text-sm text-zinc-700">
            <span className="block font-semibold text-zinc-900">{type}</span>
            <select
              value={getTypeAssignee(type)}
              onChange={(event) => onTypeChange(type, event.target.value)}
              disabled={!canEditWorkflowSettings}
              className="mt-3 w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm font-medium text-zinc-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
            >
              <option value="">No dedicated owner</option>
              {ticketAssigneeUsers.map((user) => (
                <option key={user.id} value={user.id}>{user.fullName} • {user.role}</option>
              ))}
            </select>
          </label>
        ))}
      </div>
    </div>
  );
}