import { MAX_FILES_PER_BATCH, validatePdfFile } from './fileValidation.js';
import { processPdfFile } from './pdfProcessor.js';
import { normalizeFormNumber } from './fieldRecognition.js';
import { summarizeResults } from './resultSummary.js';

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

function csvCell(value) {
  const safe = /^[\s]*[=+@-]/.test(value) ? `'${value}` : value;
  return `"${safe.replaceAll('"', '""')}"`;
}

export function mountExtractor(container) {
  const root = element('section', 'extractor-module');
  const heading = element('p', 'section-eyebrow', 'MÓDULO DOCUMENTAL');
  const title = element('h1', '', 'Extractor de formularios PDF');
  const intro = element('p', 'extractor-intro', 'Los documentos se procesan localmente en este navegador.');
  const form = element('form', 'extractor-form');
  form.noValidate = true;

  const typeLabel = element('label', 'field-label', 'TIPO DE DECLARACIÓN');
  typeLabel.htmlFor = 'document-type';
  const typeSelect = element('select', 'document-type');
  typeSelect.id = 'document-type';
  for (const [value, label] of [['importacion', 'Declaración de importación'], ['valor', 'Declaración de valor']]) {
    const option = element('option', '', label);
    option.value = value;
    typeSelect.append(option);
  }
  const typeField = element('div', 'type-field');
  typeField.append(typeLabel, typeSelect);

  const fileInput = element('input', 'file-input');
  fileInput.type = 'file';
  fileInput.accept = '.pdf,application/pdf';
  fileInput.multiple = true;
  fileInput.id = 'pdf-files';
  const dropzone = element('label', 'dropzone');
  dropzone.htmlFor = fileInput.id;
  dropzone.tabIndex = 0;
  dropzone.append(
    element('span', 'dropzone-symbol', '+'),
    element('span', 'dropzone-title', 'Arrastra tus PDF aquí'),
    element('span', 'dropzone-caption', 'o selecciona uno o varios archivos'),
  );
  dropzone.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      fileInput.click();
    }
  });
  dropzone.addEventListener('dragover', (event) => {
    event.preventDefault();
    dropzone.classList.add('is-dragging');
  });
  dropzone.addEventListener('dragleave', () => dropzone.classList.remove('is-dragging'));
  dropzone.addEventListener('drop', (event) => {
    event.preventDefault();
    dropzone.classList.remove('is-dragging');
    setFiles(event.dataTransfer.files);
  });

  const pickedList = element('ul', 'picked-files');
  const processButton = element('button', 'button button-primary', 'Procesar archivos');
  processButton.type = 'submit';
  const fileArea = element('div', 'file-area');
  fileArea.append(fileInput, dropzone, pickedList);

  const controls = element('div', 'extractor-controls');
  controls.append(typeField, processButton);
  form.append(fileArea, controls);

  const progressRegion = element('div', 'processing-progress');
  progressRegion.hidden = true;
  progressRegion.setAttribute('aria-live', 'polite');
  const progressText = element('span', 'progress-label', 'Procesando PDF');
  const progressBar = element('progress', 'progress-bar');
  progressBar.max = 100;
  progressBar.value = 0;
  progressRegion.append(progressText, progressBar);

  const attention = element('div', 'attention-list');
  attention.setAttribute('aria-live', 'polite');
  const resultsRegion = element('section', 'results-region');
  resultsRegion.hidden = true;
  const summaryRegion = element('div', 'results-summary');
  summaryRegion.hidden = true;
  const summaryTotal = element('p', 'summary-total');
  const summaryFiles = element('p', 'summary-files');
  const summaryReviews = element('p', 'summary-reviews');
  summaryRegion.append(summaryTotal, summaryFiles, summaryReviews);
  const resultsHeader = element('div', 'results-header');
  const resultsTitle = element('h2', '', 'Números identificados');
  const resultActions = element('div', 'result-actions');
  const copyAllButton = element('button', 'button button-secondary', 'Copiar todos');
  copyAllButton.type = 'button';
  const exportCsvButton = element('button', 'button button-secondary', 'Exportar CSV');
  exportCsvButton.type = 'button';
  const exportExcelButton = element('button', 'button button-secondary', 'Exportar Excel');
  exportExcelButton.type = 'button';
  resultActions.append(copyAllButton, exportCsvButton, exportExcelButton);
  resultsHeader.append(resultsTitle, resultActions);

  const table = element('table', 'results-table');
  const tableHead = element('thead');
  const headRow = element('tr');
  for (const label of ['Archivo', 'Número de formulario', 'Acción']) {
    headRow.append(element('th', '', label));
  }
  tableHead.append(headRow);
  const tableBody = element('tbody');
  table.append(tableHead, tableBody);
  const tableScroller = element('div', 'table-scroller');
  tableScroller.append(table);
  resultsRegion.append(summaryRegion, resultsHeader, tableScroller);

  const liveMessage = element('p', 'action-message');
  liveMessage.setAttribute('aria-live', 'polite');

  root.append(heading, title, intro, form, progressRegion, attention, resultsRegion, liveMessage);
  container.replaceChildren(root);

  let files = [];
  let records = [];
  let issues = [];
  let processedFileNames = new Set();
  let documentType = typeSelect.value;
  let busy = false;

  function setFiles(fileList) {
    files = [...fileList];
    records = [];
    issues = [];
    processedFileNames = new Set();
    resultsRegion.hidden = true;
    tableBody.replaceChildren();
    pickedList.replaceChildren();
    for (const file of files) {
      const item = element('li', 'picked-file');
      item.append(element('span', '', file.name), element('span', 'picked-file-size', `${(file.size / 1024 / 1024).toFixed(1)} MB`));
      pickedList.append(item);
    }
    liveMessage.textContent = '';
    if (files.length > MAX_FILES_PER_BATCH) {
      showAttention(`Puedes procesar hasta ${MAX_FILES_PER_BATCH} archivos en una operación.`);
    } else {
      attention.replaceChildren();
    }
  }

  function showAttention(message) {
    const item = element('p', 'attention-message', message);
    attention.replaceChildren(item);
  }

  function renderIssues() {
    attention.replaceChildren();
    for (const issue of issues) {
      const card = element('div', 'attention-card');
      const fileName = element('strong', 'attention-file', issue.file.name);
      const explanation = element('p', 'attention-reason', issue.reason);
      const correctionForm = element('form', 'correction-form');
      correctionForm.noValidate = true;
      const input = element('input', 'correction-input');
      input.type = 'text';
      input.autocomplete = 'off';
      input.spellcheck = false;
      input.placeholder = 'Número correcto';
      input.setAttribute('aria-label', `Ingresar número de formulario para ${issue.file.name}`);
      const save = element('button', 'button button-secondary', 'Agregar número');
      save.type = 'submit';
      correctionForm.append(input, save);
      correctionForm.addEventListener('submit', (event) => {
        event.preventDefault();
        saveManualValue(issue, input.value);
      });
      card.append(fileName, explanation, correctionForm);
      attention.append(card);
    }
  }

  function renderRecords() {
    tableBody.replaceChildren();
    for (const record of records) {
      const row = element('tr');
      const fileCell = element('td', 'result-file', record.fileName);
      fileCell.dataset.label = 'Archivo';
      const numberCell = element('td', 'result-number-cell');
      numberCell.dataset.label = 'Número de formulario';
      const numberInput = element('input', 'result-number');
      numberInput.type = 'text';
      numberInput.value = record.value;
      numberInput.readOnly = true;
      numberInput.setAttribute('aria-label', `Número de formulario de ${record.fileName}`);
      numberCell.append(numberInput);
      if (documentType === 'importacion' && record.original !== record.value) {
        numberCell.append(element('small', 'original-number', `Original: ${record.original}`));
      }
      if (record.needsReview) {
        numberCell.append(element('small', 'row-review', record.reviewReason));
      } else if (record.source === 'ocr' && record.confidence !== null) {
        numberCell.append(element('small', 'original-number', `Confianza OCR: ${record.confidence} %`));
      }

      const actionCell = element('td', 'result-actions-cell');
      actionCell.dataset.label = 'Acción';
      const copyButton = element('button', 'icon-action', 'Copiar');
      copyButton.type = 'button';
      copyButton.addEventListener('click', () => copyText(record.value));
      const editButton = element('button', 'icon-action', 'Corregir');
      editButton.type = 'button';
      editButton.addEventListener('click', () => {
        numberInput.readOnly = false;
        numberInput.focus();
        editButton.textContent = 'Guardar';
        editButton.onclick = () => saveRecordCorrection(record, numberInput.value);
      });
      const removeButton = element('button', 'icon-action remove-action', 'Quitar');
      removeButton.type = 'button';
      removeButton.addEventListener('click', () => {
        records = records.filter((candidate) => candidate !== record);
        renderRecords();
      });
      actionCell.append(copyButton, editButton, removeButton);
      row.append(fileCell, numberCell, actionCell);
      tableBody.append(row);
    }
    const summary = summarizeResults(records, [...processedFileNames]);
    summaryTotal.textContent = summary.totalText;
    summaryFiles.hidden = !(summary.files.length > 1 || summary.files.some((file) => file.count === 0));
    summaryFiles.textContent = summary.files
      .map((file) => `${file.fileName}: ${file.count} ${file.count === 1 ? 'encontrada' : 'encontradas'}`)
      .join(' · ');
    summaryReviews.hidden = !summary.reviewText;
    summaryReviews.textContent = summary.reviewText;
    summaryRegion.hidden = processedFileNames.size === 0;
    tableScroller.hidden = records.length === 0;
    resultsRegion.hidden = records.length === 0 && processedFileNames.size === 0;
  }

  function saveManualValue(issue, typedValue) {
    const normalized = normalizeFormNumber(typedValue, documentType);
    if (!normalized.original || !normalized.isWellFormed || !/\d/.test(normalized.value)) {
      showAttention('Ingresa un número de formulario con formato válido.');
      return;
    }
    records.push({
      fileName: issue.file.name,
      original: normalized.original,
      value: normalized.value,
      page: null,
      source: 'manual',
      needsReview: false,
      reviewReason: null,
    });
    issues = issues.filter((entry) => entry !== issue);
    renderIssues();
    renderRecords();
  }

  function saveRecordCorrection(record, typedValue) {
    const normalized = normalizeFormNumber(typedValue, documentType);
    if (!normalized.original || !normalized.isWellFormed || !/\d/.test(normalized.value)) {
      showAttention('Ingresa un número de formulario con formato válido.');
      return;
    }
    record.original = normalized.original;
    record.value = normalized.value;
    record.needsReview = false;
    record.reviewReason = null;
    renderRecords();
    liveMessage.textContent = 'Corrección guardada.';
  }

  async function copyText(value) {
    try {
      await navigator.clipboard.writeText(value);
      liveMessage.textContent = 'Número copiado.';
    } catch {
      liveMessage.textContent = 'No se pudo copiar automáticamente. Selecciona el número y cópialo manualmente.';
    }
  }

  function currentRows() {
    return records.map((record) => ({ Archivo: record.fileName, Número: record.value }));
  }

  copyAllButton.addEventListener('click', async () => {
    const values = records.map((record) => record.value).filter(Boolean).join('\n');
    if (values) await copyText(values);
  });

  exportCsvButton.addEventListener('click', () => {
    if (!records.length) return;
    const rows = [['Archivo', 'Número'], ...currentRows().map(({ Archivo, Número }) => [Archivo, Número])];
    const csv = `\uFEFF${rows.map((row) => row.map((cell) => csvCell(cell)).join(',')).join('\r\n')}`;
    downloadBlob(new Blob([csv], { type: 'text/csv;charset=utf-8' }), 'formularios-extraidos.csv');
  });

  exportExcelButton.addEventListener('click', async () => {
    if (!records.length) return;
    try {
      const { default: ExcelJS } = await import('exceljs');
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Formularios');
      worksheet.columns = [
        { header: 'Archivo', key: 'Archivo', width: 38 },
        { header: 'Número', key: 'Número', width: 30, style: { numFmt: '@' } },
      ];
      for (const row of currentRows()) worksheet.addRow(row);
      worksheet.getColumn('Número').eachCell((cell) => { cell.numFmt = '@'; });

      const summary = summarizeResults(records, [...processedFileNames]);
      const summaryWorksheet = workbook.addWorksheet('Resumen');
      summaryWorksheet.columns = [
        { header: 'Archivo', key: 'Archivo', width: 38 },
        { header: 'Declaraciones encontradas', key: 'Encontradas', width: 28 },
        { header: 'Requieren revisión', key: 'Revisión', width: 22 },
      ];
      for (const file of summary.files) {
        summaryWorksheet.addRow({
          Archivo: file.fileName,
          Encontradas: file.count,
          Revisión: file.reviewCount,
        });
      }
      summaryWorksheet.addRow({
        Archivo: 'TOTAL',
        Encontradas: summary.total,
        Revisión: summary.reviewCount,
      });
      const buffer = await workbook.xlsx.writeBuffer();
      downloadBlob(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), 'formularios-extraidos.xlsx');
      liveMessage.textContent = 'Archivo Excel descargado.';
    } catch {
      liveMessage.textContent = 'No se pudo generar el archivo Excel.';
    }
  });

  fileInput.addEventListener('change', () => setFiles(fileInput.files));
  typeSelect.addEventListener('change', () => {
    documentType = typeSelect.value;
    records = [];
    issues = [];
    processedFileNames = new Set();
    resultsRegion.hidden = true;
    attention.replaceChildren();
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (busy) return;
    if (!files.length) {
      showAttention('Selecciona al menos un archivo PDF antes de procesar.');
      return;
    }
    if (files.length > MAX_FILES_PER_BATCH) {
      showAttention(`Puedes procesar hasta ${MAX_FILES_PER_BATCH} archivos en una operación.`);
      return;
    }

    busy = true;
    processButton.disabled = true;
    copyAllButton.disabled = true;
    exportCsvButton.disabled = true;
    exportExcelButton.disabled = true;
    records = [];
    issues = [];
    attention.replaceChildren();
    liveMessage.textContent = '';
    let showProgress = files.length > 2;

    try {
      for (let fileIndex = 0; fileIndex < files.length; fileIndex++) {
        const file = files[fileIndex];
        processedFileNames.add(file.name);
        const validationMessage = await validatePdfFile(file);
        if (validationMessage) {
          issues.push({ file, reason: validationMessage });
          renderIssues();
          renderRecords();
          continue;
        }

        try {
          const result = await processPdfFile(file, documentType, (progress) => {
            if (progress.totalPages >= 100) showProgress = true;
            if (!showProgress) return;
            progressRegion.hidden = false;
            const pageLabel = progress.totalPages
              ? `página ${progress.page ?? 0} de ${progress.totalPages}`
              : progress.stage;
            progressText.textContent = `${file.name}: ${pageLabel}`;
            progressBar.value = progress.totalPages
              ? (progress.page / progress.totalPages) * 100
              : 0;
          });

          for (const record of result.records) {
            records.push({ ...record, fileName: file.name });
          }
          if (result.issue) issues.push({ file, reason: result.issue });
          renderIssues();
          renderRecords();
        } catch (error) {
          const reason = error.code === 'PDF_PASSWORD'
            ? 'El archivo está protegido con contraseña y no se puede leer.'
            : 'No se pudo leer este PDF. Puede estar dañado o no tener un formato compatible.';
          console.error('Error técnico al procesar PDF.', error?.name ?? 'Error', error?.code ?? 'sin código');
          issues.push({ file, reason });
          renderIssues();
        }

        if (showProgress) {
          progressText.textContent = `${fileIndex + 1} de ${files.length} archivos procesados`;
          progressBar.value = ((fileIndex + 1) / files.length) * 100;
        }
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
    } finally {
      busy = false;
      processButton.disabled = false;
      copyAllButton.disabled = false;
      exportCsvButton.disabled = false;
      exportExcelButton.disabled = false;
      if (showProgress) {
        progressText.textContent = 'Procesamiento finalizado';
        progressBar.value = 100;
      } else {
        progressRegion.hidden = true;
      }
      renderIssues();
      renderRecords();
    }
  });

  return root;
}