import { actionButtonStyles } from '../../lib/buttonStyles';

import { useMemo, useState, type ChangeEvent, type FormEvent } from 'react';
import type {
	InventoryEntityOption,
	InventoryModuleAssetInput,
	InventoryModuleMainItem,
	InventoryModuleSubItem,
	InventoryModuleSupplier,
	LookupOption,
} from './types';

interface Props {
	initial?: Partial<InventoryModuleAssetInput>;
	onSave: (item: InventoryModuleAssetInput) => void;
	onCreateMainItem: (name: string) => Promise<InventoryModuleMainItem | null>;
	onCreateSubItem: (payload: { itemId: string; name: string }) => Promise<InventoryModuleSubItem | null>;
	onCancel: () => void;
	saving?: boolean;
	branches: LookupOption[];
	items: InventoryModuleMainItem[];
	subItems: InventoryModuleSubItem[];
	suppliers: InventoryModuleSupplier[];
	entities: InventoryEntityOption[];
	defaultCompanyName?: string;
}

const STATUS_OPTIONS = ['inventory', 'allocated', 'returned', 'retired'];
const ASSET_TYPE_OPTIONS: Array<InventoryModuleAssetInput['assetType']> = ['critical', 'non_critical'];
const inventoryLabelClassName = 'mb-2 block text-xs font-bold uppercase tracking-wider text-zinc-900';
const inventoryInputClassName = 'w-full rounded-xl border border-emerald-100 bg-white px-3 py-3 text-sm text-zinc-950 shadow-sm outline-none transition focus:border-emerald-300 focus:ring-4 focus:ring-emerald-100';
const inventoryMutedTextClassName = 'mt-2 text-xs text-zinc-600';

