import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import GatepassPendingSection from './GatepassPendingSection';

describe('GatepassPendingSection', () => {
  it('renders upload actions for pending gatepasses', () => {
    const markup = renderToStaticMarkup(
      <GatepassPendingSection
        gatepasses={[
          {
            id: 'gp-1',
            gatepassNumber: 'ZGP-20260514-0001',
            employeeName: 'Nina Employee',
            employeeCode: 'EMP-001',
            assetRef: 'LT-1001',
            approverName: 'Maya Manager',
            issueDate: '2026-05-14',
            status: 'approved',
            hasReceiverSignedUpload: false,
          },
        ]}
        isReadOnly={false}
        busyGatepassId={null}
        onUploadSignedCopy={vi.fn(async () => {})}
        onViewUpload={vi.fn(async () => {})}
        onViewReport={vi.fn()}
        onDownloadReport={vi.fn()}
        formatDisplayDate={(value) => value}
        formatStatusLabel={(value) => value}
        gatepassDisplayNumber={(gatepass) => gatepass.gatepassNumber || gatepass.id}
      />,
    );

    expect(markup).toContain('ZGP-20260514-0001');
    expect(markup).toContain('Signed Gatepass Upload');
    expect(markup).toContain('Upload');
    expect(markup).toContain('View');
    expect(markup).toContain('Download');
  });
});