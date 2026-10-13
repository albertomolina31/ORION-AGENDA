# Plan de implementación: widgets de Orion Business (iOS y Android)

**Estado:** plan propuesto, sin código nativo todavía. En el documento maestro los widgets están en "Posteriores" (sección 2); este plan deja lista la decisión técnica para cuando se haga el primer development build.

## 1. Qué problema resuelven

El dueño, la recepción o un profesional quieren saber **qué sigue** sin abrir la app:
- la próxima cita (hora, cliente, servicio, profesional);
- cuántas solicitudes esperan aprobación (y cuándo vence la más próxima);
- el avance del día (atendidas / programadas).

El widget **solo muestra y abre**. Nunca aprueba, cancela ni completa citas: toda acción ocurre dentro de la app, con la sesión y los permisos revalidados (regla "no hay gestos invisibles que cambien el estado de una cita").

## 2. Catálogo de widgets

| Widget | iOS (WidgetKit) | Android (App Widget) | Contenido | Al tocar |
|---|---|---|---|---|
| **Próxima cita** | Pequeño (`systemSmall`) | 2×2 | Hora grande, cliente, servicio, color del profesional, estado | Detalle de la cita (`orionbusiness://cita/<id>`) |
| **Mi día** | Mediano (`systemMedium`) | 4×2 | Anillo atendidas/programadas, próximas 2–3 citas, pendientes | Agenda del día (`orionbusiness://agenda`) |
| **Pendientes** | Pequeño | 2×1 / 2×2 | Número de solicitudes y vencimiento más cercano | Bandeja de pendientes (`orionbusiness://pendientes`) |
| **Pantalla bloqueada** (fase 2) | `accessoryCircular`, `accessoryRectangular` | — | Solo hora de la próxima cita y número de pendientes, **sin nombres** | Agenda |

Diseño: misma identidad v2 (azul noche con degradado violeta, marfil, dorado decorativo, Plus Jakarta Sans). Ori aparece pequeño solo en estados vacíos ("Día libre", pose dormido) y de día completo (pose celebrando). Modo oscuro nativo en ambos sistemas.

## 3. Arquitectura de datos (recomendada: "instantánea escrita por la app")

```
App (React Native)                         Widget nativo
  ├─ obtiene /home y /appointments  ─┐
  ├─ arma WidgetSnapshot (JSON)      │      ├─ lee la instantánea compartida
  └─ la guarda en almacenamiento  ───┴────▶ ├─ muestra los datos + "actualizado HH:mm"
     compartido y pide recargar            └─ abre deep links
```

- **Almacenamiento compartido:** iOS → `UserDefaults` del **App Group** `group.labs.orion.business`; Android → `SharedPreferences` privadas de la app.
- **Cuándo se escribe:** después de cada carga correcta de Inicio/Agenda, tras cada mutación exitosa, al volver a primer plano y en una tarea en segundo plano periódica (`expo-background-task`, mejor esfuerzo).
- **Línea de tiempo (iOS):** la app escribe también las próximas citas del día para que WidgetKit programe entradas por hora sin red (la tarjeta "Próxima cita" avanza sola cuando una cita termina).
- **Sin tokens en el widget (fase 1):** el widget nunca llama a la API. Así no se comparten credenciales fuera de la app ni hace falta autorizar otro proceso. Desventaja: si la app no se abre por días, los datos envejecen; por eso el widget siempre muestra la hora de actualización y, si pasan más de 2 horas, "Abre Orion para actualizar".
- **Fase 2 opcional:** endpoint `GET /v1/businesses/:id/widget-summary` (respuesta mínima) y un token de solo lectura, de alcance limitado y revocable, compartido por Keychain con App Group. Solo si la frescura de la fase 1 resulta insuficiente en el piloto.

### Contrato de la instantánea (borrador, en `packages/contracts`)

```ts
WidgetSnapshot = {
  schemaVersion: 1,
  generatedAt: string,          // ISO; se muestra como "actualizado HH:mm"
  businessId: string,
  businessName: string,
  timezone: string,             // las horas se formatean en la zona del negocio
  privacy: 'FULL' | 'INITIALS' | 'HIDDEN', // preferencia del usuario
  day: { scheduled: number, completed: number, pending: number },
  nextPending: { expiresAt: string } | null,
  upcoming: Array<{             // máx. 6, ya filtradas por permisos del usuario
    appointmentId: string,
    startsAt: string, endsAt: string,
    customerLabel: string,      // según privacy: "Mariana López" | "M. L." | "Cliente"
    serviceName: string,
    professionalName: string,
    colorKey: string,
    status: 'CONFIRMED' | 'PENDING_APPROVAL',
  }>,
}
```

