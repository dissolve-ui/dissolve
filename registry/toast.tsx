/**
 * Toast, from dissolve (react-native-dissolve). This file is yours: restyle it with classNames,
 * change the timings, the copy, anything. Colors come from the dissolve theme tokens
 * (global.css), so it follows light and dark mode out of the box: the card is the inverted
 * surface (primary), dark on light mode and light on dark mode.
 *
 * Toasts that arrive in grains and leave as dust. Put it inside <DissolveProvider>.
 *
 * <ToastProvider top={insets.top + 8}>{app}</ToastProvider>
 * const toast = useToast();
 * toast.show({ title: 'Message deleted', action: { label: 'Undo', onPress: restore } });
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { View as RNView } from 'react-native';
import { Easing, LinearTransition } from 'react-native-reanimated';
import { DissolveIn, useDissolve, type VariantName } from 'react-native-dissolve';
import { Animated, Pressable, Text, View, cn } from './tw';

export type ToastTone = 'default' | 'success' | 'error';

export type ToastOptions = {
  title: string;
  message?: string;
  tone?: ToastTone;
  /** A single action, typically Undo. The toast leaves after it runs. */
  action?: { label: string; onPress: () => void };
  /** Time on screen before it leaves on its own, ms. Default 3200. 0 keeps it until tapped. */
  duration?: number;
  /** Entrance. Default 'gather'. */
  enter?: VariantName;
  /** Exit. Default 'dust'. */
  exit?: VariantName;
};

export type ToastProviderProps = {
  children: ReactNode;
  /** Distance from the top of the screen, points. Default 56. */
  top?: number;
  /** Toasts on screen at once; over it, the oldest leaves as dust. Default 3. */
  max?: number;
  /** Stack classes (side insets, gap). */
  className?: string;
  /** Card classes (background, radius, padding...). */
  cardClassName?: string;
};

type Item = ToastOptions & { id: number };
type Ctx = { show: (o: ToastOptions) => number; hide: (id: number) => void };

const ToastContext = createContext<Ctx | null>(null);
const DOT: Record<ToastTone, string> = { default: 'bg-dissolve-muted', success: 'bg-dissolve-success', error: 'bg-dissolve-danger' };
const layout = LinearTransition.duration(320).easing(Easing.bezier(0.32, 0.72, 0, 1));
const SHADOW = { shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 16, shadowOffset: { width: 0, height: 6 } };

function ToastCard({ item, leaving, onGone, className }: { item: Item; leaving: boolean; onGone: (id: number) => void; className?: string }) {
  const { ref, dissolving, dissolve } = useDissolve();
  const gone = useRef(false);

  const leave = useCallback(async () => {
    if (gone.current) return;
    gone.current = true;
    await dissolve({ preset: item.exit ?? 'dust', duration: 1100, haptics: false });
    onGone(item.id);
  }, [dissolve, item.exit, item.id, onGone]);

  useEffect(() => {
    if (leaving) leave();
  }, [leaving, leave]);

  useEffect(() => {
    const ms = item.duration ?? 3200;
    if (!ms) return;
    const t = setTimeout(leave, ms + 900);
    return () => clearTimeout(t);
  }, [item.duration, leave]);

  return (
    <Animated.View layout={layout}>
      <DissolveIn preset={item.enter ?? 'gather'} duration={900}>
        <Pressable onPress={leave}>
          {/* Plain RN view: it holds the capture ref. */}
          <RNView ref={ref} collapsable={false} style={[SHADOW, { opacity: dissolving ? 0 : 1 }]}>
            <View className={cn('flex-row items-center gap-3 rounded-[18px] bg-dissolve-primary px-3.5 py-3', className)}>
              <View className={cn('h-2 w-2 rounded-full', DOT[item.tone ?? 'default'])} />
              <View className="flex-1">
                <Text className="text-[15px] font-semibold text-dissolve-primary-foreground" numberOfLines={1}>
                  {item.title}
                </Text>
                {item.message ? (
                  <Text className="mt-px text-[13px] text-dissolve-primary-foreground opacity-70" numberOfLines={2}>
                    {item.message}
                  </Text>
                ) : null}
              </View>
              {item.action ? (
                <Pressable
                  hitSlop={8}
                  onPress={() => {
                    item.action?.onPress();
                    leave();
                  }}
                  className="overflow-hidden rounded-full px-3 py-[7px] active:opacity-70"
                >
                  <View className="absolute inset-0 bg-dissolve-primary-foreground opacity-15" />
                  <Text className="text-sm font-semibold text-dissolve-primary-foreground">{item.action.label}</Text>
                </Pressable>
              ) : null}
            </View>
          </RNView>
        </Pressable>
      </DissolveIn>
    </Animated.View>
  );
}

export function ToastProvider({ children, top = 56, max = 3, className, cardClassName }: ToastProviderProps) {
  const [items, setItems] = useState<Item[]>([]);
  const [leaving, setLeaving] = useState<number[]>([]);
  const next = useRef(1);

  const hide = useCallback((id: number) => setLeaving((l) => (l.includes(id) ? l : [...l, id])), []);
  const show = useCallback(
    (o: ToastOptions) => {
      const id = next.current++;
      setItems((list) => {
        const all = [...list, { ...o, id }];
        // Over the limit, the oldest leaves as dust instead of vanishing.
        all.slice(0, Math.max(0, all.length - max)).forEach((x) => hide(x.id));
        return all;
      });
      return id;
    },
    [hide, max],
  );
  const onGone = useCallback((id: number) => {
    setItems((list) => list.filter((x) => x.id !== id));
    setLeaving((l) => l.filter((x) => x !== id));
  }, []);

  const value = useMemo(() => ({ show, hide }), [show, hide]);
  return (
    <ToastContext.Provider value={value}>
      {children}
      <View pointerEvents="box-none" className={cn('absolute left-3 right-3 gap-2', className)} style={{ top }}>
        {items.map((it) => (
          <ToastCard key={it.id} item={it} leaving={leaving.includes(it.id)} onGone={onGone} className={cardClassName} />
        ))}
      </View>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx;
}
