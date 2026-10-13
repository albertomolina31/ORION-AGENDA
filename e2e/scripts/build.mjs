// Prepara lo que las pruebas e2e necesitan: contratos, API compilada y la app exportada para web
// apuntando a la API de pruebas. Se ejecuta antes de `playwright test`.
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const API_PORT = process.env.E2E_API_PORT ?? '3200';
const run = (cmd, cwd = root, env = {}) => execSync(cmd, { cwd, stdio: 'inherit', env: { ...process.env, ...env } });

run('pnpm build:packages');
run('pnpm --filter @orion/api build');
run(`npx expo export --platform web --clear --output-dir ${resolve(root, 'e2e/.web')}`, resolve(root, 'apps/business-mobile'), {
  EXPO_PUBLIC_API_URL: `http://localhost:${API_PORT}`,
  CI: '1',
});
