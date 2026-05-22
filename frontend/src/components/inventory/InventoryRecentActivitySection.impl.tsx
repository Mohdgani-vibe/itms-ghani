export default function InventoryRecentActivitySection() {
  return (
    <section className="rounded-2xl border border-emerald-100 bg-[linear-gradient(180deg,_#ffffff_0%,_#f4fbf6_100%)] p-6 text-sm text-zinc-700 shadow-sm">
      <div className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-700">Inventory Activity</div>
      <h2 className="mt-2 text-lg font-bold text-zinc-900">Recent stock movement is shown in the live inventory workspace.</h2>
      <p className="mt-2 max-w-2xl text-sm text-zinc-600">Use the main inventory page to review assignments, stock adjustments, and audit-linked activity. This panel no longer renders placeholder content.</p>
    </section>
  );
}
