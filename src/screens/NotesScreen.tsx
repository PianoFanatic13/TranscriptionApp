import React, {useCallback, useEffect, useRef, useState} from 'react';
import {
  Alert,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Sound from 'react-native-sound';
import RNFS from 'react-native-fs';
import {getAllNotes, deleteLocalNote, LocalNote} from '../storage';

const formatDuration = (ms: number) => {
  const s = Math.floor(ms / 1000);
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
};

const formatDate = (ts: number) => {
  const d = new Date(ts);
  return (
    d.toLocaleDateString('en-US', {month: 'short', day: 'numeric', year: 'numeric'}) +
    ' · ' +
    d.toLocaleTimeString('en-US', {hour: '2-digit', minute: '2-digit'})
  );
};

const NotesScreen = () => {
  const [notes, setNotes] = useState<LocalNote[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const soundRef = useRef<Sound | null>(null);

  const loadNotes = useCallback(async () => {
    const all = await getAllNotes();
    setNotes(all);
  }, []);

  useEffect(() => {
    loadNotes();
  }, [loadNotes]);

  useEffect(() => {
    return () => {
      soundRef.current?.stop(() => {
        soundRef.current?.release();
        soundRef.current = null;
      });
    };
  }, []);

  const stopPlayback = useCallback(() => {
    soundRef.current?.stop(() => {
      soundRef.current?.release();
      soundRef.current = null;
    });
    setPlayingId(null);
  }, []);

  const handlePlay = useCallback(
    async (note: LocalNote) => {
      if (playingId === note.id) {
        stopPlayback();
        return;
      }
      stopPlayback();

      const exists = await RNFS.exists(note.audioPath);
      if (!exists) {
        Alert.alert('Audio not found', 'The recording file has been removed from this device.');
        return;
      }

      Sound.setCategory('Playback');
      const player = new Sound(note.audioPath, '', err => {
        if (err) {
          setPlayingId(null);
          return;
        }
        soundRef.current = player;
        setPlayingId(note.id);
        player.play(() => {
          soundRef.current?.release();
          soundRef.current = null;
          setPlayingId(null);
        });
      });
    },
    [playingId, stopPlayback],
  );

  const handleDelete = useCallback(
    (note: LocalNote) => {
      Alert.alert(
        'Delete note',
        'This will remove the note from your device. It cannot be undone.',
        [
          {text: 'Cancel', style: 'cancel'},
          {
            text: 'Delete',
            style: 'destructive',
            onPress: async () => {
              if (playingId === note.id) stopPlayback();
              await deleteLocalNote(note.id);
              setNotes(prev => prev.filter(n => n.id !== note.id));
            },
          },
        ],
      );
    },
    [playingId, stopPlayback],
  );

  const totalDuration = notes.reduce((sum, n) => sum + n.durationMs, 0);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#f7f5f0" />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.screen}
        showsVerticalScrollIndicator={false}>

        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerBadge}>
            <Text style={styles.headerBadgeText}>ER</Text>
          </View>
          <View style={{flex: 1}}>
            <Text style={styles.headerTitle}>My Notes</Text>
            <Text style={styles.headerSub}>Local recordings</Text>
          </View>
        </View>

        {notes.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>🎙</Text>
            <Text style={styles.emptyTitle}>No recordings yet</Text>
            <Text style={styles.emptyBody}>
              Head to the Record tab to capture your first field observation.
            </Text>
          </View>
        ) : (
          <>
            {/* Summary strip */}
            <View style={styles.strip}>
              <View style={styles.stripCell}>
                <Text style={styles.stripVal}>{notes.length}</Text>
                <Text style={styles.stripLbl}>Notes</Text>
              </View>
              <View style={styles.stripDivider} />
              <View style={styles.stripCell}>
                <Text style={styles.stripVal}>{formatDuration(totalDuration)}</Text>
                <Text style={styles.stripLbl}>Total audio</Text>
              </View>
            </View>

            {/* Note cards */}
            {notes.map((note, i) => {
              const isExpanded = expanded === note.id;
              const isPlaying = playingId === note.id;
              return (
                <TouchableOpacity
                  key={note.id}
                  style={[styles.card, i === 0 && styles.cardFirst]}
                  onPress={() => setExpanded(isExpanded ? null : note.id)}
                  activeOpacity={0.8}>

                  <View style={styles.cardTop}>
                    <View style={styles.noteNum}>
                      <Text style={styles.noteNumText}>
                        {String(notes.length - i).padStart(2, '0')}
                      </Text>
                    </View>
                    <View style={{flex: 1}}>
                      <Text style={styles.noteDate}>{formatDate(note.createdAt)}</Text>
                    </View>
                    <Text style={styles.noteDur}>{formatDuration(note.durationMs)}</Text>
                  </View>

                  <Text
                    style={styles.noteTranscript}
                    numberOfLines={isExpanded ? undefined : 2}>
                    {note.transcript}
                  </Text>

                  {isExpanded && (
                    <View style={styles.cardActions}>
                      <TouchableOpacity
                        style={[styles.actionBtn, isPlaying && styles.actionBtnActive]}
                        onPress={() => handlePlay(note)}
                        activeOpacity={0.7}>
                        <Text style={[styles.actionBtnText, isPlaying && styles.actionBtnTextActive]}>
                          {isPlaying ? '⏹  Stop' : '▶  Play'}
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.actionBtn, styles.actionBtnDanger]}
                        onPress={() => handleDelete(note)}
                        activeOpacity={0.7}>
                        <Text style={styles.actionBtnTextDanger}>Delete</Text>
                      </TouchableOpacity>
                    </View>
                  )}

                  <Text style={styles.expandHint}>
                    {isExpanded ? '▴ Collapse' : '▾ Expand'}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#f7f5f0'},
  scrollView: {flex: 1},
  screen: {
    flexGrow: 1,
    paddingHorizontal: 16,
    paddingBottom: 32,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.08)',
    marginBottom: 16,
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
  headerTitle: {fontSize: 17, fontWeight: '700', color: '#1a1a18'},
  headerSub: {fontSize: 12, color: '#8a8a84', marginTop: 1},

  // Empty state
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
  },
  emptyIcon: {fontSize: 40, marginBottom: 16},
  emptyTitle: {fontSize: 17, fontWeight: '600', color: '#1a1a18', marginBottom: 8},
  emptyBody: {
    fontSize: 14,
    color: '#8a8a84',
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 260,
  },

  // Summary strip
  strip: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.08)',
    marginBottom: 14,
    overflow: 'hidden',
  },
  stripCell: {flex: 1, alignItems: 'center', paddingVertical: 14},
  stripVal: {fontSize: 20, fontWeight: '600', color: '#2d6a4f'},
  stripLbl: {fontSize: 11, color: '#8a8a84', marginTop: 2},
  stripDivider: {width: 1, backgroundColor: 'rgba(0,0,0,0.07)', marginVertical: 10},

  // Note card
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.08)',
    padding: 14,
    marginBottom: 10,
  },
  cardFirst: {borderColor: 'rgba(45,106,79,0.3)'},
  cardTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 8,
  },
  noteNum: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: '#f0faf2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  noteNumText: {fontSize: 12, fontWeight: '700', color: '#2d6a4f'},
  noteDate: {fontSize: 12, color: '#8a8a84'},
  noteDur: {fontSize: 12, color: '#8a8a84', fontFamily: 'monospace'},
  noteTranscript: {fontSize: 14, color: '#52524e', lineHeight: 21},

  // Card actions
  cardActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  actionBtn: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 10,
    backgroundColor: '#f2efe8',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.08)',
  },
  actionBtnActive: {
    backgroundColor: '#f0faf2',
    borderColor: '#d8f3dc',
  },
  actionBtnDanger: {
    backgroundColor: '#fdecea',
    borderColor: '#f5c6c2',
  },
  actionBtnText: {fontSize: 13, color: '#52524e', fontWeight: '500'},
  actionBtnTextActive: {color: '#2d6a4f'},
  actionBtnTextDanger: {fontSize: 13, color: '#c1392b', fontWeight: '500'},

  expandHint: {
    fontSize: 11,
    color: '#8a8a84',
    textAlign: 'right',
    marginTop: 8,
  },
});

export default NotesScreen;
