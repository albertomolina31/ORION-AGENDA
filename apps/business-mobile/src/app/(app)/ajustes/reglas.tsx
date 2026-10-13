import { View } from 'react-native';
import { useProfile } from '@/lib/queries';
import { useBusiness } from '@/lib/session';
import { Card, colors, Divider, ErrorState, Note, Screen, SkeletonList, spacing, StackHeader, Text } from '@/ui';

/** UI15 Perfil y reglas de reserva (lectura). Valores propuestos de la sección 24, no aprobados. */
export default function Rules() {
  const m = useBusiness();
  const q = useProfile();
  const p = q.data;
  const rows: Array<[string, string]> = p
    ? [
        ['Zona horaria', p.timezone],
        ['Moneda', p.currency],
        ['Confirmación de solicitudes externas', p.policy.confirmationMode === 'MANUAL' ? 'Manual (requiere aprobación)' : 'Automática'],
        ['Plazo para aprobar', `${p.policy.approvalWindowMin} min`],
        ['Intervalo de opciones', `${p.policy.slotGranularityMin} min`],
        ['Anticipación mínima', `${p.policy.minLeadMin / 60} h`],
        ['Horizonte máximo', `${p.policy.maxHorizonDays} días`],
        ['Cancelación del cliente', `Hasta ${p.policy.customerCancelUntilMin / 60} h antes`],
        ['Reprogramación del cliente', `Hasta ${p.policy.customerRescheduleUntilMin / 60} h antes`],
        ['Margen para “No asistió”', `${p.policy.noShowGraceMin} min después del inicio`],
        ['Versión de política', `v${p.policy.version}`],
      ]
    : [];
  return (
    <Screen header={<StackHeader title="Reglas de reserva" subtitle={m.businessName} />}>
      <Note tone="warning" title="Parámetros propuestos" body="Valores de partida para revisión (sección 24). Cambiar una política no modifica citas existentes." />
      {q.isLoading ? <SkeletonList rows={3} /> : null}
      {q.error ? <ErrorState error={q.error} onRetry={() => q.refetch()} /> : null}
      {p ? (
        <Card>
          {rows.map(([k, v], i) => (
            <View key={k}>
              {i > 0 ? <Divider /> : null}
              <View style={{ flexDirection: 'row', paddingVertical: spacing.md, gap: spacing.md }}>
                <Text variant="body" color={colors.textMuted} style={{ flex: 1 }}>
                  {k}
                </Text>
                <Text variant="bodyStrong" style={{ flexShrink: 1, textAlign: 'right' }}>
                  {v}
                </Text>
              </View>
            </View>
          ))}
        </Card>
      ) : null}
    </Screen>
  );
}
