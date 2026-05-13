import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import SettingsWorkflowMembersPanel from './SettingsWorkflowMembersPanel';

describe('SettingsWorkflowMembersPanel', () => {
  it('renders workflow member drafts, existing members, and add/remove controls', () => {
    const markup = renderToStaticMarkup(
      <SettingsWorkflowMembersPanel
        canEditWorkflowSettings={true}
        hasActiveEmployeeWorkflowUsers={true}
        ticketAssigneeDraft="user-1"
        chatMemberDraft="user-2"
        availableTicketAssigneeOptions={[{ id: 'user-1', fullName: 'Ava Admin', email: 'ava@example.com', role: 'admin' }]}
        availableChatMemberOptions={[{ id: 'user-2', fullName: 'Ian IT', email: 'ian@example.com', role: 'it' }]}
        ticketAssigneeUsers={[{ id: 'user-1', fullName: 'Ava Admin', email: 'ava@example.com', role: 'admin' }]}
        chatMemberUsers={[{ id: 'user-2', fullName: 'Ian IT', email: 'ian@example.com', role: 'it' }]}
        onTicketAssigneeDraftChange={vi.fn()}
        onChatMemberDraftChange={vi.fn()}
        onAddWorkflowMember={vi.fn()}
        onRemoveWorkflowMember={vi.fn()}
      />,
    );

    expect(markup).toContain('Ticket Assignee List');
    expect(markup).toContain('Chat Member List');
    expect(markup).toContain('Select assignee');
    expect(markup).toContain('Select chat member');
    expect(markup).toContain('Ava Admin • admin');
    expect(markup).toContain('Ian IT • it');
    expect(markup).toContain('Add');
    expect(markup).toContain('Ava Admin • Remove');
    expect(markup).toContain('Ian IT • Remove');
  });

  it('renders the default eligibility messages when no explicit members are configured', () => {
    const markup = renderToStaticMarkup(
      <SettingsWorkflowMembersPanel
        canEditWorkflowSettings={false}
        hasActiveEmployeeWorkflowUsers={false}
        ticketAssigneeDraft=""
        chatMemberDraft=""
        availableTicketAssigneeOptions={[]}
        availableChatMemberOptions={[]}
        ticketAssigneeUsers={[]}
        chatMemberUsers={[]}
        onTicketAssigneeDraftChange={vi.fn()}
        onChatMemberDraftChange={vi.fn()}
        onAddWorkflowMember={vi.fn()}
        onRemoveWorkflowMember={vi.fn()}
      />,
    );

    expect(markup).toContain('All active IT/admin users remain eligible until employee users are imported or you narrow this list.');
    expect(markup).toContain('All active IT team and super admin users remain eligible until you add specific names.');
    expect(markup).toContain('disabled=""');
  });
});