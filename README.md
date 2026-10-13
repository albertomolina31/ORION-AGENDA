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
docs/                stack.md, decisiones.md, openapi.json
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
pnpm test        # 63 pruebas de la API: reglas, casos de aceptación, configuración y HTTP
pnpm openapi     # regenera docs/openapi.json desde los esquemas
```

Las pruebas cubren los ejemplos de la sección 25 y los casos de la sección 16 que una simulación puede demostrar (doble reserva, idempotencia, aprobación vs. vencimiento, reprogramación con conflicto, permisos por rol, aislamiento entre negocios, sello único, canje único, consentimiento en campañas). Las garantías de persistencia y concurrencia entre procesos **no** se demuestran con memoria: requieren PostgreSQL.

## Ori

El arte de la mascota está pendiente. Coloca el PNG en `apps/business-mobile/assets/ori/ori.png` y sigue las instrucciones de `src/ui/Ori.tsx`.
