# Ori: animación y hoja de ruta de diseño

## Pendiente: Ori animado con Rive

Duolingo anima a su mascota con **Rive** (rive.app): un solo archivo `.riv` con máquina de estados que parpadea, saluda, celebra y reacciona en tiempo real, mucho más ligero que video o Lottie.

**Hoy (iteración actual):** Ori se anima a partir de las imágenes PNG de cada pose con `react-native-reanimated` (flotar, aparecer, rebotar al celebrar). Funciona, pero no puede parpadear ni cambiar de expresión.

**Pendiente para después:**

1. Encargar o crear un `ori.riv` en Rive con:
   - Entradas (inputs) de la máquina de estados: `idle`, `wave`, `celebrate`, `think`, `sleep`, `sad`, `point`.
   - Parpadeo automático y respiración en `idle`.
   - Órbita dorada girando en bucle.
   - Mismos colores y proporciones que el arte aprobado (marfil, visor azul noche, manos/pies violeta, órbita y estrella doradas).
2. Integrar con `rive-react-native` (requiere development build; no funciona en Expo Go).
3. Sustituir el componente `apps/business-mobile/src/ui/Ori.tsx` manteniendo la misma API (`<Ori pose="celebrate" />`), para que ninguna pantalla cambie.
4. Mantener las PNG como respaldo (web, modo de movimiento reducido y carga inicial).

## Biblioteca de poses (PNG entregadas el 13-oct-2026)

| Pose (`pose`) | Archivo | Uso en la app |
|---|---|---|
| `wave` | `ori-wave` | Bienvenida, login, Inicio |
| `point` | `ori-point` | Consejos y tips |
| `star` | `ori-star` | Fidelidad |
| `celebrate` | `ori-celebrate` | Éxito y celebraciones |
| `head` | `ori-head` | Avatar circular |
| `unplugged` | `ori-unplugged` | Sin conexión / error |
| `sleep` | `ori-sleep` | Día sin citas |
| `calendar` | `ori-calendar` | Agenda, onboarding |
| `whatsapp` | `ori-whatsapp` | Canal WhatsApp y campañas |
| `shield` | `ori-shield` | Consentimiento, seguridad, permisos |
| `think` | `ori-think` | Cargando / calculando |
| `search` | `ori-search` | Búsqueda sin resultados |

Faltan (opcional): Ori con megáfono (campañas), escenas horizontales de onboarding y arte final del ícono de la app.

## Principios de diseño acordados

- Densidad de app profesional: títulos 28–30 pt, texto 15–16 pt, filas de 60–72 pt, botones de 48–52 pt.
- Ori aparece en momentos emocionales (bienvenida, vacíos, éxito, errores, logros); en pantallas de trabajo, mínimo o ausente.
- Toda animación respeta "Reducir movimiento" del sistema.
- No hay gestos invisibles que cambien el estado de una cita.

## Hecho en el rediseño v2 (13-oct-2026)

- Escala tipográfica más densa y fuente Plus Jakarta Sans (`@expo-google-fonts/plus-jakarta-sans`).
- Botón principal con profundidad tipo Duolingo y vibración (`expo-haptics`).
- Encabezado fijo y compacto en pestañas; el título aparece al hacer scroll. Aviso "Demo" discreto.
- Animaciones con Reanimated 4: entrada escalonada de tarjetas, escala al presionar, selector Día/Semana deslizante, contadores animados, anillo de progreso, esqueletos con pulso, reacomodo animado de la agenda.
- Feedback global (`src/ui/feedback.tsx`): toasts, hoja inferior de confirmación (con motivo obligatorio cuando la política lo exige) y celebración con Ori + confeti al completar visita, canjear o programar campaña.
- Inicio: anillo "atendidas del día", mensaje contextual de Ori, tres indicadores y accesos rápidos.
- Agenda: filas compactas, línea de "ahora" y huecos "Sin citas · Agendar" al filtrar por profesional (el hueco no implica disponibilidad; "Agendar" consulta el motor real).
- Poses de Ori en estados vacíos, errores, carga, login, campañas y fidelidad.

## Siguientes ideas de diseño

- Onboarding / alta guiada (UI03) con Ori paso a paso.
- Modo oscuro.
- Escenas horizontales de onboarding y Ori con megáfono (pendientes de arte).
