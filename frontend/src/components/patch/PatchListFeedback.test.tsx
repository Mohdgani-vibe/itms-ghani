import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import PatchListFeedback from './PatchListFeedback';

describe('PatchListFeedback', () => {
  it('renders error and success banners when both are present', () => {
    const markup = renderToStaticMarkup(
      <PatchListFeedback
        error="Salt API is unavailable"
        successMessage="Patch report saved successfully"
      />,
    );

    expect(markup).toContain('Salt API is unavailable');
    expect(markup).toContain('Patch report saved successfully');
    expect(markup).toContain('text-rose-700');
    expect(markup).toContain('text-emerald-700');
  });
});