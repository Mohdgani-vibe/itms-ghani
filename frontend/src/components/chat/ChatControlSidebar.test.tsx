import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import ChatControlSidebar from './ChatControlSidebar';

describe('ChatControlSidebar', () => {
  it('disables member removal for closed channels', () => {
    const markup = renderToStaticMarkup(
      <ChatControlSidebar
        activeChannel={{
          id: 'channel-1',
          name: 'VPN Support',
          kind: 'support',
          status: 'closed',
          members: [
            { id: 'it-1', fullName: 'IT Owner', role: 'it_team' },
            { id: 'employee-1', fullName: 'Employee One', role: 'employee' },
          ],
        }}
        selectedOwnerId={null}
        selectedBackupOwnerId={null}
        selectedTeammateId=""
        ownerCandidates={[{ id: 'it-1', fullName: 'IT Owner', role: 'it_team' }]}
        backupOwnerCandidates={[{ id: 'it-1', fullName: 'IT Owner', role: 'it_team' }]}
        availableTeammates={[{ id: 'it-2', fullName: 'Backup Owner', role: 'it_team' }]}
        removingMemberId=""
        transferringOwner={false}
        addingTeammate={false}
        loadingTeammates={false}
        isActiveChannelClosed={true}
        onPendingTeammateActionChange={() => {}}
        onSelectedOwnerChange={() => {}}
        onSelectedBackupOwnerChange={() => {}}
        onTransferOwner={() => {}}
        onBackupOwnerUpdate={() => {}}
        onSelectedTeammateChange={() => {}}
        onOpenAddTeammateDialog={() => {}}
      />,
    );

    expect(markup).toContain('Remove');
    expect(markup).toContain('disabled');
  });
});