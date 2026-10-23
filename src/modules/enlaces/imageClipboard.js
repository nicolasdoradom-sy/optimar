export async function copyTextToClipboard(text, clipboard = globalThis.navigator?.clipboard) {
  if (!clipboard?.writeText) {
    throw new Error('El navegador no permite copiar texto al portapapeles.');
  }

  await clipboard.writeText(text);
}

export async function copyImageToClipboard(imageUrl, {
  fetcher = globalThis.fetch,
  clipboard = globalThis.navigator?.clipboard,
  ClipboardItemType = globalThis.ClipboardItem,
} = {}) {
  if (!clipboard?.write || !ClipboardItemType) {
    throw new Error('El navegador no permite copiar imágenes al portapapeles.');
  }

  const response = await fetcher(imageUrl);
  if (!response.ok) throw new Error('No se pudo cargar la imagen.');
  const blob = await response.blob();
  if (!blob.type.startsWith('image/')) throw new Error('El archivo no es una imagen.');

  await clipboard.write([new ClipboardItemType({ [blob.type]: blob })]);
}