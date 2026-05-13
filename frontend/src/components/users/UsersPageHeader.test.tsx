import { Users as UsersIcon } from 'lucide-react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import UsersPageHeader from './UsersPageHeader';

describe('UsersPageHeader', () => {
  it('renders the superadmin users workspace hero and tab badges', () => {
    const markup = renderToStaticMarkup(
      <UsersPageHeader
        directoryTotal={84}
        departmentCount={6}
        assetTotal={120}
        auditTotal={412}
        unassignedTotal={9}
        activeTab="directory"
        isSuperAdmin={true}
        isAuditor={false}
        UsersIcon={UsersIcon}
        onTabChange={vi.fn()}
      />,
    );

    expect(markup).toContain('Directory Workspace');
    expect(markup).toContain('Superadmin User Portal');
    expect(markup).toContain('84');
    expect(markup).toContain('Portal Access');
    expect(markup).toContain('Unassigned');
    expect(markup).toContain('9');
  });

  it('renders the auditor header without mutation-oriented tabs', () => {
    const markup = renderToStaticMarkup(
      <UsersPageHeader
        directoryTotal={10}
        departmentCount={2}
        assetTotal={7}
        auditTotal={18}
        unassignedTotal={0}
        activeTab="directory"
        isSuperAdmin={false}
        isAuditor={true}
        UsersIcon={UsersIcon}
        onTabChange={vi.fn()}
      />,
    );

    expect(markup).toContain('Auditor User Portal');
    expect(markup).not.toContain('Add Employee');
    expect(markup).not.toContain('Portal Access');
  });
});