# Orion Business

App para negocios con varios profesionales: agenda, clientes, fidelidad y campañas. Plan de referencia: *Orion — Plan de construcción v1.3*.

> ⚠️ **Simulación.** No hay base de datos todavía (D09) ni autenticación real. La API usa datos sintéticos en memoria que se reinician con cada arranque. No usar con datos reales.

## Estructura

```
apps/
  api/               NestJS 12 · dominio, casos de uso, adaptadores en memoria, HTTP v1
  business-mobile/   Expo SDK 57 · Expo Router · app Orion Business
packages/
  contracts/         Esquemas zod compartidos (tipos, validación y OpenAPI)
  design-tokens/     Colores, tipografía, espaciado (dirección visual aprobada)
docs/                stack.md, decisiones.md, openapi.json, widgets-plan.md, emuladores.md, ori-animacion-y-diseno.md
e2e/                 Pruebas de extremo a extremo (Playwright)
```

## Arranque

```bash
pnpm install
pnpm build:packages          # compila contracts y design-tokens
pnpm dev:api                 # API en http://localhost:3000/v1
pnpm dev:app                 # Expo (i = iOS, a = Android, w = web)
```

En un teléfono físico, crea `apps/business-mobile/.env` con `EXPO_PUBLIC_API_URL=http://<IP-de-tu-computadora>:3000`.

Usuarios de prueba (login simulado): **Alberto** (dueño de dos negocios), **Carmen** (administradora), **Rocío** (recepción), **Ana** (profesional: solo ve su agenda).

## Calidad

```bash
pnpm typecheck   # todo el monorepo
pnpm test        # 83 pruebas de la API + 13 de widgets (packages/contracts)
pnpm openapi     # regenera docs/openapi.json desde los esquemas
pnpm e2e         # pruebas de extremo a extremo de la app (Playwright, versión web + API simulada)
```

**Pruebas de extremo a extremo (`e2e/`):**
- `pnpm e2e` hace lo siguiente:
  - compila los contratos y la API;
  - exporta la app para web apuntando a una API de pruebas (puerto 3200);
  - recorre los flujos principales en Chromium.
- **Flujos cubiertos:**
  - sesión y pestañas;
  - aprobar solicitudes;
  - reglas versionadas;
  - vista previa de widgets;
  - modo sin conexión;
  - privacidad (oposición y eliminación de datos);
  - unión de duplicados y notas por rol;
  - edición de ficha;
  - modo oscuro.
- Cada prueba reinicia los datos de ejemplo con `POST /v1/simulation/reset`. Esa ruta solo está activa con `ORION_ALLOW_RESET=1`.
- **Primera vez en tu equipo:** `pnpm --filter @orion/e2e exec playwright install chromium`.

**CI** (`.github/workflows/ci.yml`) tiene tres trabajos:
- `checks`: tipos, pruebas y contrato OpenAPI;
- `e2e`: los flujos anteriores, con reporte si fallan;
- `widgets-ios`: compila el bundle de iOS y ejecuta los widgets serializados con `scripts/check-ios-widgets.mjs`.

Las pruebas cubren los ejemplos de la sección 25 y los casos de la sección 16 que una simulación puede demostrar (doble reserva, idempotencia, aprobación vs. vencimiento, reprogramación con conflicto, permisos por rol, aislamiento entre negocios, sello único, canje único, consentimiento en campañas). Las garantías de persistencia y concurrencia entre procesos **no** se demuestran con memoria: requieren PostgreSQL.

## Ori

Las poses de Ori están en `apps/business-mobile/assets/ori/` (ver `docs/ori-animacion-y-diseno.md`).
