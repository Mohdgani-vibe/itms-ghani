import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import GatepassPreviewOverlay from './GatepassPreviewOverlay';

describe('GatepassPreviewOverlay', () => {
  it('renders the preview sheet with gatepass details and actions', () => {
    const markup = renderToStaticMarkup(
      <GatepassPreviewOverlay
        showPreview={true}
        previewGatepassNumber="GP-2026-010"
        previewRecord={{
          issueDate: '2026-05-08',
          createdAt: '2026-05-08T09:30:00Z',
          status: 'approved',
          originBranch: 'HQ',
          recipientBranch: 'Branch South',
          employeeName: 'Chris Employee',
          employeeCode: 'EMP-101',
          departmentName: 'IT',
          approverName: 'Ava Admin',
          contactNumber: '9999999999',
          assetRef: 'LT-44',
          assetType: 'Laptop',
          serialNumber: 'SN-44',
          purpose: 'Work from home',
          expectedReturn: '2026-05-20',
          assetDescription: '14-inch laptop',
          issuerSignedName: 'Issuer One',
          requesterName: 'Chris Employee',
          securitySignedName: 'Security Lead',
        }}
        formatDisplayDate={(value) => value ? `date:${value}` : 'No date'}
        formatIssueTime={(value) => value ? `time:${value}` : 'No time'}
        onClose={vi.fn()}
        onDownloadPdf={vi.fn()}
        onPrintPreview={vi.fn()}
      />,
    );

    expect(markup).toContain('Gatepass Preview');
    expect(markup).toContain('GP-2026-010');
    expect(markup).toContain('date:2026-05-08');
    expect(markup).toContain('time:2026-05-08T09:30:00Z');
    expect(markup).toContain('Chris Employee');
    expect(markup).toContain('Ava Admin');
    expect(markup).toContain('Branch South');
    expect(markup).toContain('LT-44');
    expect(markup).toContain('14-inch laptop');
    expect(markup).toContain('Security Check');
    expect(markup).toContain('Download PDF');
    expect(markup).toContain('Print');
  });

  it('renders nothing when preview is hidden', () => {
    const markup = renderToStaticMarkup(
      <GatepassPreviewOverlay
        showPreview={false}
        previewGatepassNumber="GP-2026-010"
        previewRecord={{
          issueDate: '2026-05-08',
          createdAt: '2026-05-08T09:30:00Z',
          status: 'approved',
          originBranch: 'HQ',
          recipientBranch: 'Branch South',
          employeeName: 'Chris Employee',
          employeeCode: 'EMP-101',
          departmentName: 'IT',
          approverName: 'Ava Admin',
          contactNumber: '9999999999',
          assetRef: 'LT-44',
          purpose: 'Work from home',
          assetDescription: '14-inch laptop',
        }}
        formatDisplayDate={(value) => value}
        formatIssueTime={(value) => value || ''}
        onClose={vi.fn()}
        onDownloadPdf={vi.fn()}
        onPrintPreview={vi.fn()}
      />,
    );

    expect(markup).toBe('');
  });
});