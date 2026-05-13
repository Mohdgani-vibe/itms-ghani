import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import UserAuditList from './UserAuditList';

describe('UserAuditList', () => {
  it('renders audit entries, actor and subject cards, and pagination', () => {
    const markup = renderToStaticMarkup(
      <UserAuditList
        auditLoading={false}
        auditItems={[
          {
            id: 'audit-1',
            action: 'password_reset',
            entityId: 'user-1',
            entityType: 'user_account',
            createdAt: '2026-05-08T08:00:00Z',
            summary: 'Password reset performed for Chris Employee',
            module: 'access',
            actor: { fullName: 'Ava Admin', email: 'ava@example.com' },
            subject: { fullName: 'Chris Employee' },
          },
        ]}
        auditPage={1}
        auditTotal={12}
        auditPageSize={10}
        basePath="/users"
        getAuditModule={() => 'access'}
        resolveAuditEntityPath={() => '/users/1'}
        formatAuditModuleLabel={(value) => value === 'access' ? 'Access' : value}
        onAuditModuleFilterChange={vi.fn()}
        onAuditActionFilterChange={vi.fn()}
        onAuditSearchQueryChange={vi.fn()}
        onNavigate={vi.fn()}
        onAuditPageChange={vi.fn()}
      />,
    );

    expect(markup).toContain('Access');
    expect(markup).toContain('password_reset');
    expect(markup).toContain('Password reset performed for Chris Employee');
    expect(markup).toContain('Actor');
    expect(markup).toContain('Ava Admin');
    expect(markup).toContain('ava@example.com');
    expect(markup).toContain('Subject');
    expect(markup).toContain('Chris Employee');
    expect(markup).toContain('Entity ID: user-1');
    expect(markup).toContain('Open related record');
    expect(markup).toContain('user account');
    expect(markup).toContain('audit events');
  });

  it('renders loading and empty states', () => {
    const loadingMarkup = renderToStaticMarkup(
      <UserAuditList
        auditLoading={true}
        auditItems={[]}
        auditPage={1}
        auditTotal={0}
        auditPageSize={10}
        basePath="/users"
        getAuditModule={() => 'all'}
        resolveAuditEntityPath={() => ''}
        formatAuditModuleLabel={(value) => value}
        onAuditModuleFilterChange={vi.fn()}
        onAuditActionFilterChange={vi.fn()}
        onAuditSearchQueryChange={vi.fn()}
        onNavigate={vi.fn()}
        onAuditPageChange={vi.fn()}
      />,
    );

    const emptyMarkup = renderToStaticMarkup(
      <UserAuditList
        auditLoading={false}
        auditItems={[]}
        auditPage={1}
        auditTotal={0}
        auditPageSize={10}
        basePath="/users"
        getAuditModule={() => 'all'}
        resolveAuditEntityPath={() => ''}
        formatAuditModuleLabel={(value) => value}
        onAuditModuleFilterChange={vi.fn()}
        onAuditActionFilterChange={vi.fn()}
        onAuditSearchQueryChange={vi.fn()}
        onNavigate={vi.fn()}
        onAuditPageChange={vi.fn()}
      />,
    );

    expect(loadingMarkup).toContain('Loading audit activity...');
    expect(emptyMarkup).toContain('No audit activity matched the current filters.');
  });
});