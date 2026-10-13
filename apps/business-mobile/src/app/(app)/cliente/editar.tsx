import { UpdateCustomerRequest } from '@orion/contracts';
import { router, useLocalSearchParams } from 'expo-router';
import { Check } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { endpoints } from '@/lib/endpoints';
import { useIdempotentMutation } from '@/lib/mutations';
import { useCustomer, useProfessionals } from '@/lib/queries';
import { useBusiness } from '@/lib/session';
import { Button, Chip, colors, ErrorState, Field, LoadingState, Note, Screen, SectionHeader, spacing, StackHeader, Text, useFeedback } from '@/ui';

/** Corregir datos del cliente (también sirve para atender una solicitud de rectificación). */
export default function EditCustomer() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const m = useBusiness();
  const q = useCustomer(id);
  const pros = useProfessionals();
  const feedback = useFeedback();
  const c = q.data;
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [note, setNote] = useState('');
  const [preferred, setPreferred] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [general, setGeneral] = useState<string | null>(null);

  useEffect(() => {
    if (!c) return;
    setName(c.name);
    setPhone(c.phone ?? '');
    setEmail(c.email ?? '');
    setNote(c.note ?? '');
    setPreferred(c.preferredProfessional?.id ?? null);
  }, [c]);

  const save = useIdempotentMutation(
    (body: Omit<UpdateCustomerRequest, 'requestId'>, requestId) => endpoints.updateCustomer(m.businessId, id, { ...body, requestId }),
    [['customer', m.businessId, id], ['customers', m.businessId]],
  );

  if (q.isLoading) return <LoadingState />;
  if (!c) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;

  const submit = () => {
    const body = { name, phone: phone.trim() || null, email: email.trim() || null, note: note.trim() || null, preferredProfessionalId: preferred };
    const local = UpdateCustomerRequest.safeParse({ ...body, requestId: 'local-validation' });
    if (!local.success) {
      const fe: Record<string, string[]> = {};
      local.error.issues.forEach((i) => (fe[String(i.path[0])] ??= []).push(i.message));
      setErrors(fe);
      return;
    }
    setErrors({});
    setGeneral(null);
    save.mutate(body, {
      onSuccess: (updated) => {
        feedback.toast('Ficha actualizada');
        if (updated.possibleDuplicates.length > 0) feedback.toast(`Revisa: posible duplicado de ${updated.possibleDuplicates[0]!.name}`);
        router.back();
      },
      onError: (e) => {
        setErrors(e.fieldErrors ?? {});
        setGeneral(e.uncertain ? 'No sabemos si se guardó. Intenta de nuevo: no se duplicará.' : e.message);
      },
    });
  };

  const singular = m.vocabulary.customerSingular.toLowerCase();
  return (
    <Screen header={<StackHeader title={`Editar ${singular}`} subtitle={c.name} />} footer={<Button requiresOnline label="Guardar cambios" icon={Check} onPress={submit} loading={save.isPending} />}>
      <View style={{ gap: spacing.lg }}>
        <Field label="Nombre completo" value={name} onChangeText={setName} autoCapitalize="words" error={errors.name?.[0]} />
        <Field label="Teléfono (WhatsApp)" value={phone} onChangeText={setPhone} keyboardType="phone-pad" error={errors.phone?.[0]} hint="Si cambias el teléfono, revisa que no exista otro registro con él." />
        <Field label="Correo" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" error={errors.email?.[0]} />
        <Field label="Nota operativa" value={note} onChangeText={setNote} maxLength={140} error={errors.note?.[0]} hint="Visible en la ficha. Sin datos clínicos; para algo más largo usa las notas internas." />
      </View>
      <SectionHeader title="Profesional preferido" />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
        <Chip label="Sin preferencia" selected={preferred === null} onPress={() => setPreferred(null)} />
        {(pros.data ?? [])
          .filter((p) => p.active)
          .map((p) => (
            <Chip key={p.id} label={p.name} selected={preferred === p.id} onPress={() => setPreferred(p.id)} />
          ))}
      </View>
      <Text variant="caption" color={colors.textMuted}>
        El permiso de promociones se cambia aparte, desde la ficha, con constancia.
      </Text>
      {general ? <Note tone="warning" body={general} /> : null}
    </Screen>
  );
}
