import React, {useState} from 'react';
import {
  ActivityIndicator,
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
import AsyncStorage from '@react-native-async-storage/async-storage';

const DEVICE_USER_ID_KEY = 'device_user_id';

interface Props {
  onLogin: (username: string) => void;
}

const LoginScreen = ({onLogin}: Props) => {
  const [username, setUsername] = useState('');
  const [saving, setSaving] = useState(false);

  const handleStart = async () => {
    const trimmed = username.trim();
    if (!trimmed || saving) return;
    setSaving(true);
    await AsyncStorage.setItem(DEVICE_USER_ID_KEY, trimmed);
    onLogin(trimmed);
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#2d6a4f" />
      <KeyboardAvoidingView
        style={styles.kav}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>

        <View style={styles.hero}>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>ER</Text>
          </View>
          <Text style={styles.heroTitle}>EarthRanger</Text>
          <Text style={styles.heroSub}>Field Notes</Text>
        </View>

        <View style={styles.form}>
          <Text style={styles.formTitle}>Welcome back</Text>
          <Text style={styles.formSub}>
            Enter your ranger ID to access field observations.
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
            style={[
              styles.button,
              (!username.trim() || saving) && styles.buttonDisabled,
            ]}
            onPress={handleStart}
            activeOpacity={0.86}
            disabled={!username.trim() || saving}>
            {saving ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text style={styles.buttonText}>Continue</Text>
            )}
          </TouchableOpacity>

          <Text style={styles.version}>EarthRanger Field Notes · v1.0</Text>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#2d6a4f'},
  kav: {flex: 1},

  hero: {
    flex: 0.42,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 12,
  },
  badge: {
    width: 68,
    height: 68,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  badgeText: {
    fontSize: 22,
    fontWeight: '900',
    color: '#ffffff',
    letterSpacing: 1.5,
  },
  heroTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: 0.3,
  },
  heroSub: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.65)',
    marginTop: 5,
    letterSpacing: 0.5,
  },

  form: {
    flex: 0.58,
    backgroundColor: '#f7f5f0',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    paddingTop: 32,
    paddingHorizontal: 28,
    paddingBottom: 24,
  },
  formTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1a1a18',
    marginBottom: 4,
  },
  formSub: {
    fontSize: 14,
    color: '#8a8a84',
    marginBottom: 28,
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
    marginBottom: 24,
  },
  buttonDisabled: {opacity: 0.4},
  buttonText: {color: '#ffffff', fontWeight: '700', fontSize: 16},
  version: {
    textAlign: 'center',
    fontSize: 11,
    color: '#b0aea8',
  },
});

export default LoginScreen;
