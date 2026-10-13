import { API, expect, login, test } from './fixtures';

test.describe('Privacidad y datos', () => {
  test('atender una oposición registra la baja de promociones', async ({ page }) => {
    await login(page, 'Alberto');
    await page.goto('/privacidad');
    await page.getByText('Oposición · Fernanda Gil').click();
    await page.getByText('Marcar como atendida').first().click();
    await page.getByRole('textbox').last().fill('Se dio de baja de promociones; seguirá recibiendo recordatorios.');
    await page.getByText('Marcar como atendida').last().click();
    await expect(page.getByText('Solicitud atendida')).toBeVisible();
    await page.goto('/cliente/cus_009');
    await expect(page.getByText('Se dio de baja').first()).toBeVisible();
  });

  test('eliminar datos exige escribir el nombre y conserva la solicitud como atendible', async ({ page, request }) => {
    const { accessToken } = await (await request.post(`${API}/auth/dev-login`, { data: { userId: 'u_alberto' } })).json();
    const prv = await (await request.get(`${API}/businesses/biz_orbita/privacy/requests/prv_seed_2`, { headers: { authorization: `Bearer ${accessToken}` } })).json();
    const name: string = prv.customer.name;
    await login(page, 'Alberto');
    await page.goto('/privacidad/prv_seed_2');
    await page.getByText('Eliminar datos del cliente').first().click();
    await page.getByRole('textbox').last().fill(name);
    await page.getByText('Eliminar datos', { exact: true }).last().click();
    await expect(page.getByText('Datos eliminados').first()).toBeVisible();
    await expect(page.getByText('Cliente eliminado')).toBeVisible();
  });
});
