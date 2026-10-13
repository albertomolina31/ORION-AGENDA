import type { WidgetViewModel } from '@orion/contracts';

/** Lo que muestran los widgets sin sesión o tras cambiar de negocio: nada de datos anteriores. */
export const SIGNED_OUT_VIEW_MODEL: WidgetViewModel = {
  businessName: 'Orion Business',
  updatedLabel: 'Abre Orion para ver tu agenda',
  stale: true,
  hidden: true,
  oriPose: 'sleep',
  next: null,
  today: { title: 'Orion Business', rows: [], emptyMessage: 'Inicia sesión para ver tu día.', deepLink: 'orionbusiness://' },
  week: { rangeLabel: 'Tu semana', days: [] },
};
