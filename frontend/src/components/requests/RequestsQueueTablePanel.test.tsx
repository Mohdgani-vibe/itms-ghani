import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import RequestsQueueTablePanel from './RequestsQueueTablePanel';

describe('RequestsQueueTablePanel', () => {
  it('renders the queue table shell, row content, and selected detail slot', () => {
    const markup = renderToStaticMarkup(
      <RequestsQueueTablePanel
        allSelected={true}
        onToggleAll={vi.fn()}
        rows={<tr><td>REQ-1001</td><td>Portal access</td></tr>}
        selectedDetail={<div>Selected request details</div>}
      />,
    );

    expect(markup).toContain('checked=""');
    expect(markup).toContain('Request');
    expect(markup).toContain('Status');
    expect(markup).toContain('Updated');
    expect(markup).toContain('Actions');
    expect(markup).toContain('REQ-1001');
    expect(markup).toContain('Selected request details');
  });
});