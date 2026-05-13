import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import PatchDeviceTablePanel from './PatchDeviceTablePanel';

describe('PatchDeviceTablePanel', () => {
  it('renders loading, table chrome, and summary label', () => {
    const markup = renderToStaticMarkup(
      <PatchDeviceTablePanel
        searchQuery=""
        totalLabel="18 managed devices"
        loading={true}
        isEmpty={false}
        onSearchQueryChange={() => {}}
        rows={null}
        pagination={null}
      />,
    );

    expect(markup).toContain('Device Queue');
    expect(markup).toContain('Managed patch devices');
    expect(markup).toContain('Search Hostname, Department...');
    expect(markup).toContain('18 managed devices');
    expect(markup).toContain('Loading device patch statuses...');
    expect(markup).toContain('Patch Group');
    expect(markup).toContain('Compliance');
  });

  it('renders empty state and pagination content when provided', () => {
    const markup = renderToStaticMarkup(
      <PatchDeviceTablePanel
        searchQuery="ops"
        totalLabel="0 managed devices"
        loading={false}
        isEmpty={true}
        onSearchQueryChange={() => {}}
        rows={<tr><td>ignored</td></tr>}
        pagination={<div>Custom pagination</div>}
      />,
    );

    expect(markup).toContain('No managed devices found.');
    expect(markup).toContain('Custom pagination');
  });
});