import { ShieldCheck } from 'lucide-react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import DetailSectionCard from './DetailSectionCard';

describe('DetailSectionCard', () => {
  it('renders the default grid layout with footer content', () => {
    const markup = renderToStaticMarkup(
      <DetailSectionCard
        title="Security"
        icon={<ShieldCheck className="mr-2 h-4 w-4" />}
        items={[
          { label: 'Antivirus', value: 'Enabled' },
          { label: 'Disk Encryption', value: 'LUKS' },
        ]}
        footer={<div>Security footer</div>}
      />,
    );

    expect(markup).toContain('Security');
    expect(markup).toContain('Antivirus');
    expect(markup).toContain('Enabled');
    expect(markup).toContain('Disk Encryption');
    expect(markup).toContain('LUKS');
    expect(markup).toContain('Security footer');
  });

  it('renders the brand stack layout', () => {
    const markup = renderToStaticMarkup(
      <DetailSectionCard
        title="Operations"
        tone="brand"
        layout="stack"
        items={[
          { label: 'Owner', value: 'IT' },
          { label: 'Status', value: 'Healthy' },
        ]}
      />,
    );

    expect(markup).toContain('Operations');
    expect(markup).toContain('Owner:');
    expect(markup).toContain('IT');
    expect(markup).toContain('Status:');
    expect(markup).toContain('Healthy');
  });
});