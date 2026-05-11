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

const SUGGESTIONS = [
  "What did I observe today?",
  "Any wildlife sightings this week?",
  "Were there fence breaches?",
  "Any injured animals reported?",
  "Summarize my last patrol",
  "Any poaching incidents logged?",
];

const QueryScreen = () => {
  const [queryText, setQueryText] = useState('');
  const [answer, setAnswer] = useState('');
  const [sources, setSources] = useState<SourceChunk[]>([]);
  const [isQuerying, setIsQuerying] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [expandedSource, setExpandedSource] = useState<string | null>(null);

  const handleAsk = async (preset?: string) => {
    const trimmed = (preset ?? queryText).trim();
    if (!trimmed || isQuerying) {
      return;
    }
    if (preset) {
      setQueryText(preset);
    }

    setIsQuerying(true);
    setAnswer('');
    setSources([]);
    setErrorMessage('');
    setExpandedSource(null);

    try {
      const result = await queryNotes(trimmed);
      setAnswer(result.answer);
      setSources(result.sources);
    } catch (error) {
      setErrorMessage(
        (error as Error).message || 'Could not reach the server. Check your connection.',
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

  const hasResults = !!answer || sources.length > 0;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#f7f5f0" />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerBadge}>
          <Text style={styles.headerBadgeText}>ER</Text>
        </View>
        <View>
          <Text style={styles.title}>Search Notes</Text>
          <Text style={styles.subtitle}>Ask anything about your field observations</Text>
        </View>
      </View>

      {/* Search bar — always visible, not inside ScrollView */}
      <View style={styles.inputArea}>
        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            value={queryText}
            onChangeText={setQueryText}
            placeholder="Ask about your field notes…"
            placeholderTextColor="#8a8a84"
            multiline
            numberOfLines={2}
            editable={!isQuerying}
            returnKeyType="search"
            onSubmitEditing={() => handleAsk()}
          />
          <TouchableOpacity
            style={[
              styles.askBtn,
              (!queryText.trim() || isQuerying) && styles.askBtnDisabled,
            ]}
            onPress={() => handleAsk()}
            activeOpacity={0.86}
            disabled={!queryText.trim() || isQuerying}>
            {isQuerying ? (
              <ActivityIndicator color="#ffffff" size="small" />
            ) : (
              <Text style={styles.askBtnText}>Ask</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Suggestion chips — shown before a query */}
        {!hasResults && !isQuerying && (
          <>
            <Text style={styles.tryLabel}>Try asking</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chipsContent}>
              {SUGGESTIONS.map(s => (
                <TouchableOpacity
                  key={s}
                  style={styles.chip}
                  onPress={() => handleAsk(s)}
                  activeOpacity={0.7}>
                  <Text style={styles.chipText}>{s}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </>
        )}
      </View>

      {/* Results scroll area */}
      <ScrollView
        style={styles.results}
        contentContainerStyle={styles.resultsContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>

        {errorMessage ? (
          <View style={styles.errorCard}>
            <Text style={styles.errorText}>{errorMessage}</Text>
          </View>
        ) : null}

        {answer ? (
          <View style={styles.answerCard}>
            <Text style={styles.answerLabel}>Answer</Text>
            <Text style={styles.answerText}>{answer}</Text>
          </View>
        ) : null}

        {sources.length > 0 ? (
          <View style={styles.sourcesSection}>
            <Text style={styles.sourcesHeader}>
              {sources.length} source{sources.length !== 1 ? 's' : ''}
            </Text>
            {sources.map(source => (
              <TouchableOpacity
                key={source.chunk_id}
                style={styles.sourceCard}
                onPress={() =>
                  setExpandedSource(
                    expandedSource === source.chunk_id ? null : source.chunk_id,
                  )
                }
                activeOpacity={0.8}>
                <View style={styles.sourceTop}>
                  <Text style={styles.sourceDate}>{formatDate(source.created_at)}</Text>
                  <Text style={styles.sourceChevron}>
                    {expandedSource === source.chunk_id ? '▴' : '▾'}
                  </Text>
                </View>
                <Text
                  style={styles.sourceContent}
                  numberOfLines={expandedSource === source.chunk_id ? undefined : 2}>
                  {source.content}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        ) : null}

        <View style={{height: 24}} />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#f7f5f0'},

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 20,
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.08)',
    gap: 12,
  },
  headerBadge: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#2d6a4f',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerBadgeText: {
    fontSize: 12,
    fontWeight: '900',
    color: '#ffffff',
    letterSpacing: 0.8,
  },
  title: {fontSize: 17, fontWeight: '700', color: '#1a1a18'},
  subtitle: {fontSize: 12, color: '#8a8a84', marginTop: 1},

  // Input area (fixed, not scrollable)
  inputArea: {
    paddingTop: 14,
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.06)',
    backgroundColor: '#f7f5f0',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
    marginBottom: 12,
  },
  input: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#1a1a18',
    fontSize: 15,
    lineHeight: 22,
    textAlignVertical: 'top',
    minHeight: 50,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
  },
  askBtn: {
    backgroundColor: '#2d6a4f',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 64,
  },
  askBtnDisabled: {opacity: 0.4},
  askBtnText: {color: '#ffffff', fontWeight: '700', fontSize: 15},

  // Suggestion chips
  tryLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#8a8a84',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  chipsContent: {
    paddingRight: 8,
    alignItems: 'center',
  },
  chip: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    paddingHorizontal: 14,
    height: 34,
    justifyContent: 'center',
    marginRight: 8,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
  },
  chipText: {color: '#52524e', fontSize: 13},

  // Results
  results: {flex: 1},
  resultsContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 24,
  },

  // Error
  errorCard: {
    backgroundColor: '#fdecea',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#f5c6c2',
  },
  errorText: {color: '#c1392b', fontSize: 13, lineHeight: 18},

  // Answer
  answerCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#d8f3dc',
  },
  answerLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#2d6a4f',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  answerText: {color: '#1a1a18', fontSize: 15, lineHeight: 24},

  // Sources
  sourcesSection: {marginTop: 4},
  sourcesHeader: {
    fontSize: 11,
    fontWeight: '700',
    color: '#8a8a84',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  sourceCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.07)',
  },
  sourceTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  sourceDate: {fontSize: 11, color: '#8a8a84'},
  sourceChevron: {fontSize: 10, color: '#8a8a84'},
  sourceContent: {color: '#52524e', fontSize: 13, lineHeight: 19},
});

export default QueryScreen;
