interface DirectoryUser {
  id: string;
  fullName: string;
  email: string;
  role: string;
  employeeCode?: string;
}

interface WorkflowRoutingState {
  requestAutoAssignEnabled: boolean;
  chatAutoRouteEnabled: boolean;
  requestFallbackAssigneeId: string | null;
  chatFallbackAssigneeId: string | null;
}

interface SettingsWorkflowRoutingPanelProps {
  canEditWorkflowSettings: boolean;
  workflowSettings: WorkflowRoutingState;
  ticketAssigneeUsers: DirectoryUser[];
  chatMemberUsers: DirectoryUser[];
  onWorkflowSettingsChange: (patch: Partial<WorkflowRoutingState>) => void;
}

export default function SettingsWorkflowRoutingPanel({
  canEditWorkflowSettings,
  workflowSettings,
  ticketAssigneeUsers,
  chatMemberUsers,
  onWorkflowSettingsChange,
}: SettingsWorkflowRoutingPanelProps) {
  return (
    <>
      <div className="grid gap-4 lg:grid-cols-2">
        <label className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-700">
          <span className="flex items-start gap-3">
            <input
              type="checkbox"
              checked={workflowSettings.requestAutoAssignEnabled}
              onChange={(event) => onWorkflowSettingsChange({ requestAutoAssignEnabled: event.target.checked })}
              disabled={!canEditWorkflowSettings}
              className="mt-0.5 h-4 w-4 rounded border-zinc-300 text-brand-600 focus:ring-brand-500"
            />
            <span>
              <span className="block font-semibold text-zinc-900">Enable request auto-assignment</span>
              <span className="mt-1 block text-xs text-zinc-500">Requests created by employees, IT, or admins will pick an assignee from the rules below.</span>
            </span>
          </span>
        </label>
        <label className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-700">
          <span className="flex items-start gap-3">
            <input
              type="checkbox"
              checked={workflowSettings.chatAutoRouteEnabled}
              onChange={(event) => onWorkflowSettingsChange({ chatAutoRouteEnabled: event.target.checked })}
              disabled={!canEditWorkflowSettings}
              className="mt-0.5 h-4 w-4 rounded border-zinc-300 text-brand-600 focus:ring-brand-500"
            />
            <span>
              <span className="block font-semibold text-zinc-900">Enable chat subject routing</span>
              <span className="mt-1 block text-xs text-zinc-500">New channels can auto-add the right IT owner when the chat subject matches a rule.</span>
            </span>
          </span>
        </label>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <label className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-700">
          <span className="block text-[11px] font-bold uppercase tracking-wider text-zinc-500">Request Fallback Assignee</span>
          <span className="mt-1 block text-xs text-zinc-500">Only users from the request assignee list appear here. With no active employee users in the directory, this stays limited to active IT/admin accounts until import.</span>
          <select
            value={workflowSettings.requestFallbackAssigneeId ?? ''}
            onChange={(event) => onWorkflowSettingsChange({ requestFallbackAssigneeId: event.target.value || null })}
            disabled={!canEditWorkflowSettings}
            className="mt-3 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm font-medium text-zinc-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
          >
            <option value="">No fallback assignee</option>
            {ticketAssigneeUsers.map((user) => (
              <option key={user.id} value={user.id}>{user.fullName} • {user.role}</option>
            ))}
          </select>
        </label>
        <label className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-700">
          <span className="block text-[11px] font-bold uppercase tracking-wider text-zinc-500">Chat Fallback Assignee</span>
          <span className="mt-1 block text-xs text-zinc-500">Only users from the chat member list appear here.</span>
          <select
            value={workflowSettings.chatFallbackAssigneeId ?? ''}
            onChange={(event) => onWorkflowSettingsChange({ chatFallbackAssigneeId: event.target.value || null })}
            disabled={!canEditWorkflowSettings}
            className="mt-3 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm font-medium text-zinc-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
          >
            <option value="">No fallback assignee</option>
            {chatMemberUsers.map((user) => (
              <option key={user.id} value={user.id}>{user.fullName} • {user.role}</option>
            ))}
          </select>
        </label>
      </div>
    </>
  );
}