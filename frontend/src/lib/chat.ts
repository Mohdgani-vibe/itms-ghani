export interface ChatLatestMessageLike {
  body?: string;
  createdAt?: string;
  authorName?: string;
  fullName?: string;
  full_name?: string;
  author?: {
    fullName?: string;
    full_name?: string;
    name?: string;
  };
}

export interface ChatActivityItemLike {
  createdAt?: string;
  latestMessage?: ChatLatestMessageLike;
}

export function chatActivityTimestamp(item: ChatActivityItemLike) {
  if (item.latestMessage?.createdAt) {
    const latestMessageTime = new Date(item.latestMessage.createdAt).getTime();
    if (!Number.isNaN(latestMessageTime)) {
      return latestMessageTime;
    }
  }

  if (item.createdAt) {
    const createdTime = new Date(item.createdAt).getTime();
    if (!Number.isNaN(createdTime)) {
      return createdTime;
    }
  }

  return 0;
}

export function sortByRecentChatActivity<TItem extends ChatActivityItemLike>(items: TItem[]) {
  return [...items].sort((left, right) => chatActivityTimestamp(right) - chatActivityTimestamp(left));
}

export function chatPreviewAuthorName(message?: ChatLatestMessageLike) {
  const candidates = [
    message?.authorName,
    message?.fullName,
    message?.full_name,
    message?.author?.fullName,
    message?.author?.full_name,
    message?.author?.name,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim().length > 0) {
      return candidate.trim();
    }
  }

  return 'Chat user';
}

export function chatPreviewText(message: ChatLatestMessageLike | undefined, emptyLabel = 'No recent messages') {
  const body = message?.body?.trim();
  if (!body) {
    return emptyLabel;
  }

  return `${chatPreviewAuthorName(message)}: ${body}`;
}