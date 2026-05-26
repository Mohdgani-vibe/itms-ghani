import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { AlertsSparklineChart, normalizeSparklineValues, sparklinePath } from './AlertsSparklineChart';

describe('AlertsSparklineChart', () => {
  it('filters non-finite values before building the path', () => {
    expect(normalizeSparklineValues([1, Number.NaN, 3, Number.POSITIVE_INFINITY, 5])).toEqual([1, 3, 5]);
    expect(sparklinePath([1, Number.NaN, 3])).not.toContain('NaN');
  });

  it('renders a safe fallback path when no finite values are available', () => {
    const markup = renderToStaticMarkup(<AlertsSparklineChart values={[Number.NaN, Number.POSITIVE_INFINITY]} />);

    expect(markup).toContain('M4 24 L96 24');
  });
});