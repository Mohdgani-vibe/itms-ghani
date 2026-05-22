import { describe, expect, it } from 'vitest';

import domPurifyStub from './dompurify-stub';

describe('dompurify-stub', () => {
  it('throws a clear disabled-support error when sanitize is called', () => {
    expect(() => domPurifyStub.sanitize()).toThrowError(
      'DOMPurify support is disabled in this build. Use trusted HTML or jsPDF canvas/text APIs instead of doc.html().',
    );
  });
});