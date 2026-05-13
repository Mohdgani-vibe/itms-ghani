import { beforeEach, describe, expect, it, vi } from 'vitest';

const hookState = vi.hoisted(() => ({
  stateQueue: [] as unknown[],
  setterQueue: [] as Array<ReturnType<typeof vi.fn>>,
  refQueue: [] as Array<{ current: unknown }>,
  chatSocketUrlMock: vi.fn((channelId: string) => `ws://chat/${channelId}`),
  chatSocketProtocolsMock: vi.fn((token: string) => [`bearer.${token}`]),
}));

vi.mock('react', async () => {
  const actual = await vi.importActual<typeof import('react')>('react');
  return {
    ...actual,
    useCallback: <T extends (...args: never[]) => unknown>(fn: T) => fn,
    useEffect: (effect: () => void | (() => void)) => {
      effect();
    },
    useMemo: <T,>(factory: () => T) => factory(),
    useRef: <T,>(initialValue: T) => {
      if (hookState.refQueue.length > 0) {
        return hookState.refQueue.shift() as { current: T };
      }
      return { current: initialValue };
    },
    useState: <T,>(initialValue: T) => {
      const value = hookState.stateQueue.length > 0 ? hookState.stateQueue.shift() as T : initialValue;
      const setter = hookState.setterQueue.length > 0 ? hookState.setterQueue.shift()! : vi.fn();
      return [value, setter] as const;
    },
  };
});

vi.mock('./chatUtils', () => ({
  chatSocketProtocols: hookState.chatSocketProtocolsMock,
  chatSocketUrl: hookState.chatSocketUrlMock,
}));

import { useChatMessaging } from './useChatMessaging';

function queueHookState(overrides: {
  readyChannelId?: string;
  remoteTypingState?: { channelId: string; users: Record<string, string> };
  readySetter?: ReturnType<typeof vi.fn>;
  remoteTypingSetter?: ReturnType<typeof vi.fn>;
  refs?: Array<{ current: unknown }>;
} = {}) {
  hookState.stateQueue.splice(0, hookState.stateQueue.length, ...[
    overrides.readyChannelId ?? '',
    overrides.remoteTypingState ?? { channelId: '', users: {} },
  ]);
  hookState.setterQueue.splice(0, hookState.setterQueue.length, ...[
    overrides.readySetter ?? vi.fn(),
    overrides.remoteTypingSetter ?? vi.fn(),
  ]);
  hookState.refQueue.splice(0, hookState.refQueue.length, ...(
    overrides.refs ?? [
      { current: null },
      { current: null },
      { current: null },
      { current: {} },
      { current: false },
    ]
  ));
}

