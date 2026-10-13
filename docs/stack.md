# Stack y versiones fijadas

Registro exigido por la sección 4 del plan. Versiones resueltas el 13-oct-2026; el lockfile (`pnpm-lock.yaml`) es la fuente exacta.

| Pieza | Versión | Notas |
|---|---|---|
| Node.js | 22.x | `engines` en el `package.json` raíz |
| pnpm | 10.28 | Workspaces; `node-linker=hoisted` para compatibilidad con Metro/Expo |
| TypeScript | ~6.0.3 | La que trae la plantilla de Expo SDK 57; misma versión en todo el monorepo. `strict` + `noUncheckedIndexedAccess` |
| Expo SDK | 57 (`expo ~57.0.28`) | React Native 0.86.3, React 19.2.3. Versiones nativas tomadas de `expo/bundledNativeModules.json` |
| Expo Router | ~57.0.26 | Pestañas JS (`expo-router/js-tabs`) con barra propia |
| TanStack Query | 5.x | Caché de lecturas; las reglas de reserva no viven ahí |
| lucide-react-native + react-native-svg | 1.x / 15.15.4 | Iconos e ilustraciones vectoriales |
| expo-secure-store | ~57.0.4 | Token de sesión (sessionStorage solo en web) |
| NestJS | 12.x (ESM) | `@nestjs/core`, `common`, `platform-express` |
| zod | 4.x | Esquemas compartidos en `@orion/contracts`: validan app y API y generan OpenAPI |
| luxon | 3.x | Zonas IANA y cambios de horario en el motor de disponibilidad |
| Vitest | 5.x | Pruebas de dominio, casos de uso y HTTP (supertest) |

## Decisiones técnicas tomadas en esta iteración

- **Validación con zod en lugar de class-validator.** Un solo esquema en `packages/contracts` sirve a la app (validación local), a la API (`ZodPipe`) y al generador de `docs/openapi.json`. Así no se copian interfaces a mano (sección 4).
- **Inyección explícita en Nest (`@Inject(TOKEN)`).** No dependemos de `emitDecoratorMetadata` y las pruebas corren en Vitest sin compilador especial.
- **Base de datos: NO implementada (D09).** Los casos de uso hablan con puertos (`apps/api/src/application/ports.ts`). Hoy solo hay adaptadores en memoria marcados como SIMULACIÓN.
- **Login simulado.** Selector de usuarios sintéticos con tokens opacos en memoria. Sin contraseñas, refresh ni expiración: se sustituye cuando se decida la estrategia de identidad (sección 14).
- **Reloj de simulación.** La API arranca "hoy a las 09:41" en la zona del negocio para que los fixtures coincidan con los diseños. `ORION_CLOCK=system` usa la hora real.
- **Docs de Expo no accesibles desde el entorno de construcción**: versiones nativas verificadas con `bundledNativeModules.json` del paquete `expo`. Ejecutar `npx expo install --check` en una máquina con red antes del primer development build.
