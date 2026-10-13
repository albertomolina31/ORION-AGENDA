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
| Panel de negocio | `/negocio` | Lectura; edición en P17–P19 |
| Configura tu programa | `/fidelidad/configurar` | Formulario y revisión; **no aplica cambios** (módulo de Sergio) |
| Revisión antes del canje | `/fidelidad/canje` | Canje idempotente contra la simulación; escaneo pendiente |
| Crear campaña pasos 1–4 | `/campana/nueva` | Borrador, audiencia con consentimiento, vista previa; programar bloqueado si la plantilla no está aprobada |

Pantallas adicionales del inventario: detalle de cita y acciones (UI07), nueva cita (UI06), reprogramar (UI08), pendientes (UI09), alta de cliente, servicios/equipo/horarios/reglas en lectura (UI12–UI15), notificaciones (UI18) y cuenta (UI19).

## Siguiente bloque sugerido

1. Retomar D09: esquema PostgreSQL, migraciones y pruebas de concurrencia reales (P09, P22).
2. Decidir autenticación y reemplazar el login simulado (P14).
3. Edición de servicios, equipo, horarios y bloqueos (P17–P19).
4. Development build en iPhone/Android físicos (P12).
5. Entregar a Carlos y Sergio `docs/openapi.json` y los fixtures (P06).
