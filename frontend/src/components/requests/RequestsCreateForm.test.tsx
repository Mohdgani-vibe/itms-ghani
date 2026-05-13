import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import RequestsCreateForm from './RequestsCreateForm';

describe('RequestsCreateForm', () => {
  it('renders request creation fields and submit state', () => {
    const markup = renderToStaticMarkup(
      <RequestsCreateForm
        requestForm={{
          type: 'Portal access',
          title: 'Enable reports portal',
          description: 'Grant access to the reports portal for a new team member.',
        }}
        requestSubmitting={false}
        onSubmit={vi.fn()}
        onTypeChange={vi.fn()}
        onTitleChange={vi.fn()}
        onDescriptionChange={vi.fn()}
      />,
    );

    expect(markup).toContain('Raise A Request');
    expect(markup).toContain('IT and super admin can raise work directly from the queue');
    expect(markup).toContain('Create Request');
    expect(markup).toContain('Request Type');
    expect(markup).toContain('Portal access');
    expect(markup).toContain('Laptop change');
    expect(markup).toContain('Short request title');
    expect(markup).toContain('Enable reports portal');
    expect(markup).toContain('Description');
    expect(markup).toContain('Grant access to the reports portal for a new team member.');
  });

  it('renders the submitting state', () => {
    const markup = renderToStaticMarkup(
      <RequestsCreateForm
        requestForm={{
          type: 'Other',
          title: '',
          description: '',
        }}
        requestSubmitting={true}
        onSubmit={vi.fn()}
        onTypeChange={vi.fn()}
        onTitleChange={vi.fn()}
        onDescriptionChange={vi.fn()}
      />,
    );

    expect(markup).toContain('Submitting...');
    expect(markup).toContain('disabled=""');
  });
});