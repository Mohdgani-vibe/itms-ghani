import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import {
  ArrowLeftRight,
  Building2,
  ClipboardList,
  KeyRound,
  Mail,
  Package,
  PackageCheck,
  Plus,
  Search,
  ShieldCheck,
  Store,
} from 'lucide-react';
import InventoryDetailDrawer from './InventoryDetailDrawer';
import InventoryItemForm from './InventoryItemForm';
import InventoryImportsPanel from './InventoryImportsPanel';
import ConfirmDialog from '../ConfirmDialog';
import {
  createInventoryBranch,
  createInventoryMainItem,
  createInventoryModuleAsset,
  createInventorySubItem,
  createInventorySupplier,
  deleteInventoryBranch,
  deleteInventoryMainItem,
  deleteInventoryModuleAsset,
  deleteInventorySubItem,
  deleteInventorySupplier,
  downloadInventoryModuleTemplate,
  exportInventoryModuleCsv,
  fetchInventoryEntities,
  fetchInventoryMainItems,
  fetchInventoryModuleAssets,
  fetchInventoryModuleAudit,
  fetchInventoryModuleBranches,
  fetchInventoryModuleOptions,
  fetchInventorySubItems,
  fetchInventorySuppliers,
  importInventoryModuleCsv,
  runInventoryStockOperation,
  updateInventoryBranch,
  updateInventoryMainItem,
  updateInventoryModuleAsset,
  updateInventorySubItem,
  updateInventorySupplier,
} from '../../lib/inventoryApi';
import type {
  InventoryModuleAsset,
  InventoryModuleAssetInput,
  InventoryModuleAuditListResponse,
  InventoryModuleBranch,
  InventoryEntityOption,
  InventoryModuleEmployee,
  InventoryModuleMainItem,
  InventoryModuleSubItem,
  InventoryModuleSummary,
  InventoryModuleSupplier,
  LookupOption,
} from './types';

type InventoryTab = 'assets' | 'catalog' | 'branches' | 'suppliers' | 'audit';
type EditorMode = 'add' | 'edit';
type DeleteTarget =
  | { kind: 'asset'; id: string; label: string }
  | { kind: 'item'; id: string; label: string }
  | { kind: 'subItem'; id: string; label: string }
  | { kind: 'supplier'; id: string; label: string }
  | { kind: 'branch'; id: string; label: string }
  | null;

interface StockOperationDraft {
  operation: 'add' | 'reduce' | 'transfer';
  subItemId: string;
  branchId: string;
  fromBranchId: string;
  toBranchId: string;
  quantity: number;
  note: string;
}

interface SupplierDraft {
  id?: string;
  name: string;
  contactInfo: string;
}

interface BranchDraft {
  id?: string;
  name: string;
  location: string;
  locationCode: string;
  isActive: boolean;
}

interface MainItemDraft {
  id?: string;
  name: string;
}

interface SubItemDraft {
  id?: string;
  itemId: string;
  name: string;
  itemCode: string;
  companyName: string;
  supplierId: string;
  operatingSystem: string;
  assetType: 'critical' | 'non_critical';
  remarks: string;
}

interface AssignmentDraft {
  assetId: string;
  label: string;
  assignedUserId: string;
}

function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function formatDate(value?: string | null) {
  if (!value) {
    return 'Not set';
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return parsed.toLocaleDateString();
}

function formatCurrency(value?: string | null) {
  if (!value) {
    return 'Not set';
  }
  const numericValue = Number(value);
  if (Number.isNaN(numericValue)) {
    return 'Not set';
  }
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(numericValue);
}

function getBranchLabel(branch: InventoryModuleBranch) {
  return branch.full_name || branch.location_code || 'Unnamed branch';
}

function findAutoAssignedEmployee(query: string, employees: InventoryModuleEmployee[], filteredEmployees: InventoryModuleEmployee[]) {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) {
    return null;
  }
  const exactMatch = employees.find((employee) => [employee.name, employee.email || '', employee.empId || ''].some((value) => value.trim().toLowerCase() === normalizedQuery));
  if (exactMatch) {
    return exactMatch;
  }
  if (filteredEmployees.length === 1) {
    return filteredEmployees[0];
  }
  return null;
}

