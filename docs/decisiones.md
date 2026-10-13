# Registro de decisiones y pendientes

| ID | Tema | Estado en el código |
|---|---|---|
| D01 | Público: negocios primero | Solo app Business |
| D02 | iOS/Android con Expo | Web solo para revisar UI, sin paridad comprometida |
| D09 | Base de datos | **Pospuesta.** Puertos + adaptadores en memoria. La exclusión de traslapes se simula en `memory-database.ts`; en PostgreSQL será `EXCLUDE USING gist` sobre `tstzrange` |
| Auth | Estrategia de identidad | **Simulada** (decisión de Alberto, 13-oct). Pendiente: proveedor vs. propia |
| Ori | Arte de la mascota | **Pendiente de Alberto.** `apps/business-mobile/src/ui/Ori.tsx` usa un marcador vectorial; ver instrucciones en el archivo |

## Parámetros de la sección 24 usados como fixtures (no aprobados)

Intervalo 15 min · anticipación mínima 1 h · horizonte 60 días · aprobación 30 min · cancelación/reprogramación del cliente hasta 2 h antes · ausencia 15 min tras el inicio · buffers 0 por defecto · citas creadas por personal se confirman directamente · "cualquiera" = menor carga del día y luego ID.

## Qué cubre cada pantalla del diseño

| Mockup | Ruta | Estado |
|---|---|---|
| Panel de citas con Ori (Inicio) | `/` | Funcional sobre API simulada |
| Agenda de citas | `/agenda` | Día y semana resumida, filtros por profesional, pendientes |
| Directorio de clientes / Primeras citas | `/clientes` | Segmentos, búsqueda, orden y paginación |
| Ficha de cliente | `/cliente/:id` | Historial, preferencias, fidelidad (lectura del módulo de Sergio) |
| Marketing (Campañas y Fidelidad) | `/marketing` | Listado real; tarjeta con progreso de ejemplo etiquetado |
| Panel de negocio | `/negocio` | Servicios, equipo, horarios, excepciones y bloqueos editables (P17–P19) |
| Configura tu programa | `/fidelidad/configurar` | Formulario y revisión; **no aplica cambios** (módulo de Sergio) |
| Revisión antes del canje | `/fidelidad/canje` | Canje idempotente contra la simulación; escaneo pendiente |
| Crear campaña pasos 1–4 | `/campana/nueva` | Borrador, audiencia con consentimiento, vista previa; programar bloqueado si la plantilla no está aprobada |

Pantallas adicionales del inventario: detalle de cita y acciones (UI07), nueva cita (UI06), reprogramar (UI08), pendientes (UI09), alta de cliente, servicios/equipo/horarios/reglas en lectura (UI12–UI15), notificaciones (UI18) y cuenta (UI19).

## Iteración 13-oct-2026 (tarde)

- **P17–P19 Edición de Negocio:** servicios (crear, editar, archivar; snapshot intacto), equipo (alta sin usuario, baja solo tras resolver citas futuras, reasignación desde Reprogramar), jornada semanal con jornada partida, excepciones por fecha y bloqueos manuales. Todo cambio de horario calcula conflictos primero (`dryRun`) y nunca mueve ni cancela citas en silencio.
- **UI24 Campañas:** detalle con métricas disponibles (enviados, entregados, con error, respuestas; reservas atribuibles "No disponible"), historial de estados, pausar/reanudar/cancelar. Selección manual de destinatarios con estado de consentimiento visible.
- **UI18 Notificaciones:** bandeja derivada del outbox (solicitudes y reservas por WhatsApp, vencimientos, cancelaciones, reprogramaciones), sin auto-avisos del propio actor, filtrada por permisos; contador en la campana.
- Permisos: catálogo `catalog.manage`; alta/baja de profesionales `team.manage` (solo dueño por defecto); horarios y bloqueos `schedules.manage`.

## Iteración 13-oct-2026 (noche)

