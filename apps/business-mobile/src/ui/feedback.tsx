import { CircleAlert, CircleCheck } from 'lucide-react-native';
import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, TextInput, View, useWindowDimensions } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeInUp,
  FadeOut,
  FadeOutUp,
  ReduceMotion,
  SlideInDown,
  SlideOutDown,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
  ZoomIn,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from './Button';
import { haptic, useShake } from './motion';
import { Ori } from './Ori';
import { Text } from './Text';
import { colors, radius, shadow, spacing } from './theme';
import { themed } from './theme';

/**
 * Feedback global: toasts, hoja inferior de confirmación y celebración.
 * Las acciones destructivas siempre muestran su efecto antes de confirmar.
 */

type ToastTone = 'success' | 'error';
interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel: string;
  destructive?: boolean;
  /** Pide un motivo obligatorio (excepciones de política, auditoría). */
  requireReason?: boolean;
  reasonLabel?: string;
}
interface ConfirmResult {
  confirmed: boolean;
  reason?: string;
}
interface FeedbackValue {
  toast: (message: string, tone?: ToastTone) => void;
  celebrate: (title: string, body?: string) => void;
  confirm: (opts: ConfirmOptions) => Promise<ConfirmResult>;
}

const Ctx = createContext<FeedbackValue | null>(null);

export function FeedbackProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<{ id: number; message: string; tone: ToastTone } | null>(null);
  const [party, setParty] = useState<{ id: number; title: string; body?: string } | null>(null);
  const [sheet, setSheet] = useState<(ConfirmOptions & { resolve: (r: ConfirmResult) => void }) | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const value = useMemo<FeedbackValue>(
    () => ({
      toast: (message, tone = 'success') => {
        if (tone === 'success') haptic.success();
        else haptic.warning();
        if (timer.current) clearTimeout(timer.current);
        setToast({ id: Date.now(), message, tone });
        timer.current = setTimeout(() => setToast(null), 2600);
      },
      celebrate: (title, body) => {
        haptic.success();
        setParty({ id: Date.now(), title, body });
      },
      confirm: (opts) => new Promise<ConfirmResult>((resolve) => setSheet({ ...opts, resolve })),
    }),
    [],
  );

  return (
    <Ctx.Provider value={value}>
      {children}
      {toast ? <Toast key={toast.id} message={toast.message} tone={toast.tone} /> : null}
      {party ? <Celebration key={party.id} title={party.title} body={party.body} onDone={() => setParty(null)} /> : null}
      <ConfirmSheet
        options={sheet}
        onClose={(r) => {
          sheet?.resolve(r);
          setSheet(null);
        }}
      />
    </Ctx.Provider>
  );
}

export function useFeedback(): FeedbackValue {
  const v = useContext(Ctx);
  if (!v) throw new Error('useFeedback fuera de FeedbackProvider');
  return v;
}

