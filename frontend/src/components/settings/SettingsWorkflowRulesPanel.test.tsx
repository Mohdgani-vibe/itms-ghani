import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import SettingsWorkflowRulesPanel from './SettingsWorkflowRulesPanel';

describe('SettingsWorkflowRulesPanel', () => {
  it('renders request and chat rule editors with invalid-line feedback', () => {
    const markup = renderToStaticMarkup(
      <SettingsWorkflowRulesPanel
        canEditWorkflowSettings={true}
        requestSubjectEditor={'portal access => user-1'}
        chatSubjectEditor={'os reinstall => user-2'}
        invalidRequestSubjectRules={['bad request line']}
        invalidChatSubjectRules={['bad chat line']}
        onRequestSubjectEditorChange={vi.fn()}
        onChatSubjectEditorChange={vi.fn()}
      />,
    );

    expect(markup).toContain('Request Subject Rules');
    expect(markup).toContain('Chat Subject Rules');
    expect(markup).toContain('portal access =&gt; user-1');
    expect(markup).toContain('os reinstall =&gt; user-2');
    expect(markup).toContain('Invalid lines');
    expect(markup).toContain('Use `keyword =&gt; assignee-id` for every non-empty line.');
    expect(markup).toContain('bad request line');
    expect(markup).toContain('bad chat line');
    expect(markup).toContain('Leave-aware diversion is still not wired');
  });

  it('renders disabled editors without invalid feedback by default', () => {
    const markup = renderToStaticMarkup(
      <SettingsWorkflowRulesPanel
        canEditWorkflowSettings={false}
        requestSubjectEditor=""
        chatSubjectEditor=""
        onRequestSubjectEditorChange={vi.fn()}
        onChatSubjectEditorChange={vi.fn()}
      />,
    );

    expect(markup).toContain('disabled=""');
    expect(markup).not.toContain('Invalid lines');
  });
});