# Plan de implementación: widgets de Orion Business (iOS y Android)

**Estado (13-oct-2026):**
- **W1–W2:** contrato y privacidad hechos y probados.
- **W3–W6:** código nativo **listo para compilar**:
  - iOS con `expo-widgets`;
  - Android con `react-native-android-widget`;
  - `eas.json` y App Group configurados.
- **Lo que ya se verificó en Linux:**
  - `expo prebuild` genera la extensión `ExpoWidgetsTarget` (3 widgets y App Group) y los 3 receivers de Android;
  - los bundles de iOS y Android compilan;
  - los 3 widgets de iOS, ya serializados, se ejecutaron 36 veces sin errores (timeline × privacidad × claro/oscuro).
- **Falta:** verlos en el simulador, el emulador y teléfonos reales. Ver [`emuladores.md`](emuladores.md).

En el documento maestro los widgets están en "Posteriores" (sección 2). Este plan sigue la propuesta visual aprobada: **"Widgets del negocio · Tu agenda, a un vistazo"**.

## 1. Qué problema resuelven

El dueño, la recepción o un profesional quieren saber **qué sigue** sin abrir la app:
- la próxima cita;
- la agenda de hoy;
- cómo viene la semana.

El widget **solo muestra y abre**. Nunca aprueba, cancela ni completa citas. Toda acción ocurre dentro de la app, con la sesión y los permisos revalidados (regla "no hay gestos invisibles que cambien el estado de una cita").

## 2. Catálogo (diseño aprobado)

| # | Widget | iOS | Android | Contenido | Al tocar |
|---|---|---|---|---|---|
| 01 | **Próxima cita** | Pequeño (`systemSmall`) | 2×2 | Negocio, hora grande, servicio, estado (Confirmada / Por aprobar), "Con Ana", "Actualizado 09:40", Ori (cabeza) | Detalle de la cita `orionbusiness://cita/<id>` |
| 02 | **Agenda del día** | Mediano (`systemMedium`) | 4×2 | Fondo azul noche con degradado, "Hoy · Negocio", próximas 3 citas (hora · servicio · profesional), Ori con la pose del momento | Agenda de hoy `orionbusiness://agenda` |
| 03 | **Resumen semanal** | Grande (`systemLarge`) | 4×4 | Rango "12–18 de octubre", tira de días con hoy resaltado, citas por día o "Cerrado" | **Cada día** abre la agenda en esa fecha: `orionbusiness://agenda?fecha=AAAA-MM-DD` |
| — | Pantalla bloqueada (fase 2) | `accessoryRectangular` / `accessoryCircular` | — | Hora de la próxima cita y número de citas, **sin nombres** | Agenda |
| — | Actividad en vivo "Cita en curso" (fase 2, solo iPhone) | Live Activity / Isla Dinámica | — | Cliente según privacidad, cuenta regresiva hasta el fin, barra de avance | Detalle de la cita |

**Estados:**

| Estado | Qué muestra |
|---|---|
| Sin citas | "Día libre: hoy no hay citas." con Ori dormido |
| Cerrado | "Hoy el negocio está cerrado." |
| Día completo | "¡Día completo!" con Ori celebrando |
| Sin conexión o datos viejos | Siempre "Actualizado HH:mm". Pasadas 2 horas: "Abre Orion para actualizar" |
| Privacidad "Información oculta" | "10:00 · Próxima cita" y un candado |

## 3. Animaciones: qué se puede y qué no

iOS y Android **dibujan el widget como una imagen**. No hay un proceso de la app corriendo dentro del widget. Por eso:

| | iOS | Android |
|---|---|---|
| Animación continua (Ori flotando, órbita girando) | ❌ No permitido | ❌ No permitido |
| Pose de Ori según el momento (saluda, celebra, duerme) | ✅ (campo `oriPose`) | ✅ |
| Transición al cambiar el contenido (la hora "rueda", la lista se desliza) | ✅ iOS 17+ (`contentTransition(.numericText())`, `.transition`) | ⚠️ Cambio directo, sin animación |
| Cuenta regresiva en vivo ("Empieza en 12 min") | ✅ `Text(date, style: .timer)` | ✅ `Chronometer` en cuenta regresiva |
| Avanzar sola a la siguiente cita sin abrir la app | ✅ Una entrada de timeline por cita (`upcoming`) | ⚠️ `updatePeriodMillis` (mínimo 30 min) o al abrir la app |
| Más animación (barra de progreso, Isla Dinámica) | ✅ Actividad en vivo (fase 2) | — |

