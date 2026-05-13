import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import AppErrorBoundary from './AppErrorBoundary';

describe('AppErrorBoundary', () => {
  it('renders children when no error is present', () => {
    const markup = renderToStaticMarkup(
      <AppErrorBoundary>
        <div>Healthy app content</div>
      </AppErrorBoundary>,
    );

    expect(markup).toContain('Healthy app content');
  });

  it('renders the recovery fallback when the boundary is in error state', () => {
    const boundary = new AppErrorBoundary({
      children: <div>Healthy app content</div>,
    });

    boundary.state = { hasError: true };

    const markup = renderToStaticMarkup(boundary.render());

    expect(markup).toContain('Portal Recovery');
    expect(markup).toContain('This page hit a frontend error.');
    expect(markup).toContain('Reload Portal');
    expect(markup).toContain('Return to Login');
  });
});