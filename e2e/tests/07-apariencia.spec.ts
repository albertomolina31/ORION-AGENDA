import { expect, login, test } from './fixtures';

test('modo oscuro desde Cuenta y regreso a la misma pantalla', async ({ page }) => {
  await login(page, 'Alberto');
  await page.goto('/cuenta');
  await page.getByText('Oscuro', { exact: true }).click();
  await expect.poll(() => page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe('rgb(13, 15, 43)');
  await expect(page).toHaveURL(/\/cuenta$/);
  await page.getByText('Claro', { exact: true }).click();
  await expect.poll(() => page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe('rgb(251, 248, 244)');
});
