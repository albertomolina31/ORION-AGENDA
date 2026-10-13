import { expect, login, test } from './fixtures';

test.describe('Configuración del negocio', () => {
  test('cambiar una regla de reserva crea una versión nueva con revisión previa', async ({ page }) => {
    await login(page, 'Alberto');
    await page.goto('/ajustes/reglas');
    const version = page.getByText(/^v\d+$/).first();
    await expect(version).toBeVisible();
    const before = Number((await version.textContent())!.slice(1));
    await page.getByLabel('Sumar 5').last().click();
    await page.getByText('Revisar cambios').click();
    await expect(page.getByText('Confirmar cambios')).toBeVisible();
    await page.getByText('Confirmar cambios').click();
    await expect(page.getByText(`v${before + 1}`).first()).toBeVisible();
  });

  test('la vista previa de widgets respeta la privacidad elegida', async ({ page }) => {
    await login(page, 'Alberto');
    await page.goto('/widgets');
    await expect(page.getByText('03 · Resumen semanal')).toBeVisible();
    await page.getByText('Información oculta', { exact: true }).first().click();
    await expect(page.getByText('Próxima cita', { exact: true }).first()).toBeVisible();
  });
});
