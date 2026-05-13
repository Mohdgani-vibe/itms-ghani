interface SettingsWorkflowRulesPanelProps {
  canEditWorkflowSettings: boolean;
  requestSubjectEditor: string;
  chatSubjectEditor: string;
  invalidRequestSubjectRules?: string[];
  invalidChatSubjectRules?: string[];
  onRequestSubjectEditorChange: (value: string) => void;
  onChatSubjectEditorChange: (value: string) => void;
}

export default function SettingsWorkflowRulesPanel({
  canEditWorkflowSettings,
  requestSubjectEditor,
  chatSubjectEditor,
  invalidRequestSubjectRules = [],
  invalidChatSubjectRules = [],
  onRequestSubjectEditorChange,
  onChatSubjectEditorChange,
}: SettingsWorkflowRulesPanelProps) {
  return (
    <>
      <div className="grid gap-4 xl:grid-cols-2">
        <label className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-700">
          <span className="block text-sm font-bold text-zinc-900">Request Subject Rules</span>
          <span className="mt-1 block text-xs text-zinc-500">One rule per line in the format keyword =&gt; assignee-id. These run after request type rules.</span>
          <textarea
            value={requestSubjectEditor}
            onChange={(event) => onRequestSubjectEditorChange(event.target.value)}
            disabled={!canEditWorkflowSettings}
            rows={8}
            placeholder="portal access => user-uuid
software install => user-uuid"
            className="mt-3 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2.5 font-mono text-xs text-zinc-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
          />
          {invalidRequestSubjectRules.length > 0 ? (
            <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">
              <div className="font-bold uppercase tracking-wider">Invalid lines</div>
              <div className="mt-1">Use `keyword =&gt; assignee-id` for every non-empty line.</div>
              <div className="mt-2 space-y-1 font-mono">
                {invalidRequestSubjectRules.map((line) => <div key={`request-rule-${line}`}>{line}</div>)}
              </div>
            </div>
          ) : null}
        </label>
        <label className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-700">
          <span className="block text-sm font-bold text-zinc-900">Chat Subject Rules</span>
          <span className="mt-1 block text-xs text-zinc-500">One rule per line in the format keyword =&gt; assignee-id. Matching channels auto-add that IT owner.</span>
          <textarea
            value={chatSubjectEditor}
            onChange={(event) => onChatSubjectEditorChange(event.target.value)}
            disabled={!canEditWorkflowSettings}
            rows={8}
            placeholder="leave request => user-uuid
os reinstall => user-uuid"
            className="mt-3 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2.5 font-mono text-xs text-zinc-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
          />
          {invalidChatSubjectRules.length > 0 ? (
            <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">
              <div className="font-bold uppercase tracking-wider">Invalid lines</div>
              <div className="mt-1">Use `keyword =&gt; assignee-id` for every non-empty line.</div>
              <div className="mt-2 space-y-1 font-mono">
                {invalidChatSubjectRules.map((line) => <div key={`chat-rule-${line}`}>{line}</div>)}
              </div>
            </div>
          ) : null}
        </label>
      </div>

      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
        Leave-aware diversion is still not wired because the current platform does not expose a leave-status source for IT ownership handoff.
      </div>
    </>
  );
}