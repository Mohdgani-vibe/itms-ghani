import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import SettingsRequestTypeOwnersPanel from './SettingsRequestTypeOwnersPanel';

describe('SettingsRequestTypeOwnersPanel', () => {
  it('renders request type owner selectors with assignee options', () => {
    const markup = renderToStaticMarkup(
      <SettingsRequestTypeOwnersPanel
        canEditWorkflowSettings={true}
        requestRouteTypes={['Portal Access', 'Device Enrollment']}
        ticketAssigneeUsers={[{ id: 'user-1', fullName: 'Ava Admin', email: 'ava@example.com', role: 'admin' }]}
        getTypeAssignee={(type) => type === 'Portal Access' ? 'user-1' : ''}
        onTypeChange={vi.fn()}
      />,
    );

    expect(markup).toContain('Request Type Owners');
    expect(markup).toContain('Assign fixed owners for the main request categories already used across the portal.');
    expect(markup).toContain('Portal Access');
    expect(markup).toContain('Device Enrollment');
    expect(markup).toContain('No dedicated owner');
    expect(markup).toContain('Ava Admin • admin');
  });

  it('renders disabled selectors when workflow settings are read-only', () => {
    const markup = renderToStaticMarkup(
      <SettingsRequestTypeOwnersPanel
        canEditWorkflowSettings={false}
        requestRouteTypes={['Portal Access']}
        ticketAssigneeUsers={[]}
        getTypeAssignee={() => ''}
        onTypeChange={vi.fn()}
      />,
    );

    expect(markup).toContain('disabled=""');
  });
});