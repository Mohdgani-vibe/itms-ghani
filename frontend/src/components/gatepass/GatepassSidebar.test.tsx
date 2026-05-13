import { FileText, Inbox, ListChecks } from 'lucide-react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import GatepassSidebar from './GatepassSidebar';

describe('GatepassSidebar', () => {
  it('renders navigation items and numeric badges', () => {
    const markup = renderToStaticMarkup(
      <GatepassSidebar
        items={[
          { id: 'create', label: 'New Pass', detail: 'Draft and issue a gatepass', icon: FileText },
          { id: 'pending', label: 'Pending', detail: 'Awaiting approval', icon: Inbox, badge: 3 },
          { id: 'reports', label: 'Reports', detail: 'Open archived PDFs', icon: ListChecks, badge: 0 },
        ]}
        activeSection="pending"
        onSectionChange={vi.fn()}
      />,
    );

    expect(markup).toContain('Gatepass Pro');
    expect(markup).toContain('Dispatch and tracking');
    expect(markup).toContain('New Pass');
    expect(markup).toContain('Pending');
    expect(markup).toContain('Awaiting approval');
    expect(markup).toContain('>3<');
    expect(markup).toContain('Reports');
  });
});