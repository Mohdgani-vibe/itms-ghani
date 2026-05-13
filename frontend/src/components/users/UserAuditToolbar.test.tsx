import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import UserAuditToolbar from './UserAuditToolbar';

describe('UserAuditToolbar', () => {
  it('renders audit filters, module counts, presets, and active action chip', () => {
    const markup = renderToStaticMarkup(
      <UserAuditToolbar
        auditSearchQuery="reset"
        auditModuleFilter="access"
        auditActionFilter="password_reset"
        auditTotal={12}
        auditModuleCounts={new Map([
          ['access', 5],
          ['assets', 2],
        ])}
        accessAuditActionPresets={['password_reset', 'access_saved']}
        formatAuditModuleLabel={(value) => value === 'all' ? 'All' : value === 'access' ? 'Access' : value}
        formatAuditActionLabel={(value) => value === 'password_reset' ? 'Password Reset' : value === 'access_saved' ? 'Access Saved' : value}
        onAuditSearchQueryChange={vi.fn()}
        onAuditModuleFilterChange={vi.fn()}
        onAuditActionFilterChange={vi.fn()}
        onClearAuditActionFilter={vi.fn()}
      />,
    );

    expect(markup).toContain('Audit Activity');
    expect(markup).toContain('Track who added assets, created gatepasses, ran patch jobs, or changed users.');
    expect(markup).toContain('Search by summary, actor, subject, action, or module');
    expect(markup).toContain('All');
    expect(markup).toContain('>12<');
    expect(markup).toContain('Access');
    expect(markup).toContain('>5<');
    expect(markup).toContain('Password Reset');
    expect(markup).toContain('Access Saved');
    expect(markup).toContain('Action filter:');
    expect(markup).toContain('Clear');
  });
});