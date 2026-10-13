import { expect, login, test } from './fixtures';

test.describe('Sesión y navegación', () => {
  test('el dueño elige negocio y ve su Inicio', async ({ page }) => {
    await login(page, 'Alberto');
    await expect(page.getByText('Tu día, en un vistazo')).toBeVisible();
    await expect(page.getByText('Próxima cita')).toBeVisible();
  });

  test('una profesional entra directo a su negocio y no ve Privacidad y datos', async ({ page }) => {
    await login(page, 'Ana');
    await page.goto('/privacidad');
    await expect(page.getByText('Sin acceso')).toBeVisible();
  });

  test('las pestañas principales cargan sin errores', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await login(page, 'Alberto');
    for (const [tab, title] of [
      ['Agenda', 'Agenda'],
      ['Clientes', 'Clientes'],
      ['Marketing', 'Marketing'],
      ['Negocio', 'Negocio'],
    ] as const) {
      await page.getByText(tab, { exact: true }).last().click();
      await expect(page.getByText(title, { exact: true }).first()).toBeVisible();
    }
    expect(errors).toEqual([]);
  });
});
