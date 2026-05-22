import { describe, expect, it } from 'vitest';

import html2canvasStub from './html2canvas-stub';

describe('html2canvas-stub', () => {
  it('rejects with a clear disabled-support error', async () => {
    await expect(html2canvasStub()).rejects.toThrowError(
      'html2canvas support is disabled in this build. Use jsPDF canvas/text APIs instead of doc.html().',
    );
  });
});