Las animaciones tipo Duolingo (Ori saltando, confeti) **siguen dentro de la app**. En el widget, Ori es una imagen con la pose adecuada.

## 4. Arquitectura de datos: "instantánea escrita por la app"

```
App (React Native)                                Widget nativo
  ├─ /home + /appointments (semana) + /schedules ─┐
  ├─ buildWidgetSnapshot() (packages/contracts)   │   ├─ lee la instantánea compartida
  └─ widgetBridge.setSnapshot() ──────────────────┴─▶ ├─ dibuja + "Actualizado HH:mm"
                                                      └─ abre deep links
```

- **Hecho:**
  - `WidgetSnapshot` y `buildWidgetSnapshot()` en `packages/contracts/src/widgets.ts`, función pura con 10 pruebas en `packages/contracts/test/widgets.test.ts`.
  - La instantánea trae los textos ya formateados en la zona del negocio (`timeLabel`, `dayLabel`, `countLabel`, `rangeLabel`, `generatedAtLabel`). Así el código nativo solo dibuja y no repite reglas.
  - **Sincronización:** `WidgetSync`, en `apps/business-mobile/src/lib/widgets.ts`, la recalcula cada vez que cambian los datos de Inicio, la agenda semanal, los horarios o la privacidad.
  - Hoy `widgetBridge` la guarda en el almacenamiento de la app (**simulación**: ningún widget la lee todavía).
- **Puente nativo (W3):**
  - iOS: `UserDefaults` del **App Group** `group.labs.orion.business`, más `WidgetCenter.shared.reloadAllTimelines()`.
  - Android: `SharedPreferences`, más una petición de actualización del widget.
- **Sin tokens en el widget (fase 1):** el widget nunca llama a la API. Si la app no se abre por horas, el widget lo indica.
- **Fase 2 opcional:** `GET /v1/businesses/:id/widget-summary` con un token de solo lectura revocable. Solo si el piloto demuestra que la frescura no alcanza.

### Contrato (resumen; la fuente de verdad es `widgets.ts`)

```ts
WidgetSnapshot = {
  schemaVersion: 1, generatedAt, generatedAtLabel: '09:40',
  businessId, businessName, timezone, privacy: 'FULL' | 'INITIALS' | 'HIDDEN',
  today, day: { scheduled, completed, pending }, nextPendingExpiresAt,
  upcoming: WidgetAppointment[]  // máx. 6, futuras, vigentes, ya filtradas por permisos
  week: { from, to, rangeLabel: '12–18 de octubre', days: WidgetWeekDay[7] },
  oriPose: 'wave' | 'calendar' | 'celebrate' | 'sleep',
  emptyMessage,
}
WidgetAppointment = { appointmentId, startsAt, endsAt, date, timeLabel, dayLabel,
  customerLabel | null, serviceName | null, professionalName | null,   // null si HIDDEN
  colorKey, status, statusLabel, deepLink }
WidgetWeekDay = { date, weekdayShort, dayNumber, count, closed, isToday, countLabel, deepLink }
```

## 5. Privacidad (configurable por negocio y por persona)

- **Negocio:** en *Perfil y reglas* se fija el máximo que pueden mostrar los widgets: *Nombre completo*, *Solo iniciales* (por defecto) o *Información oculta*. Lo cambia quien tenga `business.configure` y se guarda en la API (`widgetPrivacy` del perfil).
- **Persona:** en *Negocio → Widgets* cada profesional elige en su teléfono. **Puede ocultar más, nunca mostrar más** (`effectiveWidgetPrivacy`).
- **Pantalla bloqueada:** nunca muestra nombres.
- **Qué no se muestra nunca:** notas ni datos clínicos; solo el nombre del servicio.
- **Cerrar sesión o cambiar de negocio** borra la instantánea, igual que la caché privada.
- **Permisos:** un profesional solo ve sus citas, porque la instantánea se arma con datos que la API ya filtró.

## 6. Tecnología

