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
  View,
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
      <StatusBar barStyle="dark-content" backgroundColor="#f7f5f0" />
      <KeyboardAvoidingView
        style={styles.inner}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>

        <View style={styles.badge}>
          <Text style={styles.badgeText}>ER</Text>
        </View>

        <Text style={styles.title}>EarthRanger</Text>
        <Text style={styles.subtitle}>
          Enter your ranger ID to access field notes.
        </Text>

        <Text style={styles.label}>Ranger ID</Text>
        <TextInput
          style={styles.input}
          value={username}
          onChangeText={setUsername}
          placeholder="e.g. ranger_42"
          placeholderTextColor="#8a8a84"
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
          <Text style={styles.buttonText}>Continue</Text>
        </TouchableOpacity>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f7f5f0',
  },
  inner: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  badge: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: '#2d6a4f',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  badgeText: {
    fontSize: 18,
    fontWeight: '900',
    color: '#ffffff',
    letterSpacing: 1,
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    color: '#1a1a18',
    letterSpacing: 0.3,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    color: '#8a8a84',
    marginBottom: 32,
    lineHeight: 20,
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
    color: '#8a8a84',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: '#1a1a18',
    fontSize: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
  },
  button: {
    backgroundColor: '#2d6a4f',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.4,
  },
  buttonText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 16,
  },
});

export default LoginScreen;
