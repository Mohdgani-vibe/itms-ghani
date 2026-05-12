import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { AlertsDetailMetadataPanel } from './AlertsDetailMetadataPanel';
import type { AlertsListRecord } from './types';

const alertRecord: AlertsListRecord = {
  id: 'alert-1',
  assetId: 'asset-1',
  assetTag: 'IT-001',
  assetName: 'Operations Laptop',
  hostname: 'ops-laptop-01',
  deviceId: 'device-1',
  userId: 'user-1',
  userName: 'Alex Kumar',
  userEmail: 'alex@example.com',
  department: 'IT Operations',
  source: 'clamav',
  sourceRaw: 'clamav-scan',
  severity: 'high',
  title: 'Malware signature triggered',
  detail: 'Scanned 70436 files; infected: 2; errors: 0. ---------- SCAN SUMMARY ---------- Known viruses: 3627837 Engine version: 1.4.3 Scanned files: 70436 Infected files: 2 Data scanned: 5166.48 MB Paths: /home,/etc,/opt',
  acknowledged: false,
  resolved: false,
  createdAt: '2026-05-08T04:00:00Z',
};

describe('AlertsDetailMetadataPanel', () => {
  it('renders finding summary, asset metadata, and ClamScan metrics', () => {
    const markup = renderToStaticMarkup(
      <AlertsDetailMetadataPanel
        selectedAlert={alertRecord}
        renderSystemName={(alert) => alert.hostname || 'Unknown system'}
        renderAlertUser={(alert) => alert.userName || '-'}
        formatAbsoluteTime={() => '08 May 2026'}
      />,
    );

    expect(markup).toContain('Finding Summary');
    expect(markup).toContain('Scanned Files');
    expect(markup).toContain('70436');
    expect(markup).toContain('Known Viruses');
    expect(markup).toContain('ops-laptop-01');
    expect(markup).toContain('alex@example.com');
    expect(markup).toContain('/home');
    expect(markup).toContain('08 May 2026');
  });

  it('renders non-ClamScan alerts without extra metrics sections', () => {
    const markup = renderToStaticMarkup(
      <AlertsDetailMetadataPanel
        selectedAlert={{
          ...alertRecord,
          source: 'wazuh',
          sourceRaw: 'wazuh',
          detail: 'A test finding',
        }}
        renderSystemName={(alert) => alert.hostname || 'Unknown system'}
        renderAlertUser={(alert) => alert.userName || '-'}
        formatAbsoluteTime={() => '08 May 2026'}
      />,
    );

    expect(markup).toContain('Finding Summary');
    expect(markup).not.toContain('Scanned Files');
    expect(markup).toContain('Raw Source');
  });
});