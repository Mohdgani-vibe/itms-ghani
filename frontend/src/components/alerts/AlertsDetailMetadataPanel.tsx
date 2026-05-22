import type { AlertsListRecord } from './types';

import { parseClamAVAlertFacts, renderAlertDetailPreview } from './AlertsDisplay';

interface AlertsDetailMetadataPanelProps {
  selectedAlert: AlertsListRecord;
  renderSystemName: (alert: AlertsListRecord) => string;
  renderAlertUser: (alert: AlertsListRecord) => string;
  formatAbsoluteTime: (value: string) => string;
  darkMode?: boolean;
}

export function AlertsDetailMetadataPanel({
  selectedAlert,
  renderSystemName,
  renderAlertUser,
  formatAbsoluteTime,
  darkMode = false,
}: AlertsDetailMetadataPanelProps) {
  const clamavFacts = parseClamAVAlertFacts(selectedAlert);

  return (
    <div className="space-y-4">
      <div className={`rounded-2xl border px-4 py-4 shadow-sm ${darkMode ? 'border-white/10 bg-slate-950/50' : 'border-zinc-200 bg-[linear-gradient(180deg,_#ffffff_0%,_#f9fbff_100%)]'}`}>
        <div className={`text-[11px] font-bold uppercase tracking-[0.18em] ${darkMode ? 'text-slate-400' : 'text-zinc-500'}`}>Finding Summary</div>
        <div className={`mt-2 text-sm leading-6 ${darkMode ? 'text-slate-200' : 'text-zinc-700'}`}>{renderAlertDetailPreview(selectedAlert, 420)}</div>
      </div>

      {clamavFacts ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className={`rounded-2xl border px-4 py-3 shadow-sm ${darkMode ? 'border-white/10 bg-slate-950/50' : 'border-zinc-200 bg-[linear-gradient(180deg,_#ffffff_0%,_#f9fbff_100%)]'}`}>
            <div className={`text-[11px] font-bold uppercase tracking-[0.18em] ${darkMode ? 'text-slate-400' : 'text-zinc-500'}`}>Scanned Files</div>
            <div className={`mt-1.5 text-sm font-semibold ${darkMode ? 'text-white' : 'text-zinc-900'}`}>{clamavFacts.scannedFiles ?? '-'}</div>
          </div>
          <div className={`rounded-2xl border px-4 py-3 shadow-sm ${darkMode ? 'border-white/10 bg-slate-950/50' : 'border-zinc-200 bg-[linear-gradient(180deg,_#ffffff_0%,_#f9fbff_100%)]'}`}>
            <div className={`text-[11px] font-bold uppercase tracking-[0.18em] ${darkMode ? 'text-slate-400' : 'text-zinc-500'}`}>Infected Files</div>
            <div className={`mt-1.5 text-sm font-semibold ${darkMode ? 'text-white' : 'text-zinc-900'}`}>{clamavFacts.infectedFiles ?? '-'}</div>
          </div>
          <div className={`rounded-2xl border px-4 py-3 shadow-sm ${darkMode ? 'border-white/10 bg-slate-950/50' : 'border-zinc-200 bg-[linear-gradient(180deg,_#ffffff_0%,_#f9fbff_100%)]'}`}>
            <div className={`text-[11px] font-bold uppercase tracking-[0.18em] ${darkMode ? 'text-slate-400' : 'text-zinc-500'}`}>Errors</div>
            <div className={`mt-1.5 text-sm font-semibold ${darkMode ? 'text-white' : 'text-zinc-900'}`}>{clamavFacts.errorCount ?? '-'}</div>
          </div>
          <div className={`rounded-2xl border px-4 py-3 shadow-sm ${darkMode ? 'border-white/10 bg-slate-950/50' : 'border-zinc-200 bg-[linear-gradient(180deg,_#ffffff_0%,_#f9fbff_100%)]'}`}>
            <div className={`text-[11px] font-bold uppercase tracking-[0.18em] ${darkMode ? 'text-slate-400' : 'text-zinc-500'}`}>Known Viruses</div>
            <div className={`mt-1.5 text-sm font-semibold ${darkMode ? 'text-white' : 'text-zinc-900'}`}>{clamavFacts.knownViruses ?? '-'}</div>
          </div>
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <div className={`rounded-2xl border px-4 py-3 shadow-sm ${darkMode ? 'border-white/10 bg-slate-950/50' : 'border-zinc-200 bg-[linear-gradient(180deg,_#ffffff_0%,_#f9fbff_100%)]'}`}>
          <div className={`text-[11px] font-bold uppercase tracking-[0.18em] ${darkMode ? 'text-slate-400' : 'text-zinc-500'}`}>System Hostname</div>
          <div className={`mt-1.5 text-sm font-semibold ${darkMode ? 'text-white' : 'text-zinc-900'}`}>{selectedAlert.hostname || renderSystemName(selectedAlert)}</div>
        </div>
        <div className="rounded-2xl border border-zinc-200 bg-[linear-gradient(180deg,_#ffffff_0%,_#f9fbff_100%)] px-4 py-3 shadow-sm">
          <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-zinc-500">Asset Tag</div>
          <div className="mt-1.5 text-sm font-semibold text-zinc-900">{selectedAlert.assetTag || '-'}</div>
        </div>
        <div className="rounded-2xl border border-zinc-200 bg-[linear-gradient(180deg,_#ffffff_0%,_#f9fbff_100%)] px-4 py-3 shadow-sm">
          <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-zinc-500">Asset ID</div>
          <div className="mt-1.5 break-all text-sm font-semibold text-zinc-900">{selectedAlert.assetId || '-'}</div>
        </div>
        <div className="rounded-2xl border border-zinc-200 bg-[linear-gradient(180deg,_#ffffff_0%,_#f9fbff_100%)] px-4 py-3 shadow-sm">
          <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-zinc-500">User</div>
          <div className="mt-1.5 text-sm font-semibold text-zinc-900">{renderAlertUser(selectedAlert)}</div>
        </div>
        <div className="rounded-2xl border border-zinc-200 bg-[linear-gradient(180deg,_#ffffff_0%,_#f9fbff_100%)] px-4 py-3 shadow-sm">
          <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-zinc-500">Email</div>
          <div className="mt-1.5 text-sm font-semibold text-zinc-900">{selectedAlert.userEmail || '-'}</div>
        </div>
        <div className="rounded-2xl border border-zinc-200 bg-[linear-gradient(180deg,_#ffffff_0%,_#f9fbff_100%)] px-4 py-3 shadow-sm">
          <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-zinc-500">Department</div>
          <div className="mt-1.5 text-sm font-semibold text-zinc-900">{selectedAlert.department || '-'}</div>
        </div>
      </div>

      <div className={`rounded-2xl border px-4 py-3 shadow-sm ${darkMode ? 'border-white/10 bg-slate-950/50' : 'border-zinc-200 bg-[linear-gradient(180deg,_#ffffff_0%,_#f9fbff_100%)]'}`}>
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-zinc-500">Created</div>
            <div className="mt-1.5 text-sm font-semibold text-zinc-900">{formatAbsoluteTime(selectedAlert.createdAt)}</div>
          </div>
          <div>
            <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-zinc-500">Raw Source</div>
            <div className="mt-1.5 text-sm font-semibold text-zinc-900">{selectedAlert.sourceRaw || selectedAlert.source}</div>
          </div>
        </div>
      </div>

      {clamavFacts?.paths && clamavFacts.paths.length > 0 ? (
        <div className={`rounded-2xl border px-4 py-3 shadow-sm ${darkMode ? 'border-white/10 bg-slate-950/50' : 'border-zinc-200 bg-[linear-gradient(180deg,_#ffffff_0%,_#f9fbff_100%)]'}`}>
          <div className={`text-[11px] font-bold uppercase tracking-[0.18em] ${darkMode ? 'text-slate-400' : 'text-zinc-500'}`}>Scanned Paths</div>
          <div className="mt-2 flex flex-wrap gap-2">
            {clamavFacts.paths.slice(0, 8).map((path) => <span key={path} className={`rounded-full border px-2.5 py-1 text-xs font-medium shadow-sm ${darkMode ? 'border-white/10 bg-slate-900 text-slate-200' : 'border-zinc-200 bg-white text-zinc-700'}`}>{path}</span>)}
          </div>
        </div>
      ) : null}

      {clamavFacts?.detectedFiles && clamavFacts.detectedFiles.length > 0 ? (
        <div className={`rounded-2xl border px-4 py-3 shadow-sm ${darkMode ? 'border-white/10 bg-slate-950/50' : 'border-zinc-200 bg-[linear-gradient(180deg,_#ffffff_0%,_#f9fbff_100%)]'}`}>
          <div className={`text-[11px] font-bold uppercase tracking-[0.18em] ${darkMode ? 'text-slate-400' : 'text-zinc-500'}`}>Detected Files</div>
          <div className="mt-2 space-y-2">
            {clamavFacts.detectedFiles.slice(0, 6).map((file) => <div key={file} className={`rounded-xl border px-3 py-2 text-xs font-medium shadow-sm ${darkMode ? 'border-white/10 bg-slate-900 text-slate-200' : 'border-zinc-200 bg-white text-zinc-700'}`}>{file}</div>)}
          </div>
        </div>
      ) : null}
    </div>
  );
}