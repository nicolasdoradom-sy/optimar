import {
  deduplicateCandidates,
  findFieldFourCandidates,
  hasFieldFourLabel,
  normalizeFormNumber,
} from './fieldRecognition.js';

const BASE_URL = import.meta.env.BASE_URL;
const OCR_WORKER_PATH = `${BASE_URL}assets/tesseract/worker.min.js`;
const OCR_CORE_PATH = `${BASE_URL}assets/tesseract-core/tesseract-core-lstm.wasm.js`;
const OCR_LANGUAGE_PATH = `${BASE_URL}assets/tessdata`;

function mapPdfTextItems(items, viewport) {
  const rows = [];
  for (const item of items) {
    if (!item.str?.trim()) continue;
    const top = viewport.height - item.transform[5];
    let row = rows.find((candidate) => Math.abs(candidate.top - top) <= 2);
    if (!row) {
      row = { top, parts: [] };
      rows.push(row);
    }
    row.parts.push({ x: item.transform[4], text: item.str });
  }

  return rows.map((row) => ({
    text: row.parts.sort((a, b) => a.x - b.x).map((part) => part.text).join(' ').replace(/\s+/g, ' ').trim(),
    x: Math.min(...row.parts.map((part) => part.x)),
    top: row.top,
  }));
}

function mapOcrLines(tsv, scale) {
  const rows = new Map();
  for (const rawRow of tsv.split(/\r?\n/).slice(1)) {
    const columns = rawRow.split('\t');
    if (columns.length < 12 || !columns[11]?.trim()) continue;

    const key = columns.slice(1, 5).join(':');
    let row = rows.get(key);
    if (!row) {
      row = {
        x: Number(columns[6]) / scale,
        top: Number(columns[7]) / scale,
        parts: [],
        confidence: [],
      };
      rows.set(key, row);
    }
    row.parts.push({ x: Number(columns[6]), text: columns[11] });
    const confidence = Number(columns[10]);
    if (confidence >= 0) row.confidence.push(confidence);
  }

  return [...rows.values()].map((row) => ({
    text: row.parts.sort((a, b) => a.x - b.x).map((part) => part.text).join(' '),
    x: row.x,
    top: row.top,
    confidence: row.confidence.length
      ? Math.round(row.confidence.reduce((sum, value) => sum + value, 0) / row.confidence.length)
      : 0,
  }));
}

async function createOcrWorker(onProgress) {
  const { createWorker } = await import('tesseract.js');
  const baseUrl = window.location.origin;
  return createWorker('spa', 1, {
    workerPath: new URL(OCR_WORKER_PATH, baseUrl).href,
    corePath: new URL(OCR_CORE_PATH, baseUrl).href,
    langPath: new URL(OCR_LANGUAGE_PATH, baseUrl).href,
    gzip: true,
    cacheMethod: 'none',
    logger: ({ status, progress }) => onProgress({ stage: status, progress }),
  });
}

function makeRecords(candidates, documentType, source) {
  const countsByPage = new Map();
  const uniqueCandidates = deduplicateCandidatesByPage(candidates);
  for (const candidate of uniqueCandidates) {
    countsByPage.set(candidate.page, (countsByPage.get(candidate.page) ?? 0) + 1);
  }

  return deduplicateCandidates(uniqueCandidates).flatMap((candidate) => {
    const normalized = normalizeFormNumber(candidate.value, documentType);
    let reviewReason = null;
    if (source === 'ocr' && candidate.confidence !== null && candidate.confidence < 80) {
      reviewReason = `El OCR tiene confianza baja (${candidate.confidence} %); verifica los caracteres antes de usarlo.`;
    } else if (source === 'ocr') {
      reviewReason = 'El número se obtuvo por OCR; verifica los caracteres antes de usarlo.';
    } else if (!normalized.isWellFormed) {
      reviewReason = 'El formato del número en el campo 4 es inesperado; verifica el dato.';
    } else if (countsByPage.get(candidate.page) > 1) {
      reviewReason = 'Se encontraron varios números en la zona del campo 4 de esta página; verifica cuál corresponde.';
    }

    return [{
      original: normalized.original,
      value: normalized.value,
      page: candidate.page,
      source,
      confidence: candidate.confidence ?? null,
      needsReview: Boolean(reviewReason),
      reviewReason,
    }];
  });
}

