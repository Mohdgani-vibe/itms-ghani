import { ShieldPlus, Users } from 'lucide-react';
import type { ChannelMember, ChatChannel, PendingTeammateAction } from './types';

interface ChatControlSidebarProps {
  activeChannel: ChatChannel | null;
  selectedOwnerId: string | null;
  selectedBackupOwnerId: string | null;
  selectedTeammateId: string;
  ownerCandidates: ChannelMember[];
  backupOwnerCandidates: ChannelMember[];
  availableTeammates: ChannelMember[];
  removingMemberId: string;
  transferringOwner: boolean;
  addingTeammate: boolean;
  loadingTeammates: boolean;
  isActiveChannelClosed: boolean;
  onPendingTeammateActionChange: (value: PendingTeammateAction) => void;
  onSelectedOwnerChange: (value: string | null) => void;
  onSelectedBackupOwnerChange: (value: string | null) => void;
  onTransferOwner: () => void;
  onBackupOwnerUpdate: (backupOwnerId?: string | null) => void;
  onSelectedTeammateChange: (value: string) => void;
  onOpenAddTeammateDialog: () => void;
}

export default function ChatControlSidebar({
  activeChannel,
  selectedOwnerId,
  selectedBackupOwnerId,
  selectedTeammateId,
  ownerCandidates,
  backupOwnerCandidates,
  availableTeammates,
  removingMemberId,
  transferringOwner,
  addingTeammate,
  loadingTeammates,
  isActiveChannelClosed,
  onPendingTeammateActionChange,
  onSelectedOwnerChange,
  onSelectedBackupOwnerChange,
  onTransferOwner,
  onBackupOwnerUpdate,
  onSelectedTeammateChange,
  onOpenAddTeammateDialog,
}: ChatControlSidebarProps) {
  return (
    <aside className="hidden min-h-0 flex-col border-l border-zinc-200 bg-white xl:flex">
      <div className="border-b border-zinc-100 p-4">
        <div className="text-sm font-bold text-zinc-900">Chat Control</div>
        <p className="mt-1 text-xs text-zinc-500">Inspect routed support chats, add backup owners, and close completed conversations.</p>
      </div>
      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        <div className="rounded-xl border border-zinc-200 bg-white p-4">
          <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-zinc-500">
            <Users className="h-3.5 w-3.5" /> Members
          </div>
          <div className="mt-3 space-y-2">
            {activeChannel?.members.length ? activeChannel.members.map((member) => {
              const canRemoveMember = member.role === 'it_team' || member.role === 'super_admin';
              return (
                <div key={member.id} className="rounded-lg border border-zinc-100 bg-zinc-50 px-3 py-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-zinc-900">{member.fullName}</div>
                      <div className="text-[11px] uppercase tracking-wider text-zinc-500">{member.role}</div>
                    </div>
                    {canRemoveMember ? (
                      <button
                        type="button"
                        onClick={() => onPendingTeammateActionChange({ kind: 'remove', memberId: member.id, memberName: member.fullName })}
                        disabled={!activeChannel || removingMemberId === member.id || isActiveChannelClosed}
                        className="shrink-0 rounded-md border border-zinc-200 bg-white px-2 py-1 text-[11px] font-semibold text-zinc-700 hover:bg-zinc-100 disabled:opacity-60"
                      >
                        {removingMemberId === member.id ? 'Removing...' : 'Remove'}
                      </button>
                    ) : null}
                  </div>
                </div>
              );
            }) : <div className="text-sm text-zinc-500">Select a channel to inspect its members.</div>}
          </div>
        </div>

        <div className="rounded-xl border border-zinc-200 bg-white p-4">
          <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-zinc-500">
            <ShieldPlus className="h-3.5 w-3.5" /> Primary Owner
          </div>
          <p className="mt-2 text-xs text-zinc-500">Set the accountable IT owner for this conversation. Routing can still add backups, but this keeps one explicit owner on record.</p>
          <select
            value={selectedOwnerId ?? ''}
            onChange={(event) => onSelectedOwnerChange(event.target.value || null)}
            disabled={!activeChannel || ownerCandidates.length === 0 || isActiveChannelClosed}
            className="mt-3 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 disabled:bg-zinc-100"
          >
            <option value="">{ownerCandidates.length === 0 ? 'No IT owners in this chat' : 'Select primary owner'}</option>
            {ownerCandidates.map((member) => (
              <option key={member.id} value={member.id}>{member.fullName} ({member.role})</option>
            ))}
          </select>
          <button
            type="button"
            onClick={onTransferOwner}
            disabled={!activeChannel || !selectedOwnerId || selectedOwnerId === activeChannel?.primaryOwner?.id || transferringOwner || isActiveChannelClosed}
            className="mt-3 w-full rounded-lg bg-brand-600 px-3 py-2 text-sm font-bold text-white hover:bg-brand-700 disabled:opacity-60"
          >
            {transferringOwner ? 'Updating owner...' : 'Set Primary Owner'}
          </button>
        </div>

        <div className="rounded-xl border border-zinc-200 bg-white p-4">
          <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-zinc-500">
            <ShieldPlus className="h-3.5 w-3.5" /> Backup Owner
          </div>
          <p className="mt-2 text-xs text-zinc-500">Keep one secondary IT owner ready to step in when the primary owner is busy or out of office.</p>
          <select
            value={selectedBackupOwnerId ?? ''}
            onChange={(event) => onSelectedBackupOwnerChange(event.target.value || null)}
            disabled={!activeChannel || backupOwnerCandidates.length === 0 || isActiveChannelClosed}
            className="mt-3 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 disabled:bg-zinc-100"
          >
            <option value="">{backupOwnerCandidates.length === 0 ? 'No backup owner candidates' : 'Select backup owner'}</option>
            {backupOwnerCandidates.map((member) => (
              <option key={member.id} value={member.id}>{member.fullName} ({member.role})</option>
            ))}
          </select>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => onBackupOwnerUpdate()}
              disabled={!activeChannel || transferringOwner || selectedBackupOwnerId === (activeChannel?.backupOwner?.id ?? null) || isActiveChannelClosed}
              className="rounded-lg bg-zinc-900 px-3 py-2 text-sm font-bold text-white hover:bg-zinc-800 disabled:opacity-60"
            >
              {transferringOwner ? 'Updating...' : 'Set Backup'}
            </button>
            <button
              type="button"
              onClick={() => {
                onSelectedBackupOwnerChange(null);
                onBackupOwnerUpdate(null);
              }}
              disabled={!activeChannel || !activeChannel.backupOwner || transferringOwner || isActiveChannelClosed}
              className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm font-bold text-zinc-700 hover:bg-zinc-100 disabled:opacity-60"
            >
              Clear
            </button>
          </div>
        </div>

        <div className="rounded-xl border border-zinc-200 bg-white p-4">
          <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-zinc-500">
            <ShieldPlus className="h-3.5 w-3.5" /> Add Backup Owner
          </div>
          <p className="mt-2 text-xs text-zinc-500">Pull another IT teammate into this conversation when the first routed owner needs help, then remove the previous backup if needed.</p>
          <select
            value={selectedTeammateId}
            onChange={(event) => onSelectedTeammateChange(event.target.value)}
            disabled={!activeChannel || loadingTeammates || availableTeammates.length === 0 || isActiveChannelClosed}
            className="mt-3 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 disabled:bg-zinc-100"
          >
            <option value="">{loadingTeammates ? 'Loading teammates...' : availableTeammates.length === 0 ? 'No more teammates available' : 'Select IT teammate'}</option>
            {availableTeammates.map((member) => (
              <option key={member.id} value={member.id}>{member.fullName} ({member.role})</option>
            ))}
          </select>
          <button
            type="button"
            onClick={onOpenAddTeammateDialog}
            disabled={!activeChannel || !selectedTeammateId || addingTeammate || isActiveChannelClosed}
            className="mt-3 w-full rounded-lg bg-zinc-900 px-3 py-2 text-sm font-bold text-white hover:bg-zinc-800 disabled:opacity-60"
          >
            {addingTeammate ? 'Adding...' : 'Add Teammate'}
          </button>
        </div>
      </div>
    </aside>
  );
}