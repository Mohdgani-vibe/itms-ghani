import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import SettingsWorkflowRoutingPanel from './SettingsWorkflowRoutingPanel';

describe('SettingsWorkflowRoutingPanel', () => {
  it('renders workflow toggles and fallback assignee options', () => {
    const markup = renderToStaticMarkup(
      <SettingsWorkflowRoutingPanel
        canEditWorkflowSettings={true}
        workflowSettings={{
          requestAutoAssignEnabled: true,
          chatAutoRouteEnabled: false,
          requestFallbackAssigneeId: 'user-1',
          chatFallbackAssigneeId: 'user-2',
        }}
        ticketAssigneeUsers={[
          { id: 'user-1', fullName: 'Ava Admin', email: 'ava@example.com', role: 'admin' },
        ]}
        chatMemberUsers={[
          { id: 'user-2', fullName: 'Ian IT', email: 'ian@example.com', role: 'it' },
        ]}
        onWorkflowSettingsChange={vi.fn()}
      />,
    );

    expect(markup).toContain('Enable request auto-assignment');
    expect(markup).toContain('Enable chat subject routing');
    expect(markup).toContain('Request Fallback Assignee');
    expect(markup).toContain('Chat Fallback Assignee');
    expect(markup).toContain('Ava Admin • admin');
    expect(markup).toContain('Ian IT • it');
    expect(markup).toContain('value="user-1"');
    expect(markup).toContain('value="user-2"');
  });

  it('renders disabled fallback selects when editing is unavailable', () => {
    const markup = renderToStaticMarkup(
      <SettingsWorkflowRoutingPanel
        canEditWorkflowSettings={false}
        workflowSettings={{
          requestAutoAssignEnabled: false,
          chatAutoRouteEnabled: false,
          requestFallbackAssigneeId: null,
          chatFallbackAssigneeId: null,
        }}
        ticketAssigneeUsers={[]}
        chatMemberUsers={[]}
        onWorkflowSettingsChange={vi.fn()}
      />,
    );

    expect(markup).toContain('disabled=""');
    expect(markup).toContain('No fallback assignee');
  });
});