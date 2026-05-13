import { ShieldCheck } from 'lucide-react';

interface PortalChoice {
  id: string;
  label: string;
}

interface UserAccessCardRecord {
  id: string;
  fullName: string;
  employeeCode: string;
  email: string;
  role?: { name: string } | null;
  department?: { name?: string } | null;
}

interface UserAccessCardProps {
  user: UserAccessCardRecord;
  selectedPortals: string[];
  selectedForBulk: boolean;
  isCurrentSessionUser: boolean;
  isLockedUser: boolean;
  isSaving: boolean;
  saveDisabled: boolean;
  portalChoices: ReadonlyArray<PortalChoice>;
  formatPortalLabel: (portalId: string) => string;
  onToggleBulkSelection: (checked: boolean) => void;
  onPortalToggle: (portalId: string, checked: boolean) => void;
  onSaveAccess: () => void;
}

export default function UserAccessCard({
  user,
  selectedPortals,
  selectedForBulk,
  isCurrentSessionUser,
  isLockedUser,
  isSaving,
  saveDisabled,
  portalChoices,
  formatPortalLabel,
  onToggleBulkSelection,
  onPortalToggle,
  onSaveAccess,
}: UserAccessCardProps) {
  return <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
    <div className="flex items-start justify-between gap-4">
      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          checked={selectedForBulk}
          disabled={isCurrentSessionUser}
          onChange={(event) => onToggleBulkSelection(event.target.checked)}
          className="mt-1 h-4 w-4 rounded border-zinc-300 text-brand-600 focus:ring-brand-500"
        />
        <div>
          <div className="text-lg font-bold text-zinc-900">{user.fullName}</div>
          <div className="mt-1 text-sm text-zinc-500">{user.employeeCode} • {user.email}</div>
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-end gap-2">
        {isLockedUser ? <div className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-800">Protected Role</div> : null}
        <div className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-bold text-zinc-700">{user.department?.name || 'Department'}</div>
      </div>
    </div>

    <div className="mt-4 rounded-2xl bg-zinc-50 p-4">
      <div className="flex items-center text-sm font-bold text-zinc-700">
        <ShieldCheck className="mr-2 h-4 w-4 text-brand-600" />
        Portal Access
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {selectedPortals.map((portal) => (
          <span key={portal} className="rounded-full bg-white px-3 py-1 text-xs font-bold text-zinc-700 ring-1 ring-zinc-200">
            {formatPortalLabel(portal)}
          </span>
        ))}
      </div>
      <div className="mt-4 space-y-3">
        <div className="text-xs font-bold uppercase tracking-wider text-zinc-500">Select Portals</div>
        <div className="grid gap-2 sm:grid-cols-3">
          {portalChoices.map((portal) => {
            const selected = selectedPortals.includes(portal.id);
            const disabled = isLockedUser || isSaving || (portal.id === 'employee' && selectedPortals.some((value) => value === 'it_team' || value === 'super_admin' || value === 'auditor'));
            return (
              <label key={portal.id} className={`flex items-center gap-3 rounded-xl border px-3 py-3 text-sm font-semibold ${selected ? 'border-sky-300 bg-sky-100 text-sky-800 shadow-sm' : 'border-zinc-200 bg-white text-zinc-700'} ${disabled ? 'opacity-70' : ''}`}>
                <input
                  type="checkbox"
                  checked={selected}
                  disabled={disabled}
                  onChange={(event) => onPortalToggle(portal.id, event.target.checked)}
                  className="h-4 w-4 rounded border-zinc-300 text-sky-600 focus:ring-sky-500"
                />
                <span>{portal.label}</span>
              </label>
            );
          })}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={onSaveAccess}
            disabled={saveDisabled}
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-bold text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSaving ? 'Saving access...' : 'Save Access'}
          </button>
          <span className="text-xs text-zinc-500">{isLockedUser ? 'Your own super admin access is kept read-only here to prevent locking yourself out of the portal.' : 'Choose one or more portals, then save. Auditor stays read-only, IT Team includes Employee, and Super Admin includes all portals.'}</span>
        </div>
      </div>
    </div>
  </div>;
}