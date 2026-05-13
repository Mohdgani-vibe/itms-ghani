export default function InventorySummarySection() {
  return (
    <section className="rounded-2xl border border-sky-100 bg-[linear-gradient(180deg,_#ffffff_0%,_#f6fbff_100%)] p-6 text-sm text-zinc-700 shadow-sm">
      <div className="text-xs font-bold uppercase tracking-[0.2em] text-sky-700">Inventory Summary</div>
      <h2 className="mt-2 text-lg font-bold text-zinc-900">Inventory totals and branch rollups are available in the live inventory workspace.</h2>
      <p className="mt-2 max-w-2xl text-sm text-zinc-600">Open the inventory module for real-time asset counts, supplier coverage, branch stock, and allocation detail.</p>
    </section>
  );
}
