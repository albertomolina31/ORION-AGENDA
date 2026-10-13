import { useBusiness } from '@/lib/session';
import { EmptyState, Note, Screen, StackHeader } from '@/ui';

/** UI18 Notificaciones. El registro push y los avisos llegan con P41. */
export default function Notifications() {
  const m = useBusiness();
  return (
    <Screen header={<StackHeader title="Notificaciones" subtitle={m.businessName} />}>
      <EmptyState title="Sin avisos por ahora" body="Aquí verás solicitudes nuevas, cambios y cancelaciones. Denegar notificaciones no impide usar la agenda." />
      <Note body="Por privacidad, los avisos en pantalla bloqueada no mostrarán nombres ni teléfonos de clientes." />
    </Screen>
  );
}