function deduplicateCandidatesByPage(candidates) {
  const seen = new Set();
  return candidates.filter((candidate) => {
    const key = `${candidate.page}:${candidate.value}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function cleanupSafely(resource, method, resourceLabel) {
  try {
    await resource?.[method]?.();
  } catch (error) {
    console.error(`Falló la limpieza de ${resourceLabel}.`, error?.name ?? 'Error');
  }
}

export async function processPdfFile(file, documentType, onProgress = () => {}) {
  const pdfjs = await import('pdfjs-dist');
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    `${BASE_URL}assets/pdfjs/pdf.worker.min.mjs`,
    globalThis.location?.origin ?? 'http://localhost',
  ).href;

  const loadingTask = pdfjs.getDocument({
    data: new Uint8Array(await file.arrayBuffer()),
    isEvalSupported: false,
    useSystemFonts: true,
  });
  let rejectPassword;
  const passwordRequired = new Promise((resolve, reject) => {
    rejectPassword = reject;
  });
  loadingTask.onPassword = () => {
    const error = new Error('PDF protegido con contraseña.');
    error.code = 'PDF_PASSWORD';
    rejectPassword(error);
  };

  let pdf;
  try {
    pdf = await Promise.race([loadingTask.promise, passwordRequired]);
  } catch (error) {
    await cleanupSafely(loadingTask, 'destroy', 'carga PDF');
    if (error.code === 'PDF_PASSWORD') throw error;
    throw new Error('No se pudo abrir este PDF. El archivo puede estar dañado o tener un formato no compatible.');
  }

  const selectableCandidates = [];
  const missingNumberPages = [];
  let hasSelectableText = false;
  let labelFound = false;

  try {
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
      const page = await pdf.getPage(pageNumber);
      try {
        const viewport = page.getViewport({ scale: 1 });
        const textContent = await page.getTextContent();
        const textItems = mapPdfTextItems(textContent.items, viewport);
        hasSelectableText ||= textItems.length > 0;
        labelFound ||= hasFieldFourLabel(textItems, viewport.width, viewport.height);
        const pageCandidates = findFieldFourCandidates(textItems, viewport.width, viewport.height);
        if (hasFieldFourLabel(textItems, viewport.width, viewport.height) && !pageCandidates.length) {
          missingNumberPages.push(pageNumber);
        }
        selectableCandidates.push(...pageCandidates.map((candidate) => ({
          ...candidate,
          page: pageNumber,
        })));
        onProgress({ stage: 'lectura', page: pageNumber, totalPages: pdf.numPages });
      } finally {
        await cleanupSafely(page, 'cleanup', 'página PDF');
      }
      await new Promise((resolve) => setTimeout(resolve, 0));
    }

    let candidates = selectableCandidates;
    let source = 'texto';
    if (!hasSelectableText) {
      source = 'ocr';
      const worker = await createOcrWorker(onProgress);
      try {
        candidates = [];
        for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
          const page = await pdf.getPage(pageNumber);
          const canvas = document.createElement('canvas');
          try {
            const scale = 2;
            const viewport = page.getViewport({ scale });
            canvas.width = Math.ceil(viewport.width);
            canvas.height = Math.ceil(viewport.height);
            const context = canvas.getContext('2d', { willReadFrequently: true });
            await page.render({ canvas, canvasContext: context, viewport }).promise;
            const result = await worker.recognize(canvas);
            const items = mapOcrLines(result.data.tsv ?? '', scale);
            const ocrLabelFound = hasFieldFourLabel(items, viewport.width / scale, viewport.height / scale);
            labelFound ||= ocrLabelFound;
            const pageCandidates = findFieldFourCandidates(items, viewport.width / scale, viewport.height / scale);
            if (ocrLabelFound && !pageCandidates.length) missingNumberPages.push(pageNumber);
            candidates.push(...pageCandidates.map((candidate) => ({
              ...candidate,
              page: pageNumber,
            })));
            onProgress({ stage: 'ocr', page: pageNumber, totalPages: pdf.numPages });
          } finally {
            canvas.width = 0;
            canvas.height = 0;
            await cleanupSafely(page, 'cleanup', 'página OCR');
          }
          await new Promise((resolve) => setTimeout(resolve, 0));
        }
      } finally {
        await cleanupSafely(worker, 'terminate', 'worker OCR');
      }
    }

    const records = makeRecords(candidates, documentType, source);
    let issue = null;
    if (missingNumberPages.length) {
      issue = `Se encontró la etiqueta del campo 4, pero no un número legible en la página ${missingNumberPages.join(', ')}.`;
    } else if (!records.length) {
      issue = labelFound
        ? 'Se encontró la etiqueta del campo 4, pero no un número legible junto a ella.'
        : 'No se encontró un número en la zona superior derecha del campo 4.';
    }

    return {
      pageCount: pdf.numPages,
      hasSelectableText,
      source,
      records,
      issue,
    };
  } finally {
    await cleanupSafely(loadingTask, 'destroy', 'documento PDF');
  }
}