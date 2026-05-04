import React, {useState} from 'react';
import {
  ActivityIndicator,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import {queryNotes, SourceChunk} from '../api';

const QueryScreen = () => {
  const [queryText, setQueryText] = useState('');
  const [answer, setAnswer] = useState('');
  const [sources, setSources] = useState<SourceChunk[]>([]);
  const [isQuerying, setIsQuerying] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleAsk = async () => {
    const trimmed = queryText.trim();
    if (!trimmed || isQuerying) {
      return;
    }

    setIsQuerying(true);
    setAnswer('');
    setSources([]);
    setErrorMessage('');

    try {
      const result = await queryNotes(trimmed);
      setAnswer(result.answer);
      setSources(result.sources);
    } catch (error) {
      setErrorMessage(
        `Query failed: ${(error as Error).message || 'Unknown error'}`,
      );
    } finally {
      setIsQuerying(false);
    }
  };

  const formatDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return iso;
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0f172a" />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.screen}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={true}>
        <Text style={styles.title}>Ask Your Notes</Text>
        <Text style={styles.subtitle}>
          Query across all submitted field notes.
        </Text>

        <TextInput
          style={styles.input}
          value={queryText}
          onChangeText={setQueryText}
          placeholder="Ask about your field notes..."
          placeholderTextColor="#475569"
          multiline
          numberOfLines={3}
          editable={!isQuerying}
        />

        <TouchableOpacity
          style={[styles.askButton, isQuerying ? styles.askButtonDisabled : null]}
          onPress={handleAsk}
          activeOpacity={0.86}
          disabled={isQuerying}>
          <Text style={styles.askButtonText}>
            {isQuerying ? 'Asking...' : 'Ask'}
          </Text>
        </TouchableOpacity>

        {isQuerying ? (
          <ActivityIndicator
            style={styles.loader}
            color="#60a5fa"
            size="large"
          />
        ) : null}

        {errorMessage ? (
          <Text style={styles.errorText}>{errorMessage}</Text>
        ) : null}

        {answer ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Answer</Text>
            <Text style={styles.answerText}>{answer}</Text>
          </View>
        ) : null}

        {sources.length > 0 ? (
          <View style={styles.sourcesSection}>
            <Text style={styles.sourcesHeader}>Sources</Text>
            {sources.map(source => (
              <View key={source.chunk_id} style={styles.sourceCard}>
                <Text style={styles.sourceDate}>
                  {formatDate(source.created_at)}
                </Text>
                <Text style={styles.sourceContent} numberOfLines={4}>
                  {source.content}
                </Text>
              </View>
            ))}
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  scrollView: {
    flex: 1,
  },
  screen: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingVertical: 24,
  },
  title: {
    fontSize: 34,
    fontWeight: '800',
    color: '#e2e8f0',
    letterSpacing: 0.5,
  },
  subtitle: {
    marginTop: 8,
    color: '#94a3b8',
    fontSize: 14,
    marginBottom: 24,
  },
  input: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: '#e2e8f0',
    fontSize: 15,
    lineHeight: 22,
    textAlignVertical: 'top',
    minHeight: 80,
  },
  askButton: {
    marginTop: 12,
    backgroundColor: '#1d4ed8',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  askButtonDisabled: {
    opacity: 0.5,
  },
  askButtonText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 16,
  },
  loader: {
    marginTop: 24,
  },
  errorText: {
    marginTop: 16,
    color: '#f87171',
    fontSize: 14,
    textAlign: 'center',
  },
  card: {
    marginTop: 24,
    backgroundColor: '#1e293b',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  cardTitle: {
    color: '#f8fafc',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 8,
  },
  answerText: {
    color: '#cbd5e1',
    fontSize: 15,
    lineHeight: 22,
  },
  sourcesSection: {
    marginTop: 20,
  },
  sourcesHeader: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  sourceCard: {
    backgroundColor: '#1e293b',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 8,
  },
  sourceDate: {
    color: '#64748b',
    fontSize: 11,
    marginBottom: 4,
  },
  sourceContent: {
    color: '#94a3b8',
    fontSize: 13,
    lineHeight: 18,
  },
});

export default QueryScreen;
