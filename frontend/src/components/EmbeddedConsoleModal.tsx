import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { useEffect } from 'react';
import { createPortal } from 'react-dom';

import SshTerminalView from './SshTerminalView';
import TerminalConsoleView from './TerminalConsoleView';

export type EmbeddedConsoleState = {
  kind: 'ssh';
  title: string;
  subtitle: string;
  assetId: string;
} | {
  kind: 'salt-loading';
  title: string;
  subtitle: string;
  assetId?: string;
} | {
  kind: 'salt';
  title: string;
  subtitle: string;
  assetId?: string;
  departmentName?: string;
  minionId: string;
  prefillCommand?: string;
};

interface EmbeddedConsoleModalProps {
  consoleState: EmbeddedConsoleState | null;
  titleId: string;
  closeButtonRef?: React.RefObject<HTMLButtonElement | null>;
  navigation?: {
    index: number;
    total: number;
    onPrevious: () => void;
    onNext: () => void;
  } | null;
  onClose: () => void;
}

export default function EmbeddedConsoleModal({ consoleState, titleId, closeButtonRef, navigation = null, onClose }: EmbeddedConsoleModalProps) {
  useEffect(() => {
    if (!consoleState || !navigation) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (!event.altKey || !event.shiftKey) {
        return;
      }

      if (event.key === 'ArrowLeft' && navigation.index > 0) {
        event.preventDefault();
        navigation.onPrevious();
        return;
      }

      if (event.key === 'ArrowRight' && navigation.index < navigation.total - 1) {
        event.preventDefault();
        navigation.onNext();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [consoleState, navigation]);

  if (!consoleState || typeof document === 'undefined') {
    return null;
  }

  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-zinc-950/48 p-2 sm:p-3 backdrop-blur-[6px]" onClick={onClose}>
      <div
        className="flex h-[96vh] w-full max-w-[98vw] flex-col overflow-hidden rounded-[32px] border border-zinc-200 bg-white shadow-[0_32px_90px_rgba(15,23,42,0.28)]"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="border-b border-zinc-200 bg-[radial-gradient(circle_at_top_right,_rgba(56,189,248,0.18),_transparent_28%),radial-gradient(circle_at_left,_rgba(59,130,246,0.10),_transparent_24%),linear-gradient(180deg,_#f8fcff_0%,_#ffffff_100%)] px-4 py-4 sm:px-5 sm:py-5">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="inline-flex items-center rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.22em] text-sky-700">{consoleState.kind === 'ssh' ? 'SSH Terminal' : 'Salt Console'}</div>
              <h2 id={titleId} className="mt-3 truncate text-2xl font-black tracking-tight text-zinc-950">{consoleState.title}</h2>
              <p className="mt-1 truncate text-sm text-zinc-500">{consoleState.subtitle}</p>
            </div>
            <div className="flex items-center gap-2">
              {navigation ? (
                <>
                  <div className="hidden rounded-2xl border border-zinc-200 bg-white/80 px-3 py-2 text-right text-xs text-zinc-500 lg:block">
                    <div className="font-semibold text-zinc-900">{navigation.index + 1} of {navigation.total}</div>
                    <div className="mt-0.5">Alt+Shift+Left/Right</div>
                  </div>
                  <button type="button" onClick={navigation.onPrevious} disabled={navigation.index === 0} className="inline-flex items-center rounded-2xl border border-zinc-200 bg-white px-3.5 py-2.5 text-sm font-bold text-zinc-700 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50">
                    <ChevronLeft className="mr-1 h-4 w-4" /> Prev
                  </button>
                  <button type="button" onClick={navigation.onNext} disabled={navigation.index >= navigation.total - 1} className="inline-flex items-center rounded-2xl border border-zinc-200 bg-white px-3.5 py-2.5 text-sm font-bold text-zinc-700 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50">
                    Next <ChevronRight className="ml-1 h-4 w-4" />
                  </button>
                </>
              ) : null}
              <button ref={closeButtonRef} type="button" onClick={onClose} className="inline-flex items-center rounded-2xl border border-zinc-200 bg-white px-3.5 py-2.5 text-sm font-bold text-zinc-900 shadow-sm transition hover:bg-zinc-50">
                <X className="mr-2 h-4 w-4" /> Close
              </button>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <div className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-sky-700">
              {consoleState.kind === 'ssh' ? 'Secure Device Access' : consoleState.kind === 'salt-loading' ? 'Preparing Salt Target' : 'Live Salt Command Session'}
            </div>
            {'assetId' in consoleState && consoleState.assetId ? (
              <div className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-blue-700">
                Asset ID {consoleState.assetId}
              </div>
            ) : null}
            {consoleState.kind === 'salt' && consoleState.departmentName ? (
              <div className="rounded-full border border-zinc-200 bg-white px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-zinc-700">
                Department {consoleState.departmentName}
              </div>
            ) : null}
            {consoleState.kind === 'salt' ? (
              <div className="rounded-full border border-zinc-200 bg-white px-3 py-1 text-[11px] font-medium uppercase tracking-[0.16em] text-zinc-700">
                Salt Target {consoleState.minionId}
              </div>
            ) : null}
            <div className="rounded-full border border-zinc-200 bg-white px-3 py-1 text-[11px] font-medium uppercase tracking-[0.16em] text-zinc-700">
              Embedded Workspace
            </div>
          </div>
        </div>
        <div className="min-h-0 flex-1 bg-[linear-gradient(180deg,_#eef5ff_0%,_#f8fbff_100%)] p-2 sm:p-3">
          {consoleState.kind === 'ssh' ? <SshTerminalView key={consoleState.assetId} assetId={consoleState.assetId} embedded /> : null}
          {consoleState.kind === 'salt-loading' ? (
            <div className="flex h-full min-h-[420px] items-center justify-center rounded-[28px] border border-zinc-200 bg-white px-6 py-8 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.4)]">
              <div>
                <div className="text-xs font-bold uppercase tracking-[0.18em] text-sky-700">Loading Salt Target</div>
                <div className="mt-3 text-lg font-bold text-zinc-950">Preparing console session for the selected device.</div>
                <div className="mt-2 text-sm text-zinc-500">Fetching the latest Salt target details before opening the next console.</div>
              </div>
            </div>
          ) : null}
          {consoleState.kind === 'salt' ? <TerminalConsoleView key={consoleState.minionId} minionId={consoleState.minionId} prefilledCommand={consoleState.prefillCommand} embedded /> : null}
        </div>
      </div>
    </div>,
    document.body,
  );
}