import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { AlertsToolbar } from './AlertsToolbar';

describe('AlertsToolbar', () => {
  it('renders source tabs, counts, and active search summary', () => {
    const markup = renderToStaticMarkup(
      <AlertsToolbar
        tabs={[
          { value: 'all', label: 'All Alerts' },
          { value: 'wazuh', label: 'Wazuh' },
          { value: 'openscap', label: 'OpenSCAP' },
        ]}
        sourceFilter="wazuh"
        totalAlerts={42}
        sourceCountMap={new Map<string, number>([
          ['wazuh', 7],
          ['openscap', 5],
        ])}
        onSelectSourceFilter={() => {}}
        renderSourceIcon={(value) => <span>{value}</span>}
        searchQuery="kernel drift"
        onSearchQueryChange={() => {}}
        sourceOptions={[
          { value: 'wazuh', label: 'Wazuh' },
          { value: 'openscap', label: 'OpenSCAP Hardening' },
        ]}
        sourceLabelMap={new Map<string, string>([
          ['wazuh', 'Wazuh'],
          ['openscap', 'OpenSCAP Hardening'],
        ])}
      />,
    );

    expect(markup).toContain('All Alerts');
    expect(markup).toContain('Wazuh');
    expect(markup).toContain('OpenSCAP');
    expect(markup).toContain('>42<');
    expect(markup).toContain('>7<');
    expect(markup).toContain('Search alert title, asset, hostname, source');
    expect(markup).toContain('42 results');
    expect(markup).toContain('Source: Wazuh');
    expect(markup).toContain('Search: kernel drift');
  });

  it('hides search controls when requested', () => {
    const markup = renderToStaticMarkup(
      <AlertsToolbar
        tabs={[{ value: 'all', label: 'All Alerts' }]}
        sourceFilter="all"
        totalAlerts={1}
        sourceCountMap={new Map<string, number>()}
        onSelectSourceFilter={() => {}}
        renderSourceIcon={() => <span>icon</span>}
        searchQuery=""
        onSearchQueryChange={() => {}}
        sourceOptions={[]}
        sourceLabelMap={new Map<string, string>()}
        showSearchControls={false}
      />,
    );

    expect(markup).toContain('All Alerts');
    expect(markup).toContain('>1<');
    expect(markup).not.toContain('Search alert title, asset, hostname, source');
    expect(markup).not.toContain('All sources');
  });
});