interface AssigneeOption {
  value: string;
  label: string;
}

interface StatusOption {
  value: string;
  label: string;
}

type NoteTemplateId = 'triage' | 'waiting' | 'resolved';

interface RequestDetailControlsPanelProps {
  assigneeDraft: string;
  statusDraft: string;
  noteDraft: string;
  assigneeOptions: AssigneeOption[];
  statusOptions: StatusOption[];
  saving: boolean;
  canEdit?: boolean;
  statusLabel?: string;
  onAssigneeDraftChange: (value: string) => void;
  onAssign: () => void;
  onStatusDraftChange: (value: string) => void;
  onNoteDraftChange: (value: string) => void;
  onApplyNoteTemplate: (templateId: NoteTemplateId) => void;
  onUpdateRequest: () => void;
}

export default function RequestDetailControlsPanel({
  assigneeDraft,
  statusDraft,
  noteDraft,
  assigneeOptions,
  statusOptions,
  saving,
  canEdit = true,
  statusLabel,
  onAssigneeDraftChange,
  onAssign,
  onStatusDraftChange,
  onNoteDraftChange,
  onApplyNoteTemplate,
  onUpdateRequest,
}: RequestDetailControlsPanelProps) {
  return (
    <div className="space-y-4 rounded-2xl border border-sky-100 bg-[linear-gradient(180deg,_#ffffff_0%,_rgba(240,249,255,0.9)_100%)] p-4 shadow-sm">
      <div className="rounded-xl bg-white px-3 py-3 ring-1 ring-sky-100">
        <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">Queue Controls</div>
        <div className="mt-2 text-sm text-zinc-600">Assign an owner, move the request to the correct state, then save the review note for the queue history.</div>
        {statusLabel ? <div className="mt-2 text-xs font-semibold uppercase tracking-wider text-sky-700">Current status: {statusLabel}</div> : null}
      </div>

      <div>
        <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-zinc-500">Assign To</label>
        <div className="flex gap-2">
          <select value={assigneeDraft} onChange={(event) => onAssigneeDraftChange(event.target.value)} disabled={!canEdit || saving} className="w-full rounded-lg border border-sky-100 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm disabled:opacity-60">
            <option value="">Select IT owner</option>
            {assigneeOptions.map((user) => <option key={user.value} value={user.value}>{user.label}</option>)}
          </select>
          <button type="button" onClick={onAssign} disabled={!canEdit || saving || !assigneeDraft} className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-xs font-bold text-sky-700 hover:bg-sky-100 disabled:opacity-60">Assign</button>
        </div>
      </div>

      <div>
        <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-zinc-500">Status</label>
        <select value={statusDraft} onChange={(event) => onStatusDraftChange(event.target.value)} disabled={!canEdit || saving} className="w-full rounded-lg border border-sky-100 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm disabled:opacity-60">
          {statusOptions.map((status) => <option key={status.value} value={status.value}>{status.label}</option>)}
        </select>
      </div>

      <div>
        <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-zinc-500">Support Notes</label>
        <textarea value={noteDraft} onChange={(event) => onNoteDraftChange(event.target.value)} disabled={!canEdit || saving} rows={4} className="w-full rounded-lg border border-sky-100 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm disabled:opacity-60" placeholder="Internal resolution or triage notes" />
        <div className="mt-2 flex flex-wrap gap-2">
          {[
            { id: 'triage', label: 'Add triage note' },
            { id: 'waiting', label: 'Mark waiting' },
            { id: 'resolved', label: 'Add resolution note' },
          ].map((template) => (
            <button
              key={template.id}
              type="button"
              onClick={() => onApplyNoteTemplate(template.id as NoteTemplateId)}
              disabled={!canEdit || saving}
              className="rounded-full border border-sky-100 bg-white px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-zinc-600 hover:bg-sky-50 disabled:opacity-60"
            >
              {template.label}
            </button>
          ))}
        </div>
      </div>

      <button type="button" onClick={onUpdateRequest} disabled={!canEdit || saving} className="w-full rounded-lg bg-sky-700 px-4 py-2.5 text-sm font-bold text-white hover:bg-sky-800 disabled:opacity-60">
        {saving ? 'Saving...' : 'Update Request'}
      </button>
    </div>
  );
}