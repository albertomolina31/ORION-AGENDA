import type { CustomerSummary, Service } from '@orion/contracts';
import { useQuery } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { ArrowRight, Check, CircleCheck, Search, UserPlus } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { DateStrip, SlotGrid } from '@/features/SlotPicker';
import { endpoints } from '@/lib/endpoints';
import { fmt, localDate, noonOf } from '@/lib/format';
import { useIdempotentMutation } from '@/lib/mutations';
import { useCustomers, useHome, useProfessionals, useServices } from '@/lib/queries';
import { useBusiness } from '@/lib/session';
import { Avatar, Button, Card, Chip, colors, Divider, haptic, LinkButton, Note, radius, Screen, spacing, StackHeader, Text, useFeedback } from '@/ui';

type Step = 1 | 2 | 3 | 4;
const steps = ['Cliente', 'Servicio', 'Horario', 'Resumen'];

/** UI06 Nueva cita: cliente → servicio/profesional → horario → resumen. Éxito solo tras respuesta confirmada. */
export default function NewAppointment() {
  const params = useLocalSearchParams<{ date?: string; customerId?: string }>();
  const m = useBusiness();
  const home = useHome();
  const today = home.data?.date;
  const [step, setStep] = useState<Step>(params.customerId ? 2 : 1);
  const [customer, setCustomer] = useState<Pick<CustomerSummary, 'id' | 'name'> | null>(null);
  const [service, setService] = useState<Service | null>(null);
  const [proId, setProId] = useState<string | null>(m.role === 'PROFESSIONAL' ? m.professionalId : null);
  const [date, setDate] = useState<string | null>(params.date ?? null);
  const [startsAt, setStartsAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const feedback = useFeedback();

  const preset = useQuery({
    queryKey: ['customer', m.businessId, params.customerId],
    queryFn: () => endpoints.customer(m.businessId, params.customerId!),
    enabled: !!params.customerId,
  });
  useEffect(() => {
    if (preset.data && !customer) setCustomer({ id: preset.data.id, name: preset.data.name });
  }, [preset.data, customer]);
  useEffect(() => {
    if (!date && today) setDate(today);
  }, [today, date]);

  const customers = useCustomers({ q: search.trim() || undefined, limit: 8, sort: 'NAME' });
  const services = useServices();
  const pros = useProfessionals();
  const availability = useQuery({
    queryKey: ['availability', m.businessId, service?.id, proId, date],
    queryFn: () => endpoints.availability(m.businessId, { serviceId: service!.id, professionalId: proId ?? undefined, date: date! }),
    enabled: step === 3 && !!service && !!date,
  });

  const create = useIdempotentMutation(
    (_: void, requestId) =>
      endpoints.createAppointment(m.businessId, { requestId, customerId: customer!.id, serviceId: service!.id, professionalId: proId, startsAt: startsAt! }),
    [['agenda', m.businessId], ['home', m.businessId], ['customers', m.businessId]],
  );

  const enabledPros = (pros.data ?? []).filter((p) => p.active && service?.professionalIds.includes(p.id));
  const slot = availability.data?.slots.find((s) => s.startsAt === startsAt);

  const confirm = () => {
    setError(null);
    create.mutate(undefined, {
      onSuccess: (appt) => {
        feedback.toast(`Cita agendada para ${appt.customer.name}`);
        router.replace(`/cita/${appt.id}`);
      },
      onError: (err) => {
        if (err.code === 'SLOT_UNAVAILABLE') {
          setError('Ese horario ya no está disponible. Elige otro: actualizamos las opciones.');
          setStartsAt(null);
          create.resetKey();
          setStep(3);
          void availability.refetch();
        } else if (err.uncertain) {
          setError('No sabemos si la cita se guardó. Toca “Confirmar cita” de nuevo: no se duplicará.');
        } else {
          setError(err.message);
        }
      },
    });
  };

  return (
    <Screen
      header={<StackHeader title="Nueva cita" subtitle={m.businessName} />}
      footer={
        step === 2 ? (
          <Button label="Elegir horario" trailingIcon={ArrowRight} disabled={!service} onPress={() => setStep(3)} />
        ) : step === 3 ? (
          <Button label="Revisar resumen" trailingIcon={ArrowRight} disabled={!startsAt} onPress={() => setStep(4)} />
        ) : step === 4 ? (
          <Button label="Confirmar cita" icon={Check} loading={create.isPending} onPress={confirm} />
        ) : undefined
      }
    >
      <Stepper step={step} onStep={(s) => s < step && setStep(s)} />
      {error ? <Note tone="warning" body={error} /> : null}

      {step === 1 ? (
        <View style={{ gap: spacing.md }}>
          <Text variant="heading">¿Para quién es la cita?</Text>
          <View style={styles.search}>
            <Search size={22} color={colors.textMuted} />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Buscar por nombre o teléfono"
              placeholderTextColor={colors.textSubtle}
              style={{ flex: 1, fontSize: 16, color: colors.text, paddingVertical: spacing.md }}
              accessibilityLabel="Buscar cliente"
              autoFocus
            />
          </View>
          <Card padded={false}>
            {(customers.data?.items ?? []).map((c, i) => (
              <Pressable
                key={c.id}
                onPress={() => {
                  setCustomer({ id: c.id, name: c.name });
                  setStep(2);
                }}
                accessibilityRole="button"
                style={[styles.option, i > 0 && styles.divider]}
              >
                <Avatar initials={c.initials} seed={c.name} size={44} />
                <View style={{ flex: 1 }}>
                  <Text variant="subheading">{c.name}</Text>
                  <Text variant="caption" color={colors.textMuted}>
                    {c.phoneMasked ?? 'Sin teléfono'} · {c.completedVisits} visitas
                  </Text>
                </View>
              </Pressable>
            ))}
            {customers.data?.items.length === 0 ? (
              <Text variant="body" color={colors.textMuted} style={{ padding: spacing.lg }}>
                Sin resultados.
              </Text>
            ) : null}
          </Card>
          {m.permissions.includes('customers.manage') ? <Button label="Crear cliente nuevo" icon={UserPlus} variant="outline" onPress={() => router.push('/cliente/nuevo')} /> : null}
        </View>
      ) : null}

      {step === 2 ? (
        <View style={{ gap: spacing.lg }}>
          <Text variant="heading">Servicio y profesional</Text>
          <Text variant="body" color={colors.textMuted}>
            Para {customer?.name}
          </Text>
          <View style={{ gap: spacing.sm }}>
            {(services.data ?? [])
              .filter((s) => s.active && s.professionalIds.length > 0)
              .map((s) => (
                <Pressable
                  key={s.id}
                  onPress={() => {
                    haptic.select();
                    setService(s);
                    setStartsAt(null);
                    if (proId && !s.professionalIds.includes(proId) && m.role !== 'PROFESSIONAL') setProId(null);
                  }}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: service?.id === s.id }}
                  style={[styles.serviceRow, service?.id === s.id && styles.serviceActive]}
                >
                  <View style={{ flex: 1 }}>
                    <Text variant="subheading">{s.name}</Text>
                    <Text variant="caption" color={colors.textMuted}>
                      {s.durationMin} min · {fmt.money(s.price)}
                    </Text>
                  </View>
                  {service?.id === s.id ? <CircleCheck size={24} color={colors.primary} /> : null}
                </Pressable>
              ))}
          </View>
          {service && m.role !== 'PROFESSIONAL' ? (
            <View style={{ gap: spacing.sm }}>
              <Text variant="heading">Profesional</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
                <Chip label="Cualquiera disponible" selected={proId === null} onPress={() => setProId(null)} />
                {enabledPros.map((p) => (
                  <Chip
                    key={p.id}
                    label={p.name}
                    selected={proId === p.id}
                    onPress={() => setProId(p.id)}
                    leading={<Avatar initials={p.initials} colorKey={p.colorKey} size={28} />}
                  />
                ))}
              </View>
            </View>
          ) : null}
        </View>
      ) : null}

      {step === 3 && date ? (
        <View style={{ gap: spacing.lg }}>
          <Text variant="heading">Elige el horario</Text>
          <Text variant="body" color={colors.textMuted}>
            {service?.name} · {service?.durationMin} min · {proId ? enabledPros.find((p) => p.id === proId)?.name : 'Cualquiera disponible'}
          </Text>
          <DateStrip
            start={today ?? date}
            value={date}
            onChange={(d) => {
              setDate(d);
              setStartsAt(null);
            }}
          />
          <Text variant="heading">{fmt.longDay(noonOf(date), 'UTC')}</Text>
          <SlotGrid
            data={availability.data}
            loading={availability.isLoading}
            error={availability.error}
            onRetry={() => availability.refetch()}
            value={startsAt}
            onChange={setStartsAt}
          />
        </View>
      ) : null}

      {step === 4 && customer && service && startsAt ? (
        <View style={{ gap: spacing.lg }}>
          <Text variant="heading">Revisa la cita</Text>
          <Card tone="accent">
            <SummaryRow label="Cliente" value={customer.name} />
            <Divider />
            <SummaryRow label="Servicio" value={`${service.name} · ${service.durationMin} min`} />
            <Divider />
            <SummaryRow
              label="Profesional"
              value={
                proId
                  ? (enabledPros.find((p) => p.id === proId)?.name ?? '')
                  : `Se asignará al confirmar${slot ? ` (${slot.professionalIds.length} disponibles)` : ''}`
              }
            />
            <Divider />
            <SummaryRow label="Fecha" value={fmt.longDay(noonOf(localDate(startsAt, m.timezone)), 'UTC')} />
            <Divider />
            <SummaryRow label="Hora" value={`${fmt.time(startsAt, m.timezone)} (hora del negocio)`} />
            <Divider />
            <SummaryRow label="Precio" value={fmt.money(service.price)} />
          </Card>
          <Note body="El servidor vuelve a validar la disponibilidad al confirmar. Si alguien tomó el horario, te pediremos elegir otro." />
          <LinkButton label="Cambiar horario" onPress={() => setStep(3)} chevron={false} />
        </View>
      ) : null}
    </Screen>
  );
}

