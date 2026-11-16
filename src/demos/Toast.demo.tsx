import { StyleSheet } from 'react-native';
import { useToast } from '@registry/toast';
import { Pressable, Text, View } from '@registry/tw';

/** Three kinds of toast: success, with an Undo action, and an error that leaves as pixels. */
export default function ToastDemo() {
  const toast = useToast();
  const buttons = [
    { label: 'Saved', run: () => toast.show({ title: 'Changes saved', tone: 'success' }) },
    {
      label: 'Undo',
      run: () =>
        toast.show({
          title: 'Photo deleted',
          message: 'Lisbon, 3 years ago',
          action: { label: 'Undo', onPress: () => toast.show({ title: 'Photo restored', tone: 'success' }) },
        }),
    },
    { label: 'Error', run: () => toast.show({ title: 'Payment declined', message: 'Try another card', tone: 'error', exit: 'pixel' }) },
  ];
  return (
    <View style={st.row}>
      {buttons.map((b) => (
        <Pressable key={b.label} onPress={b.run} className="bg-dissolve-primary active:opacity-75" style={st.btn}>
          <Text className="text-dissolve-primary-foreground" style={st.btnText}>{b.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const st = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8 },
  btn: { flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: 14 },
  btnText: { fontSize: 15, fontWeight: '600' },
});
