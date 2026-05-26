import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../hooks/useAlertsDerivedState', () => ({
  useAlertsDerivedState: vi.fn(),
}));

vi.mock('../components/alerts/AlertsHeroSection', () => ({ AlertsHeroSection: () => null }));
vi.mock('../components/alerts/AlertsStatusStrip', () => ({ AlertsStatusStrip: () => null }));
vi.mock('../components/alerts/AlertsMainTabs', () => ({ AlertsMainTabs: () => null }));
vi.mock('../components/alerts/AlertsDashboardSourceGrid', () => ({ AlertsDashboardSourceGrid: () => null }));
vi.mock('../components/alerts/AlertsDetailPane', () => ({ AlertsDetailPane: () => null }));
vi.mock('../components/alerts/AlertsFeedPane', () => ({ AlertsFeedPane: () => null }));
vi.mock('../components/alerts/AlertsQueueOverviewCard', () => ({ AlertsQueueOverviewCard: () => null }));
vi.mock('../components/alerts/AlertsRecentTable', () => ({ AlertsRecentTable: () => null }));
vi.mock('../components/alerts/AlertsSourceWorkspacePanel', () => ({ AlertsSourceWorkspacePanel: () => null }));
vi.mock('../components/alerts/AlertsToolbar', () => ({ AlertsToolbar: () => null }));
vi.mock('../components/EmbeddedConsoleModal', () => ({ default: () => null }));
vi.mock('../components/PatchRunReportModal', () => ({ default: () => null }));

import {
  emptyDashboardMap,
  formatDateTime,
  formatNumber,
  formatRelativeTime,
  normalizeSeverity,
  normalizeSourceKey,
  parseTimestamp,
  sourceLabel,
  systemName,
} from './alertsUtils';

describe('Alerts helpers', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('creates source maps and formats numeric counts', () => {
    expect(emptyDashboardMap(3)).toEqual({ wazuh: 3, openscap: 3, clamav: 3 });
    expect(formatNumber()).toBe('0');
    expect(formatNumber(12345)).toBe('12,345');
  });

  it('parses and formats timestamps with unknown fallbacks', () => {
    vi.spyOn(Date, 'now').mockReturnValue(new Date('2026-05-09T12:00:00Z').getTime());

    expect(parseTimestamp('invalid')).toBe(0);
    expect(parseTimestamp('2026-05-09T10:00:00Z')).toBeGreaterThan(0);
    expect(formatDateTime('invalid')).toBe('Unknown time');
    expect(formatDateTime('2026-05-09T10:00:00Z')).not.toBe('Unknown time');
    expect(formatRelativeTime('invalid')).toBe('Unknown time');
    expect(formatRelativeTime('2026-05-09T11:30:00Z')).toBe('30 min ago');
    expect(formatRelativeTime('2026-05-09T10:00:00Z')).toBe('2 hr ago');
    expect(formatRelativeTime('2026-05-07T12:00:00Z')).toBe('2 days ago');
  });

  it('normalizes severity and source labels', () => {
    expect(normalizeSeverity('critical')).toBe('critical');
    expect(normalizeSeverity('warning')).toBe('medium');
    expect(normalizeSeverity('something-else')).toBe('low');
    expect(normalizeSourceKey('open_scap')).toBe('openscap');
    expect(normalizeSourceKey('clamscan')).toBe('clamav');
    expect(normalizeSourceKey('salt_patch')).toBe('patch');
    expect(normalizeSourceKey('terminal_session')).toBe('terminal');
    expect(sourceLabel('wazuh')).toBe('Wazuh');
    expect(sourceLabel('open_scap')).toBe('OpenSCAP');
    expect(sourceLabel('custom', ' Custom Label ')).toBe('Custom Label');
    expect(sourceLabel('', undefined)).toBe('Unknown');
  });

  it('prefers the best available system identifier', () => {
    expect(systemName({ hostname: 'host-1' } as never)).toBe('host-1');
    expect(systemName({ assetName: 'Device Name' } as never)).toBe('Device Name');
    expect(systemName({ assetTag: 'AT-100' } as never)).toBe('AT-100');
    expect(systemName({ deviceId: 'dev-9' } as never)).toBe('dev-9');
    expect(systemName({} as never)).toBe('Unknown system');
  });
});