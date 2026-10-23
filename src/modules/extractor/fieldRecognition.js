const FIELD_LABEL = /(?:^|\b)4\s*[.)]?\s*n[uú]mero\s+de\s+formulario\b/i;
const FIELD_TOKEN = /[\p{L}\d][\p{L}\d.,/-]*/gu;

function fieldBox(item, pageWidth, pageHeight) {
  const x = item.x / pageWidth;
  const y = item.top / pageHeight;
  return x >= 0.6 && x <= 0.98 && y >= 0.075 && y <= 0.2;
}

function fieldTokens(text) {
  const withoutLabel = text.replace(FIELD_LABEL, ' ');
  return [...withoutLabel.matchAll(FIELD_TOKEN)]
    .map((match) => match[0])
    .filter((value) => /\d/.test(value));
}

export function findFieldFourCandidates(items, pageWidth, pageHeight) {
  const positionedItems = items
    .filter((item) => item.text?.trim())
    .map((item) => ({ ...item, text: item.text.trim() }));
  const labels = positionedItems.filter((item) => (
    fieldBox(item, pageWidth, pageHeight) && FIELD_LABEL.test(item.text)
  ));

  if (labels.length) {
    const found = new Map();
    for (const label of labels) {
      const nearby = positionedItems.filter((item) => (
        fieldBox(item, pageWidth, pageHeight)
        && Math.abs(item.top - label.top) <= pageHeight * 0.04
      ));
      for (const item of nearby) {
        for (const value of fieldTokens(item.text)) {
          found.set(value, { value, labelFound: true, confidence: item.confidence ?? null });
        }
      }
    }
    return [...found.values()];
  }

  return positionedItems
    .filter((item) => {
      const y = item.top / pageHeight;
      return item.x / pageWidth >= 0.6
        && item.x / pageWidth <= 0.98
        && y >= 0.1
        && y <= 0.17;
    })
    .flatMap((item) => fieldTokens(item.text).map((value) => ({
      value,
      labelFound: false,
      confidence: item.confidence ?? null,
    })));
}

export function hasFieldFourLabel(items, pageWidth, pageHeight) {
  return items.some((item) => (
    fieldBox(item, pageWidth, pageHeight) && FIELD_LABEL.test(item.text?.trim() ?? '')
  ));
}

export function normalizeFormNumber(value, documentType) {
  const original = value.trim();
  const isWellFormed = /^\d+(?:-\d)?$/.test(original);
  const finalValue = documentType === 'importacion'
    ? original.replace(/-\d$/, '')
    : original;

  return {
    original,
    value: finalValue,
    isWellFormed,
  };
}

export function deduplicateCandidates(candidates) {
  const seen = new Set();
  return candidates.filter((candidate) => {
    if (seen.has(candidate.value)) return false;
    seen.add(candidate.value);
    return true;
  });
}