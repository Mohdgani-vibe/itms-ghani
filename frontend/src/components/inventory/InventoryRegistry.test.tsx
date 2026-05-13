import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import InventoryRegistry from './InventoryRegistry';

describe('InventoryRegistry', () => {
  it('renders the forwarded empty registry state', () => {
    const markup = renderToStaticMarkup(<InventoryRegistry />);

    expect(markup).toContain('Inventory Registry');
    expect(markup).toContain('Registry records are served from the live inventory workspace.');
  });
});