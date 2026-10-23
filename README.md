# Logitrading – Optimizador documental y de correos

Aplicación web interna, en español y sin backend. El extractor procesa documentos localmente en el navegador; los demás módulos se incorporarán por etapas.

## Requisitos

- Node.js 20.19+ o 22.12+
- npm

## Instalación y ejecución

```bash
npm install
npm run dev
```

Abre la URL local que Vite muestre en la terminal. Para ejecutar las pruebas automatizadas:

```bash
npm test
npm run test:e2e
```

La prueba E2E usa Chromium y las muestras locales ignoradas. Instala el navegador con `npx playwright install chromium`; en contenedores Linux también pueden faltar dependencias del sistema. En ese caso, una persona con permisos de administrador debe ejecutar `npx playwright install-deps chromium`.

Para generar y previsualizar la compilación:

```bash
npm run build
npm run preview
```

## GitHub Pages

`vite.config.js` toma automáticamente el nombre del repositorio desde `GITHUB_REPOSITORY` en GitHub Actions y configura `base` como `/<nombre-del-repositorio>/`. Por ejemplo, para `mi-organizacion/optimar`, la base es `/optimar/`. Para un sitio de usuario u organización publicado en la raíz (`<usuario>.github.io`), define `VITE_BASE_PATH=/` en el entorno de compilación. En una compilación local de un proyecto llamado `optimar`, se puede probar con `VITE_BASE_PATH=/optimar/ npm run build`.

## Extractor PDF

En `#extractor`, selecciona el tipo de declaración y carga hasta 20 archivos PDF, de máximo 25 MB cada uno. Los números se tratan como texto; se detecta el campo 4 por su ubicación junto al rótulo, se conservan todos los números únicos en orden y la importación elimina solo el guion y el dígito final de control. El DAV conserva el número completo.

PDF.js se importa al abrir el extractor. Tesseract.js, su worker y los datos de español se cargan solo si el PDF no tiene texto seleccionable. Los workers y `spa.traineddata.gz` están incluidos en `public/assets`; el navegador no necesita descargarlos de un CDN. Los números obtenidos por OCR se marcan para revisión. ExcelJS se carga solo al exportar el archivo `.xlsx`; CSV y Excel incluyen una fila por número.

Para la revisión manual del extractor, ejecuta `npm run dev`, abre `#extractor`, selecciona el tipo y el PDF, y presiona **Procesar archivos**. Verifica las filas, **Copiar todos**, CSV y Excel. El borrador de correo no está incluido en esta etapa.

## Envío de enlaces y soportes

El apartado `#enlaces` muestra el texto aprobado sin campos de edición y, debajo, la imagen `image.png`. **Copiar imagen** envía esa imagen al portapapeles del navegador. El enlace se pega directamente en el programa de correo donde corresponda. Este apartado no edita ni exporta archivos.

## Documentos de prueba y privacidad

Los patrones `tests/samples/` y `*.pdf` están ignorados junto con `node_modules/` y `dist/`. Antes de añadir muestras reales, confirma que Git las ignora:

```bash
git check-ignore -v tests/samples/DIM_86df50.pdf tests/samples/DAV_be74ce.pdf
git ls-files '*.pdf'
```

El primer comando debe mostrar la regla coincidente y el segundo no debe listar ningún PDF. Si un documento ya fue agregado al índice de Git, `.gitignore` por sí solo no lo deja de rastrear. No añadas documentos reales a repositorios públicos ni los imprimas en logs.

La prueba `tests/extractor-samples.local.test.js` usa los PDF locales y `tests/samples/expected-results.json`. Ambos están ignorados por Git, y la prueba se omite automáticamente si falta cualquiera de ellos. `tests/e2e/extractor.spec.js` también se omite si faltan las muestras. Las pruebas que sí se rastrean utilizan solo números inventados. Confirma que ni los documentos ni sus resultados privados están rastreados con `git ls-files '*.pdf'` y `git ls-files 'tests/samples/expected-results.json'`.

Los PDF se mantienen en memoria y no se guardan en borradores, historial ni consola. Los archivos de exportación solo se generan cuando el usuario los solicita.

## Alcance de privacidad

Al ser una aplicación sin servidor, no proporciona autenticación real. Los futuros borradores y el historial vivirán únicamente en el navegador y equipo donde se creen; no se compartirán entre usuarios.