import type { ReactNode } from 'react';

interface SectionTone {
  shell: string;
  badge: string;
  heading: string;
  subtext: string;
}

interface RequestsQueueSectionProps {
  title: string;
  description: string;
  emptyMessage: string;
  visibleItems: number;
  tone: SectionTone;
  children: ReactNode;
}

export default function RequestsQueueSection({
  title,
  description,
  emptyMessage,
  visibleItems,
  tone,
  children,
}: RequestsQueueSectionProps) {
  return (
    <section className={`overflow-hidden rounded-2xl border shadow-sm ${tone.shell}`}>
      <div className="border-b border-sky-100/80 bg-[linear-gradient(180deg,_#ffffff_0%,_#f5fbff_100%)] px-5 py-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <div className={`inline-flex rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] ${tone.badge}`}>
              {title}
            </div>
            <h2 className={`mt-3 text-xl font-black tracking-tight ${tone.heading}`}>{title}</h2>
            <p className={`mt-1 text-sm ${tone.subtext}`}>{description}</p>
          </div>
          <div className="rounded-2xl bg-white/90 px-4 py-3 text-right shadow-sm ring-1 ring-sky-100">
            <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">Visible Items</div>
            <div className="mt-1 text-2xl font-black text-zinc-950">{visibleItems}</div>
          </div>
        </div>
      </div>

      {visibleItems === 0 ? <div className="px-5 py-8 text-sm text-zinc-500">{emptyMessage}</div> : null}

      {children}
    </section>
  );
}