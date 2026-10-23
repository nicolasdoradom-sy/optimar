import fs from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import { deduplicateCandidates, findFieldFourCandidates, normalizeFormNumber } from '../src/modules/extractor/fieldRecognition.js';

const sampleDirectory = new URL('./samples/', import.meta.url);
const expectedUrl = new URL('./samples/expected-results.json', import.meta.url);
const sampleNames = ['DIM_86df50.pdf', 'DAV_be74ce.pdf'];
const hasLocalSamples = existsSync(expectedUrl)
  && sampleNames.every((name) => existsSync(new URL(name, sampleDirectory)));

async function extractNumbersFromSample(filename, documentType) {
  const bytes = new Uint8Array(await fs.readFile(new URL(filename, sampleDirectory)));
  const task = pdfjs.getDocument({ data: bytes, isEvalSupported: false, useSystemFonts: true });
  const pdf = await task.promise;
  const candidates = [];

  try {
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
      const page = await pdf.getPage(pageNumber);
      const viewport = page.getViewport({ scale: 1 });
      const content = await page.getTextContent();
      const items = content.items.map((item) => ({
        text: item.str,
        x: item.transform[4],
        top: viewport.height - item.transform[5],
      }));
      candidates.push(...findFieldFourCandidates(items, viewport.width, viewport.height)
        .map((candidate) => ({ ...candidate, page: pageNumber })));
      page.cleanup();
    }
  } finally {
    await task.destroy();
  }

  return deduplicateCandidates(candidates)
    .map((candidate) => normalizeFormNumber(candidate.value, documentType).value);
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe.skipIf(!hasLocalSamples)('regresión local con documentos reales ignorados', () => {
  const expected = hasLocalSamples ? JSON.parse(readFileSync(expectedUrl, 'utf8')) : {};

  it('extrae los números confirmados sin imprimir datos documentales', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});

    const dim = await extractNumbersFromSample('DIM_86df50.pdf', 'importacion');
    const dav = await extractNumbersFromSample('DAV_be74ce.pdf', 'valor');

    expect(dim.length === expected.DIM_86df50.length).toBe(true);
    expect(dim.every((value, index) => value === expected.DIM_86df50[index])).toBe(true);
    expect(dav.length === expected.DAV_be74ce.length).toBe(true);
    expect(dav.every((value, index) => value === expected.DAV_be74ce[index])).toBe(true);
  });
});