import { ChevronRight, Mail, MapPin, Building2, Shield, Package, User } from 'lucide-react';

interface UserDirectoryCardRecord {
  id: string;
  fullName: string;
  email: string;
  employeeCode: string;
  status: string;
  department?: { name?: string } | null;
  branch?: { name?: string } | null;
  _count?: { assets: number };
}

interface UserDirectoryCardProps {
  user: UserDirectoryCardRecord;
  active: boolean;
  isSuperAdmin: boolean;
  isCurrentSessionUser: boolean;
  selectedForBulk: boolean;
  accessSummary: string;
  portalLabels: string[];
  userActionLoading: boolean;
  onSelect: () => void;
  onToggleBulkSelection: (checked: boolean) => void;
  onOpenProfile: () => void;
  onQuickEdit: () => void;
  onResetPassword: () => void;
  onManageAccess: () => void;
  onToggleStatus: () => void;
}

export default function UserDirectoryCard({
  user,
  active,
  isSuperAdmin,
  isCurrentSessionUser,
  selectedForBulk,
  accessSummary,
  portalLabels,
  userActionLoading,
  onSelect,
  onToggleBulkSelection,
  onOpenProfile,
  onQuickEdit,
  onResetPassword,
  onManageAccess,
  onToggleStatus,
}: UserDirectoryCardProps) {
  const initials = user.fullName
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return <div
    role="button"
    tabIndex={0}
    onClick={onSelect}
    onKeyDown={(event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        onSelect();
      }
    }}
    className={`group cursor-pointer rounded-xl border bg-white shadow-sm transition-all hover:shadow-md ${
      active 
        ? 'border-primary ring-2 ring-primary/20' 
        : 'border-zinc-200 hover:border-zinc-300'
    }`}
  >
    <div className="p-5">
      {/* Header with avatar and status */}
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3 min-w-0 flex-1">
          {isSuperAdmin && (
            <input
              type="checkbox"
              checked={selectedForBulk}
              disabled={isCurrentSessionUser}
              onChange={(event) => onToggleBulkSelection(event.target.checked)}
              onClick={(event) => event.stopPropagation()}
              className="mt-3 h-4 w-4 rounded border-zinc-300 text-primary focus:ring-primary"
            />
          )}
          
          {/* Avatar */}
          <div className="flex-shrink-0">
            <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-primary to-blue-600 flex items-center justify-center text-white font-bold text-sm shadow-sm">
              {initials}
            </div>
          </div>

          {/* User info */}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-bold text-ink truncate">
                {user.fullName}
              </h3>
              <span className={`inline-flex h-2 w-2 rounded-full ${
                user.status === 'active' ? 'bg-green-500' : 'bg-red-500'
              }`} />
            </div>
            
            <div className="mt-1 text-xs font-medium text-muted uppercase tracking-wider">
              {user.employeeCode}
            </div>
            
            <div className="mt-2 flex items-center gap-1.5 text-sm text-muted">
              <Mail className="h-3.5 w-3.5" />
              <span className="truncate">{user.email}</span>
            </div>
          </div>
        </div>

        {/* Assets count badge */}
        <div className="flex-shrink-0 text-center">
          <div className="w-14 h-14 rounded-lg bg-zinc-50 flex flex-col items-center justify-center">
            <Package className="h-5 w-5 text-primary mb-1" />
            <span className="text-lg font-bold text-ink">{user._count?.assets || 0}</span>
          </div>
          <div className="mt-1 text-[10px] font-medium text-muted uppercase">Assets</div>
        </div>
      </div>

      {/* Info Grid */}
      <div className="mt-4 grid grid-cols-3 gap-3">
        <div className="rounded-lg bg-zinc-50 p-3">
          <div className="flex items-center gap-2 mb-2">
            <Building2 className="h-3.5 w-3.5 text-muted" />
            <div className="text-[10px] font-bold uppercase tracking-wider text-muted">Department</div>
          </div>
          <div className="text-sm font-semibold text-ink truncate">
            {user.department?.name || 'Unassigned'}
          </div>
        </div>

        <div className="rounded-lg bg-zinc-50 p-3">
          <div className="flex items-center gap-2 mb-2">
            <MapPin className="h-3.5 w-3.5 text-muted" />
            <div className="text-[10px] font-bold uppercase tracking-wider text-muted">Location</div>
          </div>
          <div className="text-sm font-semibold text-ink truncate">
            {user.branch?.name || 'Unassigned'}
          </div>
        </div>

        <div className="rounded-lg bg-zinc-50 p-3">
          <div className="flex items-center gap-2 mb-2">
            <Shield className="h-3.5 w-3.5 text-muted" />
            <div className="text-[10px] font-bold uppercase tracking-wider text-muted">Access</div>
          </div>
          <div className="text-sm font-semibold text-ink truncate">
            {accessSummary}
          </div>
        </div>
      </div>

      {/* Portal badges */}
      {portalLabels.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {portalLabels.map((portal) => (
            <span 
              key={portal} 
              className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-primary/10 text-primary border border-primary/20"
            >
              {portal}
            </span>
          ))}
        </div>
      )}

      {/* Action buttons for superadmin */}
      {isSuperAdmin && (
        <div className="mt-4 pt-4 border-t border-zinc-100 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onQuickEdit();
            }}
            className="flex-1 min-w-[120px] rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs font-semibold text-ink hover:bg-zinc-50 transition-colors"
          >
            Quick Edit
          </button>
          
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onManageAccess();
            }}
            className="flex-1 min-w-[120px] rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs font-semibold text-ink hover:bg-zinc-50 transition-colors"
          >
            Manage Access
          </button>
          
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onToggleStatus();
            }}
            disabled={userActionLoading || isCurrentSessionUser}
            className={`flex-1 min-w-[120px] rounded-lg px-3 py-2 text-xs font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
              user.status === 'active'
                ? 'border border-red-200 bg-red-50 text-red-700 hover:bg-red-100'
                : 'border border-green-200 bg-green-50 text-green-700 hover:bg-green-100'
            }`}
          >
            {userActionLoading ? 'Updating...' : user.status === 'active' ? 'Deactivate' : 'Reactivate'}
          </button>
        </div>
      )}
    </div>

    {/* View Profile button - always at bottom */}
    <div className="border-t border-zinc-100 px-5 py-3 bg-zinc-50/50 rounded-b-xl">
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          onOpenProfile();
        }}
        className="w-full inline-flex items-center justify-center gap-2 text-sm font-semibold text-primary hover:text-blue-700 transition-colors"
      >
        <User className="h-4 w-4" />
        View Full Profile
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  </div>;
}