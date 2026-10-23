export const MAX_FILES_PER_BATCH = 20;
export const MAX_PDF_SIZE_BYTES = 25 * 1024 * 1024;

export async function validatePdfFile(file) {
  if (!/\.pdf$/i.test(file.name)) {
    return 'El archivo debe tener extensión .pdf.';
  }
  if (file.type && file.type.toLowerCase() !== 'application/pdf') {
    return 'El tipo MIME del archivo no es application/pdf.';
  }
  if (file.size > MAX_PDF_SIZE_BYTES) {
    return 'El archivo supera el tamaño máximo de 25 MB.';
  }

  const signature = new Uint8Array(await file.slice(0, 4).arrayBuffer());
  if (String.fromCharCode(...signature) !== '%PDF') {
    return 'El contenido del archivo no tiene firma PDF válida.';
  }

  return null;
}