export default function InventoryItemForm({ initial = {}, onSave, onCreateMainItem, onCreateSubItem, onCancel, saving, branches, items, subItems, suppliers, entities, defaultCompanyName = '' }: Props) {
	const initialSubItem = initial.subItemId ? subItems.find((subItem) => subItem.id === initial.subItemId) : undefined;
	const [mainItemId, setMainItemId] = useState(initialSubItem?.itemId || '');
	const [showMainItemCreator, setShowMainItemCreator] = useState(false);
	const [showSubItemCreator, setShowSubItemCreator] = useState(false);
	const [newMainItemName, setNewMainItemName] = useState('');
	const [newSubItemName, setNewSubItemName] = useState('');
	const [creatingTaxonomy, setCreatingTaxonomy] = useState(false);
	const [taxonomyError, setTaxonomyError] = useState('');
	const [form, setForm] = useState<InventoryModuleAssetInput>({
		subItemId: initial.subItemId || '',
		assetTag: initial.assetTag || '',
		serialNumber: initial.serialNumber || '',
		companyName: initial.companyName || initialSubItem?.companyName || '',
		supplierId: initial.supplierId || '',
		operatingSystem: initial.operatingSystem || '',
		assetType: initial.assetType || 'non_critical',
		locationId: initial.locationId || '',
		branchId: initial.branchId || '',
		branchStocks: initial.branchStocks?.length ? initial.branchStocks : [{ branchId: initial.branchId || '', quantity: 1 }],
		cost: initial.cost || '',
		purchaseDate: initial.purchaseDate || '',
		warrantyExpiresAt: initial.warrantyExpiresAt || '',
		specs: initial.specs || '',
		remarks: initial.remarks || '',
		status: initial.status || 'inventory',
	});

	const availableSubItems = useMemo(() => mainItemId ? subItems.filter((subItem) => subItem.itemId === mainItemId) : [], [mainItemId, subItems]);
	const totalQuantity = useMemo(() => form.branchStocks.reduce((sum, entry) => sum + (Number.isFinite(entry.quantity) ? entry.quantity : 0), 0), [form.branchStocks]);
	const selectedSubItem = useMemo(() => subItems.find((subItem) => subItem.id === form.subItemId), [form.subItemId, subItems]);
	const resolvedCompanyName = form.companyName || selectedSubItem?.companyName || defaultCompanyName;

	function handleChange(e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) {
		const { name, value } = e.target;
		if (name === 'cost') {
			const normalized = value.replace(/[^0-9.]/g, '');
			setForm((current) => ({ ...current, cost: normalized }));
			return;
		}
		setForm((current) => ({ ...current, [name]: value }));
		if (name === 'subItemId') {
			const selected = subItems.find((subItem) => subItem.id === value);
			if (selected) {
				setMainItemId(selected.itemId);
				setForm((current) => ({
					...current,
					subItemId: value,
					companyName: current.companyName || selected.companyName || defaultCompanyName,
					supplierId: selected.supplierId || '',
					operatingSystem: selected.operatingSystem || '',
					assetType: selected.assetType,
					remarks: selected.remarks || current.remarks || '',
				}));
			}
		}
		if (name === 'locationId' && !form.branchId) {
			setForm((current) => ({ ...current, locationId: value, branchId: value }));
		}
	}

	function handleMainItemChange(value: string) {
		setMainItemId(value);
		setForm((current) => ({ ...current, subItemId: '', companyName: current.companyName || defaultCompanyName, supplierId: '', operatingSystem: '', remarks: '' }));
	}

	function handleBranchStockChange(index: number, field: 'branchId' | 'quantity', value: string) {
		const quantity = field === 'quantity'
			? Math.max(0, Number.parseInt(value.replace(/[^0-9]/g, '') || '0', 10))
			: value;
		setForm((current) => ({
			...current,
			branchStocks: current.branchStocks.map((entry, entryIndex) => entryIndex === index ? {
				...entry,
				[field]: field === 'quantity' ? quantity : value,
			} : entry),
		}));
	}

	function addBranchStock() {
		setForm((current) => ({ ...current, branchStocks: [...current.branchStocks, { branchId: '', quantity: 0 }] }));
	}

	function removeBranchStock(index: number) {
		setForm((current) => ({
			...current,
			branchStocks: current.branchStocks.filter((_, entryIndex) => entryIndex !== index),
		}));
	}

	function handleSubmit(e: FormEvent) {
		e.preventDefault();
		onSave({
			...form,
			companyName: resolvedCompanyName,
			branchStocks: form.branchStocks.filter((entry) => entry.branchId && entry.quantity >= 0),
		});
	}

	async function handleCreateMainItem() {
		if (!newMainItemName.trim()) {
			setTaxonomyError('Main item name is required');
			return;
		}
		setCreatingTaxonomy(true);
		setTaxonomyError('');
		const created = await onCreateMainItem(newMainItemName.trim()).catch((error: Error) => {
			setTaxonomyError(error.message || 'Failed to create main item');
			return null;
		});
		setCreatingTaxonomy(false);
		if (!created) {
			return;
		}
		setMainItemId(created.id);
		setForm((current) => ({ ...current, subItemId: '' }));
		setNewMainItemName('');
		setShowMainItemCreator(false);
	}

	async function handleCreateSubItem() {
		if (!mainItemId) {
			setTaxonomyError('Select a main item before adding a sub item');
			return;
		}
		if (!newSubItemName.trim()) {
			setTaxonomyError('Sub item name is required');
			return;
		}
		setCreatingTaxonomy(true);
		setTaxonomyError('');
		const created = await onCreateSubItem({ itemId: mainItemId, name: newSubItemName.trim() }).catch((error: Error) => {
			setTaxonomyError(error.message || 'Failed to create sub item');
			return null;
		});
		setCreatingTaxonomy(false);
		if (!created) {
			return;
		}
		setForm((current) => ({ ...current, subItemId: created.id }));
		setNewSubItemName('');
		setShowSubItemCreator(false);
	}

	return (
		<form onSubmit={handleSubmit} className="space-y-5 rounded-[28px] border border-emerald-100 bg-[linear-gradient(180deg,_#ffffff_0%,_#f4fbf6_100%)] p-5 shadow-sm shadow-emerald-100/60">
			<div className="grid gap-4 md:grid-cols-2">
				<div>
					<div className="mb-2 flex items-center justify-between gap-3">
						<label className="block text-xs font-bold uppercase tracking-wider text-zinc-900">Main Item</label>
						<button type="button" onClick={() => { setShowMainItemCreator((current) => !current); setTaxonomyError(''); }} className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${actionButtonStyles.add}`}>+ Add New</button>
					</div>
					<select value={mainItemId} onChange={(event) => handleMainItemChange(event.target.value)} className={inventoryInputClassName} required>
						<option value="">Select main item</option>
						{items.map((item) => (
							<option key={item.id} value={item.id}>{item.name}</option>
						))}
					</select>
					{showMainItemCreator ? (
						<div className="mt-3 space-y-2 rounded-xl border border-emerald-100 bg-emerald-50/70 p-3">
							<input value={newMainItemName} onChange={(event) => setNewMainItemName(event.target.value)} placeholder="New main item name" className={inventoryInputClassName} />
							<div className="flex gap-2">
								<button type="button" onClick={handleCreateMainItem} disabled={creatingTaxonomy} className={`rounded-lg px-3 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${actionButtonStyles.add}`}>{creatingTaxonomy ? 'Adding...' : 'Add Main Item'}</button>
								<button type="button" onClick={() => setShowMainItemCreator(false)} className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm font-semibold text-zinc-700">Cancel</button>
							</div>
						</div>
					) : null}
				</div>
				<div>
					<div className="mb-2 flex items-center justify-between gap-3">
						<label className="block text-xs font-bold uppercase tracking-wider text-zinc-900">Sub Item / Asset Name</label>
						<button type="button" onClick={() => { setShowSubItemCreator((current) => !current); setTaxonomyError(''); }} className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${actionButtonStyles.add}`}>+ Add New</button>
					</div>
					<select name="subItemId" value={form.subItemId} onChange={handleChange} className={`${inventoryInputClassName} disabled:cursor-not-allowed disabled:bg-emerald-50`} required disabled={!mainItemId}>
						<option value="">Select sub item</option>
						{availableSubItems.map((subItem) => (
							<option key={subItem.id} value={subItem.id}>{subItem.name}</option>
						))}
					</select>
					{!mainItemId ? <div className={inventoryMutedTextClassName}>Select a main item to load matching sub items.</div> : null}
					{showSubItemCreator ? (
						<div className="mt-3 space-y-2 rounded-xl border border-emerald-100 bg-emerald-50/70 p-3">
							<input value={newSubItemName} onChange={(event) => setNewSubItemName(event.target.value)} placeholder="New sub item name" className={inventoryInputClassName} />
							<div className="text-xs text-zinc-600">The item code is auto-generated when you add a sub item from here.</div>
							<div className="flex gap-2">
								<button type="button" onClick={handleCreateSubItem} disabled={creatingTaxonomy} className={`rounded-lg px-3 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${actionButtonStyles.add}`}>{creatingTaxonomy ? 'Adding...' : 'Add Sub Item'}</button>
								<button type="button" onClick={() => setShowSubItemCreator(false)} className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm font-semibold text-zinc-700">Cancel</button>
							</div>
						</div>
					) : null}
				</div>
				<div>
					<label className={inventoryLabelClassName}>Item Code</label>
					<input value={subItems.find((subItem) => subItem.id === form.subItemId)?.itemCode || ''} className="w-full rounded-xl border border-emerald-100 bg-emerald-50/80 px-3 py-3 text-sm font-medium text-zinc-900" readOnly placeholder="Auto from sub item" />
				</div>
				<div>
					<label className={inventoryLabelClassName}>Entity Company</label>
					<select name="companyName" value={form.companyName || ''} onChange={handleChange} className={inventoryInputClassName}>
						<option value="">Select entity company</option>
						{entities.map((entity) => (
							<option key={entity.id} value={entity.full_name}>{entity.full_name}</option>
						))}
					</select>
					<div className={inventoryMutedTextClassName}>Selected company is saved with the inventory item. Current value: {resolvedCompanyName || 'Not selected'}.</div>
				</div>
				<div>
					<label className={inventoryLabelClassName}>Supplier</label>
					<select name="supplierId" value={form.supplierId || ''} onChange={handleChange} className={inventoryInputClassName}>
						<option value="">Select supplier</option>
						{suppliers.map((supplier) => (
							<option key={supplier.id} value={supplier.id}>{supplier.name}</option>
						))}
					</select>
				</div>
				<div>
					<label className={inventoryLabelClassName}>Asset ID / Tag</label>
					<input name="assetTag" value={form.assetTag || ''} onChange={handleChange} className={inventoryInputClassName} placeholder="Optional for bulk stock entry" />
					<div className={inventoryMutedTextClassName}>Leave blank when you are adding stock quantity for multiple similar items.</div>
				</div>
				<div>
					<label className={inventoryLabelClassName}>Serial Number</label>
					<input name="serialNumber" value={form.serialNumber || ''} onChange={handleChange} className={inventoryInputClassName} placeholder="Optional for bulk stock entry" />
					<div className={inventoryMutedTextClassName}>Use this only when you need to track a specific device separately.</div>
				</div>
				<div>
					<label className={inventoryLabelClassName}>Operating System</label>
					<input name="operatingSystem" value={form.operatingSystem || ''} onChange={handleChange} className={inventoryInputClassName} />
				</div>
				<div>
					<label className={inventoryLabelClassName}>Asset Type</label>
					<select name="assetType" value={form.assetType} onChange={handleChange} className={inventoryInputClassName}>
						{ASSET_TYPE_OPTIONS.map((option) => (
							<option key={option} value={option}>{option === 'critical' ? 'Critical' : 'Non-Critical'}</option>
						))}
					</select>
				</div>
				<div>
					<label className={inventoryLabelClassName}>Location</label>
					<select name="locationId" value={form.locationId || ''} onChange={handleChange} className={inventoryInputClassName}>
						<option value="">Select location</option>
						{branches.map((branch) => (
							<option key={branch.id} value={branch.id}>{branch.name}</option>
						))}
					</select>
				</div>
				<div>
					<label className={inventoryLabelClassName}>Cost</label>
					<input name="cost" value={form.cost || ''} onChange={handleChange} className={inventoryInputClassName} type="number" min="0" step="0.01" inputMode="decimal" placeholder="e.g. 45000" />
					<div className={inventoryMutedTextClassName}>Enter the purchase cost as a number.</div>
				</div>
				<div>
					<label className={inventoryLabelClassName}>Purchase Date</label>
					<input name="purchaseDate" value={form.purchaseDate || ''} onChange={handleChange} className={inventoryInputClassName} type="date" />
				</div>
				<div>
					<label className={inventoryLabelClassName}>Warranty Expiry Date</label>
					<input name="warrantyExpiresAt" value={form.warrantyExpiresAt || ''} onChange={handleChange} className={inventoryInputClassName} type="date" />
				</div>
				<div>
					<label className={inventoryLabelClassName}>Status</label>
					<select name="status" value={form.status || 'inventory'} onChange={handleChange} className={inventoryInputClassName}>
						{STATUS_OPTIONS.map((status) => (
							<option key={status} value={status}>{status}</option>
						))}
					</select>
				</div>
			</div>
			{taxonomyError ? <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{taxonomyError}</div> : null}
			<div>
				<div className="mb-2 flex items-center justify-between">
					<label className="block text-xs font-bold uppercase tracking-wider text-zinc-900">Branch Stock</label>
					<div className="flex items-center gap-3">
						<div className="rounded-full border border-emerald-100 bg-white px-3 py-1 text-xs font-semibold text-zinc-900">Total Qty: {totalQuantity}</div>
						<button type="button" onClick={addBranchStock} className="text-sm font-semibold text-emerald-700 hover:text-emerald-800">+ Add Branch Stock</button>
					</div>
				</div>
				<div className="space-y-3 rounded-xl border border-emerald-100 bg-emerald-50/70 p-3">
					{form.branchStocks.map((entry, index) => (
						<div key={`${entry.branchId}-${index}`} className="grid gap-3 md:grid-cols-[1fr_140px_auto]">
							<div>
								<div className="mb-2 text-xs font-bold uppercase tracking-wider text-zinc-900">Branch</div>
								<select value={entry.branchId} onChange={(event) => handleBranchStockChange(index, 'branchId', event.target.value)} className={inventoryInputClassName}>
									<option value="">Select branch</option>
									{branches.map((branch) => (
										<option key={branch.id} value={branch.id}>{branch.name}</option>
									))}
								</select>
							</div>
							<div>
								<div className="mb-2 text-xs font-bold uppercase tracking-wider text-zinc-900">Quantity</div>
								<input type="number" min="0" step="1" inputMode="numeric" value={entry.quantity} onChange={(event) => handleBranchStockChange(index, 'quantity', event.target.value)} className={inventoryInputClassName} placeholder="0" />
							</div>
							<button type="button" onClick={() => removeBranchStock(index)} className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${actionButtonStyles.remove}`}>Remove</button>
						</div>
					))}
				</div>
			</div>
			<div className="grid gap-4 md:grid-cols-2">
				<div>
					<label className={inventoryLabelClassName}>Specs / Remarks</label>
					<textarea name="specs" value={form.specs || ''} onChange={handleChange} className={`min-h-24 ${inventoryInputClassName}`} />
				</div>
				<div>
					<label className={inventoryLabelClassName}>Additional Remarks</label>
					<textarea name="remarks" value={form.remarks || ''} onChange={handleChange} className={`min-h-24 ${inventoryInputClassName}`} />
				</div>
			</div>
			<div className="flex gap-2 pt-2">
				<button type="submit" className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${actionButtonStyles.save}`} disabled={saving}>{saving ? 'Saving...' : 'Save asset'}</button>
				<button type="button" className="rounded-xl border border-zinc-200 bg-white px-4 py-2 text-sm font-semibold text-zinc-700" onClick={onCancel}>Cancel</button>
			</div>
		</form>
	);
}
