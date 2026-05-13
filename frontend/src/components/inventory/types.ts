export interface LookupOption {
  id: string;
  name: string;
}

export interface InventoryEntityOption {
  id: string;
  full_name: string;
  is_active?: boolean;
}

export interface InventoryModuleEmployee {
  id: string;
  name: string;
  email?: string;
  empId?: string;
  branchName?: string;
}

export interface InventoryModuleMainItem {
  id: string;
  name: string;
}

export interface InventoryModuleSupplier {
  id: string;
  name: string;
  contactInfo?: string | null;
}

export interface InventoryModuleSubItem {
  id: string;
  itemId: string;
  itemName?: string;
  name: string;
  itemCode: string;
  companyName?: string | null;
  supplierId?: string | null;
  operatingSystem?: string | null;
  assetType: 'critical' | 'non_critical';
  remarks?: string | null;
}

export interface InventoryModuleBranch {
  id: string;
  full_name: string;
  city?: string | null;
  location_code?: string | null;
  entity_id?: string | null;
  entity_code?: string | null;
  is_active?: boolean;
}

export interface InventoryModuleBranchStock {
  branchId: string;
  branchName: string;
  quantity: number;
}

export interface InventoryItem {
  id: string;
  name: string;
  itemCode: string;
  assetTag?: string | null;
  serialNumber: string;
  specs: string;
  warrantyExpiresAt: string;
  cost?: string | null;
  assignedAt?: string;
  status: string;
}

export interface InventoryModuleAsset extends InventoryItem {
  subItemId?: string | null;
  subItem: string;
  assetTag?: string | null;
  companyName?: string | null;
  supplierId?: string | null;
  operatingSystem?: string | null;
  assetType: 'critical' | 'non_critical';
  assignedUserId?: string | null;
  assignedUserName?: string | null;
  assignedUserEmail?: string | null;
  locationId?: string | null;
  branchId?: string | null;
  branchName?: string | null;
  stockByBranch: InventoryModuleBranchStock[];
  stockTotal: number;
  purchaseDate?: string | null;
  remarks?: string | null;
}

export interface InventoryModuleAssetInput {
  subItemId: string;
  assetTag: string;
  serialNumber: string;
  companyName: string;
  supplierId?: string;
  operatingSystem: string;
  assetType: 'critical' | 'non_critical';
  assignedUserId?: string;
  locationId: string;
  branchId: string;
  branchStocks: Array<{ branchId: string; quantity: number }>;
  cost: string;
  purchaseDate: string;
  warrantyExpiresAt: string;
  specs: string;
  remarks: string;
  status: string;
}

export interface InventoryModuleSummary {
  assets: number;
  mainItems: number;
  subItems: number;
  branches: number;
  suppliers: number;
}

export interface InventoryModuleAuditEntry {
  id: string;
  summary: string;
  action: string;
  createdAt: string;
  actor?: {
    fullName?: string;
  } | null;
}

export interface InventoryModuleAuditListResponse {
  items: InventoryModuleAuditEntry[];
}

export interface InventoryModuleOptionsResponse {
  items: InventoryModuleMainItem[];
  subItems: InventoryModuleSubItem[];
  suppliers: InventoryModuleSupplier[];
  branches: LookupOption[];
  employees: InventoryModuleEmployee[];
  defaultCompanyName?: string;
}

export interface InventoryModuleAssetsResponse {
  items: InventoryModuleAsset[];
  total?: number;
  summary: InventoryModuleSummary;
}

export interface InventoryModuleImportResult {
  created: number;
  errors: Array<{
    row: number;
    message: string;
  }>;
}

export interface InventoryStockOperationInput {
  operation: 'add' | 'reduce' | 'transfer';
  subItemId: string;
  branchId?: string;
  fromBranchId?: string;
  toBranchId?: string;
  quantity: number;
  note?: string;
}
