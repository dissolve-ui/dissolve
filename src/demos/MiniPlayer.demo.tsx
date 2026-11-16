import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';
import { SymbolView, type SFSymbol } from 'expo-symbols';
import { MiniPlayer } from '@registry/mini-player';
import { Text, View, useToken } from '@registry/tw';

const TRACKS = [
  { title: 'Cypress Light', artist: 'Maren Holt', art: require('../../assets/paintings/cypress.jpg'), length: 214 },
  { title: 'Still Water', artist: 'The Quiet Hours', art: require('../../assets/paintings/lake.jpg'), length: 187 },
  { title: 'Old Aqueduct', artist: 'Lumen Choir', art: require('../../assets/paintings/aqueduct.jpg'), length: 241 },
  { title: 'Villa at Noon', artist: 'Sora Vale', art: require('../../assets/paintings/villa.jpg'), length: 198 },
  { title: 'Under the Pines', artist: 'Maren Holt', art: require('../../assets/paintings/pines.jpg'), length: 226 },
  { title: 'Valley Drift', artist: 'North Arcade', art: require('../../assets/paintings/valley.jpg'), length: 205 },
];

const ROWS: [SFSymbol, string][] = [
  ['music.note.list', 'Playlists'],
  ['music.mic', 'Artists'],
  ['square.stack', 'Albums'],
  ['music.note', 'Songs'],
];

/** Music library with the liquid glass now playing pill docked at the bottom. Tap or drag it up, swipe it to skip. */
export default function MiniPlayerDemo() {
  const { width } = useWindowDimensions();
  const ink = useToken('foreground');
  const muted = useToken('muted');
  const [i, setI] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [t, setT] = useState(42);
  const track = TRACKS[i];

  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => {
      setT((s) => {
        if (s + 0.5 < track.length) return s + 0.5;
        setI((n) => (n + 1) % TRACKS.length);
        return 0;
      });
    }, 500);
    return () => clearInterval(id);
  }, [playing, track.length]);

  const go = (n: number) => {
    setI((n + TRACKS.length) % TRACKS.length);
    setT(0);
  };

  const tile = (width - 32 - 24) / 3;

  return (
    <View className="bg-dissolve-background" style={st.root}>
      <View className="px-[16px]">
        <Text className="text-[30px] font-bold tracking-[-0.6px] text-dissolve-foreground">Library</Text>
        <View className="mt-[10px]">
          {ROWS.map(([icon, label]) => (
            <View key={label} className="h-[46px] flex-row items-center gap-[14px] border-b border-dissolve-border">
              <SymbolView name={icon} size={19} tintColor={ink} />
              <Text className="flex-1 text-[17px] text-dissolve-foreground">{label}</Text>
              <SymbolView name="chevron.right" size={13} tintColor={muted} weight="semibold" />
            </View>
          ))}
        </View>

        <Text className="mb-[12px] mt-[22px] text-[20px] font-bold text-dissolve-foreground">Recently Added</Text>
        <View className="flex-row flex-wrap gap-x-[12px] gap-y-[14px]">
          {TRACKS.map((tr, n) => (
            <Pressable
              key={tr.title}
              onPress={() => {
                go(n);
                setPlaying(true);
              }}
              style={({ pressed }) => ({ width: tile, opacity: pressed ? 0.7 : 1 })}
            >
              <Image source={tr.art} style={{ width: tile, height: tile, borderRadius: 8 }} contentFit="cover" />
              <Text numberOfLines={1} className="mt-[6px] text-[13px] font-medium text-dissolve-foreground">
                {tr.title}
              </Text>
              <Text numberOfLines={1} className="text-[12px] text-dissolve-muted">
                {tr.artist}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <MiniPlayer
        title={track.title}
        subtitle={track.artist}
        artwork={track.art}
        progress={t / track.length}
        duration={track.length}
        playing={playing}
        onPlayPause={() => setPlaying((p) => !p)}
        onNext={() => go(i + 1)}
        onPrev={() => (t > 3 ? setT(0) : go(i - 1))}
        bottom={12}
        topInset={10}
      />
    </View>
  );
}

// The demo host pads its content by 16: cancel it so the player can cover the whole screen area.
const st = StyleSheet.create({ root: { flex: 1, margin: -16, paddingTop: 8 } });
