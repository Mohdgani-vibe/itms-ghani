import { describe, expect, it } from 'vitest';

import { parseClamAVAlertFacts, renderAlertDetailPreview, renderAlertTitle, renderClamAVMetricSummary } from './AlertsDisplay';
import type { AlertsListRecord } from './types';

describe('AlertsDisplay', () => {
	it('parses structured ClamScan facts and aliases historical ClamAV titles', () => {
		const alert: AlertsListRecord = {
			id: 'alert-1',
			deviceId: 'device-1',
			source: 'clamav',
			severity: 'info',
			title: 'ClamAV scan clean',
			detail: 'Scanned 70436 files; infected: 0; errors: 0. ---------- SCAN SUMMARY ---------- Known viruses: 3627837 Engine version: 1.4.3 Scanned files: 70436 Infected files: 0 Data scanned: 5166.48 MB Paths: /home,/etc,/opt',
			acknowledged: false,
			resolved: false,
			createdAt: '2026-04-27T12:00:00Z',
		};

		const facts = parseClamAVAlertFacts(alert);

		expect(facts).not.toBeNull();
		expect(renderAlertTitle(alert)).toBe('ClamScan scan clean');
		expect(facts?.summary).toContain('Scanned 70436 files; infected: 0; errors: 0.');
		expect(facts?.scannedFiles).toBe(70436);
		expect(facts?.infectedFiles).toBe(0);
		expect(facts?.knownViruses).toBe(3627837);
		expect(facts?.paths).toEqual(['/home', '/etc', '/opt']);
		expect(renderClamAVMetricSummary(alert)).toBe('70,436 scanned • 0 infected • 0 errors');
		expect(renderAlertDetailPreview(alert, 120)).toBe('ClamScan scan clean');
	});
});