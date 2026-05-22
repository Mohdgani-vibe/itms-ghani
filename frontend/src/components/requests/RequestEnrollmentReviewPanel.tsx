import { actionButtonStyles } from '../../lib/buttonStyles';

interface RequestEnrollmentReviewPanelProps {
  assetLabel: string;
  requesterName: string;
  requesterEmail: string;
  employeeIdLabel: string;
  departmentLabel: string;
  modelLabel: string;
  osLabel: string;
  canOpenDevice: boolean;
  canStartReview: boolean;
  canApproveAndOpen: boolean;
  canApprove: boolean;
  canReject: boolean;
  showStartReviewAction?: boolean;
  showApproveAndOpenAction?: boolean;
  showApproveAction?: boolean;
  showRejectAction?: boolean;
  openDeviceLabel: string;
  approveAndOpenLabel: string;
  onOpenDevice: () => void;
  onStartReview: () => void;
  onApproveAndOpen: () => void;
  onApprove: () => void;
  onReject: () => void;
}

export default function RequestEnrollmentReviewPanel({
  assetLabel,
  requesterName,
  requesterEmail,
  employeeIdLabel,
  departmentLabel,
  modelLabel,
  osLabel,
  canOpenDevice,
  canStartReview,
  canApproveAndOpen,
  canApprove,
  canReject,
  showStartReviewAction = true,
  showApproveAndOpenAction = true,
  showApproveAction = true,
  showRejectAction = true,
  openDeviceLabel,
  approveAndOpenLabel,
  onOpenDevice,
  onStartReview,
  onApproveAndOpen,
  onApprove,
  onReject,
}: RequestEnrollmentReviewPanelProps) {
  return (
    <div className="rounded-2xl border border-emerald-100 bg-[linear-gradient(180deg,_#ffffff_0%,_rgba(240,253,244,0.9)_100%)] p-4 shadow-sm">
      <div className="text-xs font-bold uppercase tracking-wider text-emerald-700">Enrollment Review</div>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border border-emerald-100 bg-white/90 px-3 py-3">
          <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">Asset</div>
          <div className="mt-1 text-sm font-semibold text-zinc-900">{assetLabel}</div>
        </div>
        <div className="rounded-xl border border-emerald-100 bg-white/90 px-3 py-3">
          <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">Requester</div>
          <div className="mt-1 text-sm font-semibold text-zinc-900">{requesterName}</div>
          <div className="text-xs text-zinc-500">{requesterEmail}</div>
        </div>
        <div className="rounded-xl border border-emerald-100 bg-white/90 px-3 py-3">
          <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">Employee ID</div>
          <div className="mt-1 text-sm font-semibold text-zinc-900">{employeeIdLabel}</div>
        </div>
        <div className="rounded-xl border border-emerald-100 bg-white/90 px-3 py-3">
          <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">Department</div>
          <div className="mt-1 text-sm font-semibold text-zinc-900">{departmentLabel}</div>
        </div>
      </div>
      <div className="mt-3 rounded-xl border border-emerald-100 bg-white/90 px-3 py-3">
        <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">Endpoint Profile</div>
        <div className="mt-1 text-sm font-semibold text-zinc-900">{modelLabel}</div>
        <div className="text-xs text-zinc-500">{osLabel}</div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" onClick={onOpenDevice} disabled={!canOpenDevice} className={`rounded-lg px-3 py-2 text-xs font-bold transition disabled:cursor-not-allowed disabled:opacity-60 ${actionButtonStyles.add}`}>{openDeviceLabel}</button>
        {showStartReviewAction ? <button type="button" onClick={onStartReview} disabled={!canStartReview} className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-700 hover:bg-amber-100 disabled:opacity-60">Start Review</button> : null}
        {showApproveAndOpenAction ? <button type="button" onClick={onApproveAndOpen} disabled={!canApproveAndOpen} className={`rounded-lg px-3 py-2 text-xs font-bold transition disabled:cursor-not-allowed disabled:opacity-60 ${actionButtonStyles.save}`}>{approveAndOpenLabel}</button> : null}
        {showApproveAction ? <button type="button" onClick={onApprove} disabled={!canApprove} className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700 hover:bg-emerald-100 disabled:opacity-60">Approve</button> : null}
        {showRejectAction ? <button type="button" onClick={onReject} disabled={!canReject} className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700 hover:bg-rose-100 disabled:opacity-60">Reject</button> : null}
      </div>
    </div>
  );
}