import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import UserImportsPanel from './UserImportsPanel';

describe('UserImportsPanel', () => {
  it('renders CSV actions and the current loading label', () => {
    const markup = renderToStaticMarkup(
      <UserImportsPanel
        csvActionLoading="template"
        importingUsers={false}
        onDownloadMinimalTemplate={vi.fn()}
        onDownloadTemplate={vi.fn()}
        onExportUsers={vi.fn()}
        onOpenImportPicker={vi.fn()}
      />,
    );

    expect(markup).toContain('Import / Export');
    expect(markup).toContain('User CSV tools');
    expect(markup).toContain('Download Minimal Template');
    expect(markup).toContain('Downloading...');
    expect(markup).toContain('Export Users');
    expect(markup).toContain('Import CSV');
    expect(markup).toContain('disabled=""');
  });

  it('renders importing state on the upload action', () => {
    const markup = renderToStaticMarkup(
      <UserImportsPanel
        csvActionLoading=""
        importingUsers={true}
        onDownloadMinimalTemplate={vi.fn()}
        onDownloadTemplate={vi.fn()}
        onExportUsers={vi.fn()}
        onOpenImportPicker={vi.fn()}
      />,
    );

    expect(markup).toContain('Importing...');
    expect(markup).toContain('disabled=""');
  });
});