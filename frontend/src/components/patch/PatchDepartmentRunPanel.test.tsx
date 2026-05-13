import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import PatchDepartmentRunPanel from './PatchDepartmentRunPanel';

describe('PatchDepartmentRunPanel', () => {
  it('renders actionable totals, retired read-only messaging, and device actions', () => {
    const markup = renderToStaticMarkup(
      <PatchDepartmentRunPanel
        runningPatch={false}
        canOperate={true}
        openingConsoleDeviceId=""
        totalDevices={3}
        actionableDeviceCount={1}
        departmentSystemsLabel="Finance systems"
        loading={false}
        departmentSystems={[
          {
            id: 'device-1',
            hostname: 'fin-laptop-01',
            osName: 'Ubuntu 24.04',
            status: 'retired',
            patchStatus: 'pending',
            department: { name: 'Finance' },
            user: { fullName: 'Asha Patel' },
          },
          {
            id: 'device-2',
            hostname: 'fin-laptop-02',
            osName: 'Windows 11',
            status: 'in_use',
            patchStatus: 'up_to_date',
            department: { name: 'Finance' },
          },
        ]}
        onRunDepartmentPatch={() => {}}
        onOpenDepartmentSaltConsole={() => {}}
        onOpenDevice={() => {}}
        onRunPatchForDevice={() => {}}
        onOpenConsoleForDevice={() => {}}
      />,
    );

    expect(markup).toContain('Department Run');
    expect(markup).toContain('Salt patch execution');
    expect(markup).toContain('>1<');
    expect(markup).toContain('Run Department Patch');
    expect(markup).toContain('Open Department Salt Console');
    expect(markup).toContain('Retired assets are read-only for patch and Salt console actions until they return to an active lifecycle state.');
    expect(markup).toContain('Finance systems');
    expect(markup).toContain('fin-laptop-01');
    expect(markup).toContain('Open Salt Console');
    expect(markup).toContain('Run Patch');
    expect(markup).toContain('Showing the first 2 systems here. Use the full device table below for the rest.');
  });
});