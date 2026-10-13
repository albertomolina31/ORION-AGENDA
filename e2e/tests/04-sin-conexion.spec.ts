import { expect, login, test } from './fixtures';

test('sin conexión: se muestran datos guardados y las acciones se bloquean (P42)', async ({ page, context }) => {
  await login(page, 'Alberto');
  await page.goto('/pendientes');
  await page.getByText('Jorge Salas').first().click();
  await expect(page.getByText('Aprobar', { exact: true }).first()).toBeVisible();
  await context.setOffline(true);
  await expect(page.getByText('Sin conexión a internet')).toBeVisible();
  await expect(page.getByText('Sin conexión', { exact: true }).first()).toBeVisible();
  await context.setOffline(false);
  await expect(page.getByText('Sin conexión a internet')).toBeHidden();
  await expect(page.getByText('Aprobar', { exact: true }).first()).toBeVisible();
});
