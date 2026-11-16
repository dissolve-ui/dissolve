import { useState } from 'react';
import { StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { LikeButton } from '@registry/like-button';
import { Text, View } from '@registry/tw';

/** A post with a like button: sparks on like, the heart snaps away on unlike. */
export default function LikeButtonDemo() {
  const [liked, setLiked] = useState(false);
  const [likes, setLikes] = useState(128);
  return (
    <View className="bg-dissolve-surface" style={st.post}>
      <View style={st.postHead}>
        <Image source={require('../../assets/paintings/pond.jpg')} style={st.avatar} contentFit="cover" />
        <View style={{ flex: 1 }}>
          <Text className="text-dissolve-foreground" style={st.postName}>hannera.studio</Text>
          <Text className="text-dissolve-muted" style={st.postMeta}>Lisbon</Text>
        </View>
      </View>
      <Image source={require('../../assets/paintings/temple.jpg')} style={st.postImg} contentFit="cover" />
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
    </View>
  );
}

const st = StyleSheet.create({
  post: { borderRadius: 22, overflow: 'hidden' },
  postHead: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12 },
  avatar: { width: 34, height: 34, borderRadius: 17 },
  postName: { fontSize: 14, fontWeight: '600' },
  postMeta: { fontSize: 12 },
  postImg: { width: '100%', aspectRatio: 4 / 3 },
  postActions: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12 },
});
