import { Tabs } from 'expo-router/js-tabs';
import { useBusiness } from '@/lib/session';
import { TabBar } from '@/ui/TabBar';

/**
 * Pestañas por rol (sección 26). La profesión cambia la terminología; el rol, los permisos.
 * Marketing solo aparece si hay una función habilitada y permiso. Ocultar una pestaña no
 * protege datos: el servidor vuelve a autorizar cada operación.
 */
export default function TabsLayout() {
  const m = useBusiness();
  const isProfessional = m.role === 'PROFESSIONAL';
  const showMarketing = m.features.loyalty || m.features.campaigns;
  const showBusiness = m.permissions.includes('business.configure') || m.permissions.includes('catalog.manage');
  const customers = m.vocabulary.customerPlural;
  return (
    <Tabs screenOptions={{ headerShown: false }} tabBar={(props) => <TabBar {...(props as unknown as Parameters<typeof TabBar>[0])} />}>
      <Tabs.Screen name="index" options={{ title: 'Inicio' }} />
      <Tabs.Screen name="agenda" options={{ title: isProfessional ? 'Mi agenda' : 'Agenda' }} />
      <Tabs.Screen name="clientes" options={{ title: isProfessional ? `Mis ${customers.toLowerCase()}` : customers }} />
      <Tabs.Screen name="marketing" options={{ title: 'Marketing', href: showMarketing ? undefined : null }} />
      <Tabs.Screen name="negocio" options={{ title: 'Negocio', href: showBusiness ? undefined : null }} />
    </Tabs>
  );
}
