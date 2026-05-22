interface RequestsQueueHeroProps {
  totalRequests: number;
  pendingCount: number;
  inProgressCount: number;
  resolvedCount: number;
  pendingEnrollmentCount: number;
  enrollmentCount: number;
}

export default function RequestsQueueHero({
  totalRequests,
  pendingCount,
  inProgressCount,
  resolvedCount,
  pendingEnrollmentCount,
  enrollmentCount,
}: RequestsQueueHeroProps) {
  return (
    <section className="overflow-hidden rounded-[32px] border border-zinc-200 bg-white shadow-sm">
      <div className="bg-[radial-gradient(circle_at_top_right,_rgba(16,185,129,0.16),_transparent_28%),radial-gradient(circle_at_left,_rgba(251,191,36,0.10),_transparent_24%),linear-gradient(135deg,_#f6fdf8_0%,_#ffffff_58%,_#fff8ef_100%)] px-6 py-7">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-3xl">
            <div className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.22em] text-emerald-700">
              Queue Workspace
            </div>
            <h1 className="mt-4 text-3xl font-black tracking-tight text-zinc-950 sm:text-4xl">Requests</h1>
            <p className="mt-3 text-sm leading-6 text-zinc-600 sm:text-base">
              Review enrollment work, triage support issues, and move requests forward from one queue-first workspace.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5 xl:min-w-[620px]">
            <div className="rounded-[22px] border border-white/90 bg-white/90 p-4 shadow-sm">
              <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">Total</div>
              <div className="mt-2 text-3xl font-black text-zinc-950">{totalRequests}</div>
            </div>
            <div className="rounded-[22px] border border-white/90 bg-white/90 p-4 shadow-sm">
              <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">Pending</div>
              <div className="mt-2 text-3xl font-black text-zinc-950">{pendingCount}</div>
            </div>
            <div className="rounded-[22px] border border-white/90 bg-white/90 p-4 shadow-sm">
              <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">In Progress</div>
              <div className="mt-2 text-3xl font-black text-zinc-950">{inProgressCount}</div>
            </div>
            <div className="rounded-[22px] border border-white/90 bg-white/90 p-4 shadow-sm">
              <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">Resolved</div>
              <div className="mt-2 text-3xl font-black text-zinc-950">{resolvedCount}</div>
            </div>
            <div className="rounded-[22px] border border-white/90 bg-white/90 p-4 shadow-sm">
              <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">Enrollment Pending</div>
              <div className="mt-2 text-3xl font-black text-zinc-950">{pendingEnrollmentCount}<span className="ml-1 text-sm font-semibold text-zinc-500">/ {enrollmentCount} total</span></div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}