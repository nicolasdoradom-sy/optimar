import { describe, expect, it } from 'vitest';
import {
  deduplicateCandidates,
  findFieldFourCandidates,
  normalizeFormNumber,
} from '../src/modules/extractor/fieldRecognition.js';
import { MAX_FILES_PER_BATCH, MAX_PDF_SIZE_BYTES, validatePdfFile } from '../src/modules/extractor/fileValidation.js';

describe('detección del campo 4', () => {
  it('asocia el número cercano a la etiqueta exacta en la zona superior derecha', () => {
    const items = [
      { text: '4. Número de formulario', x: 380, top: 74 },
      { text: '019938471205684-6', x: 380, top: 82 },
      { text: '25. No. Declaración de importación', x: 40, top: 240 },
      { text: '2026', x: 420, top: 700 },
    ];

    expect(findFieldFourCandidates(items, 600, 840)).toEqual([
      { value: '019938471205684-6', labelFound: true, confidence: null },
    ]);
  });

  it('admite que PDF.js divida la etiqueta en varios fragmentos de la misma línea', () => {
    const items = [
      { text: '4.', x: 380, top: 74 },
      { text: 'Número de', x: 395, top: 74 },
      { text: 'formulario', x: 455, top: 74 },
      { text: '019938471205684-6', x: 380, top: 82 },
    ];

    const combined = [{
      text: items.map((item) => item.text).join(' '),
      x: 380,
      top: 74,
    }, { text: '019938471205684-6', x: 380, top: 82 }];

    expect(findFieldFourCandidates(combined, 600, 840)).toEqual([
      { value: '019938471205684-6', labelFound: true, confidence: null },
    ]);
  });

  it('usa únicamente la caja del campo 4 cuando la etiqueta es texto vectorial', () => {
    const items = [
      { text: 'DO 2026-01234 Formulario 1', x: 230, top: 56 },
      { text: '78004125639871456320', x: 410, top: 106 },
      { text: '78004125639871456320', x: 238, top: 784 },
      { text: '25. No. Declaración de importación', x: 42, top: 300 },
    ];

    expect(findFieldFourCandidates(items, 600, 840)).toEqual([
      { value: '78004125639871456320', labelFound: false, confidence: null },
    ]);
  });

  it('deduplica valores conservando el orden de primera aparición', () => {
    const candidates = [
      { value: '8047612390', page: 1 },
      { value: '6518392047', page: 3 },
      { value: '8047612390', page: 4 },
    ];

    expect(deduplicateCandidates(candidates)).toEqual([
      { value: '8047612390', page: 1 },
      { value: '6518392047', page: 3 },
    ]);
  });
});

describe('normalización por tipo documental', () => {
  it('elimina solo el guion y dígito de control final en importación', () => {
    expect(normalizeFormNumber('019938471205684-6', 'importacion')).toEqual({
      original: '019938471205684-6',
      value: '019938471205684',
      isWellFormed: true,
    });
    expect(normalizeFormNumber('019938471205684', 'importacion').value)
      .toBe('019938471205684');
  });

  it('conserva el número completo para declaración de valor', () => {
    expect(normalizeFormNumber('78004125639871456320', 'valor').value)
      .toBe('78004125639871456320');
  });

  it('conserva los demás guiones y no impone una longitud fija', () => {
    expect(normalizeFormNumber('019938-471205', 'importacion')).toEqual({
      original: '019938-471205',
      value: '019938-471205',
      isWellFormed: false,
    });
    expect(normalizeFormNumber('8047612390', 'valor').value)
      .toBe('8047612390');
  });
});

describe('validación de PDF', () => {
  function makeFile({ name = 'prueba.pdf', type = 'application/pdf', bytes = '%PDF-demo', size } = {}) {
    const content = new Blob([bytes]);
    return {
      name,
      type,
      size: size ?? content.size,
      slice: (...args) => content.slice(...args),
    };
  }

  it('verifica extensión, MIME y firma PDF', async () => {
    expect(await validatePdfFile(makeFile())).toBeNull();
    expect(await validatePdfFile(makeFile({ name: 'prueba.txt' })))
      .toContain('extensión');
    expect(await validatePdfFile(makeFile({ type: 'text/plain' })))
      .toContain('MIME');
    expect(await validatePdfFile(makeFile({ bytes: 'NOPE' })))
      .toContain('firma PDF');
  });

  it('define límites explícitos para archivos y tamaño', () => {
    expect(MAX_FILES_PER_BATCH).toBe(20);
    expect(MAX_PDF_SIZE_BYTES).toBe(25 * 1024 * 1024);
  });
});