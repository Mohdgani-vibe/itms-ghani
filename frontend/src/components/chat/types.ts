import type { ChatLatestMessageLike } from '../../lib/chat';

export interface ChannelMember {
  id: string;
  fullName: string;
  role: string;
}

export interface ChatChannel {
  id: string;
  name: string;
  kind: string;
  members: ChannelMember[];
  status?: string;
  closedAt?: string;
  createdAt?: string;
  createdBy?: {
    id: string;
    fullName: string;
  };
  primaryOwner?: {
    id: string;
    fullName?: string;
  };
  backupOwner?: {
    id: string;
    fullName?: string;
  };
  latestMessage?: ChatLatestMessageLike;
  linkedRequest?: {
    id?: string;
    ticketNumber?: string;
    status?: string;
  };
  messageCount?: number;
}

export interface ChatMessage {
  id: string;
  body: string;
  createdAt: string;
  author: {
    id: string;
    fullName: string;
  };
}

export interface PaginatedChatMessagesResponse {
  items: ChatMessage[];
  total: number;
  page: number;
  pageSize: number;
}

export interface PaginatedChatChannelsResponse {
  items: ChatChannel[];
  total: number;
  page: number;
  pageSize: number;
}

export interface SocketEnvelope {
  type: string;
  messageId: string;
  authorId: string;
  authorName?: string;
  body: string;
  createdAt: string;
  status?: string;
  ticketId?: string;
  ticketNumber?: string;
  typing?: boolean;
}

export interface CreateChatChannelResponse {
  id: string;
  routedMemberId?: string;
  primaryOwnerId?: string;
}

export interface AddChatMembersResponse {
  added: number;
}

export interface RemoveChatMemberResponse {
  removed: number;
}

export interface PendingTeammateAction {
  kind: 'add' | 'remove';
  memberId: string;
  memberName: string;
}

export interface UpdateChatOwnerResponse {
  ownerId?: string | null;
  backupOwnerId?: string | null;
}

export interface CloseChatResponse {
  status: string;
  ticketId?: string;
  ticketNumber?: string;
}

export interface ReopenChatResponse {
  status: string;
  ticketId?: string;
}

export interface DirectoryUser {
  id: string;
  fullName: string;
  email: string;
  role: string;
}

export interface PaginatedUsersResponse {
  items: DirectoryUser[];
}

export interface WorkflowSettings {
  chatAutoCreateEnabled: boolean;
  chatMemberIds: string[];
}