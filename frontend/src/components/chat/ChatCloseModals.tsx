import { actionButtonStyles } from '../../lib/buttonStyles';

interface CloseResult {
  ticketNumber?: string;
}

interface ChatCloseModalsProps {
  closeDialogOpen: boolean;
  closeResult: CloseResult | null;
  closingChannel: boolean;
  canCreateChat: boolean;
  onCancelClose: () => void;
  onConfirmClose: () => void;
  onAcknowledgeCloseResult: () => void;
}

export default function ChatCloseModals({
  closeDialogOpen,
  closeResult,
  closingChannel,
  canCreateChat,
  onCancelClose,
  onConfirmClose,
  onAcknowledgeCloseResult,
}: ChatCloseModalsProps) {
  return (
    <>
      {closeDialogOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/50 px-4">
          <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-6 shadow-lg">
            <div className="text-lg font-bold text-zinc-900">Close ticket and chat?</div>
            <p className="mt-2 text-sm text-zinc-600">Closing this chat will keep the conversation history and convert it into a linked ticket for follow-up.</p>
            <div className="mt-6 flex justify-end gap-3">
              <button type="button" onClick={onCancelClose} className={`rounded-lg px-4 py-2 text-sm font-bold transition ${actionButtonStyles.add}`}>Cancel</button>
              <button type="button" onClick={onConfirmClose} disabled={closingChannel} className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-bold text-white hover:bg-rose-700 disabled:opacity-60">{closingChannel ? 'Closing...' : 'Close Now'}</button>
            </div>
          </div>
        </div>
      ) : null}

      {closeResult ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/50 px-4">
          <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-6 shadow-lg">
            <div className="text-lg font-bold text-zinc-900">Ticket closed</div>
            <p className="mt-2 text-sm text-zinc-600">{closeResult.ticketNumber ? `Follow-up is now tracked under ${closeResult.ticketNumber}. Thanks.` : 'The chat is closed. Thanks.'}</p>
            <div className="mt-6 flex justify-end">
              <button type="button" onClick={onAcknowledgeCloseResult} className={`rounded-lg px-4 py-2 text-sm font-bold transition ${actionButtonStyles.add}`}>{canCreateChat ? 'Okay' : 'Close'}</button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}