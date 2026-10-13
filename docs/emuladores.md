# Compilar y ver la app con widgets en iPhone y Android

Guía para pasar de la simulación web a la app instalada con sus widgets nativos (plan en [`widgets-plan.md`](widgets-plan.md)). Investigación del **13-oct-2026**. Las marcas ⚠️ indican datos que no se pudieron confirmar en una fuente oficial: verifíquenlos antes de comprar o contratar.

## Resumen

> **La mejor opción:** un **Mac con Apple Silicon (M1 o posterior) y 16 GB de RAM o más** (mejor 24–32 GB). Con él se usan a la vez el **iOS Simulator** (Xcode) y el **Android Emulator** (Android Studio), gratis.
>
> Se complementa con **un iPhone y un Android reales (ideal un Samsung)**, para lo que los simuladores no reproducen: App Groups firmadas, notificaciones reales y One UI.

- **Windows y Linux no pueden ejecutar el iOS Simulator.** No hay alternativa oficial.
- **Con Windows o Linux:**
  - Android funciona perfecto en local.
  - Para iOS hace falta un Mac en la nube por horas, o compilar en la nube (EAS) y probar en un iPhone real con TestFlight.
- **Ni la web ni Expo Go sirven para los widgets.**
  - La versión web y Expo Go no tienen widgets.
  - Dentro de la app, la pantalla **Negocio → Widgets** muestra una vista previa con datos reales mientras tanto.

## 1. Versiones que pide Expo SDK 57

| Tema | Valor |
|---|---|
| React Native / React | 0.86 / 19.2 |
| iOS mínimo de la app | 16.4 |
| Xcode | **26.4 o superior**. Recomendado **26.6**: es la imagen `sdk-57` de EAS (`macos-tahoe-26.5-xcode-26.6`) |
| macOS | Tahoe 26.2 o superior para Xcode 26.4–26.6 |
| Android | compileSdk / targetSdk **36** (Android 16) |
| App Store (desde el 28-abr-2026) | Compilar con Xcode 26 o superior y el SDK de iOS 26 |
| Google Play (desde el 31-ago-2026) | targetSdk 36 |
| Cambio de SDK 57 | `expo prebuild` borra y regenera `ios/` y `android/`. **No se editan a mano**: todo va por config plugins |

