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
  kind: 'salt';
  title: string;
  subtitle: string;
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
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-zinc-950/72 p-2 sm:p-3 backdrop-blur-[2px]" onClick={onClose}>
      <div
        className="flex h-[96vh] w-full max-w-[98vw] flex-col overflow-hidden rounded-[28px] border border-zinc-800 bg-zinc-950 shadow-[0_32px_90px_rgba(0,0,0,0.5)]"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="border-b border-zinc-800 bg-[radial-gradient(circle_at_top_right,_rgba(14,165,233,0.18),_transparent_28%),radial-gradient(circle_at_left,_rgba(74,222,128,0.14),_transparent_24%),linear-gradient(180deg,_rgba(12,17,29,0.96)_0%,_rgba(9,12,20,0.96)_100%)] px-4 py-4 sm:px-5 sm:py-5">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="inline-flex items-center rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.22em] text-emerald-300">{consoleState.kind === 'ssh' ? 'SSH Terminal' : 'Salt Console'}</div>
              <h2 id={titleId} className="mt-3 truncate text-2xl font-black tracking-tight text-white">{consoleState.title}</h2>
              <p className="mt-1 truncate text-sm text-zinc-400">{consoleState.subtitle}</p>
            </div>
            <div className="flex items-center gap-2">
              {navigation ? (
                <>
                  <div className="hidden rounded-2xl border border-zinc-800 bg-zinc-950/50 px-3 py-2 text-right text-xs text-zinc-400 lg:block">
                    <div className="font-semibold text-zinc-200">{navigation.index + 1} of {navigation.total}</div>
                    <div className="mt-0.5">Alt+Shift+Left/Right</div>
                  </div>
                  <button type="button" onClick={navigation.onPrevious} disabled={navigation.index === 0} className="inline-flex items-center rounded-2xl border border-zinc-700 bg-zinc-950/70 px-3.5 py-2.5 text-sm font-bold text-zinc-100 transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50">
                    <ChevronLeft className="mr-1 h-4 w-4" /> Prev
                  </button>
                  <button type="button" onClick={navigation.onNext} disabled={navigation.index >= navigation.total - 1} className="inline-flex items-center rounded-2xl border border-zinc-700 bg-zinc-950/70 px-3.5 py-2.5 text-sm font-bold text-zinc-100 transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50">
                    Next <ChevronRight className="ml-1 h-4 w-4" />
                  </button>
                </>
              ) : null}
              <button ref={closeButtonRef} type="button" onClick={onClose} className="inline-flex items-center rounded-2xl border border-zinc-700 bg-white px-3.5 py-2.5 text-sm font-bold text-zinc-900 shadow-sm transition hover:bg-zinc-100">
                <X className="mr-2 h-4 w-4" /> Close
              </button>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <div className="rounded-full border border-sky-500/25 bg-sky-500/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-sky-200">
              {consoleState.kind === 'ssh' ? 'Secure Device Access' : 'Live Salt Command Session'}
            </div>
            <div className="rounded-full border border-zinc-700 bg-zinc-950/55 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.16em] text-zinc-300">
              Embedded Workspace
            </div>
          </div>
        </div>
        <div className="min-h-0 flex-1 bg-[linear-gradient(180deg,_#06080d_0%,_#090d15_100%)] p-1.5 sm:p-2">
          {consoleState.kind === 'ssh' ? <SshTerminalView assetId={consoleState.assetId} embedded /> : <TerminalConsoleView minionId={consoleState.minionId} prefilledCommand={consoleState.prefillCommand} embedded />}
        </div>
      </div>
    </div>,
    document.body,
  );
}