import { CUSTOMER_NOTE_VISIBILITY_LABELS, type CustomerDetail, type CustomerNoteVisibility } from '@orion/contracts';
import { Plus, Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { endpoints } from '@/lib/endpoints';
import { fmt } from '@/lib/format';
import { useIdempotentMutation } from '@/lib/mutations';
import { useBusiness } from '@/lib/session';
import { Badge, Button, Card, Chip, colors, Field, spacing, Text, useFeedback } from '@/ui';

/** Notas internas: "todo el equipo" o "solo dueño y administración". Nunca datos clínicos. */
export function CustomerNotes({ customer }: { customer: CustomerDetail }) {
  const m = useBusiness();
  const feedback = useFeedback();
  const canRestricted = m.permissions.includes('customers.notes_admin');
  const [body, setBody] = useState('');
  const [visibility, setVisibility] = useState<CustomerNoteVisibility>('TEAM');
  const [error, setError] = useState<string | null>(null);
  const invalidate = [['customer', m.businessId, customer.id]];
  const add = useIdempotentMutation(
    (_: void, requestId) => endpoints.addCustomerNote(m.businessId, customer.id, { requestId, body: body.trim(), visibility }),
    invalidate,
  );
  const remove = useIdempotentMutation((noteId: string, requestId) => endpoints.deleteCustomerNote(m.businessId, customer.id, noteId, { requestId }), invalidate);

  const submit = () => {
    if (body.trim().length < 2) {
      setError('Escribe la nota');
      return;
    }
    setError(null);
    add.mutate(undefined, {
      onSuccess: () => {
        setBody('');
        setVisibility('TEAM');
        feedback.toast('Nota agregada');
      },
      onError: (e) => setError(e.fieldErrors?.body?.[0] ?? e.message),
    });
  };

  const confirmDelete = async (noteId: string) => {
    const res = await feedback.confirm({ title: 'Borrar nota', message: 'La nota dejará de verse para todo el equipo.', confirmLabel: 'Borrar', destructive: true });
    if (!res.confirmed) return;
    remove.mutate(noteId, { onSuccess: () => feedback.toast('Nota borrada'), onError: (e) => feedback.toast(e.message, 'error') });
  };

  return (
    <View style={{ gap: spacing.sm }}>
      <Text variant="title">Notas internas</Text>
      <Card style={{ gap: spacing.md }}>
        {customer.notes.length === 0 ? (
          <Text variant="body" color={colors.textMuted}>
            Aún no hay notas. Úsalas para preferencias de atención, no para datos clínicos.
          </Text>
        ) : (
          customer.notes.map((n, i) => (
            <View key={n.id} style={{ gap: 4, paddingTop: i === 0 ? 0 : spacing.md, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: colors.border }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm }}>
                <Text variant="caption" color={colors.textMuted} style={{ flex: 1 }}>
                  {n.authorName} · {fmt.shortDay(n.createdAt, m.timezone)}
                </Text>
                {n.visibility === 'ADMINS' ? <Badge label="Solo administración" tone="warning" /> : null}
                {n.canDelete ? (
                  <Pressable onPress={() => void confirmDelete(n.id)} accessibilityRole="button" accessibilityLabel="Borrar nota" hitSlop={12}>
                    <Trash2 size={16} color={colors.textMuted} />
                  </Pressable>
                ) : null}
              </View>
              <Text variant="body">{n.body}</Text>
            </View>
          ))
        )}
      </Card>
      <Card style={{ gap: spacing.md }}>
        <Field label="Nueva nota" value={body} onChangeText={setBody} multiline maxLength={500} error={error ?? undefined} placeholder="Ej.: Prefiere que la atienda Ana por la tarde" />
        {canRestricted ? (
          <View style={{ gap: spacing.xs }}>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
              <Chip label={CUSTOMER_NOTE_VISIBILITY_LABELS.TEAM.title} selected={visibility === 'TEAM'} onPress={() => setVisibility('TEAM')} />
              <Chip label={CUSTOMER_NOTE_VISIBILITY_LABELS.ADMINS.title} selected={visibility === 'ADMINS'} onPress={() => setVisibility('ADMINS')} />
            </View>
            <Text variant="caption" color={colors.textMuted}>
              {CUSTOMER_NOTE_VISIBILITY_LABELS[visibility].description}
            </Text>
          </View>
        ) : (
          <Text variant="caption" color={colors.textMuted}>
            {CUSTOMER_NOTE_VISIBILITY_LABELS.TEAM.description}
          </Text>
        )}
        <Button label="Agregar nota" icon={Plus} variant="outline" requiresOnline loading={add.isPending} onPress={submit} />
      </Card>
    </View>
  );
}
