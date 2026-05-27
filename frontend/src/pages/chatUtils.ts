import type { ChatChannel, DirectoryUser } from '../components/chat/types';

const CHAT_MESSAGE_PAGE_SIZE = 100;
export const CHAT_CHANNEL_PAGE_SIZE = 50;

export function deriveChatPermissions(role: string, chatAutoCreateEnabled: boolean) {
   const isAuditor = role === 'auditor';
   const isEmployee = role === 'employee';
   const isManager = role === 'super_admin' || role === 'it_team';

   return {
      isAuditor,
      isEmployee,
      isManager,
      canCreateChat: isManager || (isEmployee && chatAutoCreateEnabled),
      canComposeChat: !isAuditor && (isEmployee || isManager),
   };
}

export function buildChatChannelsUrl(
   channelPage: number,
   query: string,
   kindFilter: 'all' | 'support' | 'operations',
   statusFilter: 'all' | 'open' | 'closed',
) {
   const params = new URLSearchParams({
      paginate: '1',
      page: String(channelPage),
      page_size: String(CHAT_CHANNEL_PAGE_SIZE),
   });
   if (query.trim()) {
      params.set('search', query.trim());
   }
   if (kindFilter !== 'all') {
      params.set('kind', kindFilter);
   }
   if (statusFilter !== 'all') {
      params.set('status', statusFilter);
   }
   return `/api/chat/channels?${params.toString()}`;
}

export function buildChatMessagesUrl(channelId: string, page: number) {
   return `/api/chat/channels/${channelId}/messages?paginate=1&page=${page}&page_size=${CHAT_MESSAGE_PAGE_SIZE}`;
}

export function hasOlderChatMessages(messageCount: number, totalMessages: number) {
   return messageCount < totalMessages;
}

export function findActiveChatChannel(channels: ChatChannel[], activeChannelId: string) {
   return channels.find((channel) => channel.id === activeChannelId) || null;
}

export function resolveChatMemberName<T extends { id: string; fullName: string }>(
   members: T[],
   memberId: string | null | undefined,
   fallback: string,
) {
   return members.find((member) => member.id === memberId)?.fullName || fallback;
}

export function selectNextActiveChatChannelId(channels: ChatChannel[], currentActiveChannelId: string) {
   return channels.some((channel) => channel.id === currentActiveChannelId) ? currentActiveChannelId : channels[0]?.id || '';
}

export function filterEligibleChatTeammates(teammates: DirectoryUser[], chatMemberIds: string[]) {
   if (chatMemberIds.length === 0) {
      return teammates;
   }

   return teammates.filter((user) => chatMemberIds.includes(user.id));
}

export function filterAvailableTeammates(teammates: DirectoryUser[], activeChannel: ChatChannel | null) {
   if (!activeChannel) {
      return teammates;
   }

   const memberLookup = new Set(activeChannel.members.map((member) => member.id));
   return teammates.filter((user) => !memberLookup.has(user.id));
}

export function filterOwnerCandidates(activeChannel: ChatChannel | null) {
   return (activeChannel?.members || []).filter((member) => member.role === 'it_team' || member.role === 'super_admin');
}

export function filterBackupOwnerCandidates(
   ownerCandidates: ChatChannel['members'],
   selectedOwnerId: string | null,
   activeChannel: ChatChannel | null,
) {
   const currentPrimaryOwnerId = selectedOwnerId ?? activeChannel?.primaryOwner?.id ?? null;
   return ownerCandidates.filter((member) => member.id !== currentPrimaryOwnerId);
}

export function deriveChatChannelActionPermissions(role: string, activeChannel: ChatChannel | null) {
   const isActiveChannelClosed = activeChannel?.status === 'closed';

   return {
      isActiveChannelClosed,
      canCloseActiveChannel: Boolean(activeChannel && !isActiveChannelClosed && (role === 'super_admin' || role === 'it_team')),
      canReopenActiveChannel: Boolean(activeChannel && isActiveChannelClosed && (role === 'employee' || role === 'super_admin' || role === 'it_team')),
   };
}