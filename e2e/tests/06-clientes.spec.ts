import { expect, login, test } from './fixtures';

test.describe('Ficha de cliente', () => {
  test('unir el duplicado de Diego conserva un solo registro', async ({ page }) => {
    await login(page, 'Alberto');
    await page.goto('/cliente/cus_002');
    await page.getByText(/Revisar y unir con/).first().click();
    await expect(page.getByText('Qué va a pasar')).toBeVisible();
    await page.getByText('Unir registros', { exact: true }).last().click();
    await page.getByText('Unir registros', { exact: true }).last().click();
    await expect(page.getByText('Registros unidos')).toBeVisible();
    await expect(page.getByText('Posible duplicado')).toBeHidden();
  });

  test('las notas restringidas solo las ve la administración', async ({ browser }) => {
    const owner = await (await browser.newContext()).newPage();
    await login(owner, 'Alberto');
    await owner.goto('/cliente/cus_001');
    await expect(owner.getByText('Solo administración')).toBeVisible();

    const pro = await (await browser.newContext()).newPage();
    await login(pro, 'Ana');
    await pro.goto('/cliente/cus_001');
    await expect(pro.getByText('Notas internas')).toBeVisible();
    await expect(pro.getByText(/agua tibia/)).toBeVisible();
    await expect(pro.getByText('Solo administración')).toHaveCount(0);
  });

  test('editar la ficha actualiza el contacto', async ({ page }) => {
    await login(page, 'Alberto');
    await page.goto('/cliente/editar?id=cus_004');
    await page.getByLabel('Correo').fill('valeria@correo.test');
    await page.getByText('Guardar cambios').click();
    await expect(page.getByText('Ficha actualizada')).toBeVisible();
    await page.goto('/cliente/cus_004');
    await expect(page.getByText(/valeria@correo.test/)).toBeVisible();
  });
});
