import React, {useState} from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
} from 'react-native';

interface Props {
  onLogin: (username: string) => void;
}

const LoginScreen = ({onLogin}: Props) => {
  const [username, setUsername] = useState('');

  const handleStart = () => {
    const trimmed = username.trim();
    if (!trimmed) {
      return;
    }
    onLogin(trimmed);
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0f172a" />
      <KeyboardAvoidingView
        style={styles.inner}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <Text style={styles.title}>Field Notes</Text>
        <Text style={styles.subtitle}>Enter your ranger username to begin.</Text>

        <TextInput
          style={styles.input}
          value={username}
          onChangeText={setUsername}
          placeholder="Username"
          placeholderTextColor="#475569"
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="done"
          onSubmitEditing={handleStart}
        />

        <TouchableOpacity
          style={[styles.button, !username.trim() ? styles.buttonDisabled : null]}
          onPress={handleStart}
          activeOpacity={0.86}
          disabled={!username.trim()}>
          <Text style={styles.buttonText}>Start</Text>
        </TouchableOpacity>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  inner: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  title: {
    fontSize: 36,
    fontWeight: '800',
    color: '#e2e8f0',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: '#94a3b8',
    marginBottom: 32,
  },
  input: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: '#e2e8f0',
    fontSize: 16,
    marginBottom: 16,
  },
  button: {
    backgroundColor: '#1d4ed8',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.45,
  },
  buttonText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 16,
  },
});

export default LoginScreen;
