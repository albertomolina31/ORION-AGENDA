import { SaveServiceRequest } from '@orion/contracts';
import { router, useLocalSearchParams } from 'expo-router';
import { Archive, ArchiveRestore, Check } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { NumberStepper } from '@/features/TimeStepper';
import { endpoints } from '@/lib/endpoints';
import { useIdempotentMutation } from '@/lib/mutations';
import { useProfessionals, useServices } from '@/lib/queries';
import { useBusiness } from '@/lib/session';
import { Avatar, Button, Card, Chip, colors, Divider, Field, LoadingState, Note, Screen, spacing, StackHeader, Text, useFeedback } from '@/ui';

/** Crear o editar un servicio. El precio se captura en pesos y viaja en centavos (sin flotantes). */
export default function ServiceEditor() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const isNew = id === 'nuevo';
  const m = useBusiness();
  const services = useServices();
  const pros = useProfessionals();
  const feedback = useFeedback();
  const existing = services.data?.find((s) => s.id === id);
  const [name, setName] = useState('');
  const [duration, setDuration] = useState(30);
  const [before, setBefore] = useState(0);
  const [after, setAfter] = useState(0);
  const [price, setPrice] = useState('');
  const [proIds, setProIds] = useState<string[]>([]);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [loaded, setLoaded] = useState(isNew);

  useEffect(() => {
    if (existing && !loaded) {
      setName(existing.name);
      setDuration(existing.durationMin);
      setBefore(existing.bufferBeforeMin);
      setAfter(existing.bufferAfterMin);
      setPrice(String(existing.price.amountMinor / 100));
      setProIds(existing.professionalIds);
      setLoaded(true);
    }
  }, [existing, loaded]);

  const save = useIdempotentMutation(
    (body: Omit<SaveServiceRequest, 'requestId'>, requestId) => endpoints.saveService(m.businessId, isNew ? null : id, { ...body, requestId }),
    [['services', m.businessId], ['professionals', m.businessId]],
  );

  if (!loaded) return <LoadingState />;

  const submit = (active: boolean) => {
    const body = {
      name,
      durationMin: duration,
      bufferBeforeMin: before,
      bufferAfterMin: after,
      priceMinor: Math.round(Number(price.replace(',', '.') || '0') * 100),
      professionalIds: proIds,
      active,
    };
    const local = SaveServiceRequest.safeParse({ ...body, requestId: 'local-validation' });
    if (!local.success || Number.isNaN(body.priceMinor)) {
      const fe: Record<string, string[]> = {};
      local.error?.issues.forEach((i) => (fe[String(i.path[0])] ??= []).push(i.message));
      if (Number.isNaN(body.priceMinor)) fe.priceMinor = ['Precio no válido'];
      setErrors(fe);
      return;
    }
    setErrors({});
    save.mutate(body, {
      onSuccess: () => {
        feedback.toast(isNew ? 'Servicio creado' : active ? 'Cambios guardados' : 'Servicio archivado');
        if (router.canGoBack()) router.back();
        else router.replace('/');
      },
      onError: (e) => {
        setErrors(e.fieldErrors ?? {});
        feedback.toast(e.message, 'error');
      },
    });
  };

  return (
    <Screen
      header={<StackHeader title={isNew ? 'Nuevo servicio' : 'Editar servicio'} subtitle={m.businessName} />}
      footer={<Button requiresOnline label="Guardar" icon={Check} loading={save.isPending} onPress={() => submit(existing?.active ?? true)} />}
    >
      <Field label="Nombre" value={name} onChangeText={setName} error={errors.name?.[0]} maxLength={60} />
      <Card>
        <Row label="Duración" hint="Tiempo de atención">
          <NumberStepper value={duration} onChange={setDuration} min={5} max={600} suffix="min" />
        </Row>
        <Divider />
        <Row label="Preparación antes" hint="Se reserva, no se cobra">
          <NumberStepper value={before} onChange={setBefore} max={120} suffix="min" />
        </Row>
        <Divider />
        <Row label="Preparación después" hint="Limpieza, secado…">
          <NumberStepper value={after} onChange={setAfter} max={120} suffix="min" />
        </Row>
      </Card>
      <Field
        label="Precio (MXN)"
        value={price}
        onChangeText={(t) => setPrice(t.replace(/[^0-9.,]/g, ''))}
        keyboardType="decimal-pad"
        error={errors.priceMinor?.[0]}
        hint={isNew ? undefined : 'Un precio nuevo aplica solo a nuevas reservas.'}
      />
      <View style={{ gap: spacing.sm }}>
        <Text variant="subheading">¿Quién lo realiza?</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
          {(pros.data ?? [])
            .filter((p) => p.active)
            .map((p) => (
              <Chip
                key={p.id}
                label={p.name}
                selected={proIds.includes(p.id)}
                onPress={() => setProIds(proIds.includes(p.id) ? proIds.filter((x) => x !== p.id) : [...proIds, p.id])}
                leading={<Avatar initials={p.initials} colorKey={p.colorKey} size={22} />}
              />
            ))}
        </View>
        {proIds.length === 0 ? <Note tone="warning" body="Sin profesionales asignados el servicio no aparece en la disponibilidad." /> : null}
      </View>
      {!isNew && existing ? (
        existing.active ? (
          <Button
            requiresOnline
            label="Archivar servicio"
            icon={Archive}
            variant="destructive"
            onPress={async () => {
              const r = await feedback.confirm({
                title: 'Archivar servicio',
                message: 'Dejará de ofrecerse en nuevas reservas. Las citas existentes y su historial no cambian.',
                confirmLabel: 'Archivar',
                destructive: true,
              });
              if (r.confirmed) submit(false);
            }}
          />
        ) : (
          <Button requiresOnline label="Reactivar servicio" icon={ArchiveRestore} variant="outline" onPress={() => submit(true)} />
        )
      ) : null}
      <Text variant="caption" color={colors.textMuted}>
        Editar un servicio nunca modifica citas ya reservadas: conservan duración y precio originales.
      </Text>
    </Screen>
  );
}

function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.sm }}>
      <View style={{ flex: 1 }}>
        <Text variant="bodyStrong">{label}</Text>
        {hint ? (
          <Text variant="caption" color={colors.textMuted}>
            {hint}
          </Text>
        ) : null}
      </View>
      {children}
    </View>
  );
}