function Stepper({ step, onStep }: { step: Step; onStep: (s: Step) => void }) {
  return (
    <View style={styles.stepper} accessibilityLabel={`Paso ${step} de 4`}>
      {steps.map((label, i) => {
        const n = (i + 1) as Step;
        const done = n < step;
        const active = n === step;
        return (
          <Pressable key={label} onPress={() => onStep(n)} disabled={!done} style={{ alignItems: 'center', flex: 1, gap: 4 }} accessibilityRole="button">
            <View style={[styles.stepDot, (done || active) && { backgroundColor: colors.primary, borderColor: colors.primary }]}>
              {done ? <Check size={18} color={colors.textOnPrimary} /> : <Text variant="bodyStrong" color={active ? colors.textOnPrimary : colors.primary}>{n}</Text>}
            </View>
            <Text variant="caption" color={active ? colors.primary : colors.textMuted}>
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flexDirection: 'row', gap: spacing.md, paddingVertical: spacing.md }}>
      <Text variant="body" color={colors.textMuted} style={{ width: 100 }}>
        {label}
      </Text>
      <Text variant="bodyStrong" style={{ flex: 1 }}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  search: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  option: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, minHeight: 64 },
  divider: { borderTopWidth: 1, borderTopColor: colors.border },
  serviceRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.md, paddingHorizontal: spacing.lg, borderRadius: radius.lg, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.surface },
  serviceActive: { borderColor: colors.primary, backgroundColor: colors.surfaceMuted },
  stepper: { flexDirection: 'row', alignItems: 'flex-start' },
  stepDot: { width: 32, height: 32, borderRadius: 16, borderWidth: 2, borderColor: colors.primaryBorder, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface },
});
