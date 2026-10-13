import { ChevronRight, type LucideIcon } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Switch, TextInput, type TextInputProps, View } from 'react-native';
import { Text } from './Text';
import { colors, radius, spacing, touchTarget } from './theme';

/** Icono dentro de un círculo/cuadro suave, como en los mockups. */
export function IconCircle({
  icon: Icon,
  size = 48,
  tone = 'primary',
  square,
}: {
  icon: LucideIcon;
  size?: number;
  tone?: 'primary' | 'warning' | 'success' | 'whatsapp' | 'neutral';
  square?: boolean;
}) {
  const t = {
    primary: { bg: colors.primarySoft, fg: colors.primary },
    warning: { bg: '#FCE7C2', fg: '#C77A0A' },
    success: { bg: colors.successSoft, fg: colors.success },
    whatsapp: { bg: colors.whatsappSoft, fg: colors.whatsapp },
    neutral: { bg: colors.neutralSoft, fg: colors.neutral },
  }[tone];
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: square ? radius.md : size / 2,
        backgroundColor: t.bg,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Icon size={size * 0.48} color={t.fg} strokeWidth={2} />
    </View>
  );
}

export function SectionHeader({
  title,
  actionLabel,
  onAction,
  trailing,
}: {
  title: string;
  actionLabel?: string;
  onAction?: () => void;
  trailing?: ReactNode;
}) {
  return (
    <View style={styles.sectionHeader}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexShrink: 1 }}>
        <Text variant="title" accessibilityRole="header" numberOfLines={2} style={{ flexShrink: 1 }}>
          {title}
        </Text>
        {trailing}
      </View>
      {actionLabel && onAction ? <LinkButton label={actionLabel} onPress={onAction} /> : null}
    </View>
  );
}

export function LinkButton({ label, onPress, chevron = true }: { label: string; onPress: () => void; chevron?: boolean }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="link" hitSlop={10} style={styles.link}>
      <Text variant="bodyStrong" color={colors.primary}>
        {label}
      </Text>
      {chevron ? <ChevronRight size={18} color={colors.primary} /> : null}
    </Pressable>
  );
}

