import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import ChatChannelSidebar from '../components/chat/ChatChannelSidebar';
import ChatControlSidebar from '../components/chat/ChatControlSidebar';
import ChatCloseModals from '../components/chat/ChatCloseModals';
import ChatConversationPanel from '../components/chat/ChatConversationPanel';
import ConfirmDialog from '../components/ConfirmDialog';
import { apiRequest } from '../lib/api';
import { sortByRecentChatActivity } from '../lib/chat';
import { getStoredSession } from '../lib/session';
import {
   CHAT_CHANNEL_PAGE_SIZE,
   buildChatWorkspaceSearch,
   buildChatChannelsUrl,
   buildChatMessagesUrl,
   deriveChatChannelActionPermissions,
   deriveChatPermissions,
   filterAvailableTeammates,
   filterBackupOwnerCandidates,
   filterEligibleChatTeammates,
   filterOwnerCandidates,
   findActiveChatChannel,
   hasOlderChatMessages,
   parseChatWorkspaceSearch,
   resolveChatMemberName,
   selectPreferredActiveChatChannelId,
} from './chatUtils';
import { formatDateTime, mergeMessages, normalizeWorkflowSettings } from '../components/chat/chatUtils';
import type { AddChatMembersResponse, ChatChannel, ChatMessage, CloseChatResponse, CreateChatChannelResponse, DirectoryUser, PaginatedChatChannelsResponse, PaginatedChatMessagesResponse, PaginatedUsersResponse, PendingTeammateAction, RemoveChatMemberResponse, ReopenChatResponse, UpdateChatOwnerResponse, WorkflowSettings } from '../components/chat/types';
import { useChatMessaging } from '../components/chat/useChatMessaging';

const CHAT_UPDATED_EVENT = 'itms:chat-updated';

