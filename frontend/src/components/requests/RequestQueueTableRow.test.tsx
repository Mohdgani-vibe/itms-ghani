import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import RequestQueueTableRow from './RequestQueueTableRow';

describe('RequestQueueTableRow', () => {
  it('renders the enrollment-review row variant with device actions', () => {
    const markup = renderToStaticMarkup(
      <table>
        <tbody>
          <RequestQueueTableRow
            requestIdLabel="REQ-2048"
            title="Approve endpoint enrollment"
            typeLabel="Enrollment review"
            commentsLabel="2 comments"
            statusLabel="Pending"
            statusClassName="bg-amber-100 text-amber-700"
            updatedAtLabel="08 May 2026"
            requesterName="Chris Employee"
            assigneeName="Ava Admin"
            isSelected={true}
            isEnrollmentRequest={true}
            isBulkSelected={true}
            canStart={true}
            canApproveAndOpen={true}
            hasLinkedDevice={true}
            enrollmentAsset="LT-44"
            enrollmentOwner="Chris Employee"
            enrollmentDepartment="IT"
            deviceLinkLabel="Device linked"
            inspectButtonClassName="inspect-btn"
            onToggleBulkSelect={vi.fn()}
            onInspect={vi.fn()}
            onStart={vi.fn()}
            onApproveAndOpen={vi.fn()}
          />
        </tbody>
      </table>,
    );

    expect(markup).toContain('checked=""');
    expect(markup).toContain('Enrollment Review');
    expect(markup).toContain('REQ-2048');
    expect(markup).toContain('Approve endpoint enrollment');
    expect(markup).toContain('Asset');
    expect(markup).toContain('LT-44');
    expect(markup).toContain('Owner');
    expect(markup).toContain('Department');
    expect(markup).toContain('Device linked');
    expect(markup).toContain('Pending');
    expect(markup).toContain('Inspect');
  });

  it('renders the standard request row variant and device-sync fallback action', () => {
    const markup = renderToStaticMarkup(
      <table>
        <tbody>
          <RequestQueueTableRow
            requestIdLabel="REQ-2049"
            title="Grant portal access"
            typeLabel="Other"
            commentsLabel="0 comments"
            statusLabel="In Progress"
            statusClassName="bg-amber-100 text-amber-700"
            updatedAtLabel="08 May 2026"
            requesterName="Chris Employee"
            assigneeName="Ava Admin"
            isSelected={false}
            isEnrollmentRequest={false}
            isBulkSelected={false}
            canStart={false}
            canApproveAndOpen={false}
            hasLinkedDevice={false}
            enrollmentAsset=""
            enrollmentOwner=""
            enrollmentDepartment=""
            deviceLinkLabel=""
            inspectButtonClassName="inspect-btn"
            onToggleBulkSelect={vi.fn()}
            onInspect={vi.fn()}
            onStart={vi.fn()}
            onApproveAndOpen={vi.fn()}
          />
        </tbody>
      </table>,
    );

    expect(markup).toContain('Grant portal access');
    expect(markup).toContain('Other');
    expect(markup).toContain('In Progress');
    expect(markup).toContain('Ava Admin');
    expect(markup).toContain('disabled=""');
    expect(markup).toContain('Start');
  });
});