interface PatchListFeedbackProps {
  error: string;
  successMessage: string;
}

export default function PatchListFeedback({ error, successMessage }: PatchListFeedbackProps) {
  return (
    <>
      {error ? <div className="rounded-2xl border border-rose-200 bg-[linear-gradient(180deg,_#fff5f5_0%,_#fff1f2_100%)] px-5 py-4 text-sm font-semibold text-rose-700 shadow-sm">{error}</div> : null}
      {successMessage ? <div className="rounded-2xl border border-emerald-200 bg-[linear-gradient(180deg,_#f0fdf4_0%,_#ecfdf5_100%)] px-5 py-4 text-sm font-semibold text-emerald-700 shadow-sm">{successMessage}</div> : null}
    </>
  );
}