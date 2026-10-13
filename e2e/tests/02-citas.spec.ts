import { expect, login, test } from './fixtures';

test.describe('Citas', () => {
  test('aprobar una solicitud pendiente desde la bandeja', async ({ page }) => {
    await login(page, 'Alberto');
    await page.goto('/pendientes');
    await page.getByText('Jorge Salas').first().click();
    await expect(page.getByText('Solicitud pendiente de aprobación')).toBeVisible();
    await page.getByText('Aprobar', { exact: true }).first().click();
    await page.getByText('Aprobar', { exact: true }).last().click();
    await expect(page.getByText('Cita confirmada.')).toBeVisible();
    await expect(page.getByText('Confirmada').first()).toBeVisible();
  });

  test('el detalle muestra hora del negocio e historial', async ({ page }) => {
    await login(page, 'Alberto');
    await page.getByText('Agenda', { exact: true }).last().click();
    await page.getByText('Mariana López').first().click();
    await expect(page.getByText('Detalle de la cita')).toBeVisible();
    await expect(page.getByText(/Horario del negocio/)).toBeVisible();
    await expect(page.getByText('Historial')).toBeVisible();
  });
});
