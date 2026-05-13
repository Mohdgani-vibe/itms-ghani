import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import RequestsBulkTriagePanel from './RequestsBulkTriagePanel';

describe('RequestsBulkTriagePanel', () => {
  it('renders bulk controls, success feedback, and moved-status follow-up', () => {
    const markup = renderToStaticMarkup(
      <RequestsBulkTriagePanel
        bulkSelectedCount={3}
        bulkAssigneeId="user-1"
        bulkStatus="in_progress"
        bulkSaving={false}
        bulkFeedback={{
          tone: 'success',
          actionLabel: 'Bulk update',
          successCount: 2,
          failureCount: 1,
          failedRequestIds: ['request-12345678'],
          movedOutOfViewCount: 2,
          movedToStatusLabel: 'In Progress',
        }}
        assigneeOptions={[{ value: 'user-1', label: 'Ava Admin' }]}
        statusOptions={[{ value: 'pending', label: 'Pending' }, { value: 'in_progress', label: 'In Progress' }]}
        onAssigneeChange={vi.fn()}
        onStatusChange={vi.fn()}
        onAssignSelected={vi.fn()}
        onUpdateStatus={vi.fn()}
        onShowMovedStatusResults={vi.fn()}
      />,
    );

    expect(markup).toContain('Bulk Triage');
    expect(markup).toContain('3 selected');
    expect(markup).toContain('Assign selected requests');
    expect(markup).toContain('Ava Admin');
    expect(markup).toContain('In Progress');
    expect(markup).toContain('Assign Selected');
    expect(markup).toContain('Update Status');
    expect(markup).toContain('Bulk update completed with partial results');
    expect(markup).toContain('2 requests succeeded, 1 failed and remain selected for follow-up.');
    expect(markup).toContain('2 updated requests no longer match the current status filter.');
    expect(markup).toContain('Show In Progress');
    expect(markup).toContain('Failed IDs: request-');
    expect(markup).toContain('Compact table mode');
  });

  it('renders disabled actions and saving label when no selection is ready', () => {
    const markup = renderToStaticMarkup(
      <RequestsBulkTriagePanel
        bulkSelectedCount={0}
        bulkAssigneeId=""
        bulkStatus="pending"
        bulkSaving={true}
        bulkFeedback={null}
        assigneeOptions={[]}
        statusOptions={[{ value: 'pending', label: 'Pending' }]}
        onAssigneeChange={vi.fn()}
        onStatusChange={vi.fn()}
        onAssignSelected={vi.fn()}
        onUpdateStatus={vi.fn()}
        onShowMovedStatusResults={vi.fn()}
      />,
    );

    expect(markup).toContain('disabled=""');
    expect(markup).toContain('Applying...');
  });
});