| Plataforma | Opción recomendada | Por qué | Alternativa |
|---|---|---|---|
| iOS | **`expo-widgets` `~57.0.24`** (oficial de Expo) | Widgets y Live Activities en **JSX con `@expo/ui/swift-ui`**: cada layout lleva la directiva `'widget'`, se serializa y corre en la extensión (no puede usar nada de fuera de su función). Confirmado en el paquete: `Link` (enlace por día), `widgetURL`, `contentTransition('numericText')`, `Text` con temporizador, `containerBackground`, `updateTimeline` | `@bacons/apple-targets` + Swift si algo faltara |
| Android | **`react-native-android-widget`** (incluye plugin de Expo) | Widgets en JSX/TS renderizados como RemoteViews. Reutiliza tokens. Trae `WidgetPreview` para diseñar dentro de la app | Jetpack Glance (Kotlin) con un config plugin propio |
| Puente de datos | Módulo pequeño `modules/widget-bridge`, o la API de datos compartidos de `expo-widgets` en iOS | Misma interfaz que el `widgetBridge` actual: `setSnapshot(json)` y `clear()` | — |

**Nota:** en SDK 57 la parte Android de `expo-widgets` es solo un esqueleto (`enableAndroid`, dibuja el nombre del widget). Por eso Android usa `react-native-android-widget`. La API de `expo-widgets` se revisó en los tipos del paquete instalado, porque sus docs no abren desde este entorno.

**Requisitos:**
- *development build* (no funciona en Expo Go ni en web);
- App Group en la cuenta de Apple de la organización (D07);
- perfiles EAS `development`, `ios-simulator` y `preview`.

## 7. Pasos

| # | Tarea | Estado | Resultado verificable |
|---|---|---|---|
| W1 | Contrato `WidgetSnapshot` y `buildWidgetSnapshot` con pruebas | ✅ | 10 pruebas: semana, cerrados, orden, vencidas, privacidad, estados, cambio de mes, datos viejos |
| W2 | Privacidad por negocio (API) y por persona (teléfono); sincronización; vista previa en la app; deep link `agenda?fecha=` | ✅ | Pantalla *Widgets* con datos reales; la agenda abre la fecha del enlace |
| W3 | `eas.json`, App Group `group.labs.orion.business`, puente nativo (`src/widgets/native-bridge.*`), borrado al cerrar sesión | ✅ Código; verificar en dispositivo | Prebuild genera los targets; widgets limpios tras cerrar sesión |
| W4 | iOS: los 3 widgets (`src/widgets/ios-layouts.tsx`) con timeline por cita (`buildWidgetTimeline`), transición numérica y cuenta regresiva | ✅ Código; verificar en simulador y iPhone | Ejecución de los widgets serializados sin errores (36 casos) |
| W5 | Android: los 3 widgets (`src/widgets/android-widgets.tsx`), tarea en segundo plano (`register.android.ts`) y vista previa nativa en la app | ✅ Código; verificar en emulador y Samsung | Bundle Android incluye el registro de la tarea |
| W6 | Deep links por día (`agenda?fecha=`) y por cita | ✅ App; verificar desde el widget | La agenda abre la fecha del enlace (probado en web) |
| W7 | Actualización en segundo plano (`expo-background-task`) y datos viejos (> 2 h) | Pendiente | El widget nunca muestra datos de otra sesión ni sin hora |
| W8 | Fase 2: pantalla bloqueada, Actividad en vivo "Cita en curso" y evaluación del token de solo lectura | Pendiente | Decisión documentada según el piloto |

Cada widget se cierra con la regla del plan: **probado en dispositivo real**, no solo en simulador.

## 8. Riesgos

| Riesgo | Mitigación |
|---|---|
| Datos desactualizados si no se abre la app | Hora visible, aviso a las 2 h, tarea en segundo plano. En fase 2, token de lectura si hace falta |
| Mostrar datos de clientes a terceros | Iniciales por defecto, máximo por negocio, oculto en pantalla bloqueada, borrado al cerrar sesión |
| Presupuesto de recargas de WidgetKit | Timeline precalculada por citas; recargar solo tras cambios reales |
| Diferencias entre launchers de Android (One UI) | Tamaños mínimos y pruebas en Pixel y Samsung |
| `expo-widgets` no cubre todo el diseño | Alternativa `@bacons/apple-targets` con SwiftUI; la lógica de datos ya vive en TS (W1) |

## 9. Dependencias

- **D07:** cuentas Apple/Google de la organización y App Group.
- **P12:** development builds en dispositivos reales.
- **P14:** autenticación real, para el token de lectura de la fase 2.
- **Equipo:** ver [`emuladores.md`](emuladores.md).
