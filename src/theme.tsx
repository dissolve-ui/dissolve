import { useSyncExternalStore } from 'react';
import { Appearance, Pressable } from 'react-native';
import { SymbolView, type SFSymbol } from 'expo-symbols';
import * as Haptics from 'expo-haptics';
import Storage from 'expo-sqlite/kv-store';
import { useToken } from '@registry/tw';

/**
 * App wide appearance: System, Light or Dark. Applied with Appearance.setColorScheme, so the
 * native header, DynamicColorIOS colors and the prefers-color-scheme tokens all follow it.
 * Persisted in expo-sqlite's key value store.
 */
export type ThemePref = 'system' | 'light' | 'dark';

const KEY = 'dissolve.theme';
const ORDER: ThemePref[] = ['system', 'light', 'dark'];
const ICON: Record<ThemePref, SFSymbol> = { system: 'circle.lefthalf.filled', light: 'sun.max', dark: 'moon' };
const LABEL: Record<ThemePref, string> = { system: 'System appearance', light: 'Light appearance', dark: 'Dark appearance' };

function read(): ThemePref {
  try {
    const v = Storage.getItemSync(KEY);
    return v === 'light' || v === 'dark' ? v : 'system';
  } catch {
    return 'system';
  }
}

let pref: ThemePref = read();
const listeners = new Set<() => void>();

function apply(p: ThemePref) {
  Appearance.setColorScheme(p === 'system' ? 'unspecified' : p);
}

// Before the first render, so the first frame already has the right colors.
apply(pref);

export function setThemePref(p: ThemePref) {
  pref = p;
  apply(p);
  try {
    Storage.setItemSync(KEY, p);
  } catch {
    // Not persisted, still applied for this session.
  }
  listeners.forEach((l) => l());
}

export function useThemePref() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => pref,
  );
}

/** Header button: cycles System, Light, Dark. */
export function ThemeButton() {
  const p = useThemePref();
  const ink = useToken('foreground');
  return (
    <Pressable
      onPress={() => {
        Haptics.selectionAsync();
        setThemePref(ORDER[(ORDER.indexOf(p) + 1) % ORDER.length]);
      }}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={LABEL[p]}
      accessibilityHint="Switches between system, light and dark"
      style={({ pressed }) => ({ width: 36, height: 36, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.5 : 1 })}
    >
      <SymbolView name={ICON[p]} size={20} tintColor={ink} weight="medium" />
    </Pressable>
  );
}
