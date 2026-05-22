import { RefreshCw, Settings2 } from 'lucide-react';

type SettingsSection = 'platform' | 'workflow' | 'bootstrap';

interface InstallAgentConfig {
  portalInstallReady: boolean;
}

interface SyncStatus {
  enabled: boolean;
  configured: boolean;
  running: boolean;
}

interface LookupOption {
  id: string;
  name: string;
}

interface UserMetaOptionsResponse {
  roles: LookupOption[];
  departments: LookupOption[];
  branches: LookupOption[];
}

function StatusPill({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold ${ok ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
      {label}
    </span>
  );
}

interface SettingsOverviewPanelProps {
  canEditWorkflowSettings: boolean;
  portalLabel: string;
  loading: boolean;
  refreshing: boolean;
  error: string;
  installConfig: InstallAgentConfig | null;
  syncStatus: SyncStatus | null;
  meta: UserMetaOptionsResponse | null;
  detailSections: Array<{ id: SettingsSection; label: string }>;
  activeSection: SettingsSection;
  onRefresh: () => void;
  onSelectSection: (section: SettingsSection) => void;
}

export default function SettingsOverviewPanel({
  canEditWorkflowSettings,
  portalLabel,
  loading,
  refreshing,
  error,
  installConfig,
  syncStatus,
  meta,
  detailSections,
  activeSection,
  onRefresh,
  onSelectSection,
}: SettingsOverviewPanelProps) {
  return (
    <>
      <div className="flex flex-col gap-4 overflow-hidden rounded-[32px] border border-zinc-200 bg-white shadow-sm lg:flex-row lg:items-center lg:justify-between">
        <div className="bg-[radial-gradient(circle_at_top_right,_rgba(16,185,129,0.16),_transparent_30%),radial-gradient(circle_at_left,_rgba(163,230,53,0.12),_transparent_24%),linear-gradient(135deg,_#f6fdf8_0%,_#ffffff_56%,_#f8fdf4_100%)] p-5 lg:flex lg:w-full lg:items-center lg:justify-between">
        <div>
          <div className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-emerald-700">
            {canEditWorkflowSettings ? 'Admin Workspace' : 'Settings Workspace'}
          </div>
          <h1 className="mt-3 flex items-center gap-3 text-2xl font-bold tracking-tight text-zinc-900">
            <Settings2 className="h-7 w-7 text-emerald-600" />
            Settings
          </h1>
          <p className="mt-2 max-w-3xl text-sm text-zinc-600">
            {portalLabel} can view current installation, sync, and directory settings from the running backend.
          </p>
        </div>
        <button
          type="button"
          onClick={onRefresh}
          disabled={refreshing}
          className="inline-flex items-center justify-center rounded-2xl border border-zinc-200 bg-white/90 px-4 py-2.5 text-sm font-bold text-zinc-700 shadow-sm transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </button>
        </div>
      </div>

      {error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}

      <div className="grid gap-4 md:grid-cols-4">
        <div className="rounded-[24px] border border-zinc-200 bg-[linear-gradient(180deg,_#ffffff_0%,_#f9fbff_100%)] p-4 shadow-sm"><div className="text-xs font-bold uppercase tracking-wider text-zinc-500">Endpoint Onboarding</div><div className="mt-2 text-xl font-bold text-zinc-900">{loading ? '...' : installConfig?.portalInstallReady ? 'Ready' : 'Not Ready'}</div><div className="mt-2"><StatusPill ok={Boolean(installConfig?.portalInstallReady)} label={installConfig?.portalInstallReady ? 'Configured' : 'Missing server URL or token'} /></div></div>
        <div className="rounded-[24px] border border-zinc-200 bg-[linear-gradient(180deg,_#ffffff_0%,_#f9fbff_100%)] p-4 shadow-sm"><div className="text-xs font-bold uppercase tracking-wider text-zinc-500">Inventory Sync</div><div className="mt-2 text-xl font-bold text-zinc-900">{loading ? '...' : syncStatus?.running ? 'Running' : syncStatus?.enabled ? 'Idle' : 'Disabled'}</div><div className="mt-2"><StatusPill ok={Boolean(syncStatus?.enabled && syncStatus?.configured)} label={syncStatus?.enabled && syncStatus?.configured ? 'Active' : 'Not Ready'} /></div></div>
        <div className="rounded-[24px] border border-zinc-200 bg-[linear-gradient(180deg,_#ffffff_0%,_#f9fbff_100%)] p-4 shadow-sm"><div className="text-xs font-bold uppercase tracking-wider text-zinc-500">Departments</div><div className="mt-2 text-xl font-bold text-zinc-900">{loading ? '...' : meta?.departments.length ?? 0}</div></div>
        <div className="rounded-[24px] border border-zinc-200 bg-[linear-gradient(180deg,_#ffffff_0%,_#f9fbff_100%)] p-4 shadow-sm"><div className="text-xs font-bold uppercase tracking-wider text-zinc-500">Branches</div><div className="mt-2 text-xl font-bold text-zinc-900">{loading ? '...' : meta?.branches.length ?? 0}</div></div>
      </div>

      <div className="overflow-x-auto rounded-[24px] border border-zinc-200 bg-white/95 px-3 py-3 shadow-sm">
        <div className="flex min-w-max gap-2">
          {detailSections.map((section) => (
            <button
              key={section.id}
              type="button"
              onClick={() => onSelectSection(section.id)}
              className={`rounded-full border px-3 py-2 text-xs font-bold uppercase tracking-wider transition ${activeSection === section.id ? 'border-emerald-300 bg-emerald-100 text-emerald-800 shadow-sm' : 'border-zinc-200 bg-white text-emerald-700 hover:border-emerald-200 hover:bg-emerald-50'}`}
            >
              {section.label}
            </button>
          ))}
        </div>
      </div>
    </>
  );
}