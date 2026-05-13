import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import DeviceAssignmentPanel, { deviceAssignmentActionsReadOnly } from './DeviceAssignmentPanel';

describe('DeviceAssignmentPanel', () => {
  it('fails closed for inactive assigned users', () => {
    expect(deviceAssignmentActionsReadOnly(true, 'in_use', 'inactive')).toBe(true);
    expect(deviceAssignmentActionsReadOnly(true, 'retired', null)).toBe(true);
  });

  it('hides mutation controls for inactive assigned users', () => {
    const markup = renderToStaticMarkup(
      <DeviceAssignmentPanel
        assignedUser={{
          fullName: 'Inactive User',
          employeeCode: 'EMP-101',
          email: 'inactive@example.com',
          status: 'inactive',
        }}
        deviceStatus="in_use"
        department={{ name: 'IT' }}
        canOperate={true}
        isAssigned={true}
        assetActionLoading={false}
        enrollmentRequest={null}
        enrollmentDetails={{}}
        assignmentUsersLoading={false}
        assignmentSearchQuery=""
        assignableUsers={[]}
        selectedAssignmentUserId=""
        assigningDevice={false}
        onUnassignAsset={() => {}}
        onDeleteAsset={() => {}}
        onAssignmentSearchQueryChange={() => {}}
        onSelectedAssignmentUserIdChange={() => {}}
        onAssignDevice={() => {}}
      />,
    );

    expect(markup).toContain('This user is inactive. Asset actions are read-only until the account is reactivated.');
    expect(markup).not.toContain('Remove From User');
    expect(markup).not.toContain('Delete Asset');
  });

  it('hides assignment controls for retired assets', () => {
    const markup = renderToStaticMarkup(
      <DeviceAssignmentPanel
        assignedUser={null}
        deviceStatus="retired"
        department={{ name: 'IT' }}
        canOperate={true}
        isAssigned={false}
        assetActionLoading={false}
        enrollmentRequest={null}
        enrollmentDetails={{}}
        assignmentUsersLoading={false}
        assignmentSearchQuery=""
        assignableUsers={[]}
        selectedAssignmentUserId=""
        assigningDevice={false}
        onUnassignAsset={() => {}}
        onDeleteAsset={() => {}}
        onAssignmentSearchQueryChange={() => {}}
        onSelectedAssignmentUserIdChange={() => {}}
        onAssignDevice={() => {}}
      />,
    );

    expect(markup).toContain('This asset is retired. Assignment actions are read-only');
    expect(markup).not.toContain('Assign Device');
    expect(markup).not.toContain('Delete Asset');
  });
});