function compactEntityName(name: string) {
  return name
    .replace(/\s+Broking Limited$/i, '')
    .replace(/\s+Commodities$/i, '')
    .replace(/\s+Capital$/i, '')
    .replace(/\s+Technology$/i, '')
    .trim();
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

function formatHeroBranchLabel(branch: LookupOption, branchRecord?: InventoryModuleBranch, entityName?: string) {
  const compactEntity = compactEntityName(entityName || branchRecord?.entity_code || branch.name);
  const locationCode = branchRecord?.location_code || '';

  if (/-HO$/i.test(locationCode) || /head office/i.test(branch.name)) {
    return `${compactEntity} HO`;
  }

  if (branchRecord?.city?.trim()) {
    return `${compactEntity} ${branchRecord.city.trim()}`;
  }

  return branch.name
    .replace(/^ZBL\s+/i, 'Zerodha ')
    .replace(/\s+Support Office/i, '')
    .replace(/\s+Head Office/i, ' HO')
    .replace(/\s+,\s+/g, ' ')
    .trim();
}

export default function InventoryPage() {
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const [activeTab, setActiveTab] = useState<InventoryTab>('assets');
  const [assets, setAssets] = useState<InventoryModuleAsset[]>([]);
  const [summary, setSummary] = useState<InventoryModuleSummary>({ assets: 0, mainItems: 0, subItems: 0, branches: 0, suppliers: 0 });
  const [items, setItems] = useState<InventoryModuleMainItem[]>([]);
  const [subItems, setSubItems] = useState<InventoryModuleSubItem[]>([]);
  const [suppliers, setSuppliers] = useState<InventoryModuleSupplier[]>([]);
  const [branches, setBranches] = useState<LookupOption[]>([]);
  const [entities, setEntities] = useState<InventoryEntityOption[]>([]);
  const [defaultCompanyName, setDefaultCompanyName] = useState('');
  const [branchRecords, setBranchRecords] = useState<InventoryModuleBranch[]>([]);
  const [employees, setEmployees] = useState<InventoryModuleEmployee[]>([]);
  const [audit, setAudit] = useState<InventoryModuleAuditListResponse['items']>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [mainItemFilter, setMainItemFilter] = useState('all');
  const [subItemFilter, setSubItemFilter] = useState('all');
  const [branchFilter, setBranchFilter] = useState('all');
  const [assetTypeFilter, setAssetTypeFilter] = useState('all');
  const [csvActionLoading, setCsvActionLoading] = useState<'' | 'template' | 'export'>('');
  const [importingInventory, setImportingInventory] = useState(false);
  const [selectedItem, setSelectedItem] = useState<InventoryModuleAsset | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorMode, setEditorMode] = useState<EditorMode>('add');
  const [editingItem, setEditingItem] = useState<InventoryModuleAsset | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [stockDialogOpen, setStockDialogOpen] = useState(false);
  const [stockDraft, setStockDraft] = useState<StockOperationDraft>({ operation: 'add', subItemId: '', branchId: '', fromBranchId: '', toBranchId: '', quantity: 1, note: '' });
  const [mainItemDraft, setMainItemDraft] = useState<MainItemDraft>({ name: '' });
  const [subItemDraft, setSubItemDraft] = useState<SubItemDraft>({ itemId: '', name: '', itemCode: '', companyName: '', supplierId: '', operatingSystem: '', assetType: 'non_critical', remarks: '' });
  const [supplierDraft, setSupplierDraft] = useState<SupplierDraft>({ name: '', contactInfo: '' });
  const [branchDraft, setBranchDraft] = useState<BranchDraft>({ name: '', location: '', locationCode: '', isActive: true });
  const [assignmentDraft, setAssignmentDraft] = useState<AssignmentDraft | null>(null);
  const [assignmentSearchQuery, setAssignmentSearchQuery] = useState('');

  async function loadCatalogData() {
    const [options, mainItemRecords, subItemRecords, supplierRecords, branchList, entityList] = await Promise.all([
      fetchInventoryModuleOptions(),
      fetchInventoryMainItems(),
      fetchInventorySubItems(),
      fetchInventorySuppliers(),
      fetchInventoryModuleBranches(),
      fetchInventoryEntities(),
    ]);
    setItems(mainItemRecords.length ? mainItemRecords : options.items);
    setSubItems(subItemRecords.length ? subItemRecords : options.subItems);
    setSuppliers(supplierRecords.length ? supplierRecords : options.suppliers);
    setBranches(options.branches);
    setEntities(Array.isArray(entityList) ? entityList.filter((entity) => entity.is_active !== false) : []);
    setDefaultCompanyName(options.defaultCompanyName || '');
    setEmployees(options.employees);
    setBranchRecords(branchList);
  }

  async function loadAssetsData() {
    const response = await fetchInventoryModuleAssets({
      search: searchQuery,
      mainItemId: mainItemFilter === 'all' ? undefined : mainItemFilter,
      subItemId: subItemFilter === 'all' ? undefined : subItemFilter,
      branchId: branchFilter === 'all' ? undefined : branchFilter,
      assetType: assetTypeFilter === 'all' ? undefined : assetTypeFilter,
      page: 1,
    });
    setAssets(response.items);
    setSummary(response.summary);
  }

  async function loadAuditData() {
    const response = await fetchInventoryModuleAudit('inventory');
    setAudit(response.items);
  }

  async function refreshAll() {
    setLoading(true);
    setError('');
    try {
      await Promise.all([loadCatalogData(), loadAssetsData(), loadAuditData()]);
    } catch (loadError: unknown) {
      setError(getErrorMessage(loadError, 'Failed to load inventory module'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refreshAll();
  }, []);

  useEffect(() => {
    void loadAssetsData().catch((loadError: unknown) => {
      setError(getErrorMessage(loadError, 'Failed to load inventory assets'));
    });
  }, [searchQuery, mainItemFilter, subItemFilter, branchFilter, assetTypeFilter]);

  const branchSummary = useMemo(() => {
    return branches.map((branch) => ({
      ...branch,
      shortName: formatHeroBranchLabel(
        branch,
        branchRecords.find((record) => record.id === branch.id),
        entities.find((entity) => entity.id === branchRecords.find((record) => record.id === branch.id)?.entity_id)?.full_name,
      ),
      count: assets.reduce((total, asset) => {
        const branchStock = asset.stockByBranch.find((entry) => entry.branchId === branch.id);
        return total + (branchStock?.quantity || 0);
      }, 0),
    }));
  }, [assets, branches, branchRecords, entities]);

  const entitySummary = useMemo(() => {
    return entities
      .map((entity) => ({
        ...entity,
        count: assets.reduce((total, asset) => {
          if ((asset.companyName || '').trim().toLowerCase() !== entity.full_name.trim().toLowerCase()) {
            return total;
          }
          return total + asset.stockTotal;
        }, 0),
      }))
      .filter((entity) => entity.count > 0);
  }, [assets, entities]);

  const totalBranchStock = useMemo(() => assets.reduce((total, asset) => total + asset.stockTotal, 0), [assets]);

  const filteredSubItems = useMemo(() => {
    return mainItemFilter === 'all' ? subItems : subItems.filter((subItem) => subItem.itemId === mainItemFilter);
  }, [mainItemFilter, subItems]);

  const assignableEmployees = useMemo(() => {
    const query = assignmentSearchQuery.trim().toLowerCase();
    if (!query) {
      return employees.slice(0, 50);
    }
    return employees.filter((employee) => [employee.name, employee.email || '', employee.empId || '', employee.branchName || ''].some((value) => value.toLowerCase().includes(query))).slice(0, 50);
  }, [assignmentSearchQuery, employees]);
  const selectedAssignmentEmployee = useMemo(() => employees.find((employee) => employee.id === assignmentDraft?.assignedUserId), [assignmentDraft?.assignedUserId, employees]);

  useEffect(() => {
    if (!assignmentDraft) {
      return;
    }
    const matchedEmployee = findAutoAssignedEmployee(assignmentSearchQuery, employees, assignableEmployees);
    if (!matchedEmployee || matchedEmployee.id === assignmentDraft.assignedUserId) {
      return;
    }
    setAssignmentDraft((current) => current ? { ...current, assignedUserId: matchedEmployee.id } : current);
  }, [assignmentDraft, assignmentSearchQuery, assignableEmployees, employees]);

  function resetMessages() {
    setError('');
    setSuccessMessage('');
  }

  function openAddDialog() {
    setEditingItem(null);
    setEditorMode('add');
    setEditorOpen(true);
  }

  function openEditDialog(item: InventoryModuleAsset) {
    setEditingItem(item);
    setEditorMode('edit');
    setEditorOpen(true);
  }

  function openAssignDialog(item: InventoryModuleAsset) {
    setAssignmentDraft({ assetId: item.id, label: item.subItem, assignedUserId: item.assignedUserId || '' });
    setAssignmentSearchQuery(item.assignedUserEmail || item.assignedUserName || '');
  }

  function closeEditor() {
    setEditorOpen(false);
    setEditingItem(null);
  }

  function mapAssetToInput(item: InventoryModuleAsset): InventoryModuleAssetInput {
    return {
      subItemId: item.subItemId || '',
      assetTag: item.assetTag || '',
      serialNumber: item.serialNumber || '',
      companyName: item.companyName || '',
      supplierId: item.supplierId || '',
      operatingSystem: item.operatingSystem || '',
      assetType: item.assetType,
      assignedUserId: item.assignedUserId || '',
      locationId: item.locationId || '',
      branchId: item.branchId || '',
      branchStocks: item.stockByBranch.map((entry) => ({ branchId: entry.branchId, quantity: entry.quantity })),
      cost: item.cost || '',
      purchaseDate: item.purchaseDate || '',
      warrantyExpiresAt: item.warrantyExpiresAt || '',
      specs: item.specs || '',
      remarks: item.remarks || '',
      status: item.status,
    };
  }

  async function handleAssetSave(payload: InventoryModuleAssetInput) {
    resetMessages();
    setSaving(true);
    try {
      if (editorMode === 'add') {
        await createInventoryModuleAsset(payload);
        setSuccessMessage('Inventory item created.');
      } else if (editingItem) {
        await updateInventoryModuleAsset(editingItem.id, payload);
        setSuccessMessage('Inventory item updated.');
      }
      await Promise.all([loadAssetsData(), loadCatalogData(), loadAuditData()]);
      closeEditor();
      setSelectedItem(null);
    } catch (saveError: unknown) {
      setError(getErrorMessage(saveError, 'Failed to save inventory item'));
    } finally {
      setSaving(false);
    }
  }

  async function handleAssignmentSave() {
    if (!assignmentDraft) {
      return;
    }
    const asset = assets.find((entry) => entry.id === assignmentDraft.assetId) || selectedItem;
    if (!asset) {
      setError('Failed to resolve asset for reassignment');
      return;
    }
    resetMessages();
    setSaving(true);
    try {
      await updateInventoryModuleAsset(asset.id, {
        ...mapAssetToInput(asset),
        assignedUserId: assignmentDraft.assignedUserId,
      });
      setSuccessMessage(assignmentDraft.assignedUserId ? 'Asset reassigned successfully.' : 'Asset unassigned successfully.');
      setAssignmentDraft(null);
      await Promise.all([loadAssetsData(), loadCatalogData(), loadAuditData()]);
    } catch (assignError: unknown) {
      setError(getErrorMessage(assignError, 'Failed to update asset assignment'));
    } finally {
      setSaving(false);
    }
  }

  async function handleDownloadTemplate() {
    setCsvActionLoading('template');
    resetMessages();
    try {
      const blob = await downloadInventoryModuleTemplate();
      downloadBlob('inventory-module-template.csv', blob);
    } catch (downloadError: unknown) {
      setError(getErrorMessage(downloadError, 'Failed to download template'));
    } finally {
      setCsvActionLoading('');
    }
  }

  async function handleExportCsv() {
    setCsvActionLoading('export');
    resetMessages();
    try {
      const blob = await exportInventoryModuleCsv();
      downloadBlob('inventory-module-export.csv', blob);
    } catch (downloadError: unknown) {
      setError(getErrorMessage(downloadError, 'Failed to export inventory'));
    } finally {
      setCsvActionLoading('');
    }
  }

  async function handleImportCsv(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    setImportingInventory(true);
    resetMessages();
    try {
      const result = await importInventoryModuleCsv(file);
      if (result.errors.length) {
        setError(result.errors.map((entry) => `Row ${entry.row}: ${entry.message}`).join(' | '));
      } else {
        setSuccessMessage(`CSV import successful. Created ${result.created} assets.`);
      }
      await Promise.all([loadAssetsData(), loadCatalogData(), loadAuditData()]);
    } catch (uploadError: unknown) {
      setError(getErrorMessage(uploadError, 'Failed to import inventory CSV'));
    } finally {
      setImportingInventory(false);
      event.target.value = '';
    }
  }

  async function handleDeleteConfirm() {
    if (!deleteTarget) {
      return;
    }
    setDeleteBusy(true);
    resetMessages();
    try {
      if (deleteTarget.kind === 'asset') {
        await deleteInventoryModuleAsset(deleteTarget.id);
      }
      if (deleteTarget.kind === 'item') {
        await deleteInventoryMainItem(deleteTarget.id);
      }
      if (deleteTarget.kind === 'subItem') {
        await deleteInventorySubItem(deleteTarget.id);
      }
      if (deleteTarget.kind === 'supplier') {
        await deleteInventorySupplier(deleteTarget.id);
      }
      if (deleteTarget.kind === 'branch') {
        await deleteInventoryBranch(deleteTarget.id);
      }
      setSuccessMessage(`${deleteTarget.label} deleted.`);
      setDeleteTarget(null);
      setSelectedItem(null);
      await Promise.all([loadAssetsData(), loadCatalogData(), loadAuditData()]);
    } catch (deleteError: unknown) {
      setError(getErrorMessage(deleteError, 'Failed to delete record'));
    } finally {
      setDeleteBusy(false);
    }
  }

  async function handleStockOperationSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    resetMessages();
    try {
      await runInventoryStockOperation({
        operation: stockDraft.operation,
        subItemId: stockDraft.subItemId,
        branchId: stockDraft.operation === 'transfer' ? undefined : stockDraft.branchId,
        fromBranchId: stockDraft.operation === 'transfer' ? stockDraft.fromBranchId : undefined,
        toBranchId: stockDraft.operation === 'transfer' ? stockDraft.toBranchId : undefined,
        quantity: Number(stockDraft.quantity),
        note: stockDraft.note,
      });
      setSuccessMessage('Stock updated successfully.');
      setStockDialogOpen(false);
      setStockDraft({ operation: 'add', subItemId: '', branchId: '', fromBranchId: '', toBranchId: '', quantity: 1, note: '' });
      await Promise.all([loadAssetsData(), loadAuditData()]);
    } catch (stockError: unknown) {
      setError(getErrorMessage(stockError, 'Failed to update stock'));
    } finally {
      setSaving(false);
    }
  }

  async function handleMainItemSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    resetMessages();
    try {
      if (mainItemDraft.id) {
        await updateInventoryMainItem(mainItemDraft.id, mainItemDraft.name);
        setSuccessMessage('Main item updated.');
      } else {
        await createInventoryMainItem(mainItemDraft.name);
        setSuccessMessage('Main item created.');
      }
      setMainItemDraft({ name: '' });
      await Promise.all([loadCatalogData(), loadAssetsData()]);
    } catch (submitError: unknown) {
      setError(getErrorMessage(submitError, 'Failed to save main item'));
    } finally {
      setSaving(false);
    }
  }

  async function handleCreateMainItemOption(name: string) {
    resetMessages();
    const created = await createInventoryMainItem(name);
    const refreshedItems = await fetchInventoryMainItems();
    setItems(refreshedItems);
    setSummary((current) => ({ ...current, mainItems: refreshedItems.length }));
    setSuccessMessage('Main item created.');
    return refreshedItems.find((item) => item.id === created.id) || refreshedItems.find((item) => item.name.toLowerCase() === name.trim().toLowerCase()) || null;
  }

  async function handleCreateSubItemOption(payload: { itemId: string; name: string }) {
    resetMessages();
    const created = await createInventorySubItem({
      itemId: payload.itemId,
      name: payload.name,
      itemCode: '',
      companyName: '',
      supplierId: '',
      operatingSystem: '',
      assetType: 'non_critical',
      remarks: '',
    });
    const refreshedSubItems = await fetchInventorySubItems();
    setSubItems(refreshedSubItems);
    setSummary((current) => ({ ...current, subItems: refreshedSubItems.length }));
    setSuccessMessage('Sub item created.');
    return refreshedSubItems.find((subItem) => subItem.id === created.id) || refreshedSubItems.find((subItem) => subItem.itemId === payload.itemId && subItem.name.toLowerCase() === payload.name.trim().toLowerCase()) || null;
  }

  async function handleSubItemSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    resetMessages();
    try {
      const payload = {
        itemId: subItemDraft.itemId,
        name: subItemDraft.name,
        itemCode: subItemDraft.itemCode,
        companyName: subItemDraft.companyName,
        supplierId: subItemDraft.supplierId || undefined,
        operatingSystem: subItemDraft.operatingSystem,
        assetType: subItemDraft.assetType,
        remarks: subItemDraft.remarks,
      };
      if (subItemDraft.id) {
        await updateInventorySubItem(subItemDraft.id, payload);
        setSuccessMessage('Sub item updated.');
      } else {
        await createInventorySubItem(payload);
        setSuccessMessage('Sub item created.');
      }
      setSubItemDraft({ itemId: '', name: '', itemCode: '', companyName: '', supplierId: '', operatingSystem: '', assetType: 'non_critical', remarks: '' });
      await Promise.all([loadCatalogData(), loadAssetsData()]);
    } catch (submitError: unknown) {
      setError(getErrorMessage(submitError, 'Failed to save sub item'));
    } finally {
      setSaving(false);
    }
  }

  async function handleSupplierSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    resetMessages();
    try {
      if (supplierDraft.id) {
        await updateInventorySupplier(supplierDraft.id, supplierDraft.name, supplierDraft.contactInfo);
        setSuccessMessage('Supplier updated.');
      } else {
        await createInventorySupplier(supplierDraft.name, supplierDraft.contactInfo);
        setSuccessMessage('Supplier created.');
      }
      setSupplierDraft({ name: '', contactInfo: '' });
      await loadCatalogData();
    } catch (submitError: unknown) {
      setError(getErrorMessage(submitError, 'Failed to save supplier'));
    } finally {
      setSaving(false);
    }
  }

  async function handleBranchSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    resetMessages();
    try {
      if (branchDraft.id) {
        await updateInventoryBranch(branchDraft.id, {
          name: branchDraft.name,
          location: branchDraft.location,
          locationCode: branchDraft.locationCode,
          isActive: branchDraft.isActive,
        });
        setSuccessMessage('Branch updated.');
      } else {
        await createInventoryBranch({
          name: branchDraft.name,
          location: branchDraft.location,
          locationCode: branchDraft.locationCode,
        });
        setSuccessMessage('Branch created.');
      }
      setBranchDraft({ name: '', location: '', locationCode: '', isActive: true });
      await Promise.all([loadCatalogData(), loadAssetsData()]);
    } catch (submitError: unknown) {
      setError(getErrorMessage(submitError, 'Failed to save branch'));
    } finally {
      setSaving(false);
    }
  }

  const tabs: Array<{ key: InventoryTab; label: string; icon: typeof Package }> = [
    { key: 'assets', label: 'Assets', icon: PackageCheck },
    { key: 'catalog', label: 'Catalog', icon: ClipboardList },
    { key: 'branches', label: 'Branches', icon: Store },
    { key: 'suppliers', label: 'Suppliers', icon: Building2 },
    { key: 'audit', label: 'Audit', icon: ShieldCheck },
  ];

  return (
    <div className="space-y-6 pb-10">
      <section className="overflow-hidden rounded-[28px] border border-sky-100 bg-white text-sky-950 shadow-sm shadow-sky-100/70">
        <div className="bg-[radial-gradient(circle_at_top_right,_rgba(125,211,252,0.22),_transparent_32%),radial-gradient(circle_at_left,_rgba(224,242,254,0.9),_transparent_28%),linear-gradient(135deg,_#f4fbff_0%,_#ffffff_58%,_#e0f2fe_100%)] p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="text-xs font-bold uppercase tracking-[0.24em] text-sky-700">Inventory Management</div>
            <h1 className="mt-2 text-3xl font-bold text-sky-950">Inventory and asset control by branch</h1>
            <p className="mt-2 max-w-3xl text-sm text-sky-800">Manage assets, stock movement, catalog definitions, suppliers, branches, imports, audit history, and direct user assignment from one workspace.</p>
            <div className="mt-4 inline-flex items-center rounded-full border border-sky-200 bg-sky-50 px-3 py-1.5 text-xs font-semibold text-sky-700">
              <Mail className="mr-2 h-3.5 w-3.5" />
              New assets can be assigned to a user by employee email, name, or employee ID.
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <div className="rounded-2xl border border-sky-100 bg-white/90 p-4 backdrop-blur-sm">
              <div className="text-xs font-semibold uppercase tracking-wide text-sky-700">Assets</div>
              <div className="mt-2 text-2xl font-bold text-sky-950">{summary.assets}</div>
            </div>
            <div className="rounded-2xl border border-sky-100 bg-white/90 p-4 backdrop-blur-sm">
              <div className="text-xs font-semibold uppercase tracking-wide text-sky-700">Entities</div>
              <div className="mt-3 space-y-2">
                {entitySummary.length ? (
                  entitySummary.map((entity) => (
                    <div key={entity.id} className="flex items-center justify-between gap-3 text-sm text-sky-900">
                      <span className="truncate font-semibold" title={entity.full_name}>{entity.full_name}</span>
                      <span className="shrink-0 text-lg font-bold text-sky-950">{entity.count}</span>
                    </div>
                  ))
                ) : (
                  <div className="text-sm text-sky-700">No entity stock available</div>
                )}
              </div>
            </div>
            <div className="rounded-2xl border border-sky-100 bg-white/90 p-4 backdrop-blur-sm">
              <div className="text-xs font-semibold uppercase tracking-wide text-sky-700">Branch Stock</div>
              <div className="mt-3 space-y-2">
                {branchSummary.length ? (
                  branchSummary.map((branch) => (
                    <div key={branch.id} className="flex items-center justify-between gap-3 text-sm text-sky-900">
                      <span className="truncate font-semibold" title={branch.name}>{branch.shortName}</span>
                      <span className="shrink-0 text-lg font-bold text-sky-950">{branch.count}</span>
                    </div>
                  ))
                ) : (
                  <div className="text-sm text-sky-700">No branches configured</div>
                )}
              </div>
            </div>
          </div>
        </div>
        </div>
      </section>

      <InventoryImportsPanel
        csvActionLoading={csvActionLoading}
        importingInventory={importingInventory}
        onDownloadTemplate={handleDownloadTemplate}
        onExportInventory={handleExportCsv}
        onOpenImportPicker={() => importInputRef.current?.click()}
        onAddInventory={openAddDialog}
        onOpenStockUpdate={() => {
          setStockDraft((current) => ({ ...current, operation: 'add' }));
          setStockDialogOpen(true);
        }}
        onOpenStockTransfer={() => {
          setStockDraft((current) => ({ ...current, operation: 'transfer' }));
          setStockDialogOpen(true);
        }}
      />
      <input ref={importInputRef} type="file" accept=".csv" className="hidden" onChange={handleImportCsv} />

      {error ? <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
      {successMessage ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{successMessage}</div> : null}

      <div className="flex flex-wrap gap-2 rounded-2xl border border-emerald-100 bg-white p-2 shadow-sm shadow-emerald-100/50">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`inline-flex items-center rounded-full px-4 py-2 text-sm font-semibold transition ${activeTab === tab.key ? 'bg-emerald-100 text-emerald-900 shadow-sm' : 'bg-white text-emerald-700 hover:bg-emerald-50'}`}
            >
              <Icon className="mr-2 h-4 w-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {activeTab === 'assets' ? (
        <div className="grid gap-6 xl:grid-cols-[280px_minmax(0,1fr)]">
          <aside className="space-y-4">
            <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
              <div className="text-xs font-bold uppercase tracking-wide text-zinc-500">Branch stock</div>
              <div className="mt-4 space-y-2">
                <button
                  type="button"
                  onClick={() => setBranchFilter('all')}
                  className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-sm transition ${branchFilter === 'all' ? 'bg-emerald-100 text-emerald-900 shadow-sm' : 'bg-white text-emerald-700 hover:bg-emerald-50'}`}
                >
                  <span>All branches</span>
                  <span>{totalBranchStock}</span>
                </button>
                {branchSummary.map((branch) => (
                  <button
                    key={branch.id}
                    type="button"
                    onClick={() => setBranchFilter(branch.id)}
                    className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-sm transition ${branchFilter === branch.id ? 'bg-emerald-100 text-emerald-900 shadow-sm' : 'bg-white text-emerald-700 hover:bg-emerald-50'}`}
                  >
                    <span>{branch.name}</span>
                    <span>{branch.count}</span>
                  </button>
                ))}
              </div>
            </div>
          </aside>

          <section className="space-y-4">
            <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
              <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_repeat(3,minmax(0,1fr))]">
                <label className="relative block">
                  <Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-zinc-400" />
                  <input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Search asset tag, serial, item, branch" className="w-full rounded-xl border border-zinc-200 bg-white py-3 pl-9 pr-3 text-sm text-zinc-900 outline-none ring-0 placeholder:text-zinc-400 focus:border-zinc-400" />
                </label>
                <select value={mainItemFilter} onChange={(event) => { setMainItemFilter(event.target.value); setSubItemFilter('all'); }} className="rounded-xl border border-zinc-200 bg-white px-3 py-3 text-sm text-zinc-700">
                  <option value="all">All main items</option>
                  {items.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                </select>
                <select value={subItemFilter} onChange={(event) => setSubItemFilter(event.target.value)} className="rounded-xl border border-zinc-200 bg-white px-3 py-3 text-sm text-zinc-700">
                  <option value="all">All sub items</option>
                  {filteredSubItems.map((subItem) => <option key={subItem.id} value={subItem.id}>{subItem.name}</option>)}
                </select>
                <select value={assetTypeFilter} onChange={(event) => setAssetTypeFilter(event.target.value)} className="rounded-xl border border-zinc-200 bg-white px-3 py-3 text-sm text-zinc-700">
                  <option value="all">All asset types</option>
                  <option value="critical">Critical</option>
                  <option value="non_critical">Non-Critical</option>
                </select>
              </div>
            </div>

            <div className="rounded-2xl border border-zinc-200 bg-white shadow-sm">
              <div className="flex items-center justify-between border-b border-zinc-200 px-5 py-4">
                <div>
                  <div className="text-lg font-bold text-zinc-950">Asset register</div>
                  <div className="text-sm text-zinc-500">Tracked assets, branch stock, assignment and purchase details.</div>
                </div>
                {loading ? <div className="text-sm text-zinc-500">Loading...</div> : null}
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-zinc-200 text-sm">
                  <thead className="bg-zinc-50 text-left text-xs uppercase tracking-wide text-zinc-500">
                    <tr>
                      <th className="px-5 py-3">Asset</th>
                      <th className="px-5 py-3">Item Code</th>
                      <th className="px-5 py-3">Branch</th>
                      <th className="px-5 py-3">Employee</th>
                      <th className="px-5 py-3">Stock</th>
                      <th className="px-5 py-3">Cost</th>
                      <th className="px-5 py-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {assets.map((asset) => (
                      <tr key={asset.id} className="hover:bg-zinc-50/80">
                        <td className="px-5 py-4">
                          <button type="button" onClick={() => setSelectedItem(asset)} className="text-left">
                            <div className="font-semibold text-zinc-950">{asset.subItem}</div>
                            <div className="text-xs text-zinc-500">{asset.assetTag || 'No tag'} · {asset.serialNumber || 'No serial'}</div>
                          </button>
                        </td>
                        <td className="px-5 py-4 text-zinc-600">{asset.itemCode}</td>
                        <td className="px-5 py-4 text-zinc-600">{asset.branchName || 'Unassigned'}</td>
                        <td className="px-5 py-4 text-zinc-600">
                          <div>{asset.assignedUserName || 'Unassigned'}</div>
                          <div className="text-xs text-zinc-500">{asset.assignedUserEmail || 'No email assigned'}</div>
                        </td>
                        <td className="px-5 py-4">
                          <div className="font-semibold text-zinc-950">{asset.stockTotal}</div>
                          <div className="text-xs text-zinc-500">{asset.stockByBranch.map((entry) => `${entry.branchName}: ${entry.quantity}`).join(', ') || 'No stock'}</div>
                        </td>
                        <td className="px-5 py-4 text-zinc-600">{formatCurrency(asset.cost)}</td>
                        <td className="px-5 py-4">
                          <div className="flex flex-wrap gap-2">
                            <button type="button" onClick={() => openAssignDialog(asset)} className="rounded-lg border border-blue-200 px-3 py-1.5 font-semibold text-blue-700 hover:bg-blue-50">{asset.assignedUserId ? 'Reassign' : 'Assign'}</button>
                            <button type="button" onClick={() => openEditDialog(asset)} className="rounded-lg border border-blue-200 px-3 py-1.5 font-semibold text-blue-700 hover:bg-blue-50">Edit</button>
                            <button type="button" onClick={() => setDeleteTarget({ kind: 'asset', id: asset.id, label: asset.subItem })} className="rounded-lg border border-red-200 px-3 py-1.5 font-semibold text-red-600 hover:bg-red-50">Delete</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {!loading && assets.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-5 py-10 text-center text-sm text-zinc-500">No assets found for the current filters.</td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        </div>
      ) : null}

      {activeTab === 'catalog' ? (
        <div className="grid gap-6 xl:grid-cols-2">
          <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <div className="text-lg font-bold text-zinc-950">Main items</div>
                <div className="text-sm text-zinc-500">Top-level categories for branch stock planning.</div>
              </div>
              <button type="button" onClick={() => setMainItemDraft({ name: '' })} className="inline-flex items-center rounded-lg border border-blue-200 px-3 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-50"><Plus className="mr-2 h-4 w-4" />New</button>
            </div>
            <form className="space-y-3" onSubmit={handleMainItemSubmit}>
              <input value={mainItemDraft.name} onChange={(event) => setMainItemDraft({ ...mainItemDraft, name: event.target.value })} placeholder="Main item name" className="w-full rounded-xl border border-zinc-200 px-3 py-3 text-sm" required />
              <div className="flex gap-2">
                <button type="submit" className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">{mainItemDraft.id ? 'Update item' : 'Create item'}</button>
                {mainItemDraft.id ? <button type="button" onClick={() => setMainItemDraft({ name: '' })} className="rounded-lg border border-zinc-200 px-4 py-2 text-sm font-semibold text-zinc-700">Cancel edit</button> : null}
              </div>
            </form>
            <div className="mt-4 space-y-2">
              {items.map((item) => (
                <div key={item.id} className="flex items-center justify-between rounded-xl border border-zinc-200 px-4 py-3">
                  <div>
                    <div className="font-semibold text-zinc-900">{item.name}</div>
                    <div className="text-xs text-zinc-500">{subItems.filter((subItem) => subItem.itemId === item.id).length} sub items</div>
                  </div>
                  <div className="flex gap-2">
                      <button type="button" onClick={() => setMainItemDraft({ id: item.id, name: item.name })} className="rounded-lg border border-blue-200 px-3 py-1.5 text-sm font-semibold text-blue-700 hover:bg-blue-50">Edit</button>
                    <button type="button" onClick={() => setDeleteTarget({ kind: 'item', id: item.id, label: item.name })} className="rounded-lg border border-red-200 px-3 py-1.5 text-sm font-semibold text-red-600">Delete</button>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <div className="text-lg font-bold text-zinc-950">Sub items</div>
                <div className="text-sm text-zinc-500">Asset templates with item code, supplier, OS, and classification.</div>
              </div>
              <button type="button" onClick={() => setSubItemDraft({ itemId: '', name: '', itemCode: '', companyName: '', supplierId: '', operatingSystem: '', assetType: 'non_critical', remarks: '' })} className="inline-flex items-center rounded-lg border border-blue-200 px-3 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-50"><Plus className="mr-2 h-4 w-4" />New</button>
            </div>
            <form className="grid gap-3 md:grid-cols-2" onSubmit={handleSubItemSubmit}>
              <select value={subItemDraft.itemId} onChange={(event) => setSubItemDraft({ ...subItemDraft, itemId: event.target.value })} className="rounded-xl border border-zinc-200 px-3 py-3 text-sm" required>
                <option value="">Select main item</option>
                {items.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
              <input value={subItemDraft.name} onChange={(event) => setSubItemDraft({ ...subItemDraft, name: event.target.value })} placeholder="Sub item name" className="rounded-xl border border-zinc-200 px-3 py-3 text-sm" required />
              <input value={subItemDraft.itemCode} onChange={(event) => setSubItemDraft({ ...subItemDraft, itemCode: event.target.value })} placeholder="Item code" className="rounded-xl border border-zinc-200 px-3 py-3 text-sm" required />
              <input value={subItemDraft.companyName} onChange={(event) => setSubItemDraft({ ...subItemDraft, companyName: event.target.value })} placeholder="Company name" className="rounded-xl border border-zinc-200 px-3 py-3 text-sm" />
              <select value={subItemDraft.supplierId} onChange={(event) => setSubItemDraft({ ...subItemDraft, supplierId: event.target.value })} className="rounded-xl border border-zinc-200 px-3 py-3 text-sm">
                <option value="">Select supplier</option>
                {suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}
              </select>
              <input value={subItemDraft.operatingSystem} onChange={(event) => setSubItemDraft({ ...subItemDraft, operatingSystem: event.target.value })} placeholder="Operating system" className="rounded-xl border border-zinc-200 px-3 py-3 text-sm" />
              <select value={subItemDraft.assetType} onChange={(event) => setSubItemDraft({ ...subItemDraft, assetType: event.target.value as SubItemDraft['assetType'] })} className="rounded-xl border border-zinc-200 px-3 py-3 text-sm">
                <option value="non_critical">Non-Critical</option>
                <option value="critical">Critical</option>
              </select>
              <input value={subItemDraft.remarks} onChange={(event) => setSubItemDraft({ ...subItemDraft, remarks: event.target.value })} placeholder="Remarks" className="rounded-xl border border-zinc-200 px-3 py-3 text-sm" />
              <div className="md:col-span-2 flex gap-2">
                <button type="submit" className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">{subItemDraft.id ? 'Update sub item' : 'Create sub item'}</button>
                {subItemDraft.id ? <button type="button" onClick={() => setSubItemDraft({ itemId: '', name: '', itemCode: '', companyName: '', supplierId: '', operatingSystem: '', assetType: 'non_critical', remarks: '' })} className="rounded-lg border border-zinc-200 px-4 py-2 text-sm font-semibold text-zinc-700">Cancel edit</button> : null}
              </div>
            </form>
            <div className="mt-4 space-y-2">
              {subItems.map((subItem) => (
                <div key={subItem.id} className="rounded-xl border border-zinc-200 px-4 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-semibold text-zinc-900">{subItem.name}</div>
                      <div className="text-xs text-zinc-500">{subItem.itemName || items.find((item) => item.id === subItem.itemId)?.name || 'Unknown main item'} · {subItem.itemCode}</div>
                    </div>
                    <div className="flex gap-2">
                      <button type="button" onClick={() => setSubItemDraft({ id: subItem.id, itemId: subItem.itemId, name: subItem.name, itemCode: subItem.itemCode, companyName: subItem.companyName || '', supplierId: subItem.supplierId || '', operatingSystem: subItem.operatingSystem || '', assetType: subItem.assetType, remarks: subItem.remarks || '' })} className="rounded-lg border border-blue-200 px-3 py-1.5 text-sm font-semibold text-blue-700 hover:bg-blue-50">Edit</button>
                      <button type="button" onClick={() => setDeleteTarget({ kind: 'subItem', id: subItem.id, label: subItem.name })} className="rounded-lg border border-red-200 px-3 py-1.5 text-sm font-semibold text-red-600">Delete</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      ) : null}

      {activeTab === 'branches' ? (
        <div className="grid gap-6 xl:grid-cols-[380px_minmax(0,1fr)]">
          <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
            <div className="mb-4 text-lg font-bold text-zinc-950">Branch management</div>
            <form className="space-y-3" onSubmit={handleBranchSubmit}>
              <input value={branchDraft.name} onChange={(event) => setBranchDraft({ ...branchDraft, name: event.target.value })} placeholder="Branch name" className="w-full rounded-xl border border-zinc-200 px-3 py-3 text-sm" required />
              <input value={branchDraft.location} onChange={(event) => setBranchDraft({ ...branchDraft, location: event.target.value })} placeholder="Location / city" className="w-full rounded-xl border border-zinc-200 px-3 py-3 text-sm" required />
              <input value={branchDraft.locationCode} onChange={(event) => setBranchDraft({ ...branchDraft, locationCode: event.target.value })} placeholder="Location code" className="w-full rounded-xl border border-zinc-200 px-3 py-3 text-sm" />
              <label className="flex items-center gap-2 text-sm text-zinc-700">
                <input type="checkbox" checked={branchDraft.isActive} onChange={(event) => setBranchDraft({ ...branchDraft, isActive: event.target.checked })} />
                Active branch
              </label>
              <div className="flex gap-2">
                <button type="submit" className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">{branchDraft.id ? 'Update branch' : 'Create branch'}</button>
                {branchDraft.id ? <button type="button" onClick={() => setBranchDraft({ name: '', location: '', locationCode: '', isActive: true })} className="rounded-lg border border-zinc-200 px-4 py-2 text-sm font-semibold text-zinc-700">Cancel edit</button> : null}
              </div>
            </form>
          </section>
          <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
            <div className="mb-4 text-lg font-bold text-zinc-950">Configured branches</div>
            <div className="space-y-3">
              {branchRecords.map((branch) => (
                <div key={branch.id} className="flex items-center justify-between rounded-xl border border-zinc-200 px-4 py-3">
                  <div>
                    <div className="font-semibold text-zinc-900">{getBranchLabel(branch)}</div>
                    <div className="text-xs text-zinc-500">{branch.location_code || 'No code'} · {branch.is_active === false ? 'Inactive' : 'Active'}</div>
                  </div>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setBranchDraft({ id: branch.id, name: branch.full_name, location: branch.city || branch.full_name, locationCode: branch.location_code || '', isActive: branch.is_active !== false })} className="rounded-lg border border-blue-200 px-3 py-1.5 text-sm font-semibold text-blue-700 hover:bg-blue-50">Edit</button>
                    <button type="button" onClick={() => setDeleteTarget({ kind: 'branch', id: branch.id, label: getBranchLabel(branch) })} className="rounded-lg border border-red-200 px-3 py-1.5 text-sm font-semibold text-red-600">Delete</button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      ) : null}

      {activeTab === 'suppliers' ? (
        <div className="grid gap-6 xl:grid-cols-[380px_minmax(0,1fr)]">
          <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
            <div className="mb-4 text-lg font-bold text-zinc-950">Supplier management</div>
            <form className="space-y-3" onSubmit={handleSupplierSubmit}>
              <input value={supplierDraft.name} onChange={(event) => setSupplierDraft({ ...supplierDraft, name: event.target.value })} placeholder="Supplier name" className="w-full rounded-xl border border-zinc-200 px-3 py-3 text-sm" required />
              <textarea value={supplierDraft.contactInfo} onChange={(event) => setSupplierDraft({ ...supplierDraft, contactInfo: event.target.value })} placeholder="Contact details" className="min-h-28 w-full rounded-xl border border-zinc-200 px-3 py-3 text-sm" />
              <div className="flex gap-2">
                <button type="submit" className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">{supplierDraft.id ? 'Update supplier' : 'Create supplier'}</button>
                {supplierDraft.id ? <button type="button" onClick={() => setSupplierDraft({ name: '', contactInfo: '' })} className="rounded-lg border border-zinc-200 px-4 py-2 text-sm font-semibold text-zinc-700">Cancel edit</button> : null}
              </div>
            </form>
          </section>
          <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
            <div className="mb-4 text-lg font-bold text-zinc-950">Suppliers</div>
            <div className="space-y-3">
              {suppliers.map((supplier) => (
                <div key={supplier.id} className="flex items-start justify-between rounded-xl border border-zinc-200 px-4 py-3">
                  <div>
                    <div className="font-semibold text-zinc-900">{supplier.name}</div>
                    <div className="mt-1 whitespace-pre-wrap text-xs text-zinc-500">{supplier.contactInfo || 'No contact details'}</div>
                  </div>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setSupplierDraft({ id: supplier.id, name: supplier.name, contactInfo: supplier.contactInfo || '' })} className="rounded-lg border border-blue-200 px-3 py-1.5 text-sm font-semibold text-blue-700 hover:bg-blue-50">Edit</button>
                    <button type="button" onClick={() => setDeleteTarget({ kind: 'supplier', id: supplier.id, label: supplier.name })} className="rounded-lg border border-red-200 px-3 py-1.5 text-sm font-semibold text-red-600">Delete</button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      ) : null}

      {activeTab === 'audit' ? (
        <section className="rounded-2xl border border-zinc-200 bg-white shadow-sm">
          <div className="border-b border-zinc-200 px-5 py-4">
            <div className="text-lg font-bold text-zinc-950">Inventory audit trail</div>
            <div className="text-sm text-zinc-500">Recent inventory actions across assets, stock movement, and catalog updates.</div>
          </div>
          <div className="divide-y divide-zinc-100">
            {audit.map((entry) => (
              <div key={entry.id} className="px-5 py-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="font-semibold text-zinc-900">{entry.summary}</div>
                    <div className="mt-1 text-xs text-zinc-500">{entry.actor?.fullName || 'System'} · {formatDate(entry.createdAt)}</div>
                  </div>
                  <div className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-zinc-600">{entry.action}</div>
                </div>
              </div>
            ))}
            {audit.length === 0 ? <div className="px-5 py-10 text-center text-sm text-zinc-500">No audit entries found.</div> : null}
          </div>
        </section>
      ) : null}

      {selectedItem ? <InventoryDetailDrawer item={selectedItem} onClose={() => setSelectedItem(null)} /> : null}

      {selectedItem ? (
        <div className="fixed right-8 top-4 z-[60] flex gap-2">
          <button type="button" className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow hover:bg-blue-700" onClick={() => openAssignDialog(selectedItem)}>{selectedItem.assignedUserId ? 'Reassign' : 'Assign'}</button>
          <button type="button" className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow hover:bg-blue-700" onClick={() => openEditDialog(selectedItem)}>Edit</button>
          <button type="button" className="rounded-lg bg-red-600 px-3 py-2 text-sm font-semibold text-white shadow" onClick={() => setDeleteTarget({ kind: 'asset', id: selectedItem.id, label: selectedItem.subItem })}>Delete</button>
        </div>
      ) : null}

      {assignmentDraft ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <div className="text-lg font-bold text-zinc-950">Assign asset</div>
                <div className="text-sm text-zinc-500">Choose a user by email, employee ID, or name for {assignmentDraft.label}.</div>
              </div>
              <button type="button" onClick={() => setAssignmentDraft(null)} className="rounded-lg border border-zinc-200 px-3 py-2 text-sm font-semibold text-zinc-700">Close</button>
            </div>
            <div className="space-y-3 rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
              <label className="block">
                <div className="mb-2 text-xs font-bold uppercase tracking-wider text-zinc-500">Search User</div>
                <input value={assignmentSearchQuery} onChange={(event) => setAssignmentSearchQuery(event.target.value)} placeholder="Search by employee name, email, or employee ID" className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-3 text-sm text-zinc-900" />
              </label>
              <label className="block">
                <div className="mb-2 text-xs font-bold uppercase tracking-wider text-zinc-500">Assign To</div>
                <select value={assignmentDraft.assignedUserId} onChange={(event) => {
                  const selected = employees.find((employee) => employee.id === event.target.value);
                  setAssignmentDraft((current) => current ? { ...current, assignedUserId: event.target.value } : current);
                  if (selected) {
                    setAssignmentSearchQuery(selected.email || selected.empId || selected.name);
                  }
                }} className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-3 text-sm text-zinc-900">
                  <option value="">Unassigned</option>
                  {assignableEmployees.map((employee) => (
                    <option key={employee.id} value={employee.id}>{employee.name} • {employee.empId || employee.email || 'No employee ID'}</option>
                  ))}
                </select>
              </label>
              {selectedAssignmentEmployee ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-3 text-sm text-emerald-800">Matched user: {selectedAssignmentEmployee.name}{selectedAssignmentEmployee.email ? ` (${selectedAssignmentEmployee.email})` : ''}</div> : null}
              {!assignableEmployees.length ? <div className="rounded-xl border border-zinc-200 bg-white px-3 py-3 text-sm text-zinc-600">No matching users were found for this search.</div> : null}
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setAssignmentDraft(null)} className="rounded-lg border border-zinc-200 px-4 py-2 text-sm font-semibold text-zinc-700">Cancel</button>
                <button type="button" onClick={handleAssignmentSave} disabled={saving} className="inline-flex items-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"><KeyRound className="mr-2 h-4 w-4" />{saving ? 'Saving...' : 'Save assignment'}</button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {editorOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-8">
          <div className="max-h-full w-full max-w-5xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <div className="text-lg font-bold text-zinc-950">{editorMode === 'add' ? 'Add inventory asset' : 'Edit inventory asset'}</div>
                <div className="text-sm text-zinc-500">Capture branch stock, assignment, supplier, and asset lifecycle details.</div>
              </div>
              <button type="button" onClick={closeEditor} className="rounded-lg border border-zinc-200 px-3 py-2 text-sm font-semibold text-zinc-700">Close</button>
            </div>
            <InventoryItemForm
              initial={editingItem ? mapAssetToInput(editingItem) : { status: 'inventory', branchStocks: [{ branchId: '', quantity: 1 }], assetType: 'non_critical' }}
              onSave={handleAssetSave}
              onCreateMainItem={handleCreateMainItemOption}
              onCreateSubItem={handleCreateSubItemOption}
              onCancel={closeEditor}
              saving={saving}
              branches={branches}
              items={items}
              subItems={subItems}
              suppliers={suppliers}
              entities={entities}
              defaultCompanyName={defaultCompanyName}
            />
          </div>
        </div>
      ) : null}

      {stockDialogOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <div className="text-lg font-bold text-zinc-950">{stockDraft.operation === 'transfer' ? 'Transfer stock' : 'Update stock'}</div>
                <div className="text-sm text-zinc-500">Adjust on-hand quantity per branch without leaving the inventory screen.</div>
              </div>
              <button type="button" onClick={() => setStockDialogOpen(false)} className="rounded-lg border border-zinc-200 px-3 py-2 text-sm font-semibold text-zinc-700">Close</button>
            </div>
            <form className="grid gap-4 md:grid-cols-2" onSubmit={handleStockOperationSubmit}>
              <select value={stockDraft.operation} onChange={(event) => setStockDraft({ ...stockDraft, operation: event.target.value as StockOperationDraft['operation'] })} className="rounded-xl border border-zinc-200 px-3 py-3 text-sm">
                <option value="add">Add stock</option>
                <option value="reduce">Reduce stock</option>
                <option value="transfer">Transfer stock</option>
              </select>
              <select value={stockDraft.subItemId} onChange={(event) => setStockDraft({ ...stockDraft, subItemId: event.target.value })} className="rounded-xl border border-zinc-200 px-3 py-3 text-sm" required>
                <option value="">Select sub item</option>
                {subItems.map((subItem) => <option key={subItem.id} value={subItem.id}>{subItem.name} ({subItem.itemCode})</option>)}
              </select>
              {stockDraft.operation === 'transfer' ? (
                <>
                  <select value={stockDraft.fromBranchId} onChange={(event) => setStockDraft({ ...stockDraft, fromBranchId: event.target.value })} className="rounded-xl border border-zinc-200 px-3 py-3 text-sm" required>
                    <option value="">From branch</option>
                    {branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
                  </select>
                  <select value={stockDraft.toBranchId} onChange={(event) => setStockDraft({ ...stockDraft, toBranchId: event.target.value })} className="rounded-xl border border-zinc-200 px-3 py-3 text-sm" required>
                    <option value="">To branch</option>
                    {branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
                  </select>
                </>
              ) : (
                <select value={stockDraft.branchId} onChange={(event) => setStockDraft({ ...stockDraft, branchId: event.target.value })} className="rounded-xl border border-zinc-200 px-3 py-3 text-sm" required>
                  <option value="">Select branch</option>
                  {branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
                </select>
              )}
              <input type="number" min="1" step="1" value={stockDraft.quantity} onChange={(event) => setStockDraft({ ...stockDraft, quantity: Number(event.target.value || 0) })} className="rounded-xl border border-zinc-200 px-3 py-3 text-sm" placeholder="Quantity" required />
              <textarea value={stockDraft.note} onChange={(event) => setStockDraft({ ...stockDraft, note: event.target.value })} placeholder="Reason / note" className="min-h-28 rounded-xl border border-zinc-200 px-3 py-3 text-sm md:col-span-2" />
              <div className="md:col-span-2 flex justify-end gap-2">
                <button type="button" onClick={() => setStockDialogOpen(false)} className="rounded-lg border border-zinc-200 px-4 py-2 text-sm font-semibold text-zinc-700">Cancel</button>
                <button type="submit" className="inline-flex items-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"><ArrowLeftRight className="mr-2 h-4 w-4" />Save stock operation</button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete record"
        message={deleteTarget ? `Delete ${deleteTarget.label}? This action cannot be undone.` : ''}
        confirmLabel="Delete"
        tone="danger"
        busy={deleteBusy}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteConfirm}
      />
    </div>
  );
}