**Xcode 27** (sep-2026):
- Pide macOS Tahoe 26.6 y, según fuentes secundarias, solo Apple Silicon ⚠️.
- Hay reportes de apps SDK 57 que compilan pero se cierran al abrir, por el ciclo de vida UIScene de iOS 27 ⚠️. Mientras no se confirme el arreglo, **usen Xcode 26.6**.
- Se pueden tener varias versiones instaladas con [`xcodes`](https://github.com/XcodesOrg/xcodes) y elegir una con `sudo xcode-select -s`.

## 2. iPhone: iOS Simulator (en un Mac)

**Requisitos:**
- Mac Apple Silicon con macOS Tahoe 26.2 o superior y Xcode 26.6 (App Store o `xcodes`).
- Unos 40–60 GB libres ⚠️.
- **No hace falta cuenta de Apple** para usar el Simulator.

**Qué se puede probar:**

| Función | ¿Simulator? | Notas |
|---|---|---|
| Widgets de pantalla de inicio | ✅ | Mantener pulsado el fondo → **Editar** → **Añadir widget** → "Orion Business" → elegir tamaño |
| Widgets de pantalla bloqueada | ✅ | |
| Live Activities / Isla Dinámica | ✅ iniciadas desde la app | Usar un **iPhone Pro** (14 Pro o posterior) para ver la Isla. Las que se inician por push pruébenlas en un iPhone real |
| App Group (app ↔ widget) | ✅ en la práctica ⚠️ | En un dispositivo real exige la cuenta de pago |
| Notificaciones push | Simuladas | `xcrun simctl push booted labs.orion.business.dev payload.apns` |

**Lo más rápido para diseñar el widget:** las vistas previas de Xcode.
- Muestran cada entrada del timeline, modo claro y oscuro, pantalla bloqueada y StandBy.
- No hace falta compilar toda la app.
- Con `expo-widgets` el widget se escribe en JSX. Con la alternativa en Swift se usan vistas previas `#Preview(as: .systemSmall)`.

### Pasos (cuando empecemos W3)

```bash
# en el Mac, dentro del repo
pnpm install
pnpm build:packages
cd apps/business-mobile
npx expo install expo-widgets expo-dev-client   # versiones compatibles con SDK 57
npx expo prebuild --clean -p ios                 # genera ios/ con la extensión del widget
npx expo run:ios                                 # compila y abre el Simulator
# opcional: xed ios   → abrir el proyecto en Xcode
```

En otra terminal, la API: `pnpm dev:api`. El Simulator ve `localhost` del Mac, así que no hace falta cambiar `EXPO_PUBLIC_API_URL`.

### Apple ID gratis o Apple Developer Program (99 USD/año)

| Necesidad | Apple ID gratis | Programa de pago |
|---|---|---|
| Simulator y vistas previas | ✅ | ✅ |
| Instalar en tu iPhone por cable | ✅ "Personal Team" (caduca a los 7 días ⚠️) | ✅ |
| **App Group para que el widget lea datos en un iPhone real** | ❌ No es fiable | ✅ **Necesario** |
| EAS Build para dispositivo, TestFlight y App Store | ❌ | ✅ |

**Recomendación:** contratar el programa **a nombre de la organización** (D07) en cuanto se pruebe en iPhones reales.

## 3. Android: Android Studio Emulator

- **Funciona en Windows, macOS y Linux:**
  - Windows: con WHPX.
  - Linux: con KVM.
  - Mac Apple Silicon: con imágenes arm64.
- **Hardware:** mínimo 8 GB de RAM, **recomendado 16 GB o más**, SSD y virtualización activada.
- **Imágenes recomendadas (Device Manager → Create device):**
  - **Pixel 8 o Pixel 9, API 36 (Android 16), "Google Play"**: la principal.
  - Una imagen API 29 o similar para compatibilidad.
- **Añadir el widget:** mantener pulsado un hueco de la pantalla de inicio → **Widgets** → "Orion Business" → arrastrar.
- **Otros launchers:** instalar Nova o Lawnchair (Play Store o `adb install`) y elegirlo en Ajustes → Apps → Apps predeterminadas → App de inicio. **Ningún emulador reproduce One UI de Samsung**: para eso, un Galaxy real o Samsung Remote Test Lab ⚠️.
- **Diseñar sin emulador:** `react-native-android-widget` trae `WidgetPreview` para dibujar el widget dentro de la app ⚠️.

```bash
cd apps/business-mobile
npx expo install react-native-android-widget expo-dev-client
npx expo prebuild --clean -p android
npx expo run:android            # compila e instala en el emulador abierto
```

El emulador **no** ve `localhost` del equipo como propio. Para la API usen `EXPO_PUBLIC_API_URL=http://10.0.2.2:3000` (alias del equipo anfitrión), o `adb reverse tcp:3000 tcp:3000` y dejen `localhost`.

Genymotion es una alternativa (licencia ~240–480 USD/año ⚠️). Con el emulador oficial gratis no compensa.

## 4. Sin Mac: opciones para iOS

| Opción | Para qué sirve | Coste aproximado |
|---|---|---|
| **Mac en la nube: Scaleway** (Mac mini M4 16 GB) | Xcode y Simulator completos por escritorio remoto | **0,22 €/h** (mínimo 24 h por licencia de Apple) o 149 €/mes |
| **MacStadium** (Mac mini M4) | Igual, dedicado | Desde 149 USD/mes |
| **MacinCloud** | Igual, compartido o dedicado | ~1 USD/h o ~25–125 USD/mes ⚠️ |
| **AWS EC2 Mac** (M1/M2) | Igual; incómodo para uso interactivo | 0,65–0,88 USD/h, mínimo 24 h |
| **EAS Build** (Expo) | Compila en la nube: `.app` para simulador o `.ipa` para iPhone. **No muestra la app** | Plan gratis con cola. Starter ~19 USD/mes ⚠️ |
| **Codemagic** | Compila en macOS M2/M4 | 500 min/mes gratis. Luego ~0,10 USD/min |
| **Appetize.io** | Simulador en el navegador con un `.app` de simulador. Útil para demos | Free ~30 min/mes. Planes desde ~59 USD/mes ⚠️. **No se confirmó que muestre widgets de inicio**: pruébenlo en el plan gratis antes de pagar |

El simulador por escritorio remoto funciona, pero **va lento**. Sirve para revisar, no para trabajar en él todo el día.

## 5. Dispositivos reales y distribución al equipo

```bash
npm i -g eas-cli && eas login
eas build:configure                                  # crea eas.json

# iPhone (cuenta de pago): registrar el teléfono y compilar el dev client
eas device:create
eas build --profile development --platform ios
# Android: APK de desarrollo (sin cuenta de pago)
eas build --profile development --platform android

npx expo start --dev-client                          # el dev client se conecta al bundler
```

`eas.json` sugerido:

```json
{
  "build": {
    "development": { "developmentClient": true, "distribution": "internal" },
    "ios-simulator": { "extends": "development", "ios": { "simulator": true } },
    "preview": { "distribution": "internal" },
    "production": {}
  }
}
```

- `eas build --profile ios-simulator --platform ios` produce un `.app` que se instala en cualquier Mac con Simulator. Sin cuenta de pago y sin compilar localmente. Expo Orbit lo instala con un clic.
- **TestFlight:** hasta 100 testers internos sin revisión de Apple: `eas build -p ios --profile production && eas submit -p ios`.
- **Google Play, prueba interna:** hasta 100 testers. La cuenta cuesta 25 USD una sola vez.

## 6. Recomendación por escenario

| Escenario | Configuración | Coste aproximado |
|---|---|---|
| **Ideal** | Mac mini M4 (24–32 GB) o MacBook Pro con Xcode 26.6 y Android Studio. Más un iPhone y un Android/Samsung reales, Apple Developer Program y EAS | Mac ~600–1.000 USD una vez ⚠️. 99 USD/año Apple. 25 USD Google Play. EAS 0–19 USD/mes |
| **Equipo con Windows/Linux** | Android local (emulador y teléfono). iOS con EAS Build, un Mac en la nube por horas para revisar widgets en el Simulator, y un iPhone real con TestFlight para la validación final | ~5–30 €/mes de Mac en la nube según uso. 99 USD/año Apple |
| **Mínimo** | Android local. iOS solo con EAS y TestFlight en un iPhone real (sin simulador) | 99 USD/año Apple. Ciclo lento en iOS |

### Flujo de trabajo recomendado

1. **Diseño:** pantalla *Negocio → Widgets* de la app (hoy), luego vistas previas de Xcode y `WidgetPreview` de Android.
2. **Integración:** `npx expo run:ios` y `npx expo run:android` en simulador y emulador.
3. **Validación:** development build en iPhone y Samsung reales (App Group firmado, One UI, Live Activities por push).
4. **Equipo piloto:** TestFlight y prueba interna de Google Play.

## 7. Qué decidir antes de W3

- [ ] ¿El equipo tiene un Mac con Apple Silicon? Si no: comprar uno o usar un Mac en la nube.
- [ ] Apple Developer Program y Google Play Console **a nombre de la organización** (D07), con App Group `group.labs.orion.business`.
- [ ] Teléfonos de prueba: un iPhone (iOS 17 o superior) y un Android (ideal Samsung con Android 14 o superior).
- [ ] Cuenta de Expo (EAS) del equipo.

## Fuentes

- Expo SDK 57: https://expo.dev/changelog/sdk-57
- `expo-widgets`: https://docs.expo.dev/versions/v57.0.0/sdk/widgets/ y https://expo.dev/blog/ios-widgets-and-live-activities-in-expo
- Widgets con `@bacons/apple-targets`: https://github.com/EvanBacon/expo-apple-targets y https://expo.dev/blog/how-to-implement-ios-widgets-in-expo-apps
- Requisitos de App Store: https://developer.apple.com/news/upcoming-requirements/ y https://expo.dev/blog/app-store-connect-minimum-sdk-26
- Vistas previas de widgets en Xcode: https://developer.apple.com/documentation/widgetkit/previewing-widgets-and-live-activities-in-xcode
- Build para simulador con EAS: https://docs.expo.dev/tutorial/eas/ios-development-build-for-simulators/
- Development builds: https://docs.expo.dev/develop/development-builds/create-a-build
- Infraestructura de EAS (imágenes de Xcode): https://docs.expo.dev/build-reference/infrastructure/
- `react-native-android-widget`: https://github.com/sAleksovski/react-native-android-widget
- Aceleración del Android Emulator: https://developer.android.com/studio/run/emulator-acceleration
- targetSdk de Google Play: https://developer.android.com/google/play/requirements/target-sdk
- Scaleway Apple silicon: https://scaleway.com/en/pricing/apple-silicon
- Codemagic: https://docs.codemagic.io/billing/pricing/
- Appetize: https://appetize.io/pricing y https://docs.appetize.io/platform/app-management/uploading-apps/ios
