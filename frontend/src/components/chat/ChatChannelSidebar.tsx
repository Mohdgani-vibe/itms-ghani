import { Filter, MessageSquare, Plus, Search } from 'lucide-react';
import Pagination from '../Pagination';
import { chatPreviewAuthorName } from '../../lib/chat';
import type { ChatChannel } from './types';

function formatChannelStatus(status?: string) {
  return status === 'closed' ? 'Closed' : 'Open';
}

interface ChatChannelSidebarProps {
  query: string;
  statusFilter: 'all' | 'open' | 'closed';
  kindFilter: 'all' | 'support' | 'operations';
  isManager: boolean;
  canCreateChat: boolean;
  newChannelName: string;
  newChannelMessage: string;
  creatingChannel: boolean;
  loadingChannels: boolean;
  visibleChannels: ChatChannel[];
  activeChannelId: string;
  channelPage: number;
  totalChannels: number;
  pageSize: number;
  formatDateTime: (value?: string) => string;
  onQueryChange: (value: string) => void;
  onStatusFilterChange: (value: 'all' | 'open' | 'closed') => void;
  onKindFilterChange: (value: 'all' | 'support' | 'operations') => void;
  onStartFreshChat: () => void;
  onNewChannelNameChange: (value: string) => void;
  onNewChannelMessageChange: (value: string) => void;
  onCreateSupportChat: () => void;
  onSelectChannel: (channelId: string) => void;
  onChannelPageChange: (page: number) => void;
}

export default function ChatChannelSidebar({
  query,
  isManager,
  canCreateChat,
  newChannelName,
  newChannelMessage,
  creatingChannel,
  loadingChannels,
  visibleChannels,
  activeChannelId,
  channelPage,
  totalChannels,
  pageSize,
  formatDateTime,
  onQueryChange,
  onStatusFilterChange,
  onKindFilterChange,
  onStartFreshChat,
  onNewChannelNameChange,
  onNewChannelMessageChange,
  onCreateSupportChat,
  onSelectChannel,
  onChannelPageChange,
}: ChatChannelSidebarProps) {
  return (
    <div className="flex flex-col border-r border-zinc-200 bg-white">
      <div className="border-b border-zinc-100 p-4">
        <h2 className="mb-3 flex items-center text-lg font-bold text-zinc-900">
          <MessageSquare className="mr-2 h-5 w-5 text-brand-600" /> Chat
        </h2>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
          <input type="text" value={query} onChange={(event) => onQueryChange(event.target.value)} placeholder="Search channels or members..." className="w-full rounded-lg border border-zinc-200 bg-zinc-50 py-2 pl-9 pr-4 text-sm outline-none transition-all focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20" />
        </div>
        <div className="mt-4 rounded-xl border border-zinc-200 bg-zinc-50 p-3">
          <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-zinc-600">
            <Filter className="h-3.5 w-3.5" /> Status Filter
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2 text-xs font-semibold">
            {([
              { value: 'all', label: 'All' },
              { value: 'open', label: 'Open' },
              { value: 'closed', label: 'Archived' },
            ] as const).map(({ value, label }) => (
              <button
                key={value}
                type="button"
                onClick={() => onStatusFilterChange(value)}
                className="rounded-lg bg-white px-2 py-2 text-sky-700 transition-colors hover:bg-sky-50"
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        {isManager ? (
          <div className="mt-4 rounded-xl border border-zinc-200 bg-zinc-50 p-3">
            <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-zinc-600">
              <Filter className="h-3.5 w-3.5" /> Queue Filter
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2 text-xs font-semibold">
              {(['all', 'support', 'operations'] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => onKindFilterChange(value)}
                  className="rounded-lg bg-white px-2 py-2 capitalize text-sky-700 transition-colors hover:bg-sky-50"
                >
                  {value}
                </button>
              ))}
            </div>
          </div>
        ) : null}
        {canCreateChat ? (
          <div className="mt-4 rounded-xl border border-brand-200 bg-brand-50/60 p-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-[11px] font-bold uppercase tracking-wider text-brand-700">Open Support Chat</div>
                <p className="mt-1 text-xs text-zinc-600">Use a clear subject so the right IT owner is routed in quickly.</p>
              </div>
              <button
                type="button"
                onClick={onStartFreshChat}
                aria-label="Create new chat"
                title="Create new chat"
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-brand-200 bg-white text-brand-700 hover:bg-brand-50"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
            <input
              type="text"
              value={newChannelName}
              onChange={(event) => onNewChannelNameChange(event.target.value)}
              placeholder="Chat subject"
              className="mt-3 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
            />
            <textarea
              value={newChannelMessage}
              onChange={(event) => onNewChannelMessageChange(event.target.value)}
              rows={3}
              placeholder="Optional first message"
              className="mt-3 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
            />
            <button
              type="button"
              onClick={onCreateSupportChat}
              disabled={creatingChannel || !newChannelName.trim()}
              className="mt-3 w-full rounded-lg bg-brand-600 px-3 py-2 text-sm font-bold text-white hover:bg-brand-700 disabled:opacity-60"
            >
              {creatingChannel ? 'Creating...' : 'Start Support Chat'}
            </button>
          </div>
        ) : null}
      </div>
      <div className="flex-1 overflow-y-auto">
        {loadingChannels ? <div className="p-4 text-sm text-zinc-500">Loading channels...</div> : null}
        {!loadingChannels && visibleChannels.length === 0 ? <div className="p-4 text-sm text-zinc-500">No channels available.</div> : null}
        {visibleChannels.map((channel) => {
          const memberNames = channel.members.map((member) => member.fullName).join(', ');
          return (
            <button key={channel.id} type="button" onClick={() => onSelectChannel(channel.id)} className={`w-full border-b border-zinc-100 px-4 py-3 text-left transition-colors ${channel.id === activeChannelId ? 'bg-zinc-100' : 'hover:bg-zinc-50'}`}>
              <div className="mb-1 flex items-start justify-between gap-3">
                <span className="min-w-0 truncate text-sm font-bold text-zinc-900">{channel.name}</span>
                <div className="flex shrink-0 items-center gap-2">
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${channel.status === 'closed' ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'}`}>{formatChannelStatus(channel.status)}</span>
                  <span className="text-[10px] font-semibold uppercase text-zinc-500">{channel.kind}</span>
                </div>
              </div>
              <p className="truncate text-xs text-zinc-600">{channel.latestMessage?.body || memberNames || 'No members listed'}</p>
              <div className="mt-2 flex items-center justify-between gap-3 text-[11px] text-zinc-500">
                <span className="truncate">{channel.latestMessage ? `${chatPreviewAuthorName(channel.latestMessage)} · ${formatDateTime(channel.latestMessage.createdAt)}` : `Opened ${formatDateTime(channel.createdAt)}`}</span>
                <span className="shrink-0">{channel.linkedRequest?.ticketNumber || `${channel.messageCount || 0} msgs`}</span>
              </div>
            </button>
          );
        })}
      </div>
      <Pagination
        currentPage={channelPage}
        totalItems={totalChannels}
        pageSize={pageSize}
        onPageChange={onChannelPageChange}
        itemLabel="channels"
      />
    </div>
  );
}