function Toast({ message, tone }: { message: string; tone: ToastTone }) {
  const insets = useSafeAreaInsets();
  const Icon = tone === 'success' ? CircleCheck : CircleAlert;
  const { style: shakeStyle, shake } = useShake();
  useEffect(() => {
    if (tone === 'error') setTimeout(shake, 250);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <Animated.View style={[{ position: 'absolute', left: 0, right: 0, top: 0, zIndex: 1000 }, shakeStyle]} pointerEvents="none">
    <Animated.View
      entering={FadeInUp.springify().damping(16).reduceMotion(ReduceMotion.System)}
      exiting={FadeOutUp.duration(200)}
      style={[styles.toast, { top: insets.top + spacing.sm }]}
      accessibilityLiveRegion="polite"
      accessibilityRole="alert"
      pointerEvents="none"
    >
      <Animated.View entering={ZoomIn.delay(120).springify().damping(9).reduceMotion(ReduceMotion.System)}>
        <Icon size={20} color={tone === 'success' ? '#7FE0A6' : '#FFB4BE'} />
      </Animated.View>
      <Text variant="bodyStrong" color={colors.textOnNight} style={{ flexShrink: 1 }}>
        {message}
      </Text>
    </Animated.View>
    </Animated.View>
  );
}

const CONFETTI_COLORS = themed(() => [colors.accent, '#F7C35A', colors.primary, '#8C7BEA', '#7FE0A6']);

/** Pieza de confeti que sale disparada desde el centro y cae con gravedad. */
function ConfettiPiece({ i, cx, cy }: { i: number; cx: number; cy: number }) {
  const seed = (i * 9301 + 49297) % 233280;
  const rnd = (n: number) => ((seed * (n + 3)) % 997) / 997;
  const angle = (i / 36) * Math.PI * 2 + rnd(1) * 0.5;
  const speed = 160 + rnd(2) * 200;
  const spin = (rnd(3) > 0.5 ? 1 : -1) * (360 + rnd(4) * 540);
  const size = 6 + rnd(5) * 7;
  const round = rnd(6) > 0.6;
  const p = useSharedValue(0);
  useEffect(() => {
    p.value = withTiming(1, { duration: 1300 + rnd(7) * 500, easing: Easing.out(Easing.quad) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const style = useAnimatedStyle(() => {
    const t = p.value;
    return {
      opacity: t < 0.75 ? 1 : 1 - (t - 0.75) * 4,
      transform: [
        { translateX: cx + Math.cos(angle) * speed * t },
        { translateY: cy + Math.sin(angle) * speed * t + 420 * t * t },
        { rotate: `${spin * t}deg` },
        { scale: t < 0.1 ? t * 10 : 1 },
      ],
    };
  });
  return (
    <Animated.View
      style={[
        styles.confetti,
        { backgroundColor: CONFETTI_COLORS[i % CONFETTI_COLORS.length], width: size, height: round ? size : size * 1.6, borderRadius: round ? size / 2 : 2 },
        style,
      ]}
    />
  );
}

/** Celebración tipo Duolingo: Ori salta dos veces, confeti en explosión y título con rebote. */
function Celebration({ title, body, onDone }: { title: string; body?: string; onDone: () => void }) {
  const { width, height } = useWindowDimensions();
  const reduced = useReducedMotion();
  const [jumps, setJumps] = useState(0);
  useEffect(() => {
    const a = setTimeout(() => setJumps(1), 180);
    const b = setTimeout(() => setJumps(2), 720);
    const t = setTimeout(onDone, 2600);
    return () => [a, b, t].forEach(clearTimeout);
  }, [onDone]);
  return (
    <Animated.View entering={FadeIn.duration(150)} exiting={FadeOut.duration(250)} style={styles.partyBackdrop}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onDone} accessibilityLabel="Cerrar celebración" />
      <Animated.View entering={ZoomIn.springify().damping(11).reduceMotion(ReduceMotion.System)} style={styles.partyCard} accessibilityRole="alert">
        <Ori pose="celebrate" size={132} enter={false} float={false} interactive={false} jump={jumps || undefined} />
        <Animated.View entering={ZoomIn.delay(160).springify().damping(8).reduceMotion(ReduceMotion.System)}>
          <Text variant="title" align="center">
            {title}
          </Text>
        </Animated.View>
        {body ? (
          <Animated.View entering={FadeInUp.delay(260).duration(260).reduceMotion(ReduceMotion.System)}>
            <Text variant="body" color={colors.textMuted} align="center">
              {body}
            </Text>
          </Animated.View>
        ) : null}
      </Animated.View>
      {!reduced ? Array.from({ length: 36 }).map((_, i) => <ConfettiPiece key={i} i={i} cx={width / 2} cy={height / 2 - 80} />) : null}
    </Animated.View>
  );
}

function ConfirmSheet({ options, onClose }: { options: (ConfirmOptions & { resolve: unknown }) | null; onClose: (r: ConfirmResult) => void }) {
  const insets = useSafeAreaInsets();
  const [reason, setReason] = useState('');
  useEffect(() => setReason(''), [options]);
  const close = useCallback((r: ConfirmResult) => onClose(r), [onClose]);
  const needsReason = !!options?.requireReason;
  return (
    <Modal visible={!!options} transparent animationType="none" onRequestClose={() => close({ confirmed: false })} statusBarTranslucent>
      {options ? (
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, justifyContent: 'flex-end' }}>
          <Animated.View entering={FadeIn.duration(180)} style={[StyleSheet.absoluteFill, { backgroundColor: colors.overlay }]}>
            <Pressable style={StyleSheet.absoluteFill} onPress={() => close({ confirmed: false })} accessibilityLabel="Cerrar" />
          </Animated.View>
          <Animated.View
            entering={SlideInDown.springify().damping(18).reduceMotion(ReduceMotion.System)}
            exiting={SlideOutDown.duration(200)}
            style={[styles.sheet, { paddingBottom: insets.bottom + spacing.lg }]}
            accessibilityViewIsModal
          >
            <View style={styles.grabber} />
            <Text variant="title">{options.title}</Text>
            <Text variant="body" color={colors.textMuted}>
              {options.message}
            </Text>
            {needsReason ? (
              <View style={styles.reason}>
                <Text variant="caption" color={colors.textMuted}>
                  {options.reasonLabel ?? 'Motivo (obligatorio)'}
                </Text>
                <TextInput
                  value={reason}
                  onChangeText={setReason}
                  placeholder="Queda registrado en el historial"
                  placeholderTextColor={colors.textSubtle}
                  style={styles.reasonInput}
                  accessibilityLabel={options.reasonLabel ?? 'Motivo'}
                  autoFocus
                  maxLength={280}
                />
              </View>
            ) : null}
            <View style={{ gap: spacing.sm, marginTop: spacing.sm }}>
              <Button
                requiresOnline
                label={options.confirmLabel}
                variant={options.destructive ? 'destructive' : 'primary'}
                disabled={needsReason && !reason.trim()}
                onPress={() => close({ confirmed: true, reason: reason.trim() || undefined })}
              />
              <Button label="Volver" variant="ghost" onPress={() => close({ confirmed: false })} />
            </View>
          </Animated.View>
        </KeyboardAvoidingView>
      ) : null}
    </Modal>
  );
}

const styles = themed(() => StyleSheet.create({
  toast: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.night,
    zIndex: 1000,
    ...shadow.raised,
  },
  partyBackdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(17, 22, 61, 0.35)', alignItems: 'center', justifyContent: 'center', zIndex: 999 },
  partyCard: { width: 280, alignItems: 'center', gap: spacing.xs, padding: spacing.xl, borderRadius: radius.xl, backgroundColor: colors.surface, ...shadow.raised },
  confetti: { position: 'absolute', top: 0, left: 0, height: 10, borderRadius: 2 },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.xl,
    paddingTop: spacing.sm,
    gap: spacing.sm,
    ...shadow.raised,
  },
  grabber: { alignSelf: 'center', width: 40, height: 5, borderRadius: 3, backgroundColor: colors.border, marginBottom: spacing.sm },
  reason: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, marginTop: spacing.xs },
  reasonInput: { fontSize: 16, color: colors.text, paddingVertical: 4 },
}));
