import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import SaltUpdatesPanel from './SaltUpdatesPanel';

describe('SaltUpdatesPanel', () => {
  it('renders salt action controls, blocked reason, and recent jobs', () => {
    const markup = renderToStaticMarkup(
      <SaltUpdatesPanel
        saltTarget="minion-001"
        selectedSaltAction="system-update"
        customSaltInput=""
        runningPatch={false}
        canOperate={true}
        canOpenPatchConsole={false}
        patchActionButtonLabel="Queue Salt Action"
        patchBlockedReason="Patch console is unavailable until Salt API is configured."
        sidebarLoading={false}
        patchJobs={[
          { id: 'job-1', jid: '202605080001', status: 'completed', scope: 'state.apply', createdAt: '2026-05-08T09:00:00Z' },
        ]}
        onSelectedSaltActionChange={vi.fn()}
        onCustomSaltInputChange={vi.fn()}
        onRunPatch={vi.fn()}
        formatDate={() => '08 May 2026'}
      />,
    );

    expect(markup).toContain('Salt Updates');
    expect(markup).toContain('Salt target:');
    expect(markup).toContain('minion-001');
    expect(markup).toContain('Salt action');
    expect(markup).toContain('Queue Salt Action');
    expect(markup).toContain('Patch console is unavailable until Salt API is configured.');
    expect(markup).toContain('202605080001');
    expect(markup).toContain('state.apply • completed • 08 May 2026');
    expect(markup).toContain('disabled=""');
  });

  it('renders auditor read-only and empty-history states', () => {
    const markup = renderToStaticMarkup(
      <SaltUpdatesPanel
        saltTarget="minion-001"
        selectedSaltAction="system-update"
        customSaltInput=""
        runningPatch={false}
        canOperate={false}
        canOpenPatchConsole={false}
        patchActionButtonLabel="Queue Salt Action"
        patchBlockedReason=""
        sidebarLoading={false}
        patchJobs={[]}
        onSelectedSaltActionChange={vi.fn()}
        onCustomSaltInputChange={vi.fn()}
        onRunPatch={vi.fn()}
        formatDate={() => '08 May 2026'}
      />,
    );

    expect(markup).toContain('Auditor access is read-only.');
    expect(markup).toContain('No recent Salt update jobs for this asset.');
  });
});