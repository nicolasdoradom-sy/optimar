import { describe, expect, it } from 'vitest';
import { summarizeResults } from '../src/modules/extractor/resultSummary.js';

describe('resumen de resultados únicos', () => {
  it('cuenta valores únicos por archivo y en el total', () => {
    const summary = summarizeResults([
      { fileName: 'alpha.pdf', value: 'DEMO-101' },
      { fileName: 'alpha.pdf', value: 'DEMO-101' },
      { fileName: 'alpha.pdf', value: 'DEMO-102' },
      { fileName: 'beta.pdf', value: 'DEMO-201' },
      { fileName: 'beta.pdf', value: 'DEMO-101' },
    ], ['alpha.pdf', 'beta.pdf']);

    expect(summary.total).toBe(3);
    expect(summary.files).toEqual([
      { fileName: 'alpha.pdf', count: 2, reviewCount: 0 },
      { fileName: 'beta.pdf', count: 2, reviewCount: 0 },
    ]);
  });

  it('incluye archivos sin resultados con conteo cero', () => {
    const summary = summarizeResults([
      { fileName: 'alpha.pdf', value: 'DEMO-101' },
    ], ['alpha.pdf', 'empty.pdf']);

    expect(summary.files).toEqual([
      { fileName: 'alpha.pdf', count: 1, reviewCount: 0 },
      { fileName: 'empty.pdf', count: 0, reviewCount: 0 },
    ]);
  });

  it('usa singular/plural y separa los valores que requieren revisión', () => {
    const one = summarizeResults([
      { fileName: 'one.pdf', value: 'DEMO-101' },
    ], ['one.pdf']);
    const several = summarizeResults([
      { fileName: 'many.pdf', value: 'DEMO-101', needsReview: true },
      { fileName: 'many.pdf', value: 'DEMO-102', needsReview: true },
      { fileName: 'many.pdf', value: 'DEMO-103' },
    ], ['many.pdf']);

    expect(one.totalText).toBe('1 declaración encontrada');
    expect(one.reviewText).toBe('');
    expect(several.totalText).toBe('3 declaraciones encontradas');
    expect(several.reviewText).toBe('2 requieren revisión');
  });

  it('recalcula tras corregir, agregar o quitar filas', () => {
    let records = [
      { fileName: 'alpha.pdf', value: 'DEMO-101' },
      { fileName: 'alpha.pdf', value: 'DEMO-102', needsReview: true },
    ];

    expect(summarizeResults(records, ['alpha.pdf']).total).toBe(2);
    records[1] = { ...records[1], value: 'DEMO-103', needsReview: false };
    expect(summarizeResults(records, ['alpha.pdf'])).toMatchObject({
      total: 2,
      reviewCount: 0,
    });
    records.push({ fileName: 'alpha.pdf', value: 'DEMO-104' });
    expect(summarizeResults(records, ['alpha.pdf']).total).toBe(3);
    records = records.filter((record) => record.value !== 'DEMO-101');
    expect(summarizeResults(records, ['alpha.pdf']).total).toBe(2);
  });
});