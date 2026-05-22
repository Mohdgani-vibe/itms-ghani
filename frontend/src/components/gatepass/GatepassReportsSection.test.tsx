import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import GatepassReportsSection from './GatepassReportsSection';

describe('GatepassReportsSection', () => {
  it('renders barcode cards, report totals, and report table actions', () => {
    const markup = renderToStaticMarkup(
      <GatepassReportsSection
        barcodeGatepasses={[
          {
            id: 'gp-1',
            status: 'approved',
            displayNumber: 'GP-2026-001',
            subjectLabel: 'Laptop dispatch',
            employeeName: 'Nina Employee',
            assetRef: 'LT-1001',
            issueDate: '08 May 2026',
          },
        ]}
        reportGatepasses={[
          {
            id: 'gp-1',
            status: 'approved',
            displayNumber: 'GP-2026-001',
            subjectLabel: 'Laptop dispatch',
            employeeName: 'Nina Employee',
            assetRef: 'LT-1001',
            issueDate: '08 May 2026',
          },
        ]}
        total={18}
        pending={2}
        archived={16}
        renderBarcode={(value, label, className) => <div className={className} aria-label={label}>{value}</div>}
        onViewReport={vi.fn()}
        onDownloadReport={vi.fn()}
        onDownloadCsv={vi.fn()}
      />,
    );

    expect(markup).toContain('Gatepass barcode board');
    expect(markup).toContain('GP-2026-001');
    expect(markup).toContain('Barcode for GP-2026-001');
    expect(markup).toContain('18');
    expect(markup).toContain('2');
    expect(markup).toContain('16');
    expect(markup).toContain('Gatepass report register');
    expect(markup).toContain('1 reports ready');
    expect(markup).toContain('Nina Employee');
    expect(markup).toContain('LT-1001');
    expect(markup).toContain('08 May 2026');
    expect(markup).toContain('View');
    expect(markup).toContain('Download');
    expect(markup).toContain('Export CSV');
  });
});