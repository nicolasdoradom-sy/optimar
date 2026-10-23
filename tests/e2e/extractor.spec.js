import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const dimPath = path.join(projectRoot, 'tests/samples/DIM_86df50.pdf');
const davPath = path.join(projectRoot, 'tests/samples/DAV_be74ce.pdf');
const samplesAvailable = fs.existsSync(dimPath) && fs.existsSync(davPath);

async function processSample(page, filePath, type, expectedCount) {
  await page.goto('/#extractor');
  await page.getByLabel('TIPO DE DECLARACIÓN').selectOption(type);
  await page.locator('#pdf-files').setInputFiles(filePath);
  await page.getByRole('button', { name: 'Procesar archivos' }).click();

  const rows = page.locator('.results-table tbody tr');
  await expect(rows).toHaveCount(expectedCount, { timeout: 90_000 });
  await expect(page.locator('.attention-reason')).toHaveCount(0);
  const result = await page.locator('.result-number').evaluateAll((inputs) => ({
    count: inputs.length,
    nonEmpty: inputs.every((input) => input.value.length > 0),
    noControlSuffix: inputs.every((input) => !/-\d$/.test(input.value)),
  }));

  expect(result.count).toBe(expectedCount);
  expect(result.nonEmpty).toBe(true);
  return result;
}

test.describe('regresión local con muestras ignoradas', () => {
  test.skip(!samplesAvailable, 'Prueba local omitida: faltan los PDF ignorados en tests/samples/.');

  test('importación presenta 10 números sin sufijo de control', async ({ page }) => {
    const result = await processSample(page, dimPath, 'importacion', 10);
    expect(result.noControlSuffix).toBe(true);
  });

  test('DAV presenta 55 números completos', async ({ page }) => {
    const result = await processSample(page, davPath, 'valor', 55);
    expect(result.noControlSuffix).toBe(true);
  });
});