- **UI15 Perfil y reglas editables:** nombre, categoría y "acepta reservas externas" (zona horaria y moneda no se editan desde la app). Reglas de reserva (confirmación, granularidad, anticipación mínima, horizonte, ventana de aprobación, límites de cancelación/reprogramación del cliente, margen de "No asistió") con **revisión previa** (`dryRun`: cambios, avisos y cuántas citas conservan la versión anterior) y confirmación explícita. Solo `business.configure`.
- **L17 versionado:** cada cambio crea una versión nueva; las citas existentes guardan `policyVersion` en su snapshot y se evalúan con la versión con la que se crearon (`policyFor`). Historial de versiones visible.
- **P42 Modo sin conexión:** caché persistida en el dispositivo (24 h, separada por usuario y negocio, se borra al cerrar sesión o cambiar de negocio), sesión utilizable sin red, aviso con la hora de los datos mostrados y acciones transaccionales bloqueadas ("Sin conexión"). Error `OFFLINE` (no se envió nada) distinto de `NETWORK`/`TIMEOUT` (resultado incierto: se consulta `/operations/:requestId`). Distingue "sin internet" de "servidor inalcanzable". Sin pings a terceros.
- **Animaciones tipo Duolingo:** Ori con squash & stretch al tocarlo y saltos de celebración, confeti radial, destellos al completar el anillo del día, sacudida en errores de formulario y toasts, chips con rebote. Todo respeta "Reducir movimiento".
- **Widgets:** plan en [`widgets-plan.md`](widgets-plan.md) (instantánea escrita por la app, sin tokens en fase 1, iniciales por defecto).

## Iteración 13-oct-2026: widgets W1–W2

- Diseño aprobado: Próxima cita (pequeño), Agenda del día (mediano), Resumen semanal (grande, cada día abre la agenda en esa fecha), privacidad "Información oculta", estados sin citas y sin conexión.
- `WidgetSnapshot` + `buildWidgetSnapshot` (función pura, 10 pruebas) en `packages/contracts`; sincronización desde la app (`WidgetSync`, simulada en almacenamiento local hasta el development build).
- Privacidad: el negocio fija el máximo (`widgetPrivacy` en el perfil, por defecto iniciales) y cada persona puede ocultar más en su teléfono.
- Pantalla *Negocio → Widgets* con vista previa de datos reales; deep link `orionbusiness://agenda?fecha=`.
- Los widgets no admiten animación continua: Ori cambia de pose; en iOS hay transiciones de contenido y cuenta regresiva. Detalle en `widgets-plan.md`; cómo compilarlos y verlos en `emuladores.md` (iOS: `expo-widgets`, oficial de Expo).

## Iteración 13-oct-2026: privacidad y datos (sección 14)

- **Consentimiento promocional con historial:** cada alta o baja registra fecha, persona, origen y constancia (obligatoria al otorgar). Recepción puede registrarlo (`customers.manage`); un profesional no.
- **Solicitudes de derechos** (acceso, rectificación, cancelación, oposición) con canal, días abiertos, historial y respuesta obligatoria al atender o rechazar. Permiso nuevo `privacy.manage` (dueño y administración).
- **Oposición atendida** registra la baja promocional automáticamente; sigue recibiendo avisos operativos.
- **Exportación** de datos del cliente (`orion.customer-export.v1`): contacto, consentimientos, citas con importes y solicitudes.
- **Eliminación = anonimización:** se borran nombre, teléfono, correo y notas; se conservan citas, importes y sellos como "Cliente eliminado". Se rechaza si hay citas próximas y exige escribir el nombre para confirmar. Una cancelación no se puede dar por atendida hasta eliminar los datos.
- **No se inventan plazos legales ni retención:** la pantalla lista las políticas pendientes de revisión especializada antes del piloto.

## Iteración 13-oct-2026: modo oscuro

- Paleta oscura propuesta en `packages/design-tokens` (`darkColors`, `darkProfessionalColors`): azul noche profundo en lugar de negro, violeta más claro para contraste y dorado de acento. Validar contraste en dispositivo.
- Preferencia por teléfono en *Cuenta → Apariencia*: Automático (sigue al sistema), Claro u Oscuro.
- Implementación: `colors` es un objeto vivo y los estilos de módulo se envuelven con `themed()` (se recalculan por tema sin reescribir pantallas). Al cambiar de tema se vuelve a montar el navegador y se regresa a la misma pantalla; la sesión y la caché se conservan. Colores escritos a mano pasaron a tokens.

## Siguiente bloque sugerido

1. Retomar D09: esquema PostgreSQL, migraciones y pruebas de concurrencia reales (P09, P22).
2. Decidir autenticación y reemplazar el login simulado (P14).
3. Widgets W3–W6 con el primer development build (requiere Mac y cuentas de la organización, ver `emuladores.md`).
4. Development build en iPhone/Android físicos (P12).
5. Entregar a Carlos y Sergio `docs/openapi.json` y los fixtures (P06).
