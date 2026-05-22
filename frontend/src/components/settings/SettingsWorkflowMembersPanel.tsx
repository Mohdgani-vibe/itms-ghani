import { actionButtonStyles } from '../../lib/buttonStyles';

interface DirectoryUser {
  id: string;
  fullName: string;
  email: string;
  role: string;
  employeeCode?: string;
}

interface SettingsWorkflowMembersPanelProps {
  canEditWorkflowSettings: boolean;
  hasActiveEmployeeWorkflowUsers: boolean;
  ticketAssigneeDraft: string;
  chatMemberDraft: string;
  availableTicketAssigneeOptions: DirectoryUser[];
  availableChatMemberOptions: DirectoryUser[];
  ticketAssigneeUsers: DirectoryUser[];
  chatMemberUsers: DirectoryUser[];
  onTicketAssigneeDraftChange: (value: string) => void;
  onChatMemberDraftChange: (value: string) => void;
  onAddWorkflowMember: (key: 'ticketAssigneeIds' | 'chatMemberIds', userId: string) => void;
  onRemoveWorkflowMember: (key: 'ticketAssigneeIds' | 'chatMemberIds', userId: string) => void;
}

export default function SettingsWorkflowMembersPanel({
  canEditWorkflowSettings,
  hasActiveEmployeeWorkflowUsers,
  ticketAssigneeDraft,
  chatMemberDraft,
  availableTicketAssigneeOptions,
  availableChatMemberOptions,
  ticketAssigneeUsers,
  chatMemberUsers,
  onTicketAssigneeDraftChange,
  onChatMemberDraftChange,
  onAddWorkflowMember,
  onRemoveWorkflowMember,
}: SettingsWorkflowMembersPanelProps) {
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-zinc-900">Ticket Assignee List</h3>
            <p className="mt-1 text-xs text-zinc-500">Super admin can limit which active users appear for request assignment and request routing. Until employee users are imported, this list stays limited to active IT/admin accounts.</p>
          </div>
        </div>
        <div className="mt-3 flex gap-2">
          <select
            value={ticketAssigneeDraft}
            onChange={(event) => onTicketAssigneeDraftChange(event.target.value)}
            disabled={!canEditWorkflowSettings}
            className="flex-1 rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm font-medium text-zinc-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 disabled:bg-zinc-100"
          >
            <option value="">{hasActiveEmployeeWorkflowUsers ? 'Select assignee' : 'Select assignee (active IT/admin only)'}</option>
            {availableTicketAssigneeOptions.map((user) => (
              <option key={user.id} value={user.id}>{user.fullName} • {user.role}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => onAddWorkflowMember('ticketAssigneeIds', ticketAssigneeDraft)}
            disabled={!canEditWorkflowSettings || !ticketAssigneeDraft}
            className={`rounded-xl px-4 py-2.5 text-sm font-bold transition disabled:opacity-60 ${actionButtonStyles.add}`}
          >
            Add
          </button>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {ticketAssigneeUsers.length === 0 ? (
            <span className="text-sm text-zinc-500">
              {hasActiveEmployeeWorkflowUsers
                ? 'All active users remain eligible until you add specific names.'
                : 'All active IT/admin users remain eligible until employee users are imported or you narrow this list.'}
            </span>
          ) : null}
          {ticketAssigneeUsers.map((user) => (
            <button
              key={user.id}
              type="button"
              onClick={() => onRemoveWorkflowMember('ticketAssigneeIds', user.id)}
              disabled={!canEditWorkflowSettings}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold transition disabled:cursor-default ${actionButtonStyles.remove}`}
            >
              {user.fullName} • Remove
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
        <div>
          <h3 className="text-sm font-bold text-zinc-900">Chat Member List</h3>
          <p className="mt-1 text-xs text-zinc-500">Controls which active IT team and super admin users can be routed in, assigned as backup owner, or added through chat controls.</p>
        </div>
        <div className="mt-3 flex gap-2">
          <select
            value={chatMemberDraft}
            onChange={(event) => onChatMemberDraftChange(event.target.value)}
            disabled={!canEditWorkflowSettings}
            className="flex-1 rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm font-medium text-zinc-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 disabled:bg-zinc-100"
          >
            <option value="">Select chat member</option>
            {availableChatMemberOptions.map((user) => (
              <option key={user.id} value={user.id}>{user.fullName} • {user.role}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => onAddWorkflowMember('chatMemberIds', chatMemberDraft)}
            disabled={!canEditWorkflowSettings || !chatMemberDraft}
            className={`rounded-xl px-4 py-2.5 text-sm font-bold transition disabled:opacity-60 ${actionButtonStyles.add}`}
          >
            Add
          </button>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {chatMemberUsers.length === 0 ? <span className="text-sm text-zinc-500">All active IT team and super admin users remain eligible until you add specific names.</span> : null}
          {chatMemberUsers.map((user) => (
            <button
              key={user.id}
              type="button"
              onClick={() => onRemoveWorkflowMember('chatMemberIds', user.id)}
              disabled={!canEditWorkflowSettings}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold transition disabled:cursor-default ${actionButtonStyles.remove}`}
            >
              {user.fullName} • Remove
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}