describe('useChatMessaging', () => {
  beforeEach(() => {
    hookState.stateQueue.splice(0, hookState.stateQueue.length);
    hookState.setterQueue.splice(0, hookState.setterQueue.length);
    hookState.refQueue.splice(0, hookState.refQueue.length);
    hookState.chatSocketUrlMock.mockClear();
    hookState.chatSocketProtocolsMock.mockClear();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('resets message state when no channel is selected and loads the first page when a channel is active', async () => {
    class PassiveWebSocket {
      static OPEN = 1;
      readyState = 1;
      url: string;
      protocols: string[];
      onopen: null | (() => void) = null;
      onclose: null | (() => void) = null;
      onerror: null | (() => void) = null;
      onmessage: null | ((event: { data: string }) => void) = null;
      send = vi.fn();
      close = vi.fn();

      constructor(url: string, protocols: string[]) {
        this.url = url;
        this.protocols = protocols;
      }
    }

    const setMessages = vi.fn();
    const setMessagePage = vi.fn();
    const setTotalMessages = vi.fn();
    const loadMessages = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('WebSocket', PassiveWebSocket as unknown as typeof WebSocket);

    queueHookState();
    useChatMessaging({
      session: null,
      activeChannelId: '',
      draft: '',
      isActiveChannelClosed: false,
      hasOlderMessages: false,
      loadingOlderMessages: false,
      messagePage: 1,
      loadChannels: vi.fn(),
      loadMessages,
      setMessages,
      setMessagePage,
      setTotalMessages,
      setNotice: vi.fn(),
      setDraft: vi.fn(),
    });

    expect(setMessages).toHaveBeenCalledWith([]);
    expect(setMessagePage).toHaveBeenCalledWith(1);
    expect(setTotalMessages).toHaveBeenCalledWith(0);
    expect(loadMessages).not.toHaveBeenCalled();

    setMessages.mockReset();
    setMessagePage.mockReset();
    setTotalMessages.mockReset();
    loadMessages.mockReset();
    queueHookState();
    useChatMessaging({
      session: { token: 'token-123', user: { id: 'user-1', fullName: 'Alex Kumar' } },
      activeChannelId: 'channel-1',
      draft: '',
      isActiveChannelClosed: false,
      hasOlderMessages: true,
      loadingOlderMessages: false,
      messagePage: 2,
      loadChannels: vi.fn(),
      loadMessages,
      setMessages,
      setMessagePage,
      setTotalMessages,
      setNotice: vi.fn(),
      setDraft: vi.fn(),
    });

    expect(setMessagePage).toHaveBeenCalledWith(1);
    expect(setTotalMessages).toHaveBeenCalledWith(0);
    expect(loadMessages).toHaveBeenCalledWith('channel-1', 1, 'replace');
    expect(hookState.chatSocketUrlMock).toHaveBeenCalledWith('channel-1');
    expect(hookState.chatSocketProtocolsMock).toHaveBeenCalledWith('token-123');
  });

  it('sends typing state, sends messages, and loads older messages through the active socket', () => {
    class ActiveWebSocket {
      static instances: ActiveWebSocket[] = [];
      static OPEN = 1;
      readyState = 1;
      url: string;
      protocols: string[];
      onopen: null | (() => void) = null;
      onclose: null | (() => void) = null;
      onerror: null | (() => void) = null;
      onmessage: null | ((event: { data: string }) => void) = null;
      send = vi.fn();
      close = vi.fn();

      constructor(url: string, protocols: string[]) {
        this.url = url;
        this.protocols = protocols;
        ActiveWebSocket.instances.push(this);
      }
    }

    const setDraft = vi.fn();
    const setNotice = vi.fn();
    const loadMessages = vi.fn();
    const clearTimeoutMock = vi.fn();
    const setTimeoutMock = vi.fn(() => 44);
    vi.stubGlobal('window', {
      clearTimeout: clearTimeoutMock,
      setTimeout: setTimeoutMock,
      dispatchEvent: vi.fn(),
    });
    vi.stubGlobal('WebSocket', ActiveWebSocket as unknown as typeof WebSocket);

    queueHookState({
      readyChannelId: 'channel-1',
      refs: [
        { current: null },
        { current: null },
        { current: 18 },
        { current: {} },
        { current: false },
      ],
    });
    const workflow = useChatMessaging({
      session: { token: 'token-123', user: { id: 'user-1', fullName: 'Alex Kumar' } },
      activeChannelId: 'channel-1',
      draft: '  Hello team  ',
      isActiveChannelClosed: false,
      hasOlderMessages: true,
      loadingOlderMessages: false,
      messagePage: 2,
      loadChannels: vi.fn(),
      loadMessages,
      setMessages: vi.fn(),
      setMessagePage: vi.fn(),
      setTotalMessages: vi.fn(),
      setNotice,
      setDraft,
    });
    const socket = ActiveWebSocket.instances[0];

    workflow.handleDraftChange('typing now');
    workflow.handleSend();
    workflow.handleLoadOlderMessages();
    workflow.handleDraftBlur();

    expect(setDraft).toHaveBeenNthCalledWith(1, 'typing now');
    expect(socket.send).toHaveBeenNthCalledWith(1, JSON.stringify({ type: 'typing', channelId: 'channel-1', typing: true }));
    expect(setTimeoutMock).toHaveBeenCalledWith(expect.any(Function), 1200);
    expect(socket.send).toHaveBeenNthCalledWith(2, JSON.stringify({ channelId: 'channel-1', body: 'Hello team' }));
    expect(clearTimeoutMock).toHaveBeenCalledWith(18);
    expect(socket.send).toHaveBeenNthCalledWith(3, JSON.stringify({ type: 'typing', channelId: 'channel-1', typing: false }));
    expect(setDraft).toHaveBeenLastCalledWith('');
    expect(setNotice).toHaveBeenCalledWith('');
    expect(loadMessages).toHaveBeenCalledWith('channel-1', 3, 'prepend');
    expect(socket.send).toHaveBeenNthCalledWith(4, JSON.stringify({ type: 'typing', channelId: 'channel-1', typing: false }));
  });

  it('reacts to websocket events by marking readiness, appending messages, and surfacing channel notices', () => {
    class MockWebSocket {
      static instances: MockWebSocket[] = [];
      static OPEN = 1;
      readyState = 1;
      url: string;
      protocols: string[];
      onopen: null | (() => void) = null;
      onclose: null | (() => void) = null;
      onerror: null | (() => void) = null;
      onmessage: null | ((event: { data: string }) => void) = null;
      send = vi.fn();
      close = vi.fn();

      constructor(url: string, protocols: string[]) {
        this.url = url;
        this.protocols = protocols;
        MockWebSocket.instances.push(this);
      }
    }

    const setReadyChannelId = vi.fn();
    const setRemoteTypingState = vi.fn();
    const setMessages = vi.fn();
    const setTotalMessages = vi.fn();
    const setNotice = vi.fn();
    const loadChannels = vi.fn();
    const loadMessages = vi.fn().mockResolvedValue(undefined);
    const dispatchEvent = vi.fn();
    vi.stubGlobal('WebSocket', MockWebSocket as unknown as typeof WebSocket);
    vi.stubGlobal('window', {
      clearTimeout: vi.fn(),
      setTimeout: vi.fn(() => 99),
      dispatchEvent,
    });

    queueHookState({
      readySetter: setReadyChannelId,
      remoteTypingSetter: setRemoteTypingState,
    });
    useChatMessaging({
      session: { token: 'token-123', user: { id: 'user-1', fullName: 'Alex Kumar' } },
      activeChannelId: 'channel-1',
      draft: '',
      isActiveChannelClosed: false,
      hasOlderMessages: false,
      loadingOlderMessages: false,
      messagePage: 1,
      loadChannels,
      loadMessages,
      setMessages,
      setMessagePage: vi.fn(),
      setTotalMessages,
      setNotice,
      setDraft: vi.fn(),
    });

    const createdSocket = MockWebSocket.instances[0];

    expect(createdSocket?.url).toBe('ws://chat/channel-1');
    expect(createdSocket?.protocols).toEqual(['bearer.token-123']);

    createdSocket?.onopen?.();
    createdSocket?.onmessage?.({
      data: JSON.stringify({
        type: 'message',
        messageId: 'msg-1',
        authorId: 'user-2',
        authorName: 'Sam Rao',
        body: 'Ping',
        createdAt: '2026-05-09T05:00:00Z',
      }),
    });
    createdSocket?.onmessage?.({
      data: JSON.stringify({
        type: 'channel_closed',
        messageId: '',
        authorId: 'user-2',
        body: '',
        createdAt: '',
        ticketNumber: 'REQ-42',
      }),
    });

    expect(setReadyChannelId).toHaveBeenCalledWith('channel-1');
    expect(setMessages).toHaveBeenCalledWith(expect.any(Function));
    expect(setRemoteTypingState).toHaveBeenCalledWith(expect.any(Function));
    expect(loadChannels).toHaveBeenCalledTimes(2);
    expect(dispatchEvent).toHaveBeenCalledTimes(2);
    expect(setNotice).toHaveBeenCalledWith('Chat closed and moved into ticket REQ-42.');

    const append = setMessages.mock.calls[0][0] as (messages: Array<{ id: string }>) => unknown;
    expect(append([])).toEqual([
      {
        id: 'msg-1',
        body: 'Ping',
        createdAt: '2026-05-09T05:00:00Z',
        author: { id: 'user-2', fullName: 'Sam Rao' },
      },
    ]);
    expect(setTotalMessages).toHaveBeenCalledWith(expect.any(Function));
  });
});