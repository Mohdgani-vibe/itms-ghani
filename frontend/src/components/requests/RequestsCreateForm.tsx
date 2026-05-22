import { PlusCircle } from 'lucide-react';
import { actionButtonStyles } from '../../lib/buttonStyles';

const REQUEST_CREATION_TYPES = [
  'Laptop change',
  'OS reinstall',
  'Software install',
  'Portal access',
  'Settings change',
  'General issue',
  'Other',
] as const;

interface QueueRequestForm {
  type: string;
  title: string;
  description: string;
}

interface RequestsCreateFormProps {
  requestForm: QueueRequestForm;
  requestSubmitting: boolean;
  onSubmit: (event: React.FormEvent) => void | Promise<void>;
  onTypeChange: (value: string) => void;
  onTitleChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
}

export default function RequestsCreateForm({
  requestForm,
  requestSubmitting,
  onSubmit,
  onTypeChange,
  onTitleChange,
  onDescriptionChange,
}: RequestsCreateFormProps) {
  return (
    <form onSubmit={onSubmit} className="rounded-[24px] border border-emerald-100 bg-[linear-gradient(180deg,_#ffffff_0%,_#f4fbf6_100%)] p-5 shadow-sm">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="max-w-2xl">
          <div className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-emerald-700">
            <PlusCircle className="mr-2 h-3.5 w-3.5" />
            Raise A Request
          </div>
          <h2 className="mt-3 text-xl font-black text-zinc-950">IT and super admin can raise work directly from the queue</h2>
          <p className="mt-2 text-sm text-zinc-600">Use this for laptop change, OS reinstall, software install, portal access, settings change, or general IT issues.</p>
        </div>
        <button type="submit" disabled={requestSubmitting} className={`rounded-xl px-4 py-2.5 text-sm font-bold transition disabled:opacity-60 ${actionButtonStyles.add}`}>
          {requestSubmitting ? 'Submitting...' : 'Create Request'}
        </button>
      </div>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <div>
          <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-zinc-900">Request Type</label>
          <select value={requestForm.type} onChange={(event) => onTypeChange(event.target.value)} className="w-full rounded-xl border border-emerald-100 bg-white px-3 py-3 text-sm text-zinc-900 shadow-sm">
            {REQUEST_CREATION_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
          </select>
        </div>
        <div>
          <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-zinc-900">Title</label>
          <input value={requestForm.title} onChange={(event) => onTitleChange(event.target.value)} className="w-full rounded-xl border border-emerald-100 bg-white px-3 py-3 text-sm text-zinc-900 shadow-sm" placeholder="Short request title" />
        </div>
      </div>
      <div className="mt-4">
        <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-zinc-900">Description</label>
        <textarea value={requestForm.description} onChange={(event) => onDescriptionChange(event.target.value)} rows={4} className="w-full rounded-xl border border-emerald-100 bg-white px-3 py-3 text-sm text-zinc-900 shadow-sm" placeholder="Describe the issue, needed change, affected employee, or portal setting to update" />
      </div>
    </form>
  );
}