import { createRef } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import DeviceAlertDetailModal from './DeviceAlertDetailModal';

describe('DeviceAlertDetailModal', () => {
  it('renders alert investigation details and normalizes ClamAV titles', () => {
    const markup = renderToStaticMarkup(
      <DeviceAlertDetailModal
        selectedAlert={{
          id: 'alert-1',
          source: 'clamav',
          severity: 'high',
          title: 'ClamAV Malware Signature Triggered',
          detail: 'Suspicious file detected in user downloads.',
          acknowledged: false,
          resolved: false,
          createdAt: '2026-05-08T04:00:00Z',
        }}
        hostname="ops-laptop-01"
        assetId="ITMS-1001"
        assignedUserName="Alex Kumar"
        assignedUserEmail="alex@example.com"
        departmentName="IT Operations"
        alertDialogRef={createRef<HTMLDivElement>()}
        alertCloseButtonRef={createRef<HTMLButtonElement>()}
        onClose={vi.fn()}
        severityBadgeClassName={() => 'bg-rose-100 text-rose-700'}
        alertSourceLabel={(source) => source.toUpperCase()}
        alertStatusBadgeClassName={() => 'bg-amber-100 text-amber-700'}
        alertStatusLabel={() => 'Open'}
        formatDate={() => '08 May 2026'}
      />,
    );

    expect(markup).toContain('Device Alert Investigation');
    expect(markup).toContain('ClamScan Malware Signature Triggered');
    expect(markup).toContain('ops-laptop-01');
    expect(markup).toContain('ITMS-1001');
    expect(markup).toContain('Alex Kumar');
    expect(markup).toContain('08 May 2026');
    expect(markup).toContain('Open');
  });

  it('renders nothing when no alert is selected', () => {
    const markup = renderToStaticMarkup(
      <DeviceAlertDetailModal
        selectedAlert={null}
        hostname="ops-laptop-01"
        assetId="ITMS-1001"
        assignedUserName={null}
        assignedUserEmail={null}
        departmentName={null}
        alertDialogRef={createRef<HTMLDivElement>()}
        alertCloseButtonRef={createRef<HTMLButtonElement>()}
        onClose={vi.fn()}
        severityBadgeClassName={() => ''}
        alertSourceLabel={() => ''}
        alertStatusBadgeClassName={() => ''}
        alertStatusLabel={() => ''}
        formatDate={() => ''}
      />,
    );

    expect(markup).toBe('');
  });
});