import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import UserAssignedAssetsPanel, { userAssignedDeviceActionsReadOnly, userAssignedInventoryActionsReadOnly } from './UserAssignedAssetsPanel';

describe('userAssignedDeviceActionsReadOnly', () => {
  it('fails closed for inactive users and retired devices', () => {
    expect(userAssignedDeviceActionsReadOnly(false, 'inactive', 'in_use')).toBe(true);
    expect(userAssignedDeviceActionsReadOnly(false, 'active', 'retired')).toBe(true);
  });

  it('keeps active assigned devices actionable', () => {
    expect(userAssignedDeviceActionsReadOnly(false, 'active', 'in_use')).toBe(false);
  });
});

describe('userAssignedInventoryActionsReadOnly', () => {
  it('fails closed for inactive users and non-allocated inventory items', () => {
    expect(userAssignedInventoryActionsReadOnly(false, 'inactive', 'allocated')).toBe(true);
    expect(userAssignedInventoryActionsReadOnly(false, 'active', 'returned')).toBe(true);
    expect(userAssignedInventoryActionsReadOnly(false, 'active', 'retired')).toBe(true);
  });

  it('keeps allocated inventory items actionable', () => {
    expect(userAssignedInventoryActionsReadOnly(false, 'active', 'allocated')).toBe(false);
  });
});

