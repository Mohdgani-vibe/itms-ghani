import type { ReactNode } from 'react';

interface DetailSectionItem {
  label: string;
  value: ReactNode;
}

interface DetailSectionCardProps {
  title: string;
  items: DetailSectionItem[];
  icon?: ReactNode;
  tone?: 'default' | 'brand';
  layout?: 'grid' | 'stack';
  footer?: ReactNode;
}

export default function DetailSectionCard({
  title,
  items,
  icon,
  tone = 'default',
  layout = 'grid',
  footer,
}: DetailSectionCardProps) {
  const containerClassName = tone === 'brand'
    ? 'rounded-xl border border-brand-200 bg-brand-50/70 p-4'
    : 'rounded-xl border border-zinc-100 bg-zinc-50 p-4';
  const titleClassName = tone === 'brand'
    ? 'mb-2 flex items-center text-xs font-bold uppercase tracking-wider text-brand-700'
    : 'mb-2 flex items-center text-xs font-bold uppercase tracking-wider text-zinc-500';

  return <div className={containerClassName}>
    <div className={titleClassName}>
      {icon}
      {title}
    </div>
    {layout === 'grid' ? (
      <div className="grid gap-2 text-sm text-zinc-700 sm:grid-cols-2">
        {items.map((item) => (
          <div key={item.label}>
            <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">{item.label}</div>
            <div className="mt-1 font-medium text-zinc-900">{item.value}</div>
          </div>
        ))}
      </div>
    ) : (
      <div className="space-y-2 text-sm text-zinc-700">
        {items.map((item) => (
          <div key={item.label}>
            {item.label}: <span className="font-semibold text-zinc-900">{item.value}</span>
          </div>
        ))}
      </div>
    )}
    {footer ? <div className="mt-3">{footer}</div> : null}
  </div>;
}