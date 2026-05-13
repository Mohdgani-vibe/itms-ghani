import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import GatepassCreateForm from './GatepassCreateForm';

describe('GatepassCreateForm', () => {
  it('renders employee and asset lookup guidance, locked description, and actions', () => {
    const markup = renderToStaticMarkup(
      <GatepassCreateForm
        form={{
          employeeUserId: '',
          employeeName: 'Chris',
          employeeCode: 'EMP-101',
          departmentName: 'IT',
          approverName: 'Ava Admin',
          contactNumber: '9999999999',
          assetRef: 'LT-44',
          assetType: 'Laptop',
          serialNumber: 'SN-44',
          expectedReturn: '2026-05-20',
          assetDescription: '14-inch laptop',
          purpose: 'Work from home',
          originBranch: 'HQ',
          recipientBranch: 'Branch South',
          issueDate: '2026-05-08',
        }}
        formErrors={{ employeeCode: 'Required field' }}
        submitting={false}
        branches={[{ id: 'branch-1', name: 'HQ' }, { id: 'branch-2', name: 'Branch South' }]}
        departmentNames={['IT', 'Finance']}
        employeeSuggestions={[
          { id: 'user-1', fullName: 'Chris Employee', employeeCode: 'EMP-101' },
        ]}
        employeeLookupLoading={false}
        assetSuggestions={[
          { key: 'asset-1', assetRef: 'LT-44', label: 'LT-44 - Laptop' },
        ]}
        assetLookupLoading={false}
        assetDescriptionLocked={true}
        formatDisplayDate={(value) => `date:${value}`}
        onSubmit={vi.fn()}
        onFieldChange={vi.fn()}
        onEmployeeLookupChange={vi.fn()}
        onAssetLookupChange={vi.fn()}
        onUnlockAssetDescription={vi.fn()}
        onReset={vi.fn()}
        onOpenPreview={vi.fn()}
      />,
    );

    expect(markup).toContain('Draft New Gatepass');
    expect(markup).toContain('Dispatch Details');
    expect(markup).toContain('Recipient Details');
    expect(markup).toContain('Asset Details');
    expect(markup).toContain('1 employee suggestion ready.');
    expect(markup).toContain('1 asset suggestion ready. Choosing a known asset auto-fills the hardware fields and from branch.');
    expect(markup).toContain('Displays as date:2026-05-08.');
    expect(markup).toContain('Unlock Edit');
    expect(markup).toContain('Description came from the matched inventory record. Unlock edit if you need to override it.');
    expect(markup).toContain('Required field');
    expect(markup).toContain('Preview Draft');
    expect(markup).toContain('Generate Official Gatepass');
  });

  it('renders searching and submitting states', () => {
    const markup = renderToStaticMarkup(
      <GatepassCreateForm
        form={{
          employeeUserId: '',
          employeeName: 'Ch',
          employeeCode: '',
          departmentName: '',
          approverName: '',
          contactNumber: '',
          assetRef: 'LT',
          assetType: '',
          serialNumber: '',
          expectedReturn: '',
          assetDescription: '',
          purpose: 'Other',
          originBranch: 'HQ',
          recipientBranch: 'HQ',
          issueDate: '2026-05-08',
        }}
        formErrors={{}}
        submitting={true}
        branches={[{ id: 'branch-1', name: 'HQ' }]}
        departmentNames={[]}
        employeeSuggestions={[]}
        employeeLookupLoading={true}
        assetSuggestions={[]}
        assetLookupLoading={true}
        assetDescriptionLocked={false}
        formatDisplayDate={(value) => `date:${value}`}
        onSubmit={vi.fn()}
        onFieldChange={vi.fn()}
        onEmployeeLookupChange={vi.fn()}
        onAssetLookupChange={vi.fn()}
        onUnlockAssetDescription={vi.fn()}
        onReset={vi.fn()}
        onOpenPreview={vi.fn()}
      />,
    );

    expect(markup).toContain('Searching employees...');
    expect(markup).toContain('Searching assets...');
    expect(markup).toContain('Generating...');
    expect(markup).toContain('disabled=""');
  });
});