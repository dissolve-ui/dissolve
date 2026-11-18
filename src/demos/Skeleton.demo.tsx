import { useEffect, useRef, useState } from 'react';
import { StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { Skeleton, SkeletonBlock } from '@registry/skeleton';
import { Pressable, Text, View } from '@registry/tw';

/**
 * A profile and two posts on the screen background. It loads on mount; Reload shows the
 * skeleton again and the placeholders break into grains that recompose the content.
 */

const POSTS = [
  { id: 'a', title: 'Cypress alley', sub: 'Golden hour, Tuscany', src: require('../../assets/paintings/cypress.jpg') },
  { id: 'b', title: 'Quiet lake', sub: 'Morning mist, 7:40', src: require('../../assets/paintings/lake.jpg') },
];
const AVATAR = require('../../assets/paintings/pines.jpg');
const LOAD = 1600;

export default function SkeletonDemo() {
  const [loading, setLoading] = useState(true);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = () => {
    if (timer.current) clearTimeout(timer.current);
    setLoading(true);
    timer.current = setTimeout(() => setLoading(false), LOAD);
  };
  useEffect(() => {
    load();
    return () => void (timer.current && clearTimeout(timer.current));
  }, []);

  return (
    <View style={st.screen}>
      <Skeleton loading={loading}>
        <View style={st.profile}>
          <SkeletonBlock shape="circle" size={64}>
            <Image source={AVATAR} style={st.avatar} contentFit="cover" />
          </SkeletonBlock>
          <View style={st.names}>
            <SkeletonBlock width={148} height={25}>
              <Text className="text-dissolve-foreground" style={st.name}>
                Maya Chen
              </Text>
            </SkeletonBlock>
            <SkeletonBlock width={92}>
              <Text className="text-dissolve-muted" style={st.handle}>
                @mayapaints
              </Text>
            </SkeletonBlock>
          </View>
        </View>

        {POSTS.map((p) => (
          <View key={p.id} style={st.row}>
            <SkeletonBlock shape="rect" width={52} height={52} radius={12}>
              <Image source={p.src} style={st.thumb} contentFit="cover" />
            </SkeletonBlock>
            <View style={st.names}>
              <SkeletonBlock width={128} height={22}>
                <Text className="text-dissolve-foreground" style={st.title}>
                  {p.title}
                </Text>
              </SkeletonBlock>
              <SkeletonBlock width={168}>
                <Text className="text-dissolve-muted" style={st.sub}>
                  {p.sub}
                </Text>
              </SkeletonBlock>
            </View>
          </View>
        ))}
      </Skeleton>

      <Pressable onPress={load} disabled={loading} hitSlop={12} style={st.reload}>
        <Text className={loading ? 'text-dissolve-muted' : 'text-dissolve-accent'} style={st.reloadText}>
          {loading ? 'Loading' : 'Reload'}
        </Text>
      </Pressable>
    </View>
  );
}

const st = StyleSheet.create({
  screen: { paddingHorizontal: 4 },
  profile: { flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 28 },
  avatar: { width: 64, height: 64, borderRadius: 32 },
  names: { flex: 1, gap: 2 },
  name: { fontSize: 20, lineHeight: 25, fontWeight: '600', letterSpacing: -0.45 },
  handle: { fontSize: 15, lineHeight: 20, letterSpacing: -0.23 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 10 },
  thumb: { width: 52, height: 52, borderRadius: 12 },
  title: { fontSize: 17, lineHeight: 22, letterSpacing: -0.43 },
  sub: { fontSize: 15, lineHeight: 20, letterSpacing: -0.23 },
  reload: { alignSelf: 'center', marginTop: 28 },
  reloadText: { fontSize: 15, lineHeight: 20, letterSpacing: -0.23 },
});
