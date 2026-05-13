import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import DeviceLifecycleEditor, { deviceLifecycleActionsReadOnly } from './DeviceLifecycleEditor';

describe('DeviceLifecycleEditor', () => {
  it('renders lifecycle metadata fields including cost', () => {
    const markup = renderToStaticMarkup(
      <DeviceLifecycleEditor
        form={{
          assetTag: 'SPARE-B0C7079F',
          category: 'laptop',
          model: 'Latitude 7440',
          purchaseDate: '2025-01-14',
          warrantyUntil: '2027-12-31',
          cost: '82500.00',
          notes: 'Procured in FY25 batch',
        }}
        saving={false}
        readOnly={false}
        onFieldChange={() => {}}
        onSubmit={() => {}}
        onCancel={() => {}}
      />,
    );

    expect(markup).toContain('Edit Lifecycle Metadata');
    expect(markup).toContain('SPARE-B0C7079F');
    expect(markup).toContain('82500.00');
    expect(markup).toContain('Save Lifecycle Details');
  });

  it('fails closed for retired assets', () => {
    expect(deviceLifecycleActionsReadOnly(true, 'retired')).toBe(true);
    expect(deviceLifecycleActionsReadOnly(true, 'in_use')).toBe(false);
  });

  it('renders a retired read-only notice', () => {
    const markup = renderToStaticMarkup(
      <DeviceLifecycleEditor
        form={{
          assetTag: 'SPARE-B0C7079F',
          category: 'laptop',
          model: 'Latitude 7440',
          purchaseDate: '2025-01-14',
          warrantyUntil: '2027-12-31',
          cost: '82500.00',
          notes: 'Procured in FY25 batch',
        }}
        saving={false}
        readOnly
        onFieldChange={() => {}}
        onSubmit={() => {}}
        onCancel={() => {}}
      />,
    );

    expect(markup).toContain('This asset is retired. Lifecycle details are read-only');
    expect(markup).toContain('disabled=""');
  });
});