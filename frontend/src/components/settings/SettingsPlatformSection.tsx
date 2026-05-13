interface InstallAgentConfig {
  publicServerUrl: string;
  inventoryIngestToken: string;
  saltMasterHost: string;
  saltApiBaseUrl?: string;
  wazuhManagerHost: string;
  saltApiConfigured: boolean;
  saltBootstrapReady?: boolean;
  sshConfigured?: boolean;
  sshAuthMode?: string;
  wazuhApiConfigured: boolean;
  portalInstallReady: boolean;
  linuxInstallerUrl?: string;
  windowsInstallerUrl?: string;
}

interface SyncStatus {
  enabled: boolean;
  configured: boolean;
  sourceType: string;
  interval: string;
  running: boolean;
  nextRunAt?: string;
  lastRun?: {
    status: string;
    startedAt: string;
    finishedAt?: string;
    recordsSeen: number;
    recordsUpserted: number;
    error?: string;
  };
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

interface SessionUser {
  fullName?: string;
  email?: string;
  role?: string;
  defaultPortal?: string;
}

interface SettingsPlatformSectionProps {
  installConfig: InstallAgentConfig | null;
  syncStatus: SyncStatus | null;
  meta: UserMetaOptionsResponse | null;
  sessionUser?: SessionUser | null;
  formatDateTime: (value?: string) => string;
}

function StatusPill({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold ${ok ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
      {label}
    </span>
  );
}

export default function SettingsPlatformSection({
  installConfig,
  syncStatus,
  meta,
  sessionUser,
  formatDateTime,
}: SettingsPlatformSectionProps) {
  return (
    <div className="grid gap-5 xl:grid-cols-2">
      <section className="rounded-2xl border border-zinc-200 bg-white shadow-sm">
        <div className="border-b border-zinc-100 px-5 py-4">
          <h2 className="text-lg font-bold text-zinc-900">Platform Status</h2>
          <p className="mt-1 text-sm text-zinc-500">Current backend values.</p>
        </div>
        <div className="grid grid-cols-1 gap-3 p-5 md:grid-cols-2">
          <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
            <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">Portal API</div>
            <div className="mt-2 break-all text-sm font-semibold text-zinc-900">{installConfig?.publicServerUrl || 'Not configured'}</div>
          </div>
          <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
            <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">Sync Interval</div>
            <div className="mt-2 text-sm font-semibold text-zinc-900">{syncStatus?.interval || 'Not available'}</div>
          </div>
          <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
            <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">Salt Master</div>
            <div className="mt-2 text-sm font-semibold text-zinc-900">{installConfig?.saltMasterHost || 'Not configured'}</div>
            <div className="mt-2"><StatusPill ok={Boolean(installConfig?.saltApiConfigured)} label={installConfig?.saltApiConfigured ? 'Connected' : 'Optional integration not configured'} /></div>
          </div>
          <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
            <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">Salt API Base</div>
            <div className="mt-2 break-all text-sm font-semibold text-zinc-900">{installConfig?.saltApiBaseUrl || 'Not configured'}</div>
          </div>
          <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
            <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">Wazuh Manager</div>
            <div className="mt-2 text-sm font-semibold text-zinc-900">{installConfig?.wazuhManagerHost || 'Not configured'}</div>
            <div className="mt-2"><StatusPill ok={Boolean(installConfig?.wazuhApiConfigured)} label={installConfig?.wazuhApiConfigured ? 'Connected' : 'Optional integration not configured'} /></div>
          </div>
          <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
            <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">SSH Terminal Auth</div>
            <div className="mt-2 text-sm font-semibold text-zinc-900">{installConfig?.sshAuthMode === 'certificate' ? 'Certificate-backed' : installConfig?.sshAuthMode === 'key' ? 'Private key' : 'Not configured'}</div>
            <div className="mt-2"><StatusPill ok={Boolean(installConfig?.sshConfigured)} label={installConfig?.sshConfigured ? 'Ready' : 'Not configured'} /></div>
          </div>
          <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 md:col-span-2">
            <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">Last Inventory Run</div>
            <div className="mt-2 text-sm font-semibold text-zinc-900">{formatDateTime(syncStatus?.lastRun?.startedAt)}</div>
            <p className="mt-2 text-sm text-zinc-500">
              Status: {syncStatus?.lastRun?.status || 'Unknown'} • Records seen: {syncStatus?.lastRun?.recordsSeen ?? 0} • Upserted: {syncStatus?.lastRun?.recordsUpserted ?? 0}
            </p>
            {syncStatus?.lastRun?.error ? <p className="mt-2 text-sm text-rose-600">{syncStatus.lastRun.error}</p> : null}
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white shadow-sm">
        <div className="border-b border-zinc-100 px-5 py-4">
          <h2 className="text-lg font-bold text-zinc-900">Portal Context</h2>
          <p className="mt-1 text-sm text-zinc-500">Read-only portal information for the current user.</p>
        </div>
        <div className="space-y-3 p-5">
          <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
            <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">Signed In As</div>
            <div className="mt-2 text-base font-bold text-zinc-900">{sessionUser?.fullName || 'Unknown user'}</div>
            <p className="mt-1 text-sm text-zinc-500">{sessionUser?.email || 'No email'} • {sessionUser?.role || 'No role'}</p>
          </div>
          <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
            <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">Default Portal</div>
            <div className="mt-2 text-sm font-semibold text-zinc-900">{sessionUser?.defaultPortal || 'Not set'}</div>
          </div>
          <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
            <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">Departments</div>
            <div className="mt-3 flex flex-wrap gap-2">
              {(meta?.departments || []).slice(0, 16).map((department) => (
                <span key={department.id} className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-zinc-700 ring-1 ring-zinc-200">
                  {department.name}
                </span>
              ))}
              {!meta?.departments?.length ? <span className="text-sm text-zinc-500">No departments returned by the backend.</span> : null}
            </div>
          </div>
          <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
            <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">Branches</div>
            <div className="mt-3 flex flex-wrap gap-2">
              {(meta?.branches || []).slice(0, 16).map((branch) => (
                <span key={branch.id} className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-zinc-700 ring-1 ring-zinc-200">
                  {branch.name}
                </span>
              ))}
              {!meta?.branches?.length ? <span className="text-sm text-zinc-500">No branches returned by the backend.</span> : null}
            </div>
          </div>
          <div className="rounded-xl border border-brand-200 bg-brand-50 p-4 text-sm text-brand-800">
            Next run: {formatDateTime(syncStatus?.nextRunAt)}
          </div>
        </div>
      </section>
    </div>
  );
}
