import type { ScheduleConflict } from '@orion/contracts';
import { SaveProfessionalRequest } from '@orion/contracts';
import { professionalColors } from '@orion/design-tokens';
import { useQuery } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { Check, UserCheck, UserX } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { ConflictList } from '@/features/ConflictList';
import { endpoints } from '@/lib/endpoints';
import { useIdempotentMutation } from '@/lib/mutations';
import { useProfessionals, useServices } from '@/lib/queries';
import { useBusiness } from '@/lib/session';
import { useRefreshOnFocus } from '@/lib/use-refresh-on-focus';
import { Avatar, Button, Chip, colors, Field, LoadingState, Note, Screen, spacing, StackHeader, Text, useFeedback } from '@/ui';

/**
 * Crear o editar un profesional. Desactivar exige resolver antes sus citas futuras:
 * no se trasladan automáticamente a otra persona (L03).
 */
export default function ProfessionalEditor() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const isNew = id === 'nuevo';
  const m = useBusiness();
  const pros = useProfessionals();
  const services = useServices();
  const feedback = useFeedback();
  const existing = pros.data?.find((p) => p.id === id);
  const [name, setName] = useState('');
  const [colorKey, setColorKey] = useState<string>('sky');
  const [serviceIds, setServiceIds] = useState<string[]>([]);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [loaded, setLoaded] = useState(isNew);
  const [blocking, setBlocking] = useState<ScheduleConflict[] | null>(null);
  const future = useQuery({
    queryKey: ['future', m.businessId, id],
    queryFn: () => endpoints.futureAppointments(m.businessId, id),
    enabled: !isNew && blocking !== null,
  });

  useRefreshOnFocus(() => (blocking !== null ? future.refetch() : undefined));
  useEffect(() => {
    if (existing && !loaded) {
      setName(existing.name);
      setColorKey(existing.colorKey);
      setServiceIds(existing.serviceIds);
      setLoaded(true);
    }
  }, [existing, loaded]);
  useEffect(() => {
    if (future.data && blocking !== null) setBlocking(future.data);
  }, [future.data]); // eslint-disable-line react-hooks/exhaustive-deps

  const save = useIdempotentMutation(
    (body: Omit<SaveProfessionalRequest, 'requestId'>, requestId) => endpoints.saveProfessional(m.businessId, isNew ? null : id, { ...body, requestId }),
    [['professionals', m.businessId], ['services', m.businessId]],
  );
  const status = useIdempotentMutation(
    (active: boolean, requestId) => endpoints.setProfessionalActive(m.businessId, id, active, requestId),
    [['professionals', m.businessId], ['agenda', m.businessId]],
  );

  if (!loaded) return <LoadingState />;

  const submit = () => {
    const body = { name, colorKey, serviceIds };
    const local = SaveProfessionalRequest.safeParse({ ...body, requestId: 'local-validation' });
    if (!local.success) {
      const fe: Record<string, string[]> = {};
      local.error.issues.forEach((i) => (fe[String(i.path[0])] ??= []).push(i.message));
      setErrors(fe);
      return;
    }
    save.mutate(body, {
      onSuccess: () => {
        feedback.toast(isNew ? `${name} se unió al equipo` : 'Cambios guardados');
        if (router.canGoBack()) router.back();
        else router.replace('/');
      },
      onError: (e) => feedback.toast(e.message, 'error'),
    });
  };

  const toggleActive = async (active: boolean) => {
    if (!active) {
      const r = await feedback.confirm({
        title: `Desactivar a ${existing?.name}`,
        message: 'Dejará de recibir nuevas reservas. Su historial se conserva. Si tiene citas futuras, primero deberás reasignarlas o cancelarlas.',
        confirmLabel: 'Desactivar',
        destructive: true,
      });
      if (!r.confirmed) return;
    }
    status.mutate(active, {
      onSuccess: () => {
        setBlocking(null);
        feedback.toast(active ? 'Profesional reactivado' : 'Profesional desactivado');
      },
      onError: (e) => {
        status.resetKey();
        const conflicts = (e.details?.['conflicts'] as ScheduleConflict[] | undefined) ?? null;
        if (conflicts) setBlocking(conflicts);
        else feedback.toast(e.message, 'error');
      },
    });
  };

  return (
    <Screen
      header={<StackHeader title={isNew ? 'Nuevo profesional' : 'Editar profesional'} subtitle={m.businessName} />}
      footer={<Button requiresOnline label="Guardar" icon={Check} loading={save.isPending} onPress={submit} />}
      onRefresh={blocking ? () => future.refetch() : undefined}
      refreshing={future.isRefetching}
    >
      <View style={{ alignItems: 'center', gap: spacing.sm }}>
        <Avatar initials={(name || '?').split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()} colorKey={colorKey} size={72} />
        <View style={{ flexDirection: 'row', gap: spacing.sm }} accessibilityRole="radiogroup" accessibilityLabel="Color en la agenda">
          {professionalColors.map((c) => (
            <Pressable
              key={c.key}
              onPress={() => setColorKey(c.key)}
              accessibilityRole="radio"
              accessibilityState={{ checked: colorKey === c.key }}
              accessibilityLabel={c.key}
              style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: c.bar, borderWidth: 3, borderColor: colorKey === c.key ? colors.text : 'transparent' }}
            />
          ))}
        </View>
      </View>
      <Field label="Nombre" value={name} onChangeText={setName} error={errors.name?.[0]} autoCapitalize="words" maxLength={60} />
      <View style={{ gap: spacing.sm }}>
        <Text variant="subheading">Servicios que realiza</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
          {(services.data ?? [])
            .filter((s) => s.active)
            .map((s) => (
              <Chip key={s.id} label={s.name} selected={serviceIds.includes(s.id)} onPress={() => setServiceIds(serviceIds.includes(s.id) ? serviceIds.filter((x) => x !== s.id) : [...serviceIds, s.id])} />
            ))}
        </View>
        {isNew ? <Note body="Empieza con el horario general del negocio; ajústalo después en Horarios." /> : null}
      </View>

      {blocking && blocking.length > 0 ? <ConflictList conflicts={blocking} tz={m.timezone} title={`${blocking.length} citas futuras por resolver`} /> : null}
      {blocking && blocking.length === 0 ? <Note body="Ya no tiene citas futuras. Puedes desactivarlo." /> : null}

      {!isNew && existing && m.permissions.includes('team.manage') ? (
        existing.active ? (
          <Button requiresOnline label="Desactivar profesional" icon={UserX} variant="destructive" loading={status.isPending} onPress={() => toggleActive(false)} />
        ) : (
          <Button requiresOnline label="Reactivar profesional" icon={UserCheck} variant="outline" loading={status.isPending} onPress={() => toggleActive(true)} />
        )
      ) : null}
    </Screen>
  );
}
