import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { AlertsDetailEmptyState } from './AlertsDetailEmptyState';

describe('AlertsDetailEmptyState', () => {
  it('renders the empty detail-pane guidance', () => {
    const markup = renderToStaticMarkup(<AlertsDetailEmptyState />);

    expect(markup).toContain('Select an alert');
    expect(markup).toContain('Pick any item from the feed to inspect asset context, compare related findings, and run the available response actions.');
  });
});