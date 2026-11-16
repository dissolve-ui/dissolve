import { StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { SymbolView } from 'expo-symbols';
import { GooeyMenu } from '@registry/gooey-menu';
import { useToast } from '@registry/toast';
import { View } from '@registry/tw';

/** A floating button over a photo: its actions pour out as gooey drops. */
export default function GooeyMenuDemo() {
  const toast = useToast();
  return (
    <View className="bg-dissolve-surface" style={st.stage}>
      <Image source={require('../../assets/paintings/lake.jpg')} style={StyleSheet.absoluteFill} contentFit="cover" />
      <GooeyMenu
        className="absolute bottom-1 right-1"
        items={[
          { icon: <SymbolView name="camera.fill" size={20} tintColor="white" />, label: 'Camera', onPress: () => toast.show({ title: 'Camera' }) },
          { icon: <SymbolView name="photo.fill" size={20} tintColor="white" />, label: 'Photo', onPress: () => toast.show({ title: 'Photo library' }) },
          { icon: <SymbolView name="mic.fill" size={20} tintColor="white" />, label: 'Voice', onPress: () => toast.show({ title: 'Voice memo' }) },
        ]}
      />
    </View>
  );
}

const st = StyleSheet.create({
  stage: { height: 320, borderRadius: 22, overflow: 'hidden' },
});
