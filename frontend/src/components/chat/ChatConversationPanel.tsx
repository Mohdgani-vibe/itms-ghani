import { Plus, Send, Trash2 } from 'lucide-react';
import type { ChatChannel, ChatMessage } from './types';

function initials(name: string) {
  return name.split(' ').filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase();
}

function formatChannelStatus(status?: string) {
  return status === 'closed' ? 'Closed' : 'Open';
}

interface ChatConversationPanelProps {
  activeChannel: ChatChannel | null;
  activeChannelId: string;
  canCreateChat: boolean;
  canComposeChat: boolean;
  canCloseActiveChannel: boolean;
  canReopenActiveChannel: boolean;
  isManager: boolean;
  closingChannel: boolean;
  error: string;
  notice: string;
  hasOlderMessages: boolean;
  loadingMessages: boolean;
  loadingOlderMessages: boolean;
  totalMessages: number;
  messages: ChatMessage[];
  remoteTypingLabel: string;
  currentUserId?: string;
  draft: string;
  socketReady: boolean;
  isActiveChannelClosed: boolean;
  onStartFreshChat: () => void;
  onCloseChannel: () => void;
  onReopenChannel: () => void;
  onLoadOlderMessages: () => void;
  onDraftChange: (value: string) => void;
  onDraftBlur: () => void;
  onSend: () => void;
}

