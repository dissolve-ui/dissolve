import { useState } from 'react';
import { StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import Animated from 'react-native-reanimated';
import { SwipeToDelete } from '@registry/swipe-to-delete';
import { useToast } from '@registry/toast';
import { Pressable, Text, View } from '@registry/tw';
import { layout } from '../ui';

const MAILS = [
  { id: 'a', from: 'Léa', subject: 'The direction is up in your project', img: require('../../assets/paintings/pond.jpg'), time: '9:41' },
  { id: 'b', from: 'Hannera', subject: 'Your order is paid, kickoff Monday', img: require('../../assets/paintings/tuscany.jpg'), time: '9:12' },
  { id: 'c', from: 'Maya', subject: 'Three screens ready for review', img: require('../../assets/paintings/lake.jpg'), time: 'Yesterday' },
  { id: 'd', from: 'Studio', subject: 'Figma file and pull request attached', img: require('../../assets/paintings/valley.jpg'), time: 'Mon' },
];

/** An inbox: swipe a row left, past the line it turns to dust. Undo from the toast. */
export default function SwipeToDeleteDemo() {
  const [mails, setMails] = useState(MAILS);
  const toast = useToast();
  return (
    <View style={{ gap: 8 }}>
      {mails.map((m) => (
        <Animated.View key={m.id} layout={layout}>
          <SwipeToDelete
            rowClassName="rounded-[18px]"
            onDelete={() => {
              setMails((l) => l.filter((x) => x.id !== m.id));
              toast.show({
                title: 'Conversation deleted',
                message: m.from,
                action: { label: 'Undo', onPress: () => setMails((l) => [...l, m].sort((a, b) => a.id.localeCompare(b.id))) },
              });
            }}
          >
            <View className="bg-dissolve-surface" style={st.mail}>
              <Image source={m.img} style={st.mailImg} contentFit="cover" />
              <View style={{ flex: 1 }}>
                <View style={st.mailTop}>
                  <Text className="text-dissolve-foreground" style={st.mailFrom}>{m.from}</Text>
                  <Text className="text-dissolve-muted" style={st.mailTime}>{m.time}</Text>
                </View>
                <Text className="text-dissolve-muted" style={st.mailSubject} numberOfLines={1}>{m.subject}</Text>
              </View>
            </View>
          </SwipeToDelete>
        </Animated.View>
      ))}
      {mails.length < MAILS.length ? (
        <Pressable onPress={() => setMails(MAILS)} className="bg-dissolve-surface active:opacity-70" style={st.reset}>
          <Text className="text-dissolve-foreground" style={st.resetText}>Reset</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const st = StyleSheet.create({
  mail: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10, paddingRight: 14 },
  mailImg: { width: 46, height: 46, borderRadius: 12 },
  mailTop: { flexDirection: 'row', justifyContent: 'space-between' },
  mailFrom: { fontSize: 15, fontWeight: '600' },
  mailTime: { fontSize: 12 },
  mailSubject: { fontSize: 14, marginTop: 2 },
  reset: { alignSelf: 'center', marginTop: 6, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 99 },
  resetText: { fontSize: 13, fontWeight: '600' },
});
