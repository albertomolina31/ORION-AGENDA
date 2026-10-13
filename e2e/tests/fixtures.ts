import { expect, test as base, type Page } from '@playwright/test';

export const API = `http://localhost:${process.env.E2E_API_PORT ?? 3200}/v1`;

/** Cada prueba empieza con los datos de ejemplo. */
export const test = base.extend<{ resetData: void }>({
  resetData: [
    async ({ request }, use) => {
      const res = await request.post(`${API}/simulation/reset`);
      expect(res.status()).toBe(204);
      await use();
    },
    { auto: true },
  ],
});
export { expect };

/** Login simulado: elige usuario y, si tiene varios negocios, Estudio Órbita. */
export async function login(page: Page, user: 'Alberto' | 'Carmen' | 'Rocío' | 'Ana') {
  await page.goto('/login');
  await page.getByText(user, { exact: true }).click();
  if (user === 'Alberto') await page.getByText('Estudio Órbita').first().click();
  await expect(page.getByText(`¡Hola, ${user}!`)).toBeVisible();
}
