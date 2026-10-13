import { router } from 'expo-router';
import { ArrowLeftRight, LayoutGrid, LogOut, Moon, Smartphone, Sun } from 'lucide-react-native';
import { useAppearance, type AppearancePreference } from '@/lib/appearance';
import { View } from 'react-native';
import { useSession } from '@/lib/session';
import { Avatar, Button, Card, colors, Note, Screen, SegmentedControl, spacing, StackHeader, Text } from '@/ui';

/** UI19 Cuenta: sesión y cierre de sesión (limpia credenciales y caché privada). */
export default function Account() {
  const { me, membership, signOut } = useSession();
  const appearance = useAppearance();
  return (
    <Screen header={<StackHeader title="Tu cuenta" />}>
      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.lg }}>
          <Avatar initials={me?.user.name.charAt(0) ?? '?'} colorKey="lavender" size={48} />
          <View style={{ flex: 1 }}>
            <Text variant="heading">{me?.user.name}</Text>
            <Text variant="body" color={colors.textMuted}>
              {me?.user.email}
            </Text>
            <Text variant="caption" color={colors.textMuted}>
              {membership?.roleLabel} · {membership?.businessName}
            </Text>
          </View>
        </View>
      </Card>
      <Card>
        <Text variant="subheading">Apariencia</Text>
        <Text variant="caption" color={colors.textMuted} style={{ marginBottom: spacing.md }}>
          {appearance.preference === 'system' ? `Sigue al teléfono (ahora ${appearance.scheme === 'dark' ? 'oscuro' : 'claro'}).` : 'Solo en este teléfono.'}
        </Text>
        <SegmentedControl<AppearancePreference>
          options={[
            { value: 'system', label: 'Automático', icon: Smartphone },
            { value: 'light', label: 'Claro', icon: Sun },
            { value: 'dark', label: 'Oscuro', icon: Moon },
          ]}
          value={appearance.preference}
          onChange={appearance.setPreference}
        />
      </Card>
      <Note tone="warning" title="Sesión simulada" body="La autenticación real (contraseña, recuperación, biometría opcional) se definirá antes del piloto." />
      <Button label="Widgets de inicio" icon={LayoutGrid} variant="outline" onPress={() => router.push('/widgets')} />
      {me && me.memberships.length > 1 ? <Button label="Cambiar de negocio" icon={ArrowLeftRight} variant="outline" onPress={() => router.push('/negocios')} /> : null}
      <Button
        label="Cerrar sesión"
        icon={LogOut}
        variant="destructive"
        onPress={async () => {
          await signOut();
          router.replace('/login');
        }}
      />
    </Screen>
  );
}
