import imageUrl from '../../../image.png?url';
import { copyImageToClipboard, copyTextToClipboard } from './imageClipboard.js';
import { LINKS_MESSAGE } from './message.js';

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

export function mountEnlaces(container) {
  const root = element('section', 'links-basic');
  const title = element('h1', '', 'Envío de enlaces y soportes');
  const message = element('div', 'links-message');

  for (const paragraph of LINKS_MESSAGE.split('\n\n')) {
    message.append(element('p', '', paragraph));
  }

  const copyTextButton = element('button', 'button button-primary', 'Copiar texto');
  copyTextButton.type = 'button';
  const textStatus = element('p', 'links-copy-status');
  textStatus.setAttribute('role', 'status');
  textStatus.setAttribute('aria-live', 'polite');
  copyTextButton.addEventListener('click', async () => {
    try {
      await copyTextToClipboard(LINKS_MESSAGE);
      textStatus.textContent = 'Texto copiado.';
    } catch {
      textStatus.textContent = 'No se pudo copiar el texto. Inténtalo de nuevo.';
    }
  });
  const attachment = element('div', 'links-image-area');
  const image = element('img', 'links-instruction-image');
  image.src = imageUrl;
  image.alt = 'Instructivo para visualizar soportes y archivos digitales';

  const imageActions = element('div', 'links-image-actions');
  const copyButton = element('button', 'button button-primary', 'Copiar imagen');
  copyButton.type = 'button';
  const status = element('p', 'links-copy-status');
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');

  copyButton.addEventListener('click', async () => {
    try {
      await copyImageToClipboard(imageUrl);
      status.textContent = 'Imagen copiada.';
    } catch {
      status.textContent = 'No se pudo copiar la imagen. Inténtalo de nuevo desde un navegador compatible.';
    }
  });

  imageActions.append(copyTextButton, textStatus, copyButton, status);
  attachment.append(image, imageActions);
  root.append(title, message, attachment);
  container.replaceChildren(root);
  return root;
}