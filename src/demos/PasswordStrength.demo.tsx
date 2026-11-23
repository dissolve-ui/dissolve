import { useState } from 'react';
import { StyleSheet } from 'react-native';
import { GlossyButton } from '@registry/glossy-button';
import { PasswordStrength } from '@registry/password-strength';
import { Text, View, useToken } from '@registry/tw';

/** A new password step: the Save button wakes up once every rule is met. */
export default function PasswordStrengthDemo() {
  const [ok, setOk] = useState(false);
  const [done, setDone] = useState(false);
  const primary = useToken('primary');
  const onPrimary = useToken('primary-foreground');
  return (
    <View style={st.root}>
      <Text className="text-dissolve-foreground" style={st.title}>New password</Text>
      <Text className="text-dissolve-muted" style={st.sub}>
        {done ? 'Your password is saved.' : 'Use it only for this account.'}
      </Text>
      <PasswordStrength
        onChange={(_, s) => {
          setOk(s.passed);
          setDone(false);
        }}
      />
      <View style={st.cta}>
        <GlossyButton fullWidth size="lg" color={primary} labelColor={onPrimary} disabled={!ok} onPress={() => setDone(true)}>
          Save password
        </GlossyButton>
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  root: { paddingVertical: 32, paddingHorizontal: 16 },
  title: { fontSize: 34, lineHeight: 41, fontWeight: '700', letterSpacing: -0.9, marginLeft: 4 },
  sub: { fontSize: 15, marginTop: 4, marginBottom: 20, marginLeft: 4 },
  cta: { marginTop: 24 },
});
