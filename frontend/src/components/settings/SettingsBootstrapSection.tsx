interface SettingsBootstrapSectionProps {
  includeLinuxHardinfoFallback: boolean;
  copyStatus: 'linux' | 'windows' | 'linux-sync' | 'windows-sync' | '';
  linuxBootstrapCommand: string;
  windowsBootstrapCommand: string;
  linuxSyncCommand: string;
  windowsSyncCommand: string;
  onIncludeLinuxHardinfoFallbackChange: (value: boolean) => void;
  onCopyCommand: (kind: 'linux' | 'windows' | 'linux-sync' | 'windows-sync', command: string) => void;
}

export default function SettingsBootstrapSection({
  includeLinuxHardinfoFallback,
  copyStatus,
  linuxBootstrapCommand,
  windowsBootstrapCommand,
  linuxSyncCommand,
  windowsSyncCommand,
  onIncludeLinuxHardinfoFallbackChange,
  onCopyCommand,
}: SettingsBootstrapSectionProps) {
  return (
    <section className="rounded-2xl border border-zinc-200 bg-white shadow-sm">
      <div className="border-b border-zinc-100 px-5 py-4">
        <h2 className="text-lg font-bold text-zinc-900">Bootstrap Commands</h2>
        <p className="mt-1 text-sm text-zinc-500">Endpoint setup commands built from the current platform configuration.</p>
      </div>
      <div className="space-y-4 p-5">
        <label className="flex items-start gap-3 rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-700">
          <input
            type="checkbox"
            checked={includeLinuxHardinfoFallback}
            onChange={(event) => onIncludeLinuxHardinfoFallbackChange(event.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-zinc-300 text-brand-600 focus:ring-brand-500"
          />
          <span>
            <span className="block font-semibold text-zinc-900">Include Linux hardinfo fallback</span>
            <span className="mt-1 block text-xs text-zinc-500">Controls whether the generic Linux install and sync commands include `--use-hardinfo-fallback`.</span>
          </span>
        </label>

        <div className="grid gap-4 xl:grid-cols-2">
          <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div className="text-xs font-bold uppercase tracking-wider text-zinc-500">Linux Install Code</div>
              <button
                type="button"
                onClick={() => onCopyCommand('linux', linuxBootstrapCommand)}
                className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs font-bold text-zinc-700 hover:bg-zinc-50"
              >
                {copyStatus === 'linux' ? 'Copied' : 'Copy'}
              </button>
            </div>
            <h3 className="mt-1 text-lg font-bold text-zinc-900">Ubuntu, Debian, Fedora, CentOS, or RHEL install + first sync</h3>
            <p className="mt-2 text-sm text-zinc-500">Uses current backend values and supports both apt-based and dnf or yum-based Linux bootstrap flows before the first sync.</p>
            <pre className="mt-3 overflow-x-auto rounded-xl bg-zinc-900 px-3 py-3 text-xs text-zinc-100">{linuxBootstrapCommand}</pre>

            <div className="mt-5 flex items-center justify-between gap-3">
              <div className="text-xs font-bold uppercase tracking-wider text-zinc-500">Linux Sync Code</div>
              <button
                type="button"
                onClick={() => onCopyCommand('linux-sync', linuxSyncCommand)}
                className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs font-bold text-zinc-700 hover:bg-zinc-50"
              >
                {copyStatus === 'linux-sync' ? 'Copied' : 'Copy'}
              </button>
            </div>
            <p className="mt-2 text-sm text-zinc-500">Run later on the same Linux system when you want another inventory push.</p>
            <pre className="mt-3 overflow-x-auto rounded-xl bg-zinc-900 px-3 py-3 text-xs text-zinc-100">{linuxSyncCommand}</pre>
          </div>

          <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div className="text-xs font-bold uppercase tracking-wider text-zinc-500">Windows Install Code</div>
              <button
                type="button"
                onClick={() => onCopyCommand('windows', windowsBootstrapCommand)}
                className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs font-bold text-zinc-700 hover:bg-zinc-50"
              >
                {copyStatus === 'windows' ? 'Copied' : 'Copy'}
              </button>
            </div>
            <h3 className="mt-1 text-lg font-bold text-zinc-900">Windows install + first sync</h3>
            <p className="mt-2 text-sm text-zinc-500">Uses current backend values and keeps detailed hardware inventory explicit.</p>
            <pre className="mt-3 overflow-x-auto rounded-xl bg-zinc-900 px-3 py-3 text-xs text-zinc-100">{windowsBootstrapCommand}</pre>

            <div className="mt-5 flex items-center justify-between gap-3">
              <div className="text-xs font-bold uppercase tracking-wider text-zinc-500">Windows Sync Code</div>
              <button
                type="button"
                onClick={() => onCopyCommand('windows-sync', windowsSyncCommand)}
                className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs font-bold text-zinc-700 hover:bg-zinc-50"
              >
                {copyStatus === 'windows-sync' ? 'Copied' : 'Copy'}
              </button>
            </div>
            <p className="mt-2 text-sm text-zinc-500">Run later on the same Windows system when you want another inventory push.</p>
            <pre className="mt-3 overflow-x-auto rounded-xl bg-zinc-900 px-3 py-3 text-xs text-zinc-100">{windowsSyncCommand}</pre>
          </div>
        </div>
      </div>
    </section>
  );
}