export default function ChatConversationPanel({
  activeChannel,
  activeChannelId,
  canCreateChat,
  canComposeChat,
  canCloseActiveChannel,
  canReopenActiveChannel,
  isManager,
  closingChannel,
  error,
  notice,
  hasOlderMessages,
  loadingMessages,
  loadingOlderMessages,
  totalMessages,
  messages,
  remoteTypingLabel,
  currentUserId,
  draft,
  socketReady,
  isActiveChannelClosed,
  onStartFreshChat,
  onCloseChannel,
  onReopenChannel,
  onLoadOlderMessages,
  onDraftChange,
  onDraftBlur,
  onSend,
}: ChatConversationPanelProps) {
  return (
    <div className="flex min-h-0 flex-col bg-white">
      <div className="shrink-0 border-b border-zinc-200 px-5 py-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex min-w-0 items-center">
            <div className="mr-3 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-100 font-bold text-brand-700">
              {initials(activeChannel?.name || 'CH')}
            </div>
            <div className="min-w-0">
              <h3 className="truncate text-sm font-bold leading-tight text-zinc-900">{activeChannel?.name || 'Select a channel'}</h3>
              <p className="mt-0.5 truncate text-xs text-zinc-500">
                {activeChannel ? activeChannel.members.map((member) => member.fullName).join(', ') : 'Choose a channel to load messages'}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            {canCreateChat ? (
              <button
                type="button"
                onClick={onStartFreshChat}
                aria-label="Create new chat"
                title="Create new chat"
                className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-brand-200 bg-white text-brand-700 hover:bg-brand-50"
              >
                <Plus className="h-4 w-4" />
              </button>
            ) : null}
            {activeChannel?.linkedRequest?.ticketNumber ? <div className="rounded-md border border-brand-200 bg-brand-50 px-3 py-1.5 text-xs font-bold uppercase text-brand-700">{activeChannel.linkedRequest.ticketNumber}</div> : null}
            <div className="rounded-md border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-xs font-bold uppercase text-zinc-600">
              {activeChannel?.kind || 'Channel'} · {formatChannelStatus(activeChannel?.status)}
            </div>
            {canCloseActiveChannel ? (
              <button
                type="button"
                onClick={onCloseChannel}
                disabled={!activeChannel || closingChannel}
                className="inline-flex items-center gap-1.5 rounded-md bg-rose-600 px-3 py-1.5 text-xs font-bold uppercase text-white hover:bg-rose-700 disabled:opacity-60"
              >
                <Trash2 className="h-3.5 w-3.5" />
                {closingChannel ? 'Closing...' : 'Close Chat'}
              </button>
            ) : null}
            {canReopenActiveChannel && isManager ? (
              <button
                type="button"
                onClick={onReopenChannel}
                disabled={!activeChannel || closingChannel}
                className="rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-xs font-bold uppercase text-zinc-700 hover:bg-zinc-100 disabled:opacity-60"
              >
                {closingChannel ? 'Updating...' : 'Reopen Chat'}
              </button>
            ) : null}
          </div>
        </div>
      </div>

      <div className="flex flex-1 flex-col justify-end space-y-5 overflow-y-auto bg-zinc-50 p-5">
        {error ? <div className="self-stretch rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</div> : null}
        {notice ? <div className="self-stretch rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">{notice}</div> : null}
        {canReopenActiveChannel && !isManager ? (
          <div className="flex items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            <div>
              <div className="font-semibold">This chat is closed.</div>
              <div className="mt-1 text-xs text-amber-800">Reopen it if you still need help, or start a new support chat for a fresh thread.</div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onStartFreshChat}
                aria-label="Create new chat"
                title="Create new chat"
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-amber-300 bg-white text-amber-800 hover:bg-amber-100"
              >
                <Plus className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={onReopenChannel}
                disabled={closingChannel}
                className="rounded-lg bg-amber-500 px-3 py-2 text-xs font-bold uppercase tracking-wider text-white hover:bg-amber-600 disabled:opacity-60"
              >
                {closingChannel ? 'Updating...' : 'Reopen Chat'}
              </button>
            </div>
          </div>
        ) : null}
        {activeChannelId && hasOlderMessages ? (
          <div className="self-center">
            <button
              type="button"
              onClick={onLoadOlderMessages}
              disabled={loadingMessages || loadingOlderMessages}
              className="rounded-full border border-zinc-200 bg-white px-4 py-2 text-xs font-bold uppercase tracking-wider text-zinc-600 shadow-sm hover:bg-zinc-50 disabled:opacity-60"
            >
              {loadingOlderMessages ? 'Loading older messages...' : `Load older messages (${Math.max(totalMessages - messages.length, 0)} more)`}
            </button>
          </div>
        ) : null}
        {loadingMessages ? <div className="text-sm text-zinc-500">Loading messages...</div> : null}
        {!loadingMessages && activeChannelId && messages.length === 0 ? <div className="text-sm text-zinc-500">No messages in this channel yet.</div> : null}
        {!activeChannelId ? (
          <div className="flex items-center justify-between gap-3 rounded-xl border border-brand-200 bg-brand-50/60 p-4 text-sm text-zinc-600">
            <div>
              <div className="font-semibold text-brand-800">No chat selected.</div>
              <div className="mt-1 text-xs text-zinc-600">Select an existing channel or start a fresh support chat.</div>
            </div>
            {canCreateChat ? (
              <button
                type="button"
                onClick={onStartFreshChat}
                aria-label="Create new chat"
                title="Create new chat"
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-brand-200 bg-white text-brand-700 hover:bg-brand-50"
              >
                <Plus className="h-4 w-4" />
              </button>
            ) : null}
          </div>
        ) : null}
        {messages.map((msg) => {
          const isMe = msg.author.id === currentUserId;
          return (
            <div key={msg.id} className={`flex max-w-[80%] ${isMe ? 'self-end flex-row-reverse' : 'self-start'}`}>
              <div className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ${isMe ? 'ml-3 bg-zinc-900 text-white' : 'mr-3 bg-brand-100 text-brand-700'}`}>
                {initials(msg.author.fullName)}
              </div>
              <div className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                <div className="mb-1 flex items-center space-x-2">
                  <span className="text-xs font-semibold text-zinc-500">{msg.author.fullName}</span>
                  <span className="text-[10px] text-zinc-400">{new Date(msg.createdAt).toLocaleString()}</span>
                </div>
                <div className={`break-words rounded-2xl p-3 text-sm ${isMe ? 'rounded-tr-none bg-zinc-900 text-white' : 'rounded-tl-none border border-zinc-200 bg-white text-zinc-800'}`}>
                  {msg.body}
                </div>
              </div>
            </div>
          );
        })}
        {remoteTypingLabel ? <div className="text-xs font-semibold text-zinc-500">{remoteTypingLabel}</div> : null}
      </div>

      <div className="shrink-0 border-t border-zinc-200 bg-white p-4">
        <div className="relative flex items-center">
          <input
            type="text"
            value={draft}
            onChange={(event) => onDraftChange(event.target.value)}
            onBlur={onDraftBlur}
            onKeyDown={(event) => event.key === 'Enter' && onSend()}
            disabled={!canComposeChat || !activeChannelId || !socketReady || isActiveChannelClosed}
            placeholder={!activeChannelId ? 'Select a channel first' : !canComposeChat ? 'Auditor access is read-only.' : isActiveChannelClosed ? 'This chat is closed. Reopen it to continue.' : socketReady ? 'Type a message...' : 'Connecting to chat...'}
            className="w-full rounded-xl border border-zinc-200 bg-zinc-50 py-3.5 pl-4 pr-12 text-sm shadow-sm transition-colors focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 disabled:opacity-60"
          />
          <button type="button" onClick={onSend} disabled={!canComposeChat || !activeChannelId || !draft.trim() || !socketReady || isActiveChannelClosed} className="absolute right-2 rounded-lg bg-brand-600 p-2 text-white shadow-sm transition-colors hover:bg-brand-700 disabled:opacity-60">
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}