import { useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { SymbolView } from 'expo-symbols';
import Animated, { ZoomIn } from 'react-native-reanimated';
import { GooeyMenu, LikeButton, MorphButton, SlideToConfirm, SplitButton, SwipeToDelete, useToast } from '@/dissolve';
import { C, layout, mono } from '@/ui';

const P = {
  pond: require('../assets/paintings/pond.jpg'),
  lake: require('../assets/paintings/lake.jpg'),
  tuscany: require('../assets/paintings/tuscany.jpg'),
  valley: require('../assets/paintings/valley.jpg'),
  temple: require('../assets/paintings/temple.jpg'),
  cypress: require('../assets/paintings/cypress.jpg'),
  pines: require('../assets/paintings/pines.jpg'),
};

function Header({ index, title, note, right }: { index: string; title: string; note: string; right?: React.ReactNode }) {
  return (
    <View style={st.header}>
      <View style={{ flex: 1 }}>
        <Text style={st.index}>{index}</Text>
        <Text style={st.h2}>{title}</Text>
        <Text style={st.note}>{note}</Text>
      </View>
      {right}
    </View>
  );
}

/* ---------- 01 SwipeToDelete ---------- */

const MAILS = [
  { id: 'a', from: 'Léa', subject: 'The direction is up in your project', img: P.pond, time: '9:41' },
  { id: 'b', from: 'Hannera', subject: 'Your order is paid, kickoff Monday', img: P.tuscany, time: '9:12' },
  { id: 'c', from: 'Maya', subject: 'Three screens ready for review', img: P.lake, time: 'Yesterday' },
  { id: 'd', from: 'Studio', subject: 'Figma file and pull request attached', img: P.valley, time: 'Mon' },
];

function Inbox() {
  const [mails, setMails] = useState(MAILS);
  const toast = useToast();
  return (
    <View style={{ gap: 8 }}>
      {mails.map((m) => (
        <Animated.View key={m.id} layout={layout}>
          <SwipeToDelete
            radius={18}
            onDelete={() => {
              setMails((l) => l.filter((x) => x.id !== m.id));
              toast.show({
                title: 'Conversation deleted',
                message: m.from,
                action: { label: 'Undo', onPress: () => setMails((l) => [...l, m].sort((a, b) => a.id.localeCompare(b.id))) },
              });
            }}
          >
            <View style={st.mail}>
              <Image source={m.img} style={st.mailImg} contentFit="cover" />
              <View style={{ flex: 1 }}>
                <View style={st.mailTop}>
                  <Text style={st.mailFrom}>{m.from}</Text>
                  <Text style={st.mailTime}>{m.time}</Text>
                </View>
                <Text style={st.mailSubject} numberOfLines={1}>{m.subject}</Text>
              </View>
            </View>
          </SwipeToDelete>
        </Animated.View>
      ))}
      {mails.length < MAILS.length ? (
        <Pressable onPress={() => setMails(MAILS)} style={st.reset}>
          <Text style={st.resetText}>Reset</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

/* ---------- 02 Toast ---------- */

function Toasts() {
  const toast = useToast();
  const buttons = [
    { label: 'Saved', run: () => toast.show({ title: 'Changes saved', tone: 'success' }) },
    { label: 'Undo', run: () => toast.show({ title: 'Photo deleted', message: 'Lisbon, 3 years ago', action: { label: 'Undo', onPress: () => toast.show({ title: 'Photo restored', tone: 'success' }) } }) },
    { label: 'Error', run: () => toast.show({ title: 'Payment declined', message: 'Try another card', tone: 'error', exit: 'pixel' }) },
  ];
  return (
    <View style={st.row}>
      {buttons.map((b) => (
        <Pressable key={b.label} onPress={b.run} style={({ pressed }) => [st.btn, pressed && { opacity: 0.75 }]}>
          <Text style={st.btnText}>{b.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

/* ---------- 03 LikeButton ---------- */

function Post() {
  const [liked, setLiked] = useState(false);
  const [likes, setLikes] = useState(128);
  return (
    <View style={st.post}>
      <View style={st.postHead}>
        <Image source={P.pond} style={st.avatar} contentFit="cover" />
        <View style={{ flex: 1 }}>
          <Text style={st.postName}>hannera.studio</Text>
          <Text style={st.postMeta}>Lisbon</Text>
        </View>
      </View>
      <Image source={P.temple} style={st.postImg} contentFit="cover" />
      <View style={st.postActions}>
        <LikeButton
          liked={liked}
          count={likes}
          onChange={(v) => {
            setLiked(v);
            setLikes((n) => n + (v ? 1 : -1));
          }}
        />
      </View>
      <Text style={st.caption}>Tap the heart. Tap again to unlike.</Text>
    </View>
  );
}

/* ---------- Liquid ---------- */

function Liquid() {
  const toast = useToast();
  return (
    <View>
      <Header index="04" title="Morph button" note="Folds into a loader, opens back up as done." />
      <MorphButton label="Pay 42 €" doneLabel="Paid" onPress={() => new Promise((r) => setTimeout(r, 1400))} />

      <Header index="05" title="Split button" note="Divides in the middle like a drop of liquid metal." />
      <SplitButton label="Delete project" confirmLabel="Delete" onConfirm={() => toast.show({ title: 'Project deleted', tone: 'error' })} />

      <Header index="06" title="Slide to confirm" note="Slide the knob to the end to pay." />
      <SlideToConfirm label="Slide to pay 42 €" doneLabel="Paid" onConfirm={() => new Promise((r) => setTimeout(r, 1200))} />

      <Header index="07" title="Gooey menu" note="Actions pour out of the button as drops." />
      <View style={st.menuStage}>
        <Image source={P.lake} style={StyleSheet.absoluteFill} contentFit="cover" />
        <GooeyMenu
          style={{ position: 'absolute', right: 4, bottom: 4 }}
          items={[
            { icon: <SymbolView name="camera.fill" size={20} tintColor="white" />, label: 'Camera', onPress: () => toast.show({ title: 'Camera' }) },
            { icon: <SymbolView name="photo.fill" size={20} tintColor="white" />, label: 'Photo', onPress: () => toast.show({ title: 'Photo library' }) },
            { icon: <SymbolView name="mic.fill" size={20} tintColor="white" />, label: 'Voice', onPress: () => toast.show({ title: 'Voice memo' }) },
          ]}
        />
      </View>
    </View>
  );
}

export default function Components() {
  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 80 }}>
      <Text style={st.lead}>Ready-made components built on the dissolve engine.</Text>

      <Header index="01" title="Swipe to delete" note="Swipe a row left. Past the line, it turns to dust." />
      <Inbox />

      <Header index="02" title="Toast" note="Arrives in grains, leaves as dust. Tap to dismiss." />
      <Toasts />

      <Header index="03" title="Like button" note="Sparks on like, the heart snaps away on unlike." />
      <Post />

      <Liquid />
    </ScrollView>
  );
}

const st = StyleSheet.create({
  lead: { fontSize: 15, lineHeight: 22, color: C.text, paddingTop: 12 },
  header: { flexDirection: 'row', alignItems: 'flex-end', paddingTop: 30, paddingBottom: 12, gap: 12 },
  index: { fontFamily: mono, fontSize: 11, color: C.muted },
  h2: { fontSize: 22, fontWeight: '600', color: C.ink, letterSpacing: -0.4, marginTop: 4 },
  note: { fontSize: 14, color: C.text, marginTop: 3 },
  row: { flexDirection: 'row', gap: 8 },

  mail: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10, paddingRight: 14, backgroundColor: C.surface },
  mailImg: { width: 46, height: 46, borderRadius: 12 },
  mailTop: { flexDirection: 'row', justifyContent: 'space-between' },
  mailFrom: { fontSize: 15, fontWeight: '600', color: C.ink },
  mailTime: { fontSize: 12, color: C.muted },
  mailSubject: { fontSize: 14, color: C.text, marginTop: 2 },
  reset: { alignSelf: 'center', marginTop: 6, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 99, backgroundColor: C.surface },
  resetText: { fontSize: 13, fontWeight: '600', color: C.ink },

  btn: { flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: 14, backgroundColor: C.dark },
  btnText: { color: 'white', fontSize: 15, fontWeight: '600' },

  bag: { width: 44, height: 44, borderRadius: 22, backgroundColor: C.surface, alignItems: 'center', justifyContent: 'center' },
  badge: { position: 'absolute', top: -4, right: -4, minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 5, backgroundColor: '#FF3B30', borderWidth: 2, borderColor: 'white', alignItems: 'center', justifyContent: 'center' },
  badgeText: { color: 'white', fontSize: 10, fontWeight: '700' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  product: { width: '48%', flexGrow: 1, backgroundColor: C.surface, borderRadius: 18, padding: 8 },
  productImg: { width: '100%', aspectRatio: 1, borderRadius: 12 },
  productRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 4, paddingTop: 8 },
  productTitle: { fontSize: 14, fontWeight: '600', color: C.ink },
  productPrice: { fontSize: 13, color: C.text },
  add: { width: 30, height: 30, borderRadius: 15, backgroundColor: C.dark, alignItems: 'center', justifyContent: 'center' },
  total: { fontFamily: mono, fontSize: 12, color: C.text, textAlign: 'center', marginTop: 10 },

  post: { backgroundColor: C.surface, borderRadius: 22, overflow: 'hidden' },
  postHead: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12 },
  avatar: { width: 34, height: 34, borderRadius: 17 },
  postName: { fontSize: 14, fontWeight: '600', color: C.ink },
  postMeta: { fontSize: 12, color: C.muted },
  postImg: { width: '100%', aspectRatio: 4 / 3 },
  postActions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 12 },
  caption: { fontSize: 13, color: C.text, paddingHorizontal: 14, paddingBottom: 14 },

  settings: { backgroundColor: C.surface, borderRadius: 18, paddingHorizontal: 16 },
  setting: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14 },
  settingLine: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.line },
  settingText: { fontSize: 16, color: C.ink },
  menuStage: { height: 230, borderRadius: 22, overflow: 'hidden', backgroundColor: C.surface },
});
