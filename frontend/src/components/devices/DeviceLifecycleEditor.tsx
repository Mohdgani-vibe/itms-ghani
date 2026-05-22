import { actionButtonStyles } from '../../lib/buttonStyles';

interface DeviceLifecycleFormState {
  assetTag: string;
  category: string;
  model: string;
  purchaseDate: string;
  warrantyUntil: string;
  cost: string;
  notes: string;
}

interface DeviceLifecycleEditorProps {
  form: DeviceLifecycleFormState;
  saving: boolean;
  readOnly?: boolean;
  onFieldChange: (field: keyof DeviceLifecycleFormState, value: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
}

export function deviceLifecycleActionsReadOnly(canOperate: boolean, deviceStatus?: string | null) {
  return !canOperate || (deviceStatus || '').trim().toLowerCase() === 'retired';
}

export default function DeviceLifecycleEditor({
  form,
  saving,
  readOnly = false,
  onFieldChange,
  onSubmit,
  onCancel,
}: DeviceLifecycleEditorProps) {
  return (
    <div className="mt-4 rounded-xl border border-zinc-200 bg-zinc-50 p-4">
      <div className="text-xs font-bold uppercase tracking-wider text-zinc-500">Edit Lifecycle Metadata</div>
      <p className="mt-2 text-sm text-zinc-600">Update lifecycle values stored on the asset record. Assignment, department, and branch links stay unchanged.</p>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <label className="text-sm text-zinc-700">
          <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">Item Code</div>
          <input
            value={form.assetTag}
            onChange={(event) => onFieldChange('assetTag', event.target.value)}
            disabled={readOnly || saving}
            className="mt-2 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900"
          />
        </label>

        <label className="text-sm text-zinc-700">
          <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">Type of Asset</div>
          <input
            value={form.category}
            onChange={(event) => onFieldChange('category', event.target.value)}
            disabled={readOnly || saving}
            className="mt-2 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900"
          />
        </label>

        <label className="text-sm text-zinc-700">
          <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">Model</div>
          <input
            value={form.model}
            onChange={(event) => onFieldChange('model', event.target.value)}
            disabled={readOnly || saving}
            className="mt-2 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900"
          />
        </label>

        <label className="text-sm text-zinc-700">
          <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">Purchase Date</div>
          <input
            type="date"
            value={form.purchaseDate}
            onChange={(event) => onFieldChange('purchaseDate', event.target.value)}
            disabled={readOnly || saving}
            className="mt-2 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900"
          />
        </label>

        <label className="text-sm text-zinc-700">
          <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">Warranty Until</div>
          <input
            type="date"
            value={form.warrantyUntil}
            onChange={(event) => onFieldChange('warrantyUntil', event.target.value)}
            disabled={readOnly || saving}
            className="mt-2 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900"
          />
        </label>

        <label className="text-sm text-zinc-700">
          <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">Cost</div>
          <input
            value={form.cost}
            inputMode="decimal"
            onChange={(event) => onFieldChange('cost', event.target.value)}
            disabled={readOnly || saving}
            className="mt-2 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900"
            placeholder="82500.00"
          />
        </label>

        <label className="text-sm text-zinc-700 md:col-span-2">
          <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">Notes</div>
          <textarea
            value={form.notes}
            onChange={(event) => onFieldChange('notes', event.target.value)}
            rows={4}
            disabled={readOnly || saving}
            className="mt-2 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900"
            placeholder="Procurement, lifecycle, or vendor notes"
          />
        </label>
      </div>

      {readOnly ? (
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-800">
          This asset is retired. Lifecycle details are read-only until the asset returns to an active lifecycle state.
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onSubmit}
          disabled={saving || readOnly}
          className={`rounded-lg px-4 py-2 text-sm font-semibold transition disabled:opacity-60 ${actionButtonStyles.save}`}
        >
          {saving ? 'Saving...' : 'Save Lifecycle Details'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="rounded-lg border border-zinc-200 bg-white px-4 py-2 text-sm font-bold text-zinc-700 hover:bg-zinc-50 disabled:opacity-60"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}