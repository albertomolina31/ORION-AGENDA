import { buildWidgetTimeline, type WidgetOriPose, type WidgetSnapshot, type WidgetViewModel } from '@orion/contracts';
import { Asset } from 'expo-asset';
import { File } from 'expo-file-system';
import { createWidget, widgetsDirectory } from 'expo-widgets';
import { AgendaDelDiaLayout, type IosWidgetProps, ProximaCitaLayout, ResumenSemanalLayout } from './ios-layouts';
import { SIGNED_OUT_VIEW_MODEL } from './signed-out';

/**
 * iOS (WidgetKit vía expo-widgets). Los nombres deben coincidir con `widgets[].name` del
 * plugin en app.json. La app entrega una timeline precalculada: la "Próxima cita" avanza
 * sola al terminar cada cita, sin red y sin abrir la app.
 */
const proximaCita = createWidget<IosWidgetProps>('ProximaCita', ProximaCitaLayout);
const agendaDelDia = createWidget<IosWidgetProps>('AgendaDelDia', AgendaDelDiaLayout);
const resumenSemanal = createWidget<IosWidgetProps>('ResumenSemanal', ResumenSemanalLayout);

const ORI_ASSETS: Record<WidgetOriPose | 'head', number> = {
  head: require('../../assets/ori/ori-head.png'),
  wave: require('../../assets/ori/ori-wave.png'),
  calendar: require('../../assets/ori/ori-calendar.png'),
  celebrate: require('../../assets/ori/ori-celebrate.png'),
  sleep: require('../../assets/ori/ori-sleep.png'),
};

const dir = widgetsDirectory.startsWith('file://') ? widgetsDirectory : `file://${widgetsDirectory}`;
let imagesReady: Promise<boolean> | null = null;

/** Copia las poses de Ori al directorio compartido con la extensión (una vez por instalación). */
function ensureOriImages(): Promise<boolean> {
  imagesReady ??= (async () => {
    try {
      for (const [pose, mod] of Object.entries(ORI_ASSETS)) {
        const target = new File(`${dir}/ori-${pose}.png`);
        if (target.exists) continue;
        const asset = await Asset.fromModule(mod).downloadAsync();
        if (asset.localUri) await new File(asset.localUri).copy(target);
      }
      return true;
    } catch {
      return false; // El widget se dibuja sin Ori si no se pudo copiar.
    }
  })();
  return imagesReady;
}

function withOri(vm: WidgetViewModel, pose: WidgetOriPose | 'head', ok: boolean): IosWidgetProps {
  return { ...vm, oriImage: ok ? `${dir}/ori-${pose}.png` : null };
}

export async function syncNativeWidgets(snapshot: WidgetSnapshot): Promise<void> {
  const ok = await ensureOriImages();
  const timeline = buildWidgetTimeline(snapshot, new Date());
  proximaCita.updateTimeline(timeline.map((e) => ({ date: e.date, props: withOri(e.props, 'head', ok) })));
  agendaDelDia.updateTimeline(timeline.map((e) => ({ date: e.date, props: withOri(e.props, e.props.oriPose, ok) })));
  resumenSemanal.updateTimeline(timeline.map((e) => ({ date: e.date, props: withOri(e.props, 'head', ok) })));
}

export async function clearNativeWidgets(): Promise<void> {
  const ok = await ensureOriImages();
  for (const w of [proximaCita, agendaDelDia, resumenSemanal]) w.updateSnapshot(withOri(SIGNED_OUT_VIEW_MODEL, 'sleep', ok));
}
