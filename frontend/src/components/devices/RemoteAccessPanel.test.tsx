import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import RemoteAccessPanel from './RemoteAccessPanel';

describe('RemoteAccessPanel', () => {
  it('renders remote identifiers and tool status cards with fallbacks', () => {
    const markup = renderToStaticMarkup(
      <RemoteAccessPanel
        remoteIdentifierDetails={[
          { label: 'Salt Minion ID', value: 'minion-001' },
          { label: 'AnyDesk ID', value: '123 456 789' },
        ]}
        toolStatuses={[
          { label: 'Salt', status: { status: 'linked', detail: 'Salt minion linked to asset record' } },
          { label: 'RustDesk', status: undefined },
        ]}
        toolStatusTone={(status) => status === 'linked' ? 'bg-emerald-100 text-emerald-700' : 'bg-zinc-100 text-zinc-700'}
      />,
    );

    expect(markup).toContain('Remote Access &amp; IDs');
    expect(markup).toContain('Salt Minion ID');
    expect(markup).toContain('minion-001');
    expect(markup).toContain('AnyDesk ID');
    expect(markup).toContain('Salt Status');
    expect(markup).toContain('linked');
    expect(markup).toContain('Salt minion linked to asset record');
    expect(markup).toContain('RustDesk Status');
    expect(markup).toContain('missing');
    expect(markup).toContain('Not detected');
  });
});