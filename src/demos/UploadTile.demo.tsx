import { useRef, useState } from 'react';
import { StyleSheet } from 'react-native';
import { SymbolView } from 'expo-symbols';
import { UploadTray, type UploadFile, type UploadFn } from '@registry/upload-tile';
import { Pressable, Text, View, useToken } from '@registry/tw';
import { mono } from '../ui';

const MB = 1024 * 1024;
const MAX = 25 * MB;

type Item = UploadFile & { id: string };

/** What the + button attaches next, in order. The video is over the 25 MB limit. */
const QUEUE: Omit<Item, 'id'>[] = [
  { name: 'Rushes_final.mov', size: 148 * MB },
  { name: 'Moodboard.jpg', size: 3.1 * MB, source: require('../../assets/paintings/pines.jpg') },
  { name: 'Invoice_0412.pdf', size: 184 * 1024 },
  { name: 'Valley.jpg', size: 4.6 * MB, source: require('../../assets/paintings/valley.jpg') },
];

const START: Item[] = [
  { id: 'a', name: 'Villa.jpg', size: 2.4 * MB, source: require('../../assets/paintings/villa.jpg') },
  { id: 'b', name: 'Brief_v3.pdf', size: 1.2 * MB },
];

/** Fake network: progress in uneven chunks, speed depends on the size, honours the abort signal. */
const fakeUpload: UploadFn = (file, onProgress, signal) =>
  new Promise((resolve, reject) => {
    let p = 0;
    const step = Math.max(0.03, 0.16 - file.size / (40 * MB));
    const id = setInterval(() => {
      p = Math.min(1, p + step * (0.5 + Math.random()));
      onProgress(p);
      if (p >= 1) {
        clearInterval(id);
        setTimeout(resolve, 150);
      }
    }, 160);
    signal.addEventListener('abort', () => {
      clearInterval(id);
      reject(new Error('aborted'));
    });
  });

/**
 * A chat composer with attachments. Two files upload on open, each assembling from grains as its
 * progress runs; the × appears once it is uploaded. Tap + to attach more: the video is over the
 * 25 MB limit, it shakes, turns red and leaves as dust. Tap a tile while it uploads to cancel.
 */
export default function UploadTileDemo() {
  const onPrimary = useToken('primary-foreground');
  const [files, setFiles] = useState<Item[]>(START);
  const [done, setDone] = useState<string[]>([]);
  const next = useRef(0);
  const uid = useRef(0);

  const add = () => {
    const f = QUEUE[next.current % QUEUE.length];
    next.current += 1;
    uid.current += 1;
    setFiles((all) => [...all, { ...f, id: `n${uid.current}` }]);
  };
  const remove = (file: UploadFile) => {
    setFiles((all) => all.filter((f) => f.id !== file.id));
    setDone((all) => all.filter((id) => id !== file.id));
  };
  const ready = files.length > 0 && files.every((f) => done.includes(f.id));

  return (
    <View className="bg-dissolve-background" style={st.screen}>
      <Text className="text-dissolve-muted" style={st.day}>
        TODAY 16:40
      </Text>
      <View className="bg-dissolve-surface" style={st.bubble}>
        <Text className="text-dissolve-foreground" style={st.text}>
          Tu peux m’envoyer les visuels et le brief avant ce soir ?
        </Text>
      </View>

      <View className="border-dissolve-border bg-dissolve-surface" style={st.composer}>
        <UploadTray files={files} upload={fakeUpload} maxSize={MAX} onAdd={add} onDone={(f) => setDone((all) => [...all, f.id!])} onRemove={remove} />
        <View style={st.inputRow}>
          <Text className="text-dissolve-muted" style={st.placeholder}>
            {files.length ? `${files.length} attachment${files.length > 1 ? 's' : ''}` : 'Message'}
          </Text>
          <Pressable
            disabled={!ready}
            onPress={() => {
              setFiles([]);
              setDone([]);
            }}
            className="bg-dissolve-primary active:opacity-70"
            style={[st.send, { opacity: ready ? 1 : 0.3 }]}
          >
            <SymbolView name="arrow.up" size={15} tintColor={onPrimary} weight="bold" />
          </Pressable>
        </View>
      </View>
      <Text className="text-dissolve-muted" style={st.hint}>
        tap + to attach · max 25 MB · tap a tile to cancel
      </Text>
    </View>
  );
}

const st = StyleSheet.create({
  screen: { paddingHorizontal: 14, paddingVertical: 18, gap: 8 },
  day: { fontFamily: mono, fontSize: 11, textAlign: 'center', marginBottom: 6, letterSpacing: 0.4 },
  bubble: { alignSelf: 'flex-start', maxWidth: 270, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 20, borderCurve: 'continuous' },
  text: { fontSize: 16, lineHeight: 21, letterSpacing: -0.2 },
  composer: { marginTop: 18, borderRadius: 24, borderCurve: 'continuous', borderWidth: StyleSheet.hairlineWidth, paddingTop: 6, paddingHorizontal: 6, paddingBottom: 6 },
  inputRow: { flexDirection: 'row', alignItems: 'center', paddingLeft: 10, marginTop: 2 },
  placeholder: { flex: 1, fontSize: 16 },
  send: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  hint: { fontFamily: mono, fontSize: 11, textAlign: 'center', marginTop: 8, letterSpacing: 0.2 },
});
