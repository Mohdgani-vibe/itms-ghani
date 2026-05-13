import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import PatchDepartmentFilterPanel from './PatchDepartmentFilterPanel';

describe('PatchDepartmentFilterPanel', () => {
  it('renders the department scope controls and total device count', () => {
    const markup = renderToStaticMarkup(
      <PatchDepartmentFilterPanel
        selectedDepartment="all"
        departmentOptions={['all', 'Finance', 'IT Operations']}
        totalDevices={22}
        onSelectedDepartmentChange={() => {}}
      />,
    );

    expect(markup).toContain('Department Filter');
    expect(markup).toContain('Scope the rollout');
    expect(markup).toContain('All departments');
    expect(markup).toContain('Finance');
    expect(markup).toContain('IT Operations');
    expect(markup).toContain('22 managed device(s) assigned to this department.');
  });
});