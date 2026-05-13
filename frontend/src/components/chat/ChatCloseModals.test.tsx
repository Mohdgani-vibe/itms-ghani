import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import ChatCloseModals from './ChatCloseModals';

describe('ChatCloseModals', () => {
  it('renders the close confirmation dialog and busy state', () => {
    const markup = renderToStaticMarkup(
      <ChatCloseModals
        closeDialogOpen={true}
        closeResult={null}
        closingChannel={true}
        canCreateChat={true}
        onCancelClose={vi.fn()}
        onConfirmClose={vi.fn()}
        onAcknowledgeCloseResult={vi.fn()}
      />,
    );

    expect(markup).toContain('Close ticket and chat?');
    expect(markup).toContain('Closing this chat will keep the conversation history and convert it into a linked ticket for follow-up.');
    expect(markup).toContain('Cancel');
    expect(markup).toContain('Closing...');
    expect(markup).toContain('disabled=""');
  });

  it('renders the linked ticket close result and okay acknowledgement copy', () => {
    const markup = renderToStaticMarkup(
      <ChatCloseModals
        closeDialogOpen={false}
        closeResult={{ ticketNumber: 'REQ-2211' }}
        closingChannel={false}
        canCreateChat={true}
        onCancelClose={vi.fn()}
        onConfirmClose={vi.fn()}
        onAcknowledgeCloseResult={vi.fn()}
      />,
    );

    expect(markup).toContain('Ticket closed');
    expect(markup).toContain('Follow-up is now tracked under REQ-2211. Thanks.');
    expect(markup).toContain('Okay');
  });

  it('renders the non-creator acknowledgement label when chat creation is unavailable', () => {
    const markup = renderToStaticMarkup(
      <ChatCloseModals
        closeDialogOpen={false}
        closeResult={{}}
        closingChannel={false}
        canCreateChat={false}
        onCancelClose={vi.fn()}
        onConfirmClose={vi.fn()}
        onAcknowledgeCloseResult={vi.fn()}
      />,
    );

    expect(markup).toContain('The chat is closed. Thanks.');
    expect(markup).toContain('Close');
  });
});