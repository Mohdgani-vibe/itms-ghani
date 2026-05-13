import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import PatchListHeader from './PatchListHeader';

describe('PatchListHeader', () => {
  it('renders the patch workspace summary and active run action label', () => {
    const markup = renderToStaticMarkup(
      <PatchListHeader
        basePath="/live"
        navigate={() => {}}
        canOperate={true}
        runningPatch={false}
        selectedDepartment="Finance"
        totalDevices={18}
        PlayIcon={() => <span>play</span>}
        onRunDepartmentPatch={() => {}}
      />,
    );

    expect(markup).toContain('Patch Operations');
    expect(markup).toContain('Deployment &amp; Devices');
    expect(markup).toContain('Finance');
    expect(markup).toContain('>18<');
    expect(markup).toContain('Active Control');
    expect(markup).toContain('Dashboard');
    expect(markup).toContain('Run Finance Patch');
  });
});