## 4. Privacidad y seguridad

- La pantalla de inicio la puede ver cualquier persona que tome el teléfono: preferencia **"Mostrar en widgets"** con opciones *Nombre completo / Iniciales / Ocultar* (por defecto **Iniciales**). En pantalla bloqueada, siempre oculto.
- Nada clínico ni notas: solo nombre del servicio.
- **Cerrar sesión o cambiar de negocio borra la instantánea** y recarga los widgets (mismo criterio que la caché privada, sección 14).
- Si el usuario pierde el acceso al negocio, la siguiente apertura de la app borra la instantánea.
- Un profesional solo ve sus citas: la instantánea se arma con los datos que la API ya filtró por permisos.

## 5. Tecnología

| Plataforma | Opción recomendada | Por qué | Alternativa |
|---|---|---|---|
| iOS | **`@bacons/apple-targets`** (config plugin de Expo) + extensión **SwiftUI/WidgetKit** escrita en Swift | Integra el target del widget en *Continuous Native Generation* sin tocar `ios/` a mano; SwiftUI es lo nativo para widgets | `react-native-widget-extension` |
| Android | **`react-native-android-widget`** (incluye plugin de Expo) | Los widgets se describen con componentes en JS/TS y se renderizan como RemoteViews; reutiliza tokens de diseño | Jetpack Glance (Kotlin) con un config plugin propio |
| Puente de datos | Módulo Expo pequeño (`modules/widget-bridge`) con `setSnapshot(json)` y `reloadWidgets()` | Una sola API para ambas plataformas; en iOS escribe en el App Group y llama a `WidgetCenter.shared.reloadAllTimelines()` | Paquetes de terceros de "shared preferences" |

Requisitos: **development build** (no funciona en Expo Go), App Group y capacidades en la cuenta de Apple de la organización (D07), perfiles EAS `development` / `preview` / `production`.

## 6. Pasos de implementación

| # | Tarea | Resultado verificable |
|---|---|---|
| W1 | Contrato `WidgetSnapshot` en `packages/contracts` y función pura `buildWidgetSnapshot(home, agenda, privacy)` con pruebas | Pruebas de privacidad, permisos y zona horaria pasan |
| W2 | Preferencia "Mostrar en widgets" en Cuenta | Se guarda por dispositivo; por defecto Iniciales |
| W3 | Módulo `widget-bridge` (iOS App Group + Android SharedPreferences) y escritura tras cargas/mutaciones; borrado al cerrar sesión | Inspección del almacenamiento compartido en simulador/emulador |
| W4 | Widget iOS "Próxima cita" (pequeño) con timeline por cita, estado vacío y "actualizado HH:mm" | Probado en iPhone real, modo claro/oscuro, texto grande |
| W5 | Widget Android "Próxima cita" 2×2 | Probado en Android real, varios launchers |
| W6 | Widgets "Mi día" y "Pendientes" en ambas plataformas | Deep links abren la pantalla correcta con sesión válida |
| W7 | Actualización en segundo plano (`expo-background-task`) y manejo de datos viejos (> 2 h) | El widget nunca muestra datos de otra sesión ni sin hora |
| W8 | Pantalla bloqueada iOS (fase 2) y evaluación de token de solo lectura | Decisión documentada según el piloto |

Cada widget se cierra con la misma regla del plan: **probado en dispositivo real**, no solo en simulador.

## 7. Riesgos

| Riesgo | Mitigación |
|---|---|
| Datos desactualizados si no se abre la app | Hora visible, aviso a las 2 h, tarea en segundo plano; fase 2 con token de lectura si hace falta |
| Mostrar datos de clientes a terceros | Iniciales por defecto, oculto en pantalla bloqueada, borrado al cerrar sesión |
| Presupuesto de recargas de WidgetKit | Timeline precalculada por citas; recargar solo tras cambios reales |
| Diferencias entre launchers de Android | Diseños con tamaños mínimos y pruebas en Pixel/Samsung |
| Código Swift dentro de un equipo JS | Widgets iOS pequeños y aislados; toda la lógica de datos vive en TS (W1) |

## 8. Dependencias con otras decisiones

- **D07** (cuentas Apple/Google de la organización y App Group).
- **P12** (development builds en dispositivos reales).
- **P14** (autenticación real) para la fase 2 con token de lectura.
