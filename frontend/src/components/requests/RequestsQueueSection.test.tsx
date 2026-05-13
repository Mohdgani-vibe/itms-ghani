import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import RequestsQueueSection from './RequestsQueueSection';

describe('RequestsQueueSection', () => {
  it('renders section header, visible count, and child content', () => {
    const markup = renderToStaticMarkup(
      <RequestsQueueSection
        title="Pending Queue"
        description="Requests waiting for triage or approval."
        emptyMessage="No pending requests"
        visibleItems={4}
        tone={{
          shell: 'border-sky-100 bg-white',
          badge: 'bg-sky-100 text-sky-700',
          heading: 'text-zinc-950',
          subtext: 'text-zinc-600',
        }}
      >
        <div>Queue content</div>
      </RequestsQueueSection>,
    );

    expect(markup).toContain('Pending Queue');
    expect(markup).toContain('Requests waiting for triage or approval.');
    expect(markup).toContain('Visible Items');
    expect(markup).toContain('>4<');
    expect(markup).toContain('Queue content');
    expect(markup).not.toContain('No pending requests');
  });

  it('renders the empty message when no items are visible', () => {
    const markup = renderToStaticMarkup(
      <RequestsQueueSection
        title="Pending Queue"
        description="Requests waiting for triage or approval."
        emptyMessage="No pending requests"
        visibleItems={0}
        tone={{
          shell: 'border-sky-100 bg-white',
          badge: 'bg-sky-100 text-sky-700',
          heading: 'text-zinc-950',
          subtext: 'text-zinc-600',
        }}
      >
        <div>Queue content</div>
      </RequestsQueueSection>,
    );

    expect(markup).toContain('No pending requests');
  });
});