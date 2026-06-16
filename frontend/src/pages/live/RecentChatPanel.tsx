import { Link } from 'react-router-dom';

import { buildChatWorkspaceHref } from '../chatUtils';

interface RecentChatPanelConfig {
  eyebrow: string;
  title: string;
  description: string;
  actionLabel: string;
  totalLabel: string;
  loadingText: string;
  emptyText: string;
}

interface RecentChatPanelItem {
  id: string;
  title: string;
  meta: string;
  timestamp?: string;
  badge?: string;
}

interface RecentChatPanelProps {
  basePath: string;
  loading: boolean;
  total: number;
  panel: RecentChatPanelConfig;
  items: RecentChatPanelItem[];
}

export default function RecentChatPanel({
  basePath,
  loading,
  total,
  panel,
  items,
}: RecentChatPanelProps) {
  const hasVisibleChats = items.length > 0;
  const hasOverflowChats = items.length > 3;
  const chatWorkspaceHref = buildChatWorkspaceHref(basePath);
  const latestVisibleChatHref = buildChatWorkspaceHref(basePath, items[0]?.id);
  const actionHref = hasVisibleChats ? latestVisibleChatHref : chatWorkspaceHref;
  const actionLabel = loading ? 'Loading...' : hasVisibleChats ? panel.actionLabel : 'Browse Chats';
  const actionClassName = loading
    ? 'rounded-full border border-zinc-200 bg-zinc-100 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-zinc-400'
    : 'rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-zinc-700 transition hover:bg-zinc-100';

  return (
    <section className="rounded-[28px] border border-zinc-200 bg-white/95 p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-zinc-500">{panel.eyebrow}</div>
          <h2 className="mt-1 text-xl font-black text-zinc-950">{panel.title}</h2>
          <p className="mt-1 text-sm text-zinc-500">{panel.description}</p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className="rounded-full bg-zinc-100 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-zinc-700">
            {loading ? '...' : `${total} ${panel.totalLabel}`}
          </div>
          {loading ? (
            <span aria-disabled="true" className={actionClassName}>
              {actionLabel}
            </span>
          ) : (
            <Link
              to={actionHref}
              className={actionClassName}
            >
              {actionLabel}
            </Link>
          )}
        </div>
      </div>
      <div className="mt-5 grid gap-3 lg:grid-cols-3">
        {loading ? <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-4 text-sm text-zinc-500 lg:col-span-3">{panel.loadingText}</div> : null}
        {!loading && items.length === 0 ? <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-4 text-sm text-zinc-500 lg:col-span-3">{panel.emptyText}</div> : null}
        {!loading && items.slice(0, 3).map((item) => (
          <Link key={item.id} to={buildChatWorkspaceHref(basePath, item.id)} className="block rounded-[24px] border border-zinc-200 bg-[linear-gradient(180deg,_#ffffff_0%,_#f8fafc_100%)] p-4 shadow-sm transition hover:border-sky-200 hover:bg-sky-50/40">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="truncate text-sm font-bold text-zinc-950">{item.title}</div>
                <div className="mt-2 text-xs leading-6 text-zinc-500">{item.meta}</div>
              </div>
              {item.badge ? <div className="rounded-full bg-sky-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-sky-700 ring-1 ring-sky-200">{item.badge}</div> : null}
            </div>
            {item.timestamp ? <div className="mt-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-400">Last active {item.timestamp}</div> : null}
          </Link>
        ))}
      </div>
      {!loading && hasOverflowChats ? (
        <div className="mt-4 flex items-center justify-between gap-3 rounded-[22px] border border-zinc-200 bg-zinc-50/80 px-4 py-3">
          <div className="text-xs font-medium text-zinc-500">Showing the latest 3 chats from this workspace.</div>
          <Link
            to={chatWorkspaceHref}
            className="rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-zinc-700 transition hover:bg-zinc-100"
          >
            View All Chats
          </Link>
        </div>
      ) : null}
    </section>
  );
}