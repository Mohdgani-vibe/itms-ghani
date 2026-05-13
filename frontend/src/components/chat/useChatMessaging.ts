import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { ChatMessage, SocketEnvelope } from './types';
import { chatSocketProtocols, chatSocketUrl } from './chatUtils';

const CHAT_UPDATED_EVENT = 'itms:chat-updated';

interface ChatSessionLike {
  token?: string;
  user?: {
    id?: string;
    fullName?: string;
  };
}

interface UseChatMessagingParams {
  session: ChatSessionLike | null;
  activeChannelId: string;
  draft: string;
  isActiveChannelClosed: boolean;
  hasOlderMessages: boolean;
  loadingOlderMessages: boolean;
  messagePage: number;
  loadChannels: () => Promise<void>;
  loadMessages: (channelId: string, page?: number, mode?: 'replace' | 'prepend') => Promise<void>;
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  setMessagePage: React.Dispatch<React.SetStateAction<number>>;
  setTotalMessages: React.Dispatch<React.SetStateAction<number>>;
  setNotice: React.Dispatch<React.SetStateAction<string>>;
  setDraft: React.Dispatch<React.SetStateAction<string>>;
}

interface RemoteTypingState {
  channelId: string;
  users: Record<string, string>;
}

export function useChatMessaging({
  session,
  activeChannelId,
  draft,
  isActiveChannelClosed,
  hasOlderMessages,
  loadingOlderMessages,
  messagePage,
  loadChannels,
  loadMessages,
  setMessages,
  setMessagePage,
  setTotalMessages,
  setNotice,
  setDraft,
}: UseChatMessagingParams) {
  const sessionToken = session?.token ?? '';
  const sessionUserId = session?.user?.id ?? '';
  const sessionUserFullName = session?.user?.fullName ?? '';
  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<number | null>(null);
  const typingTimerRef = useRef<number | null>(null);
  const remoteTypingTimerRef = useRef<Record<string, number>>({});
  const isTypingRef = useRef(false);
  const [readyChannelId, setReadyChannelId] = useState('');
  const [remoteTypingState, setRemoteTypingState] = useState<RemoteTypingState>({ channelId: '', users: {} });
  const socketReady = Boolean(activeChannelId) && readyChannelId === activeChannelId;

  useEffect(() => {
    return () => {
      if (typingTimerRef.current !== null) {
        window.clearTimeout(typingTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!activeChannelId) {
      setMessages([]);
      setMessagePage(1);
      setTotalMessages(0);
      return;
    }

    setMessagePage(1);
    setTotalMessages(0);
    void loadMessages(activeChannelId, 1, 'replace');

    return () => {
      Object.values(remoteTypingTimerRef.current).forEach((timeoutId) => window.clearTimeout(timeoutId));
      remoteTypingTimerRef.current = {};
    };
  }, [activeChannelId, loadMessages, setMessagePage, setMessages, setTotalMessages]);

  const sendTypingState = useCallback((typing: boolean) => {
    const socket = socketRef.current;
    if (!activeChannelId || !socket || socket.readyState !== WebSocket.OPEN) {
      return;
    }
    socket.send(JSON.stringify({ type: 'typing', channelId: activeChannelId, typing }));
    isTypingRef.current = typing;
  }, [activeChannelId]);

  useEffect(() => {
    if (!activeChannelId || !sessionToken || !sessionUserId) {
      socketRef.current?.close();
      socketRef.current = null;
      return;
    }

    let cancelled = false;
    const channelId = activeChannelId;

    const connect = () => {
      const socket = new WebSocket(chatSocketUrl(channelId), chatSocketProtocols(sessionToken));
      socketRef.current = socket;

      socket.onopen = () => {
        if (!cancelled) {
          setReadyChannelId(channelId);
        }
      };

      socket.onclose = () => {
        if (socketRef.current === socket) {
          socketRef.current = null;
        }
        setReadyChannelId((current) => (current === channelId ? '' : current));
        setRemoteTypingState((current) => (current.channelId === channelId ? { channelId: '', users: {} } : current));
        if (!cancelled) {
          reconnectTimerRef.current = window.setTimeout(connect, 1000);
        }
      };

      socket.onerror = () => {
        setReadyChannelId((current) => (current === channelId ? '' : current));
      };

      socket.onmessage = (event) => {
        try {
          const envelope = JSON.parse(event.data) as SocketEnvelope;
          if (envelope.type === 'typing') {
            if (envelope.authorId === sessionUserId) {
              return;
            }
            if (!envelope.typing) {
              setRemoteTypingState((current) => {
                const baseUsers = current.channelId === channelId ? current.users : {};
                const next = { ...baseUsers };
                delete next[envelope.authorId];
                return { channelId, users: next };
              });
              const timerId = remoteTypingTimerRef.current[envelope.authorId];
              if (timerId) {
                window.clearTimeout(timerId);
                delete remoteTypingTimerRef.current[envelope.authorId];
              }
              return;
            }

            setRemoteTypingState((current) => ({
              channelId,
              users: {
                ...(current.channelId === channelId ? current.users : {}),
                [envelope.authorId]: envelope.authorName || 'Chat user',
              },
            }));
            const existingTimer = remoteTypingTimerRef.current[envelope.authorId];
            if (existingTimer) {
              window.clearTimeout(existingTimer);
            }
            remoteTypingTimerRef.current[envelope.authorId] = window.setTimeout(() => {
              setRemoteTypingState((current) => {
                const baseUsers = current.channelId === channelId ? current.users : {};
                const next = { ...baseUsers };
                delete next[envelope.authorId];
                return { channelId, users: next };
              });
              delete remoteTypingTimerRef.current[envelope.authorId];
            }, 1600);
            return;
          }
          if (envelope.type !== 'message') {
            void loadChannels();
            window.dispatchEvent(new Event(CHAT_UPDATED_EVENT));
            if (envelope.type === 'channel_closed') {
              setNotice(envelope.ticketNumber ? `Chat closed and moved into ticket ${envelope.ticketNumber}.` : 'Chat closed.');
            } else if (envelope.type === 'channel_reopened') {
              setNotice('Chat reopened.');
            }
            return;
          }

          setMessages((current) => {
            if (current.some((item) => item.id === envelope.messageId)) {
              return current;
            }

            setTotalMessages((count) => count + 1);
            return [
              ...current,
              {
                id: envelope.messageId,
                body: envelope.body,
                createdAt: envelope.createdAt,
                author: {
                  id: envelope.authorId,
                    fullName: envelope.authorId === sessionUserId ? sessionUserFullName || 'You' : envelope.authorName || 'Chat user',
                },
              },
            ];
          });
          setRemoteTypingState((current) => {
            const baseUsers = current.channelId === channelId ? current.users : {};
            const next = { ...baseUsers };
            delete next[envelope.authorId];
            return { channelId, users: next };
          });
          void loadChannels();
          window.dispatchEvent(new Event(CHAT_UPDATED_EVENT));
        } catch {
          return;
        }
      };
    };

    connect();

    return () => {
      cancelled = true;
      if (reconnectTimerRef.current !== null) {
        window.clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      const currentSocket = socketRef.current;
      if (isTypingRef.current && currentSocket?.readyState === WebSocket.OPEN && activeChannelId) {
        currentSocket.send(JSON.stringify({ type: 'typing', channelId: activeChannelId, typing: false }));
      }
      socketRef.current = null;
      currentSocket?.close();
    };
  }, [activeChannelId, loadChannels, loadMessages, sessionToken, sessionUserFullName, sessionUserId, setMessages, setNotice, setTotalMessages]);

  const remoteTypingLabel = useMemo(() => {
    const remoteTypingUsers = remoteTypingState.channelId === activeChannelId ? remoteTypingState.users : {};
    const names = Object.values(remoteTypingUsers);
    if (names.length === 0) {
      return '';
    }
    if (names.length === 1) {
      return `${names[0]} is typing...`;
    }
    return `${names.slice(0, 2).join(', ')} are typing...`;
  }, [activeChannelId, remoteTypingState]);

  const handleSend = useCallback(() => {
    const socket = socketRef.current;
    const body = draft.trim();

    if (!body || !activeChannelId || !socket || socket.readyState !== WebSocket.OPEN) {
      return;
    }

    socket.send(JSON.stringify({ channelId: activeChannelId, body }));

    if (typingTimerRef.current !== null) {
      window.clearTimeout(typingTimerRef.current);
      typingTimerRef.current = null;
    }
    sendTypingState(false);
    setDraft('');
    setNotice('');
  }, [activeChannelId, draft, sendTypingState, setDraft, setNotice]);

  const handleLoadOlderMessages = useCallback(() => {
    if (!activeChannelId || loadingOlderMessages || !hasOlderMessages) {
      return;
    }
    void loadMessages(activeChannelId, messagePage + 1, 'prepend');
  }, [activeChannelId, hasOlderMessages, loadMessages, loadingOlderMessages, messagePage]);

  const handleDraftChange = useCallback((value: string) => {
    setDraft(value);

    if (!activeChannelId || isActiveChannelClosed || !socketReady) {
      return;
    }

    const hasBody = value.trim().length > 0;
    if (hasBody && !isTypingRef.current) {
      sendTypingState(true);
    }
    if (!hasBody && isTypingRef.current) {
      sendTypingState(false);
    }
    if (typingTimerRef.current !== null) {
      window.clearTimeout(typingTimerRef.current);
    }
    if (hasBody) {
      typingTimerRef.current = window.setTimeout(() => {
        sendTypingState(false);
        typingTimerRef.current = null;
      }, 1200);
    }
  }, [activeChannelId, isActiveChannelClosed, sendTypingState, setDraft, socketReady]);

  const handleDraftBlur = useCallback(() => {
    sendTypingState(false);
  }, [sendTypingState]);

  return {
    socketReady,
    remoteTypingLabel,
    handleSend,
    handleLoadOlderMessages,
    handleDraftChange,
    handleDraftBlur,
  };
}