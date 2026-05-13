import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import SettingsPatchPolicyPanel from './SettingsPatchPolicyPanel';

describe('SettingsPatchPolicyPanel', () => {
  it('renders patch windows, active rings, and department mapping', () => {
    const markup = renderToStaticMarkup(
      <SettingsPatchPolicyPanel
        canEditWorkflowSettings={true}
        workflowSettings={{
          patchWindowEnabled: true,
          patchWindowStart: '22:00',
          patchWindowEnd: '04:00',
          patchAllowedRings: ['pilot', 'critical'],
          patchDepartmentRings: [{ match: 'IT', ring: 'critical' }],
        }}
        departments={[
          { id: 'dept-1', name: 'IT' },
          { id: 'dept-2', name: 'Finance' },
        ]}
        getDepartmentRing={(name) => name === 'IT' ? 'critical' : ''}
        onWorkflowSettingsChange={vi.fn()}
        onDepartmentRingChange={vi.fn()}
      />,
    );

    expect(markup).toContain('Patch Policy');
    expect(markup).toContain('Enforce patch approval window');
    expect(markup).toContain('value="22:00"');
    expect(markup).toContain('value="04:00"');
    expect(markup).toContain('Allowed Live Rings');
    expect(markup).toContain('Pilot');
    expect(markup).toContain('Critical');
    expect(markup).toContain('Department Ring Mapping');
    expect(markup).toContain('IT');
    expect(markup).toContain('Finance');
    expect(markup).toContain('Standard (default)');
  });

  it('renders the empty department fallback and disabled controls', () => {
    const markup = renderToStaticMarkup(
      <SettingsPatchPolicyPanel
        canEditWorkflowSettings={false}
        workflowSettings={{
          patchWindowEnabled: false,
          patchWindowStart: '09:00',
          patchWindowEnd: '18:00',
          patchAllowedRings: [],
          patchDepartmentRings: [],
        }}
        departments={[]}
        getDepartmentRing={() => ''}
        onWorkflowSettingsChange={vi.fn()}
        onDepartmentRingChange={vi.fn()}
      />,
    );

    expect(markup).toContain('disabled=""');
    expect(markup).toContain('No departments available yet. Create departments first, then map them into patch rings here.');
  });
});