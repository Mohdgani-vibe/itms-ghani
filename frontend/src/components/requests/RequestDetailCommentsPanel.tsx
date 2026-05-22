interface RequestComment {
  id: string;
  author: string;
  note: string;
}

interface RequestDetailCommentsPanelProps {
  comments: RequestComment[];
}

export default function RequestDetailCommentsPanel({ comments }: RequestDetailCommentsPanelProps) {
  if (!comments.length) {
    return <div className="rounded-xl border border-emerald-100 bg-emerald-50/70 px-4 py-4 text-sm text-zinc-500">No comments have been added to this request yet.</div>;
  }

  return (
    <div className="space-y-2">
      {comments.map((comment) => (
        <div key={comment.id} className="rounded-xl border border-emerald-100 bg-white/95 px-3 py-3 text-sm text-zinc-700 shadow-sm">
          <div className="font-semibold text-zinc-900">{comment.author}</div>
          <div className="mt-1">{comment.note}</div>
        </div>
      ))}
    </div>
  );
}