export default function Chat() {
   const location = useLocation();
   const navigate = useNavigate();
   const session = getStoredSession();
   const locationState = parseChatWorkspaceSearch(location.search);
   const requestedChannelId = locationState.channelId;

   const role = session?.user.role || '';
   const [workflowSettings, setWorkflowSettings] = useState<WorkflowSettings>(() => normalizeWorkflowSettings());
   const { isEmployee, isManager, canCreateChat, canComposeChat } = deriveChatPermissions(
      role,
      workflowSettings.chatAutoCreateEnabled,
   );
   const [query, setQuery] = useState(locationState.query);
   const [draft, setDraft] = useState('');
   const [kindFilter, setKindFilter] = useState<'all' | 'support' | 'operations'>(locationState.kindFilter);
   const [statusFilter, setStatusFilter] = useState<'all' | 'open' | 'closed'>(locationState.statusFilter);
   const [newChannelName, setNewChannelName] = useState('');
   const [newChannelMessage, setNewChannelMessage] = useState('');
   const [channels, setChannels] = useState<ChatChannel[]>([]);
   const [channelPage, setChannelPage] = useState(locationState.channelPage);
   const [totalChannels, setTotalChannels] = useState(0);
   const [messages, setMessages] = useState<ChatMessage[]>([]);
   const [messagePage, setMessagePage] = useState(1);
   const [totalMessages, setTotalMessages] = useState(0);
   const [teammates, setTeammates] = useState<DirectoryUser[]>([]);
   const [selectedTeammateId, setSelectedTeammateId] = useState('');
   const [pendingTeammateAction, setPendingTeammateAction] = useState<PendingTeammateAction | null>(null);
   const [selectedOwnerId, setSelectedOwnerId] = useState<string | null>(null);
   const [selectedBackupOwnerId, setSelectedBackupOwnerId] = useState<string | null>(null);
   const [activeChannelId, setActiveChannelId] = useState(requestedChannelId);
   const requestedChannelIdRef = useRef(new URLSearchParams(location.search).get('channel')?.trim() || '');
   const didHydrateFiltersRef = useRef(false);
   const pendingLocationSearchRef = useRef('');
   const applyingLocationSearchRef = useRef(false);
   const latestChannelRequestRef = useRef(0);
   const [loadingChannels, setLoadingChannels] = useState(true);
   const [loadingMessages, setLoadingMessages] = useState(false);
   const [loadingOlderMessages, setLoadingOlderMessages] = useState(false);
   const [loadingTeammates, setLoadingTeammates] = useState(false);
   const [creatingChannel, setCreatingChannel] = useState(false);
   const [addingTeammate, setAddingTeammate] = useState(false);
   const [removingMemberId, setRemovingMemberId] = useState('');
   const [transferringOwner, setTransferringOwner] = useState(false);
   const [closingChannel, setClosingChannel] = useState(false);
   const [closeDialogOpen, setCloseDialogOpen] = useState(false);
   const [closeResult, setCloseResult] = useState<CloseChatResponse | null>(null);
   const [error, setError] = useState('');
   const [notice, setNotice] = useState('');
   const buildFilterSearch = useCallback(
      (nextQuery: string, nextKindFilter: 'all' | 'support' | 'operations', nextStatusFilter: 'all' | 'open' | 'closed', nextChannelPage: number) =>
         buildChatWorkspaceSearch({
            channelId: '',
            query: nextQuery,
            kindFilter: nextKindFilter,
            statusFilter: nextStatusFilter,
            channelPage: nextChannelPage,
         }),
      [],
   );

   useEffect(() => {
      if (!requestedChannelId) {
         requestedChannelIdRef.current = '';
         return;
      }
      if (requestedChannelId !== activeChannelId) {
         requestedChannelIdRef.current = requestedChannelId;
      }
   }, [activeChannelId, location.search]);

   useEffect(() => {
      if (!requestedChannelId || requestedChannelId === activeChannelId) {
         return;
      }
      if (!loadingChannels && !channels.some((channel) => channel.id === requestedChannelId)) {
         return;
      }
      setActiveChannelId(requestedChannelId);
   }, [activeChannelId, channels, loadingChannels, requestedChannelId]);

   useEffect(() => {
      const nextFilterSearch = buildFilterSearch(query, kindFilter, statusFilter, channelPage);
      const locationFilterSearch = buildFilterSearch(
         locationState.query,
         locationState.kindFilter,
         locationState.statusFilter,
         locationState.channelPage,
      );

      if (locationFilterSearch === nextFilterSearch) {
         pendingLocationSearchRef.current = '';
         applyingLocationSearchRef.current = false;
         return;
      }

      pendingLocationSearchRef.current = locationFilterSearch;
      applyingLocationSearchRef.current = true;
      if (requestedChannelId) {
         requestedChannelIdRef.current = requestedChannelId;
         setActiveChannelId(requestedChannelId);
      }
      setQuery(locationState.query);
      setKindFilter(locationState.kindFilter);
      setStatusFilter(locationState.statusFilter);
      setChannelPage(locationState.channelPage);
   }, [buildFilterSearch, channelPage, kindFilter, locationState, query, requestedChannelId, statusFilter]);

   const loadChannels = useCallback(async () => {
      const requestId = latestChannelRequestRef.current + 1;
      latestChannelRequestRef.current = requestId;

      try {
         setLoadingChannels(true);
         setError('');
         const data = await apiRequest<PaginatedChatChannelsResponse>(
            buildChatChannelsUrl(channelPage, query, kindFilter, statusFilter),
         );
         if (requestId !== latestChannelRequestRef.current) {
            return;
         }
         const nextChannels = Array.isArray(data.items) ? sortByRecentChatActivity(data.items) : [];
         const requestedChannelId = requestedChannelIdRef.current;
         setChannels(nextChannels);
         setTotalChannels(data.total || nextChannels.length);
         setActiveChannelId((current) => selectPreferredActiveChatChannelId(nextChannels, current, requestedChannelId));
      } catch (requestError) {
         if (requestId !== latestChannelRequestRef.current) {
            return;
         }
         setError(requestError instanceof Error ? requestError.message : 'Failed to load chat channels');
      } finally {
         if (requestId === latestChannelRequestRef.current) {
            setLoadingChannels(false);
         }
      }
   }, [channelPage, kindFilter, query, statusFilter]);

   const loadTeammates = useCallback(async () => {
      if (!isManager) {
         setTeammates([]);
         return;
      }

      try {
         setLoadingTeammates(true);
         const [data, settings] = await Promise.all([
            apiRequest<PaginatedUsersResponse>('/api/users?paginate=1&page=1&page_size=200&role=it_team&role=super_admin&status=active'),
            apiRequest<WorkflowSettings>('/api/settings/workflow'),
         ]);
         const normalizedSettings = normalizeWorkflowSettings(settings);
         setTeammates(filterEligibleChatTeammates(data.items, normalizedSettings.chatMemberIds));
      } catch (requestError) {
         setError(requestError instanceof Error ? requestError.message : 'Failed to load available teammates');
      } finally {
         setLoadingTeammates(false);
      }
   }, [isManager]);

   const loadWorkflowSettings = useCallback(async () => {
      if (!isEmployee) {
         return;
      }

      try {
         const settings = await apiRequest<WorkflowSettings>('/api/settings/workflow');
         setWorkflowSettings(normalizeWorkflowSettings(settings));
      } catch (requestError) {
         setError(requestError instanceof Error ? requestError.message : 'Failed to load workflow settings');
      }
   }, [isEmployee]);

   const loadMessages = useCallback(async (channelId: string, page = 1, mode: 'replace' | 'prepend' = 'replace') => {
      try {
         if (mode === 'prepend') {
            setLoadingOlderMessages(true);
         } else {
            setLoadingMessages(true);
         }
         setError('');
         const data = await apiRequest<PaginatedChatMessagesResponse>(buildChatMessagesUrl(channelId, page));
         const nextItems = Array.isArray(data.items) ? data.items : [];
         setMessagePage(page);
         setTotalMessages(data.total || nextItems.length);
         setMessages((current) => (mode === 'prepend' ? mergeMessages([...nextItems, ...current]) : mergeMessages(nextItems)));
      } catch (requestError) {
         setError(requestError instanceof Error ? requestError.message : 'Failed to load chat messages');
      } finally {
         if (mode === 'prepend') {
            setLoadingOlderMessages(false);
         } else {
            setLoadingMessages(false);
         }
      }
   }, []);

   useEffect(() => {
      void loadChannels();
      if (isManager) {
         void loadTeammates();
      }
      if (isEmployee) {
         void loadWorkflowSettings();
      }
   }, [isEmployee, isManager, loadChannels, loadTeammates, loadWorkflowSettings]);

   useEffect(() => {
      if (applyingLocationSearchRef.current) {
         return;
      }
      if (!didHydrateFiltersRef.current) {
         didHydrateFiltersRef.current = true;
         return;
      }
      setChannelPage(1);
   }, [kindFilter, query, statusFilter]);

   const visibleChannels = useMemo(() => {
      return sortByRecentChatActivity(channels);
   }, [channels]);
   const activeChannel = findActiveChatChannel(visibleChannels, activeChannelId);
   const hasOlderMessages = hasOlderChatMessages(messages.length, totalMessages);
   const availableTeammates = useMemo(() => {
      return filterAvailableTeammates(teammates, activeChannel);
   }, [activeChannel, teammates]);
   const ownerCandidates = useMemo(() => {
      return filterOwnerCandidates(activeChannel);
   }, [activeChannel]);
   const backupOwnerCandidates = useMemo(() => {
      return filterBackupOwnerCandidates(ownerCandidates, selectedOwnerId, activeChannel);
   }, [activeChannel, ownerCandidates, selectedOwnerId]);
   const { isActiveChannelClosed, canCloseActiveChannel, canReopenActiveChannel } = deriveChatChannelActionPermissions(role, activeChannel);

   useEffect(() => {
      setSelectedOwnerId(activeChannel?.primaryOwner?.id ?? null);
      setSelectedBackupOwnerId(activeChannel?.backupOwner?.id ?? null);
      setCloseDialogOpen(false);
      setCloseResult(null);
   }, [activeChannel?.backupOwner?.id, activeChannel?.id, activeChannel?.primaryOwner?.id]);

   useEffect(() => {
      if (visibleChannels.length === 0) {
         return;
      }
      if (
         requestedChannelId
         && requestedChannelId === activeChannelId
         && !visibleChannels.some((channel) => channel.id === requestedChannelId)
      ) {
         return;
      }
      if (
         requestedChannelId
         && requestedChannelId !== activeChannelId
         && (applyingLocationSearchRef.current || loadingChannels)
      ) {
         return;
      }
      if (!visibleChannels.some((channel) => channel.id === activeChannelId)) {
         setActiveChannelId(selectPreferredActiveChatChannelId(visibleChannels, activeChannelId, requestedChannelIdRef.current));
      }
   }, [activeChannelId, loadingChannels, requestedChannelId, visibleChannels]);

   useEffect(() => {
      if (!requestedChannelId || requestedChannelId === activeChannelId) {
         return;
      }
      if (!visibleChannels.some((channel) => channel.id === requestedChannelId)) {
         return;
      }
      setActiveChannelId(requestedChannelId);
   }, [activeChannelId, requestedChannelId, visibleChannels]);

   useEffect(() => {
      const syncedChannelId = activeChannelId || requestedChannelId || requestedChannelIdRef.current;
      const nextSearch = buildChatWorkspaceSearch({
         channelId: syncedChannelId,
         query,
         kindFilter,
         statusFilter,
         channelPage,
      });
      const currentSearch = location.search.startsWith('?') ? location.search.slice(1) : location.search;
      const nextFilterSearch = buildFilterSearch(query, kindFilter, statusFilter, channelPage);

      if (pendingLocationSearchRef.current) {
         if (pendingLocationSearchRef.current === nextFilterSearch) {
            pendingLocationSearchRef.current = '';
            applyingLocationSearchRef.current = false;
         }
         return;
      }

      if (
         requestedChannelId
         && requestedChannelId !== activeChannelId
         && (loadingChannels || visibleChannels.some((channel) => channel.id === requestedChannelId))
      ) {
         return;
      }

      if (currentSearch === nextSearch) {
         return;
      }

      void navigate(`${location.pathname}${nextSearch ? `?${nextSearch}` : ''}`, { replace: true });
   }, [activeChannelId, buildFilterSearch, channelPage, kindFilter, loadingChannels, location.pathname, location.search, navigate, query, requestedChannelId, statusFilter, visibleChannels]);

   const {
      socketReady,
      remoteTypingLabel,
      handleSend,
      handleLoadOlderMessages,
      handleDraftChange,
      handleDraftBlur,
   } = useChatMessaging({
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
   });

   const handleCreateSupportChat = async () => {
      if (!canCreateChat) {
         setError('Support chat creation is disabled right now.');
         return;
      }

      const name = newChannelName.trim();
      const initialMessage = newChannelMessage.trim();

      if (!name) {
         setError('Enter a chat subject to route the conversation.');
         return;
      }

      try {
         setCreatingChannel(true);
         setError('');
         setNotice('');
         const response = await apiRequest<CreateChatChannelResponse>('/api/chat/channels', {
            method: 'POST',
            body: JSON.stringify({
               name,
               kind: 'support',
               initialMessage,
            }),
         });
         setNewChannelName('');
         setNewChannelMessage('');
         await loadChannels();
         setActiveChannelId(response.id);
         if (response.id) {
            await loadMessages(response.id);
         }
         window.dispatchEvent(new Event(CHAT_UPDATED_EVENT));
         setNotice(response.primaryOwnerId ? 'Support chat created and assigned to a primary IT owner.' : response.routedMemberId ? 'Support chat created and routed to an IT owner.' : 'Support chat created.');
      } catch (requestError) {
         setError(requestError instanceof Error ? requestError.message : 'Failed to create support chat');
      } finally {
         setCreatingChannel(false);
      }
   };

   const handleTransferOwner = async () => {
      if (!activeChannelId || !selectedOwnerId) {
         return;
      }

      try {
         setTransferringOwner(true);
         setError('');
         setNotice('');
         const response = await apiRequest<UpdateChatOwnerResponse>(`/api/chat/channels/${activeChannelId}/owner`, {
            method: 'PUT',
            body: JSON.stringify({ ownerId: selectedOwnerId }),
         });
         await loadChannels();
         setSelectedOwnerId(response.ownerId ?? null);
         if ((response.ownerId ?? null) === selectedBackupOwnerId) {
            setSelectedBackupOwnerId(null);
         }
         window.dispatchEvent(new Event(CHAT_UPDATED_EVENT));
         const ownerName = resolveChatMemberName(ownerCandidates, response.ownerId, 'Selected owner');
         setNotice(`${ownerName} is now the primary owner.`);
      } catch (requestError) {
         setError(requestError instanceof Error ? requestError.message : 'Failed to transfer primary owner');
      } finally {
         setTransferringOwner(false);
      }
   };

   const handleBackupOwnerUpdate = async (backupOwnerIdOverride?: string | null) => {
      if (!activeChannelId) {
         return;
      }

      const nextBackupOwnerId = typeof backupOwnerIdOverride === 'string' || backupOwnerIdOverride === null ? backupOwnerIdOverride : selectedBackupOwnerId;

      try {
         setTransferringOwner(true);
         setError('');
         setNotice('');
         const response = await apiRequest<UpdateChatOwnerResponse>(`/api/chat/channels/${activeChannelId}/owner`, {
            method: 'PUT',
            body: JSON.stringify({ backupOwnerId: nextBackupOwnerId ?? '' }),
         });
         await loadChannels();
         setSelectedBackupOwnerId(response.backupOwnerId ?? null);
         window.dispatchEvent(new Event(CHAT_UPDATED_EVENT));
         if (response.backupOwnerId) {
            const backupName = resolveChatMemberName(ownerCandidates, response.backupOwnerId, 'Selected backup owner');
            setNotice(`${backupName} is now the backup owner.`);
         } else {
            setNotice('Backup owner cleared.');
         }
      } catch (requestError) {
         setError(requestError instanceof Error ? requestError.message : 'Failed to update backup owner');
      } finally {
         setTransferringOwner(false);
      }
   };

   const handleReopenChannel = async () => {
      if (!activeChannelId || !activeChannel) {
         return;
      }

      try {
         setClosingChannel(true);
         setError('');
         setNotice('');
         await apiRequest<ReopenChatResponse>(`/api/chat/channels/${activeChannelId}/reopen`, { method: 'PUT' });
         await loadChannels();
         window.dispatchEvent(new Event(CHAT_UPDATED_EVENT));
         setNotice(activeChannel.linkedRequest?.ticketNumber ? `Chat reopened under ticket ${activeChannel.linkedRequest.ticketNumber}.` : 'Chat reopened.');
      } catch (requestError) {
         setError(requestError instanceof Error ? requestError.message : 'Failed to reopen chat');
      } finally {
         setClosingChannel(false);
      }
   };

   const handleAddTeammate = async () => {
      if (!activeChannelId || !selectedTeammateId) {
         return;
      }

      try {
         setAddingTeammate(true);
         setError('');
         setNotice('');
         const response = await apiRequest<AddChatMembersResponse>(`/api/chat/channels/${activeChannelId}/members`, {
            method: 'POST',
            body: JSON.stringify({ memberIds: [selectedTeammateId] }),
         });
         await loadChannels();
         setSelectedTeammateId('');
         window.dispatchEvent(new Event(CHAT_UPDATED_EVENT));
         setNotice(response.added > 0 ? 'Teammate added to the chat.' : 'That teammate is already in the chat.');
      } catch (requestError) {
         setError(requestError instanceof Error ? requestError.message : 'Failed to add teammate');
      } finally {
         setAddingTeammate(false);
      }
   };

   const openAddTeammateDialog = () => {
      if (!selectedTeammateId) {
         return;
      }
      const memberName = resolveChatMemberName(teammates, selectedTeammateId, 'Selected teammate');
      setPendingTeammateAction({ kind: 'add', memberId: selectedTeammateId, memberName });
   };

   const handleCloseChannel = () => {
      if (!activeChannelId || !activeChannel) {
         return;
      }

      setCloseDialogOpen(true);
   };

   const handleConfirmCloseChannel = async () => {
      if (!activeChannelId || !activeChannel) {
         return;
      }

      try {
         setClosingChannel(true);
         setError('');
         setNotice('');
         const response = await apiRequest<CloseChatResponse>(`/api/chat/channels/${activeChannelId}/close`, { method: 'PUT' });
         await loadChannels();
         window.dispatchEvent(new Event(CHAT_UPDATED_EVENT));
         setCloseDialogOpen(false);
         setCloseResult(response);
         setDraft('');
         setNotice(response.ticketNumber ? `Chat closed and converted to ticket ${response.ticketNumber}.` : 'Chat closed.');
      } catch (requestError) {
         setError(requestError instanceof Error ? requestError.message : 'Failed to close chat');
      } finally {
         setClosingChannel(false);
      }
   };

   const handleRemoveTeammate = async (memberId: string, memberName: string) => {
      if (!activeChannelId) {
         return;
      }

      try {
         setRemovingMemberId(memberId);
         setError('');
         setNotice('');
         const response = await apiRequest<RemoveChatMemberResponse>(`/api/chat/channels/${activeChannelId}/members/${memberId}`, {
            method: 'DELETE',
         });
         await loadChannels();
         window.dispatchEvent(new Event(CHAT_UPDATED_EVENT));
         setNotice(response.removed > 0 ? `${memberName} removed from the chat.` : `${memberName} was already removed.`);
      } catch (requestError) {
         setError(requestError instanceof Error ? requestError.message : 'Failed to remove teammate');
      } finally {
         setRemovingMemberId('');
      }
   };

   const handleConfirmTeammateAction = () => {
      if (!pendingTeammateAction) {
         return;
      }
      const action = pendingTeammateAction;
      setPendingTeammateAction(null);
      if (action.kind === 'add') {
         void handleAddTeammate();
         return;
      }
      void handleRemoveTeammate(action.memberId, action.memberName);
   };

   const handleStartFreshChat = () => {
      setActiveChannelId('');
      setDraft('');
      setNewChannelName('');
      setNewChannelMessage('');
      setNotice('');
      setError('');
   };

   const layoutClassName = `grid h-[calc(100vh-64px)] grid-cols-1 overflow-hidden bg-zinc-50 ${isManager ? 'lg:grid-cols-[320px_minmax(0,1fr)] xl:grid-cols-[320px_minmax(0,1fr)_320px]' : 'lg:grid-cols-[320px_1fr]'}`;

   return (
      <div className={layoutClassName}>
         <ChatChannelSidebar
            query={query}
            statusFilter={statusFilter}
            kindFilter={kindFilter}
            isManager={isManager}
            canCreateChat={canCreateChat}
            newChannelName={newChannelName}
            newChannelMessage={newChannelMessage}
            creatingChannel={creatingChannel}
            loadingChannels={loadingChannels}
            visibleChannels={visibleChannels}
            activeChannelId={activeChannelId}
            channelPage={channelPage}
            totalChannels={totalChannels}
            pageSize={CHAT_CHANNEL_PAGE_SIZE}
            formatDateTime={formatDateTime}
            onQueryChange={setQuery}
            onStatusFilterChange={setStatusFilter}
            onKindFilterChange={setKindFilter}
            onStartFreshChat={handleStartFreshChat}
            onNewChannelNameChange={setNewChannelName}
            onNewChannelMessageChange={setNewChannelMessage}
            onCreateSupportChat={() => { void handleCreateSupportChat(); }}
            onSelectChannel={setActiveChannelId}
            onChannelPageChange={setChannelPage}
         />

         <ChatConversationPanel
            activeChannel={activeChannel}
            activeChannelId={activeChannelId}
            canCreateChat={canCreateChat}
            canComposeChat={canComposeChat}
            canCloseActiveChannel={canCloseActiveChannel}
            canReopenActiveChannel={canReopenActiveChannel}
            isManager={isManager}
            closingChannel={closingChannel}
            error={error}
            notice={notice}
            hasOlderMessages={hasOlderMessages}
            loadingMessages={loadingMessages}
            loadingOlderMessages={loadingOlderMessages}
            totalMessages={totalMessages}
            messages={messages}
            remoteTypingLabel={remoteTypingLabel}
            currentUserId={session?.user.id}
            draft={draft}
            socketReady={socketReady}
            isActiveChannelClosed={isActiveChannelClosed}
            onStartFreshChat={handleStartFreshChat}
            onCloseChannel={handleCloseChannel}
            onReopenChannel={() => { void handleReopenChannel(); }}
            onLoadOlderMessages={handleLoadOlderMessages}
            onDraftChange={handleDraftChange}
            onDraftBlur={handleDraftBlur}
            onSend={handleSend}
         />

         {isManager ? (
            <ChatControlSidebar
               activeChannel={activeChannel}
               selectedOwnerId={selectedOwnerId}
               selectedBackupOwnerId={selectedBackupOwnerId}
               selectedTeammateId={selectedTeammateId}
               ownerCandidates={ownerCandidates}
               backupOwnerCandidates={backupOwnerCandidates}
               availableTeammates={availableTeammates}
               removingMemberId={removingMemberId}
               transferringOwner={transferringOwner}
               addingTeammate={addingTeammate}
               loadingTeammates={loadingTeammates}
               isActiveChannelClosed={isActiveChannelClosed}
               onPendingTeammateActionChange={setPendingTeammateAction}
               onSelectedOwnerChange={setSelectedOwnerId}
               onSelectedBackupOwnerChange={setSelectedBackupOwnerId}
               onTransferOwner={() => { void handleTransferOwner(); }}
               onBackupOwnerUpdate={(backupOwnerId) => { void handleBackupOwnerUpdate(backupOwnerId); }}
               onSelectedTeammateChange={setSelectedTeammateId}
               onOpenAddTeammateDialog={openAddTeammateDialog}
            />
         ) : null}

         <ChatCloseModals
            closeDialogOpen={closeDialogOpen}
            closeResult={closeResult}
            closingChannel={closingChannel}
            canCreateChat={canCreateChat}
            onCancelClose={() => setCloseDialogOpen(false)}
            onConfirmClose={() => { void handleConfirmCloseChannel(); }}
            onAcknowledgeCloseResult={() => {
               setCloseResult(null);
               if (canCreateChat) {
                  handleStartFreshChat();
               }
            }}
         />

         <ConfirmDialog
            open={Boolean(pendingTeammateAction)}
            title={pendingTeammateAction?.kind === 'remove' ? 'Remove Teammate' : 'Add Teammate'}
            message={pendingTeammateAction ? `${pendingTeammateAction.kind === 'remove' ? 'Remove' : 'Add'} ${pendingTeammateAction.memberName} ${pendingTeammateAction.kind === 'remove' ? 'from' : 'to'} this chat?` : 'Confirm teammate change.'}
            confirmLabel={pendingTeammateAction?.kind === 'remove' ? 'Remove' : 'Add'}
            tone={pendingTeammateAction?.kind === 'remove' ? 'danger' : 'default'}
            busy={Boolean((pendingTeammateAction?.kind === 'remove' && removingMemberId === pendingTeammateAction.memberId) || (pendingTeammateAction?.kind === 'add' && addingTeammate))}
            onClose={() => setPendingTeammateAction(null)}
            onConfirm={handleConfirmTeammateAction}
         />
      </div>
   );
}