describe('UserAssignedAssetsPanel', () => {
  it('renders available unassigned systems with assign actions', () => {
    const markup = renderToStaticMarkup(
      <UserAssignedAssetsPanel
        selectedUser={{ fullName: 'Portal Employee', status: 'active' }}
        assetsLoading={false}
        readOnly={false}
        devices={[]}
        items={[]}
        assetActionLoadingId=""
        selectedAssetsCount={0}
        toolStatusItems={[]}
        getDevicePresence={() => ({ label: 'Recently Seen', detail: 'Seen just now', classes: 'bg-emerald-100 text-emerald-700' })}
        formatWarranty={(value) => value}
        formatCurrency={(value) => `INR ${value}`}
        formatAssignmentAge={(value) => value || 'Assignment date unavailable'}
        getToolBadgeClasses={() => 'bg-zinc-100 text-zinc-700'}
        formatToolStatusLabel={() => 'missing'}
        showAvailableDevices
        availableDevices={[
          {
            id: 'asset-2',
            hostname: 'itms-free-laptop-01',
            serialNumber: 'FREE-1234',
            model: 'ThinkPad T14',
            status: 'active',
            branch: { name: 'HQ' },
            department: { name: 'IT' },
          },
        ]}
        onOpenDevice={() => {}}
        onUnassignDevice={() => {}}
        onDeleteAsset={() => {}}
        onReturnInventoryAsset={() => {}}
        onRetireInventoryAsset={() => {}}
        onAssignAvailableDevice={() => {}}
      />,
    );

    expect(markup).toContain('Available Unassigned Systems');
    expect(markup).toContain('itms-free-laptop-01');
    expect(markup).toContain('Assign Device');
  });

  it('renders inventory item cost in assigned assets view', () => {
    const markup = renderToStaticMarkup(
      <UserAssignedAssetsPanel
        selectedUser={{ fullName: 'Portal Employee' }}
        assetsLoading={false}
        readOnly={false}
        devices={[]}
          items={[
            {
              id: 'inventory-1',
              itemCode: 'INV-0001',
              name: 'MacBook Pro 14',
              serialNumber: 'MBP-1234',
              specs: 'M4 Pro / 24 GB / 512 GB',
              warrantyExpiresAt: '2027-12-31',
              cost: '99999.00',
              assignedAt: '2026-04-25T11:41:54Z',
              status: 'allocated',
            },
          ]}
        assetActionLoadingId=""
        selectedAssetsCount={1}
        toolStatusItems={[]}
        getDevicePresence={() => ({ label: 'Recently Seen', detail: 'Seen just now', classes: 'bg-emerald-100 text-emerald-700' })}
        formatWarranty={(value) => value}
        formatCurrency={(value) => `INR ${value}`}
        formatAssignmentAge={(value) => value || 'Assignment date unavailable'}
        getToolBadgeClasses={() => 'bg-zinc-100 text-zinc-700'}
        formatToolStatusLabel={() => 'missing'}
        onOpenDevice={() => {}}
        onUnassignDevice={() => {}}
        onDeleteAsset={() => {}}
          onReturnInventoryAsset={() => {}}
          onRetireInventoryAsset={() => {}}
      />,
    );

    expect(markup).toContain('MacBook Pro 14');
    expect(markup).toContain('Cost: INR 99999.00');
    expect(markup).toContain('INV-0001');
  });

  it('renders RustDesk ID for assigned devices', () => {
    const markup = renderToStaticMarkup(
      <UserAssignedAssetsPanel
        selectedUser={{ fullName: 'Portal Employee' }}
        assetsLoading={false}
        readOnly={false}
        devices={[
          {
            id: 'asset-1',
            assetTag: 'AST-0001',
            hostname: 'itms-laptop-01',
            rustdeskId: 'rd-778899',
            serialNumber: 'SN-778899',
            specs: 'ThinkPad T14',
            warrantyExpiresAt: '2027-12-31',
            assignedAt: '2026-04-25T11:41:54Z',
            status: 'active',
            toolStatus: {},
          },
        ]}
        items={[]}
        assetActionLoadingId=""
        selectedAssetsCount={1}
        toolStatusItems={[]}
        getDevicePresence={() => ({ label: 'Recently Seen', detail: 'Seen just now', classes: 'bg-emerald-100 text-emerald-700' })}
        formatWarranty={(value) => value}
        formatCurrency={(value) => `INR ${value}`}
        formatAssignmentAge={(value) => value || 'Assignment date unavailable'}
        getToolBadgeClasses={() => 'bg-zinc-100 text-zinc-700'}
        formatToolStatusLabel={() => 'missing'}
        onOpenDevice={() => {}}
        onUnassignDevice={() => {}}
        onDeleteAsset={() => {}}
          onReturnInventoryAsset={() => {}}
          onRetireInventoryAsset={() => {}}
      />,
    );

    expect(markup).toContain('itms-laptop-01');
    expect(markup).toContain('RustDesk ID: rd-778899');
  });

  it('renders cost for assigned devices', () => {
    const markup = renderToStaticMarkup(
      <UserAssignedAssetsPanel
        selectedUser={{ fullName: 'Portal Employee' }}
        assetsLoading={false}
        readOnly={false}
        devices={[
          {
            id: 'asset-2',
            assetTag: 'AST-0002',
            hostname: 'itms-laptop-02',
            rustdeskId: 'rd-112233',
            cost: '82500.00',
            serialNumber: 'SN-112233',
            specs: 'Latitude 7440',
            warrantyExpiresAt: '2027-12-31',
            assignedAt: '2026-04-25T11:41:54Z',
            status: 'active',
            toolStatus: {},
          },
        ]}
        items={[]}
        assetActionLoadingId=""
        selectedAssetsCount={1}
        toolStatusItems={[]}
        getDevicePresence={() => ({ label: 'Recently Seen', detail: 'Seen just now', classes: 'bg-emerald-100 text-emerald-700' })}
        formatWarranty={(value) => value}
        formatCurrency={(value) => `INR ${value}`}
        formatAssignmentAge={(value) => value || 'Assignment date unavailable'}
        getToolBadgeClasses={() => 'bg-zinc-100 text-zinc-700'}
        formatToolStatusLabel={() => 'missing'}
        onOpenDevice={() => {}}
        onUnassignDevice={() => {}}
        onDeleteAsset={() => {}}
          onReturnInventoryAsset={() => {}}
          onRetireInventoryAsset={() => {}}
      />,
    );

    expect(markup).toContain('itms-laptop-02');
    expect(markup).toContain('Cost: INR 82500.00');
  });

  it('hides asset mutation controls for inactive users', () => {
    const markup = renderToStaticMarkup(
      <UserAssignedAssetsPanel
        selectedUser={{ fullName: 'Inactive Employee', status: 'inactive' }}
        assetsLoading={false}
        readOnly={false}
        devices={[
          {
            id: 'asset-3',
            assetTag: 'AST-0003',
            hostname: 'itms-laptop-03',
            rustdeskId: 'rd-445566',
            serialNumber: 'SN-445566',
            specs: 'EliteBook 840',
            warrantyExpiresAt: '2027-12-31',
            assignedAt: '2026-04-25T11:41:54Z',
            status: 'active',
            toolStatus: {},
          },
        ]}
        items={[
          {
            id: 'inventory-2',
            itemCode: 'INV-0002',
            name: 'Docking Station',
            serialNumber: 'DK-2222',
            specs: 'USB-C dock',
            warrantyExpiresAt: '2027-12-31',
            cost: '5500.00',
            assignedAt: '2026-04-25T11:41:54Z',
            status: 'allocated',
          },
        ]}
        assetActionLoadingId=""
        selectedAssetsCount={2}
        toolStatusItems={[]}
        getDevicePresence={() => ({ label: 'Recently Seen', detail: 'Seen just now', classes: 'bg-emerald-100 text-emerald-700' })}
        formatWarranty={(value) => value}
        formatCurrency={(value) => `INR ${value}`}
        formatAssignmentAge={(value) => value || 'Assignment date unavailable'}
        getToolBadgeClasses={() => 'bg-zinc-100 text-zinc-700'}
        formatToolStatusLabel={() => 'missing'}
        onOpenDevice={() => {}}
        onUnassignDevice={() => {}}
        onDeleteAsset={() => {}}
        onReturnInventoryAsset={() => {}}
        onRetireInventoryAsset={() => {}}
      />,
    );

    expect(markup).toContain('This user is inactive. Asset actions are read-only until the account is reactivated.');
    expect(markup).not.toContain('Remove From User');
    expect(markup).not.toContain('Delete Asset');
    expect(markup).not.toContain('Return');
    expect(markup).not.toContain('Scrap');
  });

  it('hides device mutation controls for retired assets', () => {
    const markup = renderToStaticMarkup(
      <UserAssignedAssetsPanel
        selectedUser={{ fullName: 'Portal Employee', status: 'active' }}
        assetsLoading={false}
        readOnly={false}
        devices={[
          {
            id: 'asset-4',
            assetTag: 'AST-0004',
            hostname: 'itms-laptop-04',
            rustdeskId: 'rd-998877',
            serialNumber: 'SN-998877',
            specs: 'Precision 5480',
            warrantyExpiresAt: '2027-12-31',
            assignedAt: '2026-04-25T11:41:54Z',
            status: 'retired',
            toolStatus: {},
          },
        ]}
        items={[]}
        assetActionLoadingId=""
        selectedAssetsCount={1}
        toolStatusItems={[]}
        getDevicePresence={() => ({ label: 'Recently Seen', detail: 'Seen just now', classes: 'bg-emerald-100 text-emerald-700' })}
        formatWarranty={(value) => value}
        formatCurrency={(value) => `INR ${value}`}
        formatAssignmentAge={(value) => value || 'Assignment date unavailable'}
        getToolBadgeClasses={() => 'bg-zinc-100 text-zinc-700'}
        formatToolStatusLabel={() => 'missing'}
        onOpenDevice={() => {}}
        onUnassignDevice={() => {}}
        onDeleteAsset={() => {}}
        onReturnInventoryAsset={() => {}}
        onRetireInventoryAsset={() => {}}
      />,
    );

    expect(markup).toContain('This asset is retired. Assignment actions are read-only until the asset returns to an active lifecycle state.');
    expect(markup).not.toContain('Remove From User');
    expect(markup).not.toContain('Delete Asset');
  });

  it('hides inventory mutation controls for returned items', () => {
    const markup = renderToStaticMarkup(
      <UserAssignedAssetsPanel
        selectedUser={{ fullName: 'Portal Employee', status: 'active' }}
        assetsLoading={false}
        readOnly={false}
        devices={[]}
        items={[
          {
            id: 'inventory-3',
            itemCode: 'INV-0003',
            name: 'USB-C Dock',
            serialNumber: 'DK-3333',
            specs: 'Thunderbolt dock',
            warrantyExpiresAt: '2027-12-31',
            cost: '7000.00',
            assignedAt: '2026-04-25T11:41:54Z',
            status: 'returned',
          },
        ]}
        assetActionLoadingId=""
        selectedAssetsCount={1}
        toolStatusItems={[]}
        getDevicePresence={() => ({ label: 'Recently Seen', detail: 'Seen just now', classes: 'bg-emerald-100 text-emerald-700' })}
        formatWarranty={(value) => value}
        formatCurrency={(value) => `INR ${value}`}
        formatAssignmentAge={(value) => value || 'Assignment date unavailable'}
        getToolBadgeClasses={() => 'bg-zinc-100 text-zinc-700'}
        formatToolStatusLabel={() => 'missing'}
        onOpenDevice={() => {}}
        onUnassignDevice={() => {}}
        onDeleteAsset={() => {}}
        onReturnInventoryAsset={() => {}}
        onRetireInventoryAsset={() => {}}
      />,
    );

    expect(markup).toContain('This inventory item is no longer allocated to this user. Asset actions are read-only until the item is allocated again.');
    expect(markup).not.toContain('Return');
    expect(markup).not.toContain('Scrap');
    expect(markup).not.toContain('Delete Asset');
  });
});