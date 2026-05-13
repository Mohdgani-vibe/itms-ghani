import { resolveWebSocketUrl } from '../../lib/api';

import type { ChatMessage, WorkflowSettings } from './types';

export function normalizeWorkflowSettings(settings?: WorkflowSettings | null): WorkflowSettings {
  return {
    chatAutoCreateEnabled: settings?.chatAutoCreateEnabled === true,
    chatMemberIds: Array.isArray(settings?.chatMemberIds)
      ? settings.chatMemberIds.filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
      : [],
  };
}

export function encodeProtocolToken(token: string) {
  return btoa(token).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

export function chatSocketUrl(channelId: string) {
  const path = `/ws/chat?channelId=${encodeURIComponent(channelId)}`;
  return resolveWebSocketUrl(path);
}

export function chatSocketProtocols(token: string) {
  return ['itms.chat.v1', `bearer.${encodeProtocolToken(token)}`];
}

export function formatDateTime(value?: string) {
  if (!value) {
    return 'No activity yet';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'No activity yet';
  }

  return date.toLocaleString();
}

export function mergeMessages(messages: ChatMessage[]) {
  const seen = new Set<string>();
  return messages.filter((message) => {
    if (!message?.id || seen.has(message.id)) {
      return false;
    }
    seen.add(message.id);
    return true;
  });
}