import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import RequestDetailControlsPanel from './RequestDetailControlsPanel';

describe('RequestDetailControlsPanel', () => {
  it('renders assignment, status, templates, and active save controls', () => {
    const markup = renderToStaticMarkup(
      createElement(RequestDetailControlsPanel as unknown as string, {
        assigneeDraft: 'user-1',
        statusDraft: 'in_progress',
        noteDraft: 'Investigating the enrollment payload.',
        assigneeOptions: [{ value: 'user-1', label: 'Ava Admin' }],
        statusOptions: [{ value: 'pending', label: 'Pending' }, { value: 'in_progress', label: 'In Progress' }],
        saving: false,
        canEdit: true,
        statusLabel: 'Pending',
        onAssigneeDraftChange: vi.fn(),
        onAssign: vi.fn(),
        onStatusDraftChange: vi.fn(),
        onNoteDraftChange: vi.fn(),
        onApplyNoteTemplate: vi.fn(),
        onUpdateRequest: vi.fn(),
      }),
    );

    expect(markup).toContain('Queue Controls');
    expect(markup).toContain('Assign an owner, move the request to the correct state');
    expect(markup).toContain('Select IT owner');
    expect(markup).toContain('Ava Admin');
    expect(markup).toContain('Assign');
    expect(markup).toContain('Pending');
    expect(markup).toContain('In Progress');
    expect(markup).toContain('Investigating the enrollment payload.');
    expect(markup).toContain('Add triage note');
    expect(markup).toContain('Mark waiting');
    expect(markup).toContain('Add resolution note');
    expect(markup).toContain('Update Request');
  });

  it('renders disabled actions and saving state when updates are in progress', () => {
    const markup = renderToStaticMarkup(
      createElement(RequestDetailControlsPanel as unknown as string, {
        assigneeDraft: '',
        statusDraft: 'pending',
        noteDraft: '',
        assigneeOptions: [],
        statusOptions: [{ value: 'pending', label: 'Pending' }],
        saving: true,
        canEdit: false,
        statusLabel: 'Pending',
        onAssigneeDraftChange: vi.fn(),
        onAssign: vi.fn(),
        onStatusDraftChange: vi.fn(),
        onNoteDraftChange: vi.fn(),
        onApplyNoteTemplate: vi.fn(),
        onUpdateRequest: vi.fn(),
      }),
    );

    expect(markup).toContain('disabled=""');
    expect(markup).toContain('Saving...');
  });
});