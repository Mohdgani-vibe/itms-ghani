import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import SoftwareInventoryPanel from './SoftwareInventoryPanel';

describe('SoftwareInventoryPanel', () => {
  it('renders highlighted and full installed software for compute assets', () => {
    const markup = renderToStaticMarkup(
      <SoftwareInventoryPanel
        computeAsset={true}
        installedApps={[
          { id: 'app-1', name: 'Google Chrome', version: '136.0', installDate: '2026-05-01', source: 'apt' },
          { id: 'app-2', name: 'Salt Minion', version: '3007', source: 'deb' },
        ]}
        highlightedInstalledApps={[
          { id: 'app-2', name: 'Salt Minion', version: '3007' },
        ]}
        softwareSourceLabel={(source) => source === 'apt' ? 'APT' : source === 'deb' ? 'Debian package' : 'Unknown source'}
      />,
    );

    expect(markup).toContain('Installed Software');
    expect(markup).toContain('Detected Key Software');
    expect(markup).toContain('Salt Minion • 3007');
    expect(markup).toContain('Google Chrome');
    expect(markup).toContain('APT • 136.0 • Installed 2026-05-01');
    expect(markup).toContain('Debian package • 3007');
  });

  it('renders the non-compute fallback message', () => {
    const markup = renderToStaticMarkup(
      <SoftwareInventoryPanel
        computeAsset={false}
        installedApps={[]}
        highlightedInstalledApps={[]}
        softwareSourceLabel={(source) => source || 'Unknown'}
      />,
    );

    expect(markup).toContain('Asset Notes');
    expect(markup).toContain('This asset is treated as non-compute inventory, so processor, operating system, and installed software details are not shown.');
  });
});