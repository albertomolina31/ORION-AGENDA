import { CreatePrivacyRequest, PRIVACY_CHANNEL_LABELS, PRIVACY_REQUEST_TYPE_LABELS, PrivacyRequestChannel, PrivacyRequestType } from '@orion/contracts';
import { useQuery } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { Check, X } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { requestIcon } from '@/features/privacy';
import { endpoints } from '@/lib/endpoints';
import { useIdempotentMutation } from '@/lib/mutations';
import { useBusiness } from '@/lib/session';
import { Avatar, Button, Card, Chip, colors, Field, ListRow, Note, RadioCard, Screen, SectionHeader, spacing, StackHeader, Text, useFeedback } from '@/ui';

/** Registrar una solicitud de derechos: quién, qué pidió y por qué canal. */
export default function NewPrivacyRequest() {
  const m = useBusiness();
  const params = useLocalSearchParams<{ customerId?: string; type?: string }>();
  const feedback = useFeedback();
  const [customer, setCustomer] = useState<{ id: string; name: string } | null>(null);
  const [search, setSearch] = useState('');
  const initialType = PrivacyRequestType.safeParse(params.type);
  const [type, setType] = useState<PrivacyRequestType>(initialType.success ? initialType.data : 'ACCESS');
  const [channel, setChannel] = useState<PrivacyRequestChannel>('IN_PERSON');
  const [details, setDetails] = useState('');
  const [error, setError] = useState<string | null>(null);

  const preset = useQuery({
    queryKey: ['customer', m.businessId, params.customerId],
    queryFn: () => endpoints.customer(m.businessId, params.customerId!),
    enabled: !!params.customerId && !customer,
  });
  const chosen = customer ?? (preset.data ? { id: preset.data.id, name: preset.data.name } : null);
  const results = useQuery({
    queryKey: ['customers', m.businessId, { q: search, limit: 6 }],
    queryFn: () => endpoints.customers(m.businessId, { q: search, limit: 6 }),
    enabled: !chosen && search.trim().length >= 2,
  });

  const create = useIdempotentMutation(
    (body: Omit<CreatePrivacyRequest, 'requestId'>, requestId) => endpoints.createPrivacyRequest(m.businessId, { ...body, requestId }),
    [['privacy', m.businessId]],
  );

  const submit = () => {
    if (!chosen) {
      setError(`Elige al ${m.vocabulary.customerSingular.toLowerCase()} que hizo la solicitud.`);
      return;
    }
    setError(null);
    create.mutate(
      { customerId: chosen.id, type, channel, details: details.trim() || undefined },
      {
        onSuccess: (r) => {
          feedback.toast('Solicitud registrada');
          router.replace(`/privacidad/${r.id}`);
        },
        onError: (e) => setError(e.message),
      },
    );
  };

  return (
    <Screen
      header={<StackHeader title="Nueva solicitud" subtitle="Derechos sobre datos personales" />}
      footer={<Button requiresOnline label="Registrar solicitud" icon={Check} onPress={submit} loading={create.isPending} />}
    >
      <SectionHeader title={`1. ${m.vocabulary.customerSingular}`} />
      {chosen ? (
        <Card>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
            <Avatar initials={chosen.name.charAt(0)} size={40} colorKey="lavender" />
            <Text variant="bodyStrong" style={{ flex: 1 }}>
              {chosen.name}
            </Text>
            <Pressable
              onPress={() => {
                setCustomer(null);
                router.setParams({ customerId: '' });
              }}
              accessibilityRole="button"
              accessibilityLabel="Cambiar cliente"
              hitSlop={12}
            >
              <X size={20} color={colors.textMuted} />
            </Pressable>
          </View>
        </Card>
      ) : (
        <View style={{ gap: spacing.sm }}>
          <Field label="Buscar por nombre o teléfono" value={search} onChangeText={setSearch} autoCapitalize="words" />
          {results.data && results.data.items.length > 0 ? (
            <Card style={{ paddingVertical: 0 }}>
              {results.data.items.map((c, i) => (
                <ListRow key={c.id} title={c.name} subtitle={c.phoneMasked ?? undefined} onPress={() => setCustomer({ id: c.id, name: c.name })} last={i === results.data!.items.length - 1} />
              ))}
            </Card>
          ) : null}
        </View>
      )}

      <SectionHeader title="2. ¿Qué pidió?" />
      <View style={{ gap: spacing.sm }}>
        {PrivacyRequestType.options.map((t) => (
          <RadioCard key={t} icon={requestIcon[t]} title={PRIVACY_REQUEST_TYPE_LABELS[t].title} description={PRIVACY_REQUEST_TYPE_LABELS[t].description} selected={type === t} onPress={() => setType(t)} />
        ))}
      </View>

      <SectionHeader title="3. ¿Por qué medio?" />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
        {PrivacyRequestChannel.options.map((ch) => (
          <Chip key={ch} label={PRIVACY_CHANNEL_LABELS[ch]} selected={channel === ch} onPress={() => setChannel(ch)} />
        ))}
      </View>

      <Field label="Detalles (opcional)" value={details} onChangeText={setDetails} multiline maxLength={500} hint="Lo que dijo el cliente, sin datos clínicos ni sensibles." />
      {type === 'CANCELLATION' ? (
        <Note tone="warning" body="Antes de eliminar datos, verifica la identidad de quien lo pide. Las citas e importes se conservan sin identificar a la persona." />
      ) : null}
      {error ? <Note tone="warning" body={error} /> : null}
    </Screen>
  );
}
