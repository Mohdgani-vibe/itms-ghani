import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

const terminalMocks = vi.hoisted(() => ({
  useLocationMock: vi.fn(),
  useNavigateMock: vi.fn(),
  useParamsMock: vi.fn(),
  terminalConsoleViewMock: vi.fn(),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useLocation: terminalMocks.useLocationMock,
    useNavigate: terminalMocks.useNavigateMock,
    useParams: terminalMocks.useParamsMock,
  };
});

vi.mock('../components/TerminalConsoleView', () => ({
  default: (props: unknown) => {
    terminalMocks.terminalConsoleViewMock(props);
    return <div>terminal-console-view</div>;
  },
}));

import TerminalConsole from './TerminalConsole';

describe('TerminalConsole', () => {
  it('forwards route params and query-derived embedded state to the view', () => {
    const navigate = vi.fn();
    terminalMocks.useLocationMock.mockReturnValue({ search: '?embedded=1&prefill=%20sudo%20salt-call%20state.apply%20' });
    terminalMocks.useNavigateMock.mockReturnValue(navigate);
    terminalMocks.useParamsMock.mockReturnValue({ minionId: 'minion-42' });

    const markup = renderToStaticMarkup(<TerminalConsole />);

    expect(markup).toContain('terminal-console-view');
    expect(terminalMocks.terminalConsoleViewMock).toHaveBeenCalledWith({
      minionId: 'minion-42',
      embedded: true,
      prefilledCommand: 'sudo salt-call state.apply',
      onBack: undefined,
    });
    expect(navigate).not.toHaveBeenCalled();
  });

  it('provides a back handler when the page is not embedded', () => {
    const navigate = vi.fn();
    terminalMocks.useLocationMock.mockReturnValue({ search: '?prefill=  uptime  ' });
    terminalMocks.useNavigateMock.mockReturnValue(navigate);
    terminalMocks.useParamsMock.mockReturnValue({ minionId: 'minion-99' });

    renderToStaticMarkup(<TerminalConsole />);

    const props = terminalMocks.terminalConsoleViewMock.mock.calls.at(-1)?.[0] as { onBack?: () => void };
    expect(props).toMatchObject({
      minionId: 'minion-99',
      embedded: false,
      prefilledCommand: 'uptime',
    });
    props.onBack?.();
    expect(navigate).toHaveBeenCalledWith(-1);
  });
});