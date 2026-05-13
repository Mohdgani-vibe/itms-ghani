interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'default' | 'danger';
  busy?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  tone = 'default',
  busy = false,
  onConfirm,
  onClose,
}: ConfirmDialogProps) {
  if (!open) {
    return null;
  }

  const confirmClassName = tone === 'danger'
    ? 'bg-rose-600 text-white hover:bg-rose-700'
    : 'border border-zinc-300 bg-white text-zinc-900 hover:bg-zinc-50';

  const toneBadgeClassName = tone === 'danger'
    ? 'border-rose-200 bg-rose-50 text-rose-700'
    : 'border-sky-200 bg-sky-50 text-sky-700';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/60 p-4 backdrop-blur-[2px]">
      <div className="w-full max-w-lg overflow-hidden rounded-[28px] border border-zinc-200 bg-white shadow-[0_32px_80px_rgba(15,23,42,0.28)]" role="dialog" aria-modal="true" aria-labelledby="confirm-dialog-title">
        <div className="border-b border-zinc-200 bg-[radial-gradient(circle_at_top_right,_rgba(56,189,248,0.16),_transparent_28%),radial-gradient(circle_at_left,_rgba(251,191,36,0.12),_transparent_24%),linear-gradient(135deg,_#f8fcff_0%,_#ffffff_58%,_#fff8ef_100%)] px-6 py-5">
          <div className={`inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-bold uppercase tracking-[0.22em] ${toneBadgeClassName}`}>
            {tone === 'danger' ? 'Destructive Action' : 'Confirm Action'}
          </div>
          <h2 id="confirm-dialog-title" className="mt-3 text-2xl font-black tracking-tight text-zinc-950">{title}</h2>
          <p className="mt-2 text-sm leading-6 text-zinc-600">{message}</p>
        </div>
        <div className="flex justify-end gap-3 bg-[linear-gradient(180deg,_#ffffff_0%,_#f9fbff_100%)] px-6 py-5">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="rounded-2xl border border-zinc-200 bg-white px-4 py-2.5 text-sm font-bold text-zinc-700 shadow-sm transition hover:bg-zinc-50 disabled:opacity-60"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className={`rounded-2xl px-4 py-2.5 text-sm font-bold shadow-sm transition disabled:opacity-60 ${confirmClassName}`}
          >
            {busy ? 'Working...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}