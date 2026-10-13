import { router } from 'expo-router';
import { ArrowLeftRight, LayoutGrid, LogOut } from 'lucide-react-native';
import { View } from 'react-native';
import { useSession } from '@/lib/session';
import { Avatar, Button, Card, colors, Note, Screen, spacing, StackHeader, Text } from '@/ui';

/** UI19 Cuenta: sesión y cierre de sesión (limpia credenciales y caché privada). */
export default function Account() {
  const { me, membership, signOut } = useSession();
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
