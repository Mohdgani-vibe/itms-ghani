import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import RequestSelectedDetailPanel from './RequestSelectedDetailPanel';

describe('RequestSelectedDetailPanel', () => {
  it('renders the selected request shell and nested content', () => {
    const markup = renderToStaticMarkup(
      <RequestSelectedDetailPanel>
        <div>Detailed request content</div>
      </RequestSelectedDetailPanel>,
    );

    expect(markup).toContain('Selected Request');
    expect(markup).toContain('Table view is for scanning. Full request controls stay available below for the selected row.');
    expect(markup).toContain('Detailed request content');
  });
});