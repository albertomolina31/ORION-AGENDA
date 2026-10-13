import { CreateCustomerRequest } from '@orion/contracts';
import { router } from 'expo-router';
import { Check } from 'lucide-react-native';
import { useState } from 'react';
import { View } from 'react-native';
import { endpoints } from '@/lib/endpoints';
import { useIdempotentMutation } from '@/lib/mutations';
import { useBusiness } from '@/lib/session';
import { Button, Field, Note, Screen, spacing, StackHeader, Toggle, useFeedback } from '@/ui';

/** Alta de cliente. Validación local con el mismo esquema que el servidor (que vuelve a validar). */
export default function NewCustomer() {
  const m = useBusiness();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [note, setNote] = useState('');
  const [consent, setConsent] = useState(false);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [general, setGeneral] = useState<string | null>(null);
  const feedback = useFeedback();

  const create = useIdempotentMutation(
    (body: Omit<CreateCustomerRequest, 'requestId'>, requestId) => endpoints.createCustomer(m.businessId, { ...body, requestId }),
    [['customers', m.businessId]],
  );

  const submit = () => {
    const body = {
      name,
      phone: phone.trim() || undefined,
      email: email.trim() || undefined,
      note: note.trim() || undefined,
      promotionalConsent: consent,
    };
    const local = CreateCustomerRequest.safeParse({ ...body, requestId: 'local-validation' });
    if (!local.success) {
      const fe: Record<string, string[]> = {};
      local.error.issues.forEach((i) => (fe[String(i.path[0])] ??= []).push(i.message));
      setErrors(fe);
      return;
    }
    setErrors({});
    setGeneral(null);
    create.mutate(body, {
      onSuccess: (c) => {
        feedback.toast(`${c.name} se agregó a tus ${m.vocabulary.customerPlural.toLowerCase()}`);
        router.replace(`/cliente/${c.id}`);
      },
      onError: (err) => {
        setErrors(err.fieldErrors ?? {});
        setGeneral(err.uncertain ? 'No sabemos si se guardó. Intenta de nuevo: no se duplicará.' : err.message);
      },
    });
  };

  const singular = m.vocabulary.customerSingular.toLowerCase();
  return (
    <Screen header={<StackHeader title={`Nuevo ${singular}`} subtitle={m.businessName} />} footer={<Button label="Guardar" icon={Check} onPress={submit} loading={create.isPending} />}>
      <View style={{ gap: spacing.lg }}>
        <Field label="Nombre completo" value={name} onChangeText={setName} autoCapitalize="words" error={errors.name?.[0]} />
        <Field label="Teléfono (WhatsApp)" value={phone} onChangeText={setPhone} keyboardType="phone-pad" error={errors.phone?.[0]} hint="10 dígitos. Un teléfono puede compartirse entre personas." />
        <Field label="Correo (opcional)" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" error={errors.email?.[0]} />
        <Field label="Nota operativa (opcional)" value={note} onChangeText={setNote} error={errors.note?.[0]} hint="Solo información operativa. No registres datos clínicos." maxLength={140} />
        <Toggle label="Acepta promociones por WhatsApp" description="Tener su teléfono no equivale a consentimiento. Pregunta antes de activarlo." value={consent} onChange={setConsent} />
        {general ? <Note tone="warning" body={general} /> : null}
      </View>
    </Screen>
  );
}
