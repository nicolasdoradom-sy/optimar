import { describe, expect, it, vi } from 'vitest';
import { copyImageToClipboard, copyTextToClipboard } from '../src/modules/enlaces/imageClipboard.js';
import { LINKS_MESSAGE } from '../src/modules/enlaces/message.js';

describe('vista básica de enlaces', () => {
  it('conserva literalmente el texto y sus párrafos, sin marcador de enlace', () => {
    expect(LINKS_MESSAGE).toBe(`Buen Día,

Mediante el siguiente enlace envío soportes de pagos de terceros y documentos que se generaron en la operación. Adjunto encontrarás el instructivo para la correcta visualización de los archivos.

Para tener en cuenta, los links los podrán visualizar las veces que sea necesario. Si hace falta algún soporte es porque no lo han generado; en el momento que sean generados los podrá visualizar en tiempo real (POR FAVOR VERIFICAR).

Nota: Agradecemos por favor nos confirmen recibido de la documentación y la correcta apertura del link. Gracias.`);
    expect(LINKS_MESSAGE).not.toContain('[ENLACE]');
  });

  it('copia la imagen como blob de imagen sin crear una descarga', async () => {
    const image = new Blob(['imagen de prueba'], { type: 'image/png' });
    const fetcher = vi.fn().mockResolvedValue({ ok: true, blob: async () => image });
    const write = vi.fn().mockResolvedValue(undefined);
    class ClipboardItemStub {
      constructor(items) {
        this.items = items;
      }
    }

    await copyImageToClipboard('/assets/image.png', {
      fetcher,
      clipboard: { write },
      ClipboardItemType: ClipboardItemStub,
    });

    expect(fetcher).toHaveBeenCalledWith('/assets/image.png');
    expect(write).toHaveBeenCalledTimes(1);
    expect(write.mock.calls[0][0][0].items['image/png']).toBe(image);
  });

  it('copia el texto completo en una sola acción y de manera independiente', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);

    await copyTextToClipboard(LINKS_MESSAGE, { writeText });

    expect(writeText).toHaveBeenCalledOnce();
    expect(writeText).toHaveBeenCalledWith(LINKS_MESSAGE);
  });

  it('rechaza tipos no imagen y portapapeles sin soporte', async () => {
    await expect(copyImageToClipboard('/archivo.txt', {
      fetcher: async () => ({ ok: true, blob: async () => new Blob(['texto'], { type: 'text/plain' }) }),
      clipboard: { write: vi.fn() },
      ClipboardItemType: class {},
    })).rejects.toThrow();

    await expect(copyImageToClipboard('/assets/image.png', {
      fetcher: vi.fn(),
      clipboard: {},
      ClipboardItemType: class {},
    })).rejects.toThrow();
  });
});