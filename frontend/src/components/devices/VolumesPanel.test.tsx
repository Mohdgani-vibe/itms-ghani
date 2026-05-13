import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import VolumesPanel from './VolumesPanel';

describe('VolumesPanel', () => {
  it('renders storage summary, volume details, and disk layout output', () => {
    const markup = renderToStaticMarkup(
      <VolumesPanel
        totalStorage="512 GB"
        encryptedVolumeCount={1}
        diskLayout="Disk /dev/nvme0n1: 512 GB"
        volumes={[
          {
            name: 'rootfs',
            path: '/dev/nvme0n1p2',
            size: '512 GB',
            filesystem: 'ext4',
            device_type: 'partition',
            mountpoint: '/',
            available: '310 GB',
            used_percent: '39%',
            uuid: 'uuid-123',
            parent: 'nvme0n1',
            encrypted: true,
            encryption: 'LUKS',
          },
        ]}
        formatDetailValue={(value, fallback = 'Unknown') => value || fallback}
      />,
    );

    expect(markup).toContain('Volumes');
    expect(markup).toContain('512 GB');
    expect(markup).toContain('>1<');
    expect(markup).toContain('rootfs');
    expect(markup).toContain('/dev/nvme0n1p2 • /');
    expect(markup).toContain('LUKS');
    expect(markup).toContain('partition');
    expect(markup).toContain('ext4');
    expect(markup).toContain('310 GB');
    expect(markup).toContain('39%');
    expect(markup).toContain('uuid-123');
    expect(markup).toContain('Disk Layout / fdisk');
    expect(markup).toContain('Disk /dev/nvme0n1: 512 GB');
  });

  it('renders volume and disk-layout fallbacks when no data is reported', () => {
    const markup = renderToStaticMarkup(
      <VolumesPanel
        totalStorage="Unknown"
        encryptedVolumeCount={0}
        diskLayout={null}
        volumes={[]}
        formatDetailValue={(value, fallback = 'Unknown') => value || fallback}
      />,
    );

    expect(markup).toContain('No per-volume or encryption details have been reported by the current inventory snapshot yet.');
    expect(markup).toContain('fdisk output is not reported yet for this asset.');
  });
});