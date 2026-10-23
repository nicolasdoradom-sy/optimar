import { beforeEach, describe, expect, it, vi } from 'vitest';

const pdfJsMocks = vi.hoisted(() => ({
  getDocument: vi.fn(),
  GlobalWorkerOptions: {},
}));

vi.mock('pdfjs-dist', () => pdfJsMocks);

describe('limpieza de recursos PDF.js', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('conserva los números si cleanup y loadingTask.destroy fallan', async () => {
    const page = {
      view: [0, 0, 600, 840],
      getViewport: () => ({ width: 600, height: 840 }),
      getTextContent: async () => ({
        items: [
          { str: '4. Número de formulario', transform: [1, 0, 0, 1, 380, 766] },
          { str: '019938471205684-6', transform: [1, 0, 0, 1, 380, 758] },
        ],
      }),
      cleanup: () => { throw new Error('fallo sintético de limpieza de página'); },
    };
    const pdf = {
      numPages: 1,
      getPage: async () => page,
    };
    const loadingTask = {
      promise: Promise.resolve(pdf),
      destroy: () => { throw new Error('fallo sintético de destrucción del task'); },
    };
    pdfJsMocks.getDocument.mockReturnValue(loadingTask);
    const cleanupLog = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { processPdfFile } = await import('../src/modules/extractor/pdfProcessor.js');
    const file = { arrayBuffer: async () => new ArrayBuffer(8) };

    const result = await processPdfFile(file, 'importacion');

    expect(result.records).toHaveLength(1);
    expect(result.records[0].value).toBe('019938471205684');
    expect(result.issue).toBeNull();
    expect(cleanupLog).toHaveBeenCalledTimes(2);
    expect(cleanupLog.mock.calls.flat().join(' ')).not.toContain('019938471205684');
  });
});