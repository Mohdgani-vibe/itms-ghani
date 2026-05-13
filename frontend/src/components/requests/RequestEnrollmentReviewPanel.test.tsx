import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import RequestEnrollmentReviewPanel from './RequestEnrollmentReviewPanel';

describe('RequestEnrollmentReviewPanel', () => {
  it('renders enrollment metadata and enabled review actions', () => {
    const markup = renderToStaticMarkup(
      <RequestEnrollmentReviewPanel
        assetLabel="LT-44"
        requesterName="Chris Employee"
        requesterEmail="chris@example.com"
        employeeIdLabel="EMP-101"
        departmentLabel="IT"
        modelLabel="Dell Latitude 7440"
        osLabel="Ubuntu 24.04"
        canOpenDevice={true}
        canStartReview={true}
        canApproveAndOpen={true}
        canApprove={true}
        canReject={true}
        openDeviceLabel="Open Device"
        approveAndOpenLabel="Approve & Open"
        onOpenDevice={vi.fn()}
        onStartReview={vi.fn()}
        onApproveAndOpen={vi.fn()}
        onApprove={vi.fn()}
        onReject={vi.fn()}
      />,
    );

    expect(markup).toContain('Enrollment Review');
    expect(markup).toContain('LT-44');
    expect(markup).toContain('Chris Employee');
    expect(markup).toContain('chris@example.com');
    expect(markup).toContain('EMP-101');
    expect(markup).toContain('IT');
    expect(markup).toContain('Dell Latitude 7440');
    expect(markup).toContain('Ubuntu 24.04');
    expect(markup).toContain('Open Device');
  });

  it('renders disabled actions when review actions are unavailable', () => {
    const markup = renderToStaticMarkup(
      <RequestEnrollmentReviewPanel
        assetLabel="LT-44"
        requesterName="Chris Employee"
        requesterEmail="chris@example.com"
        employeeIdLabel="EMP-101"
        departmentLabel="IT"
        modelLabel="Dell Latitude 7440"
        osLabel="Ubuntu 24.04"
        canOpenDevice={false}
        canStartReview={false}
        canApproveAndOpen={false}
        canApprove={false}
        canReject={false}
        openDeviceLabel="Awaiting device link"
        approveAndOpenLabel="Approve & Open"
        onOpenDevice={vi.fn()}
        onStartReview={vi.fn()}
        onApproveAndOpen={vi.fn()}
        onApprove={vi.fn()}
        onReject={vi.fn()}
      />,
    );

    expect(markup).toContain('disabled=""');
    expect(markup).toContain('Awaiting device link');
  });
});