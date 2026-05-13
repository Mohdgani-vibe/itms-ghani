import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import PatchDeviceRow from './PatchDeviceRow';

describe('PatchDeviceRow', () => {
  it('disables patch and Salt console actions for retired assets', () => {
    const markup = renderToStaticMarkup(
      <table>
        <tbody>
          <PatchDeviceRow
            hostname="retired-host"
            osName="Ubuntu"
            userFullName="Retired User"
            departmentName="IT"
            patchGroupName="Default Ring"
            deviceStatus="retired"
            patchStatus="pending"
            canOperate={true}
            isOpeningConsole={false}
            onOpenDevice={() => {}}
            onRunPatch={() => {}}
            onOpenConsole={() => {}}
          />
        </tbody>
      </table>,
    );

    expect(markup).toContain('Retired assets are read-only for patch and Salt console actions');
    expect(markup).toContain('disabled=""');
  });
});