import { actionButtonStyles } from '../../lib/buttonStyles';

interface RequestsQueueEmptyStateProps {
  hasActiveFilters: boolean;
  onResetFilters: () => void;
  onOpenDashboard: () => void;
}

export default function RequestsQueueEmptyState({ hasActiveFilters, onResetFilters, onOpenDashboard }: RequestsQueueEmptyStateProps) {
  return (
    <section className="rounded-[28px] border border-zinc-200 bg-white px-6 py-10 text-center shadow-sm">
      <div className="mx-auto max-w-2xl">
        <div className="inline-flex items-center rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-zinc-600">
          Queue Empty
        </div>
        <h2 className="mt-4 text-2xl font-black tracking-tight text-zinc-950">No requests match this view</h2>
        <p className="mt-3 text-sm leading-6 text-zinc-600 sm:text-base">
          {hasActiveFilters
            ? 'No requests match the current search and filter combination. Reset the filters to return to the full queue.'
            : 'There are no requests in the queue yet. New enrollment reviews and support tickets will appear here automatically.'}
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          {hasActiveFilters ? (
            <button type="button" onClick={onResetFilters} className={`rounded-2xl px-4 py-3 text-sm font-bold transition ${actionButtonStyles.save}`}>
              Reset Filters
            </button>
          ) : null}
          <button type="button" onClick={onOpenDashboard} className={`rounded-2xl px-4 py-3 text-sm font-bold transition ${actionButtonStyles.add}`}>
            Open Dashboard
          </button>
        </div>
      </div>
    </section>
  );
}