interface UsersPageFeedbackProps {
  error: string;
  successMessage: string;
}

export default function UsersPageFeedback({ error, successMessage }: UsersPageFeedbackProps) {
  return (
    <>
      {error ? <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</div> : null}
      {successMessage ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">{successMessage}</div> : null}
    </>
  );
}