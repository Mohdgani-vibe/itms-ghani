import { Cpu, Shield, UserRound } from 'lucide-react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import DeviceDetailOverview from './DeviceDetailOverview';

describe('DeviceDetailOverview', () => {
  it('renders device workspace metadata, actions, and section chips', () => {
    const markup = renderToStaticMarkup(
      <DeviceDetailOverview
        hostname="ops-laptop-01"
        assetId="ITMS-1001"
        deviceType="Laptop"
        osName="Ubuntu 24.04"
        computeAsset={true}
        canOperate={true}
        startingTerminal={false}
        canStartTerminal={true}
        canOpenPatchConsole={true}
        onBack={vi.fn()}
        onStartTerminal={vi.fn()}
        onOpenSaltConsole={vi.fn()}
        error=""
        successMessage="Ready for maintenance"
        overviewCards={[
          { label: 'Owner', value: 'IT Operations', icon: UserRound },
          { label: 'Compliance', value: '92%', icon: Shield },
          { label: 'Hardware', value: 'Dell Latitude 7440', icon: Cpu },
        ]}
        detailSections={[
          ['hardware', 'Hardware'],
          ['software', 'Software'],
          ['security', 'Wazuh Findings'],
        ]}
        activeSection="software"
        onSelectSection={vi.fn()}
      />,
    );

    expect(markup).toContain('Device Workspace');
    expect(markup).toContain('ops-laptop-01');
    expect(markup).toContain('Open SSH Terminal');
    expect(markup).toContain('Open Salt Console');
    expect(markup).toContain('Ready for maintenance');
    expect(markup).toContain('3 sections');
    expect(markup).toContain('Wazuh Findings');
  });

  it('hides operational actions for non-operable assets', () => {
    const markup = renderToStaticMarkup(
      <DeviceDetailOverview
        hostname="meeting-room-display"
        assetId="ITMS-ACC-77"
        deviceType="Display"
        osName={null}
        computeAsset={false}
        canOperate={false}
        startingTerminal={false}
        canStartTerminal={false}
        canOpenPatchConsole={false}
        onBack={vi.fn()}
        onStartTerminal={vi.fn()}
        onOpenSaltConsole={vi.fn()}
        error=""
        successMessage=""
        overviewCards={[]}
        detailSections={[
          ['hardware', 'Inventory'],
        ]}
        activeSection="hardware"
        onSelectSection={vi.fn()}
      />,
    );

    expect(markup).toContain('Inventory Asset');
    expect(markup).not.toContain('Open SSH Terminal');
    expect(markup).not.toContain('Open Salt Console');
  });
});