import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import { ClamScanSummaryPanel } from './ClamScanSummaryPanel';

describe('ClamScanSummaryPanel', () => {
	it('renders ClamScan totals and latest findings', () => {
		const markup = renderToStaticMarkup(
			<MemoryRouter>
				<ClamScanSummaryPanel
					basePath="/audit"
					readOnlyReview
					trend={{
						last24Hours: 1,
						last7Days: 3,
						last30Days: 5,
						dailyBuckets: [
							{ date: '2026-04-21', count: 0 },
							{ date: '2026-04-22', count: 1 },
							{ date: '2026-04-23', count: 0 },
							{ date: '2026-04-24', count: 1 },
							{ date: '2026-04-25', count: 0 },
							{ date: '2026-04-26', count: 0 },
							{ date: '2026-04-27', count: 1 },
						],
					}}
					onSelectAlert={() => {}}
					alerts={[
						{
							id: 'alert-1',
							deviceId: 'device-1',
							assetId: 'asset-1',
							assetTag: 'AST-1',
							source: 'clamav',
							severity: 'critical',
							title: 'Malware detected in downloads',
							detail: 'Trojan signature found in a downloaded archive.',
							acknowledged: false,
							resolved: false,
							createdAt: '2026-04-27T09:00:00Z',
						},
						{
							id: 'alert-2',
							deviceId: 'device-1',
							assetId: 'asset-1',
							hostname: 'itms-laptop-01',
							source: 'clamav',
							severity: 'warning',
							title: 'Scan failed on temp directory',
							detail: 'Permission denied while scanning /tmp/cache.',
							acknowledged: true,
							resolved: false,
							createdAt: '2026-04-27T08:00:00Z',
						},
						{
							id: 'alert-3',
							deviceId: 'device-2',
							assetId: 'asset-2',
							assetName: 'Finance Workstation',
							source: 'clamav',
							severity: 'info',
							title: 'ClamScan scan clean',
							detail: 'No infected files were found.',
							acknowledged: true,
							resolved: true,
							createdAt: '2026-04-27T07:00:00Z',
						},
					]}
				/>
			</MemoryRouter>,
		);

		expect(markup).toContain('Malware Review Dashboard');
		expect(markup).toContain('Severity Mix');
		expect(markup).toContain('Response Posture');
		expect(markup).toContain('Trend Buckets');
		expect(markup).toContain('Open Full ClamScan Queue');
		expect(markup).toContain('>3<');
		expect(markup).toContain('>5<');
		expect(markup).toContain('>2<');
		expect(markup).toContain('Acknowledged');
		expect(markup).toContain('Malware detected in downloads');
		expect(markup).toContain('Finance Workstation');
	});
});