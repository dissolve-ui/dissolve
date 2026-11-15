import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, LinearTransition } from 'react-native-reanimated';
import { DissolveIn } from '../hooks/useAppear';
import { useDissolve } from '../hooks/useDissolve';
import type { VariantName } from '../types';

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

type Item = ToastOptions & { id: number };
type Ctx = { show: (o: ToastOptions) => number; hide: (id: number) => void };

const ToastContext = createContext<Ctx | null>(null);
const DOT: Record<ToastTone, string> = { default: '#8E8E93', success: '#34C759', error: '#FF3B30' };
const layout = LinearTransition.duration(320).easing(Easing.bezier(0.32, 0.72, 0, 1));

function ToastCard({ item, leaving, onGone }: { item: Item; leaving: boolean; onGone: (id: number) => void }) {
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
          <View ref={ref} collapsable={false} style={[s.card, { opacity: dissolving ? 0 : 1 }]}>
            <View style={[s.dot, { backgroundColor: DOT[item.tone ?? 'default'] }]} />
            <View style={{ flex: 1 }}>
              <Text style={s.title} numberOfLines={1}>{item.title}</Text>
              {item.message ? <Text style={s.message} numberOfLines={2}>{item.message}</Text> : null}
            </View>
            {item.action ? (
              <Pressable
                hitSlop={8}
                onPress={() => {
                  item.action?.onPress();
                  leave();
                }}
                style={({ pressed }) => [s.action, pressed && { opacity: 0.7 }]}
              >
                <Text style={s.actionText}>{item.action.label}</Text>
              </Pressable>
            ) : null}
          </View>
        </Pressable>
      </DissolveIn>
    </Animated.View>
  );
}

/**
 * Toasts that arrive in grains and leave as dust. Put it inside <DissolveProvider>.
 *
 * <ToastProvider top={insets.top + 8}>{app}</ToastProvider>
 * const toast = useToast();
 * toast.show({ title: 'Message deleted', action: { label: 'Undo', onPress: restore } });
 */
export function ToastProvider({ children, top = 56, max = 3 }: { children: ReactNode; top?: number; max?: number }) {
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
      <View pointerEvents="box-none" style={[s.host, { top }]}>
        {items.map((it) => (
          <ToastCard key={it.id} item={it} leaving={leaving.includes(it.id)} onGone={onGone} />
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

const s = StyleSheet.create({
  host: { position: 'absolute', left: 12, right: 12, gap: 8 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 18,
    backgroundColor: '#1C1C1E',
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  title: { color: 'white', fontSize: 15, fontWeight: '600' },
  message: { color: 'rgba(255,255,255,0.7)', fontSize: 13, marginTop: 1 },
  action: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 99, backgroundColor: 'rgba(255,255,255,0.14)' },
  actionText: { color: 'white', fontSize: 14, fontWeight: '600' },
});
