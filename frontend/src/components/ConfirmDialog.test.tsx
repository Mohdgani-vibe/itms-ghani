import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import ConfirmDialog from './ConfirmDialog';

describe('ConfirmDialog', () => {
  it('renders confirm-action dialog content', () => {
    const markup = renderToStaticMarkup(
      <ConfirmDialog
        open={true}
        title="Remove Asset From User"
        message="This will remove the asset assignment from the current user but keep the asset in ITMS."
        confirmLabel="Remove From User"
        cancelLabel="Keep Assigned"
        tone="default"
        onConfirm={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    expect(markup).toContain('Confirm Action');
    expect(markup).toContain('Remove Asset From User');
    expect(markup).toContain('Remove From User');
    expect(markup).toContain('Keep Assigned');
  });

  it('renders destructive tone and busy state', () => {
    const markup = renderToStaticMarkup(
      <ConfirmDialog
        open={true}
        title="Delete Asset"
        message="This will permanently delete the asset from ITMS and cannot be undone."
        confirmLabel="Delete Asset"
        tone="danger"
        busy={true}
        onConfirm={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    expect(markup).toContain('Destructive Action');
    expect(markup).toContain('Delete Asset');
    expect(markup).toContain('Working...');
    expect(markup).toContain('disabled=""');
  });

  it('renders nothing when closed', () => {
    const markup = renderToStaticMarkup(
      <ConfirmDialog
        open={false}
        title="Delete Asset"
        message="Message"
        onConfirm={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    expect(markup).toBe('');
  });
});