export function Chip({
  label,
  selected,
  onPress,
  leading,
  dark,
}: {
  label: string;
  selected?: boolean;
  onPress: () => void;
  leading?: ReactNode;
  /** Variante azul noche usada en "Todos" de la agenda. */
  dark?: boolean;
}) {
  const bg = selected ? (dark ? colors.night : colors.primary) : colors.surface;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected }}
      style={[styles.chip, { backgroundColor: bg, borderColor: selected ? bg : colors.border }]}
    >
      {leading}
      <Text variant="bodyStrong" color={selected ? colors.textOnPrimary : colors.text} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
}: {
  options: Array<{ value: T; label: string; icon?: LucideIcon }>;
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <View style={styles.segmented} accessibilityRole="tablist">
      {options.map((o) => {
        const active = o.value === value;
        const Icon = o.icon;
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            style={[styles.segment, active && styles.segmentActive]}
          >
            {Icon ? <Icon size={22} color={active ? colors.textOnPrimary : colors.primary} /> : null}
            <Text variant="subheading" color={active ? colors.textOnPrimary : colors.primary}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Fila de lista con icono, título, descripción y accesorio (Negocio, ajustes). */
export function ListRow({
  icon,
  iconTone,
  title,
  subtitle,
  onPress,
  accessory,
  last,
}: {
  icon?: LucideIcon;
  iconTone?: Parameters<typeof IconCircle>[0]['tone'];
  title: string;
  subtitle?: string;
  onPress?: () => void;
  accessory?: ReactNode;
  last?: boolean;
}) {
  const content = (
    <View style={[styles.row, !last && styles.rowDivider]}>
      {icon ? <IconCircle icon={icon} tone={iconTone} square size={52} /> : null}
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="subheading">{title}</Text>
        {subtitle ? (
          <Text variant="caption" color={colors.textMuted}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {accessory}
      {onPress ? <ChevronRight size={22} color={colors.text} /> : null}
    </View>
  );
  if (!onPress) return content;
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => pressed && { opacity: 0.7 }}>
      {content}
    </Pressable>
  );
}

/** Nota informativa (lavanda) o de advertencia (dorado suave). */
export function Note({
  icon: Icon,
  title,
  body,
  tone = 'info',
}: {
  icon?: LucideIcon;
  title?: string;
  body?: string;
  tone?: 'info' | 'warning';
}) {
  const bg = tone === 'info' ? colors.primarySoft : colors.accentSoft;
  const border = tone === 'info' ? colors.primarySoft : colors.accentBorder;
  const fg = tone === 'info' ? colors.primary : '#C77A0A';
  return (
    <View style={[styles.note, { backgroundColor: bg, borderColor: border }]} accessibilityRole="text">
      {Icon ? <Icon size={22} color={fg} /> : null}
      <View style={{ flex: 1, gap: 2 }}>
        {title ? <Text variant="bodyStrong">{title}</Text> : null}
        {body ? (
          <Text variant="caption" color={tone === 'warning' ? colors.accentInk : colors.textMuted}>
            {body}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

export function Field({
  label,
  error,
  hint,
  ...input
}: TextInputProps & { label: string; error?: string; hint?: string }) {
  return (
    <View style={{ gap: spacing.xs }}>
      <View style={[styles.field, error ? { borderColor: colors.danger } : null]}>
        <Text variant="caption" color={colors.textMuted}>
          {label}
        </Text>
        <TextInput
          {...input}
          accessibilityLabel={label}
          placeholderTextColor={colors.textSubtle}
          style={styles.input}
          maxFontSizeMultiplier={1.6}
        />
      </View>
      {error ? (
        <Text variant="caption" color={colors.danger} accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : hint ? (
        <Text variant="caption" color={colors.textMuted}>
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

export function Toggle({ label, description, value, onChange }: { label: string; description?: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <View style={styles.toggle}>
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="bodyStrong">{label}</Text>
        {description ? (
          <Text variant="caption" color={colors.textMuted}>
            {description}
          </Text>
        ) : null}
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        accessibilityLabel={label}
        trackColor={{ true: colors.primary, false: colors.border }}
        thumbColor={colors.surface}
      />
    </View>
  );
}

export function RadioCard({
  title,
  description,
  selected,
  onPress,
  icon: Icon,
}: {
  title: string;
  description?: string;
  selected: boolean;
  onPress: () => void;
  icon?: LucideIcon;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      style={[styles.radioCard, selected && { borderColor: colors.primary, backgroundColor: colors.surfaceMuted }]}
    >
      <View style={[styles.radio, selected && { borderColor: colors.primary }]}>{selected ? <View style={styles.radioDot} /> : null}</View>
      {Icon ? (
        <View style={styles.radioIcon}>
          <Icon size={28} color={colors.primary} />
        </View>
      ) : null}
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="subheading">{title}</Text>
        {description ? (
          <Text variant="caption" color={colors.textMuted}>
            {description}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

export function Divider() {
  return <View style={{ height: 1, backgroundColor: colors.border }} />;
}

const styles = StyleSheet.create({
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  link: { flexDirection: 'row', alignItems: 'center', gap: 2, minHeight: touchTarget - 8 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: touchTarget,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  segmented: {
    flexDirection: 'row',
    backgroundColor: colors.primarySoft,
    borderRadius: radius.lg,
    padding: 4,
    gap: 4,
  },
  segment: {
    flex: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    minHeight: touchTarget,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
  },
  segmentActive: { backgroundColor: colors.primary },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg, paddingVertical: spacing.md, minHeight: 72 },
  rowDivider: { borderBottomWidth: 1, borderBottomColor: colors.border },
  note: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.lg, borderRadius: radius.lg, borderWidth: 1 },
  field: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: 2,
  },
  input: { fontSize: 18, color: colors.text, paddingVertical: 4, minHeight: 32 },
  toggle: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: touchTarget },
  radioCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  radio: { width: 26, height: 26, borderRadius: 13, borderWidth: 2, borderColor: colors.textSubtle, alignItems: 'center', justifyContent: 'center' },
  radioDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: colors.primary },
  radioIcon: { width: 64, height: 64, borderRadius: radius.md, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
});
