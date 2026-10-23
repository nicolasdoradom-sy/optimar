export function summarizeResults(records, fileNames) {
  const values = new Map();
  const valuesByFile = new Map(fileNames.map((fileName) => [fileName, new Set()]));
  const reviewValuesByFile = new Map(fileNames.map((fileName) => [fileName, new Set()]));
  const reviewValues = new Set();

  for (const record of records) {
    const value = record.value?.trim();
    if (!value) continue;

    values.set(value, {
      needsReview: Boolean(values.get(value)?.needsReview || record.needsReview),
    });
    valuesByFile.get(record.fileName)?.add(value);
    if (record.needsReview) {
      reviewValues.add(value);
      reviewValuesByFile.get(record.fileName)?.add(value);
    }
  }

  const total = values.size;
  const reviewCount = [...values.values()].filter((entry) => entry.needsReview).length;

  return {
    total,
    reviewCount,
    totalText: `${total} ${total === 1 ? 'declaración encontrada' : 'declaraciones encontradas'}`,
    reviewText: reviewCount
      ? `${reviewCount} ${reviewCount === 1 ? 'requiere' : 'requieren'} revisión`
      : '',
    files: fileNames.map((fileName) => ({
      fileName,
      count: valuesByFile.get(fileName)?.size ?? 0,
      reviewCount: reviewValuesByFile.get(fileName)?.size ?? 0,
    })),
  };
}