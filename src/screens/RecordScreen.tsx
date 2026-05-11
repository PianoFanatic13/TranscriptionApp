import React, {useCallback, useEffect, useRef, useState} from 'react';
import {
  Animated,
  Easing,
  PermissionsAndroid,
  Platform,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import RNFS from 'react-native-fs';
import AudioRecord from 'react-native-audio-record';
import {WhisperContext, initWhisper} from 'whisper.rn';
import NetInfo from '@react-native-community/netinfo';
import {downloadModel} from '../../WhisperUtils';
import {pingHealth} from '../api';
import {enqueueNote, flushQueue} from '../queue';
import {saveLocalNote} from '../storage';

type PermissionState = 'checking' | 'granted' | 'denied';
type RecorderState = 'idle' | 'recording' | 'recorded' | 'error';

const VOICE_NOTES_ROOT = `${RNFS.DocumentDirectoryPath}/voice-notes`;
const MODELS_DIR = `${VOICE_NOTES_ROOT}/models`;
const AUDIO_DIR = `${VOICE_NOTES_ROOT}/audio`;
const NOTES_DIR = `${VOICE_NOTES_ROOT}/notes`;

const ensureDir = async (dirPath: string) => {
  const exists = await RNFS.exists(dirPath);
  if (!exists) {
    await RNFS.mkdir(dirPath);
  }
};

const sanitizePath = (value: string) => value.replace('file://', '');

const normalizePath = (value: string) => {
  const sanitized = sanitizePath(value);
  if (sanitized.startsWith('/')) return sanitized;
  if (/^[A-Za-z]:\\/.test(sanitized)) return sanitized;
  return `${RNFS.DocumentDirectoryPath}/${sanitized}`;
};

const formatDuration = (durationMs: number) => {
  const totalSeconds = Math.floor(durationMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
};

// ── Icons ────────────────────────────────────────────────────────────────────

const MicIcon = ({color = '#ffffff', size = 34}: {color?: string; size?: number}) => (
  <View style={{width: size, height: size, alignItems: 'center', justifyContent: 'center'}}>
    <View style={{
      width: size * 0.36, height: size * 0.5,
      borderRadius: size * 0.18, borderWidth: 2.5, borderColor: color,
      marginBottom: 3,
    }} />
    <View style={{width: size * 0.6, height: 1.5, backgroundColor: color}} />
    <View style={{width: 1.5, height: size * 0.16, backgroundColor: color}} />
    <View style={{width: size * 0.36, height: 1.5, backgroundColor: color}} />
  </View>
);

const StopIcon = ({color = '#ffffff', size = 24}: {color?: string; size?: number}) => (
  <View style={{width: size, height: size, borderRadius: 5, backgroundColor: color}} />
);

// ── Component ────────────────────────────────────────────────────────────────

interface Props {
  userId: string;
}

const RecordScreen = ({userId}: Props) => {
  const [permissionState, setPermissionState] = useState<PermissionState>('checking');
  const [recorderState, setRecorderState] = useState<RecorderState>('idle');
  const [statusMessage, setStatusMessage] = useState('Ready to record.');
  const [recordedFilePath, setRecordedFilePath] = useState<string | null>(null);
  const [recordedDurationMs, setRecordedDurationMs] = useState<number | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [isPreparingModel, setIsPreparingModel] = useState(false);
  const [modelProgress, setModelProgress] = useState<number | null>(null);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcribeProgress, setTranscribeProgress] = useState<number | null>(null);
  const [transcription, setTranscription] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [editDraft, setEditDraft] = useState('');
  const [submittedAt, setSubmittedAt] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'synced' | 'pending' | null>(null);

  const recordingStartedAtRef = useRef<number | null>(null);
  const expectedOutputPathRef = useRef<string | null>(null);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const whisperContextRef = useRef<WhisperContext | null>(null);
  const pulseValue = useRef(new Animated.Value(0)).current;

  const ensureStorageLayout = useCallback(async () => {
    await ensureDir(VOICE_NOTES_ROOT);
    await ensureDir(MODELS_DIR);
    await ensureDir(AUDIO_DIR);
    await ensureDir(NOTES_DIR);
  }, []);

  const checkPermission = useCallback(async () => {
    if (Platform.OS !== 'android') {
      setPermissionState('granted');
      return;
    }
    const granted = await PermissionsAndroid.check(
      PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
    );
    setPermissionState(granted ? 'granted' : 'denied');
  }, []);

  useEffect(() => {
    ensureStorageLayout().catch(() => {
      setRecorderState('error');
      setStatusMessage('Failed to prepare storage.');
    });
    checkPermission();
    pingHealth();
  }, [checkPermission, ensureStorageLayout]);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      if (state.isConnected) {
        flushQueue()
          .then(({sent}) => {
            if (sent > 0) {
              setSyncStatus('synced');
              setStatusMessage(
                sent === 1
                  ? 'Queued note synced.'
                  : `${sent} queued notes synced.`,
              );
            }
          })
          .catch(() => {});
      }
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (recorderState !== 'recording') {
      pulseValue.stopAnimation();
      pulseValue.setValue(0);
      return;
    }

    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseValue, {
          toValue: 1,
          duration: 900,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(pulseValue, {
          toValue: 0,
          duration: 900,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );

    animation.start();

    return () => {
      animation.stop();
      pulseValue.stopAnimation();
      pulseValue.setValue(0);
    };
  }, [pulseValue, recorderState]);

  useEffect(() => {
    return () => {
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
      }
      if (whisperContextRef.current) {
        void whisperContextRef.current.release().catch(() => {});
        whisperContextRef.current = null;
      }
    };
  }, []);

  const loadWhisperModel = useCallback(async (): Promise<WhisperContext> => {
    if (whisperContextRef.current) return whisperContextRef.current;

    setIsPreparingModel(true);
    setModelProgress(0);
    setStatusMessage('Loading transcription model…');

    try {
      const modelPath = await downloadModel('base', progress => {
        setModelProgress(progress);
      });

      const context = await initWhisper({
        filePath: modelPath,
        isBundleAsset: false,
        useGpu: false,
        useCoreMLIos: false,
      });

      whisperContextRef.current = context;
      setModelProgress(1);
      return context;
    } finally {
      setIsPreparingModel(false);
    }
  }, []);

  const transcribeRecording = useCallback(
    async (filePath: string, durationMs: number) => {
      setIsTranscribing(true);
      setTranscribeProgress(0);
      setStatusMessage('Transcribing your recording…');

      try {
        const context = await loadWhisperModel();

        const {promise} = context.transcribe(filePath, {
          language: 'en',
          maxLen: 120,
          onProgress: progress => {
            setTranscribeProgress(progress);
          },
        });

        const {result} = await promise;
        const cleaned = result.trim();
        setTranscription(cleaned.length ? cleaned : '(No speech detected)');
        setEditDraft('');
        setIsEditing(false);
        setSubmittedAt(null);

        if (cleaned.length) {
          setStatusMessage('Transcription ready. Edit if needed, then save.');
        } else {
          setSyncStatus(null);
          setStatusMessage('No speech detected. Try recording again.');
        }
      } catch (error) {
        setSyncStatus(null);
        setStatusMessage(`Transcription failed: ${(error as Error).message || 'Unknown error'}`);
      } finally {
        setIsTranscribing(false);
      }
    },
    [loadWhisperModel],
  );

  const requestAudioPermission = useCallback(async (): Promise<boolean> => {
    if (Platform.OS !== 'android') {
      setPermissionState('granted');
      return true;
    }

    const alreadyGranted = await PermissionsAndroid.check(
      PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
    );

    if (alreadyGranted) {
      setPermissionState('granted');
      return true;
    }

    const result = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
      {
        title: 'Microphone access',
        message: 'EarthRanger needs your microphone to record field observations.',
        buttonPositive: 'Allow',
        buttonNegative: 'Deny',
      },
    );

    const granted = result === PermissionsAndroid.RESULTS.GRANTED;
    setPermissionState(granted ? 'granted' : 'denied');
    return granted;
  }, []);

  const startRecording = useCallback(async () => {
    if (recorderState === 'recording' || isTranscribing || isPreparingModel) return;

    try {
      setStatusMessage('Checking microphone permission...');
      const granted = await requestAudioPermission();
      if (!granted) {
        setRecorderState('idle');
        setStatusMessage('Microphone access denied.');
        return;
      }

      await ensureStorageLayout();

      const fileName = `note-${Date.now()}.wav`;
      const targetPath = `${AUDIO_DIR}/${fileName}`;

      AudioRecord.init({
        sampleRate: 16000,
        channels: 1,
        bitsPerSample: 16,
        audioSource: 6,
        wavFile: fileName,
      });

      AudioRecord.start();

      expectedOutputPathRef.current = targetPath;
      recordingStartedAtRef.current = Date.now();
      setElapsedMs(0);
      setSyncStatus(null);

      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = setInterval(() => {
        const startedAt = recordingStartedAtRef.current;
        if (startedAt) setElapsedMs(Date.now() - startedAt);
      }, 200);

      setRecordedFilePath(null);
      setRecordedDurationMs(null);
      setTranscription('');
      setTranscribeProgress(null);
      setRecorderState('recording');
      setStatusMessage('Recording your observation…');
    } catch (error) {
      setRecorderState('error');
      setStatusMessage(`Could not start: ${(error as Error).message || 'Unknown error'}`);
    }
  }, [
    ensureStorageLayout,
    isPreparingModel,
    isTranscribing,
    recorderState,
    requestAudioPermission,
  ]);

  const stopRecording = useCallback(async () => {
    if (recorderState !== 'recording') return;

    try {
      setStatusMessage('Processing…');

      const rawPath = await AudioRecord.stop();
      if (!rawPath) throw new Error('Recorder did not return an output path.');

      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }

      const sourcePath = normalizePath(rawPath);
      const expectedPath = expectedOutputPathRef.current;
      let finalPath = sourcePath;

      if (expectedPath && sourcePath !== expectedPath) {
        if (await RNFS.exists(expectedPath)) await RNFS.unlink(expectedPath);
        await RNFS.moveFile(sourcePath, expectedPath);
        finalPath = expectedPath;
      }

      if (!(await RNFS.exists(finalPath))) throw new Error('Recorded file not found.');

      const stats = await RNFS.stat(finalPath);
      if (Number(stats.size || 0) <= 0) throw new Error('Recording was empty. Please try again.');

      const startedAt = recordingStartedAtRef.current;
      const durationMs = startedAt ? Date.now() - startedAt : 0;

      setElapsedMs(durationMs);
      setRecordedFilePath(finalPath);
      setRecordedDurationMs(durationMs);
      setRecorderState('recorded');

      await transcribeRecording(finalPath, durationMs);
    } catch (error) {
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }
      setRecorderState('error');
      setStatusMessage(`Recording failed: ${(error as Error).message || 'Unknown error'}`);
    } finally {
      recordingStartedAtRef.current = null;
      expectedOutputPathRef.current = null;
    }
  }, [recorderState, transcribeRecording]);

  const handleEdit = useCallback(() => {
    setEditDraft(transcription);
    setIsEditing(true);
  }, [transcription]);

  const handleCancelEdit = useCallback(() => {
    setEditDraft('');
    setIsEditing(false);
  }, []);

  const handleSave = useCallback(async () => {
    if (isSubmitting) {
      return;
    }
    const candidate = (isEditing ? editDraft : transcription).trim();
    if (!candidate.length) {
      setStatusMessage('Cannot save an empty transcription.');
      return;
    }

    setIsSubmitting(true);
    try {
      if (isEditing) {
        setTranscription(candidate);
        setIsEditing(false);
        setEditDraft('');
      }
      await saveLocalNote({
        createdAt: Date.now(),
        transcript: candidate,
        durationMs: recordedDurationMs ?? 0,
        audioPath: recordedFilePath ?? '',
      });
      await enqueueNote({user_id: userId, raw_transcript: candidate});
      const {sent} = await flushQueue();
      setSubmittedAt(Date.now());
      if (sent > 0) {
        setSyncStatus('synced');
        setStatusMessage('Note saved and synced.');
      } else {
        setSyncStatus('pending');
        setStatusMessage('Note saved locally — will sync when connected.');
      }
    } catch (error) {
      setStatusMessage(
        `Failed to save note: ${(error as Error).message || 'Unknown error'}`,
      );
    } finally {
      setIsSubmitting(false);
    }
  }, [editDraft, isEditing, isSubmitting, recordedDurationMs, recordedFilePath, transcription, userId]);

  const permissionText =
    permissionState === 'checking'
      ? 'Checking microphone permission...'
      : permissionState === 'granted'
      ? 'Microphone permission granted.'
      : 'Microphone permission not granted yet.';

  const onRecordButtonPress = useCallback(() => {
    if (isPreparingModel || isTranscribing) return;
    if (recorderState === 'recording') {
      void stopRecording();
      return;
    }
    void startRecording();
  }, [isPreparingModel, isTranscribing, recorderState, startRecording, stopRecording]);

  const pulseScale = pulseValue.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.32],
  });

  const pulseOpacity = pulseValue.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.0],
  });

  const isRecording = recorderState === 'recording';
  const isBusy = isPreparingModel || isTranscribing;

  const progressValue = isPreparingModel
    ? (modelProgress ?? 0)
    : isTranscribing
    ? (transcribeProgress ?? 0) / 100
    : 0;

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
            <Text style={styles.headerTitle}>Field Notes</Text>
            <Text style={styles.headerSub}>Record & transcribe</Text>
          </View>
          {syncStatus && (
            <View style={[
              styles.syncBadge,
              syncStatus === 'synced' ? styles.syncBadgeSynced : styles.syncBadgePending,
            ]}>
              <Text style={[
                styles.syncBadgeText,
                syncStatus === 'synced' ? styles.syncBadgeTextSynced : styles.syncBadgeTextPending,
              ]}>
                {syncStatus === 'synced' ? '✓ Synced' : '⟳ Pending'}
              </Text>
            </View>
          )}
        </View>

        {/* Status pill */}
        <View style={[
          styles.statusPill,
          isRecording && styles.statusPillRecording,
          isBusy && styles.statusPillBusy,
        ]}>
          {isRecording && (
            <Animated.View style={[styles.statusDot, {opacity: pulseOpacity}]} />
          )}
          <Text
            style={[
              styles.statusPillText,
              isRecording && styles.statusPillTextRec,
              isBusy && styles.statusPillTextBusy,
            ]}
            numberOfLines={1}>
            {statusMessage}
          </Text>
        </View>

        {/* Mic button */}
        <View style={styles.micArea}>
          {isRecording && (
            <Animated.View
              pointerEvents="none"
              style={[
                styles.pulseRing,
                {opacity: pulseOpacity, transform: [{scale: pulseScale}]},
              ]}
            />
          )}
          <TouchableOpacity
            activeOpacity={0.82}
            disabled={isBusy}
            style={[
              styles.micButton,
              isRecording && styles.micButtonRecording,
              isBusy && styles.micButtonBusy,
            ]}
            onPress={onRecordButtonPress}>
            {isRecording ? (
              <StopIcon color="#ffffff" size={26} />
            ) : (
              <MicIcon color="#ffffff" size={36} />
            )}
          </TouchableOpacity>
        </View>

        {/* Timer */}
        <Text style={[styles.timer, isRecording && styles.timerRecording]}>
          {formatDuration(elapsedMs)}
        </Text>
        <Text style={styles.timerLabel}>
          {isRecording
            ? 'Recording'
            : isBusy
            ? isPreparingModel
              ? 'Loading model'
              : 'Transcribing'
            : recorderState === 'recorded'
            ? 'Complete'
            : 'Standby'}
        </Text>

        {/* Progress bar */}
        {isBusy && (
          <View style={styles.progressTrack}>
            <View
              style={[
                styles.progressFill,
                {width: `${Math.round(progressValue * 100)}%`},
              ]}
            />
          </View>
        )}

        {/* Transcript card */}
        {(transcription || recorderState === 'recorded') ? (
          <View style={styles.transcriptCard}>
            <View style={styles.transcriptHeader}>
              <Text style={styles.transcriptLabel}>Transcript</Text>
              {!isTranscribing && transcription && submittedAt !== null && (
                <View style={styles.autoBadge}>
                  <Text style={styles.autoBadgeText}>Submitted</Text>
                </View>
              )}
            </View>

            {isEditing ? (
              <TextInput
                style={styles.transcriptInput}
                value={editDraft}
                onChangeText={setEditDraft}
                multiline
                placeholder="Edit transcription..."
                placeholderTextColor="#8a8a84"
                editable={!isSubmitting}
                textAlignVertical="top"
              />
            ) : (
              <Text style={styles.transcriptText}>
                {isTranscribing ? '…' : (transcription || '…')}
              </Text>
            )}

            {transcription && !isTranscribing && submittedAt === null ? (
              <View style={styles.cardActions}>
                {isEditing ? (
                  <TouchableOpacity
                    style={[
                      styles.smallButton,
                      isSubmitting ? styles.smallButtonDisabled : null,
                    ]}
                    onPress={handleCancelEdit}
                    disabled={isSubmitting}
                    activeOpacity={0.86}>
                    <Text style={styles.smallButtonText}>Cancel</Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    style={styles.smallButton}
                    onPress={handleEdit}
                    activeOpacity={0.86}>
                    <Text style={styles.smallButtonText}>Edit</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  style={[
                    styles.saveButton,
                    isSubmitting ? styles.smallButtonDisabled : null,
                  ]}
                  onPress={handleSave}
                  disabled={isSubmitting}
                  activeOpacity={0.86}>
                  <Text style={styles.saveButtonText}>
                    {isSubmitting ? 'Saving...' : 'Save'}
                  </Text>
                </TouchableOpacity>
              </View>
            ) : null}
          </View>
        ) : null}

        {/* Permission denied hint */}
        {permissionState === 'denied' && (
          <View style={styles.permissionHint}>
            <Text style={styles.permissionHintText}>
              Microphone access is required to record observations. Please grant
              permission in your device settings.
            </Text>
          </View>
        )}

        {recorderState === 'recorded' && recordedDurationMs !== null && (
          <Text style={styles.durationLine}>
            Duration · {formatDuration(recordedDurationMs)}
          </Text>
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

  // ── Header ──
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
  syncBadge: {
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
  },
  syncBadgeSynced: {
    backgroundColor: '#f0faf2',
    borderColor: '#d8f3dc',
  },
  syncBadgePending: {
    backgroundColor: '#fef3e2',
    borderColor: '#fde8c4',
  },
  syncBadgeText: {fontSize: 11, fontWeight: '600'},
  syncBadgeTextSynced: {color: '#2d6a4f'},
  syncBadgeTextPending: {color: '#a0522d'},

  // ── Status pill ──
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 24,
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.08)',
  },
  statusPillRecording: {
    backgroundColor: '#fdecea',
    borderColor: '#f5c6c2',
  },
  statusPillBusy: {
    backgroundColor: '#fef3e2',
    borderColor: '#fde8c4',
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#c1392b',
  },
  statusPillText: {fontSize: 13, color: '#8a8a84', flex: 1},
  statusPillTextRec: {color: '#c1392b'},
  statusPillTextBusy: {color: '#a0522d'},

  // ── Mic ──
  micArea: {
    alignSelf: 'center',
    width: 200,
    height: 200,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  pulseRing: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: '#c1392b',
  },
  micButton: {
    width: 130,
    height: 130,
    borderRadius: 65,
    backgroundColor: '#2d6a4f',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#2d6a4f',
    shadowOpacity: 0.25,
    shadowRadius: 16,
    shadowOffset: {width: 0, height: 4},
  },
  micButtonRecording: {
    backgroundColor: '#c1392b',
    shadowColor: '#c1392b',
  },
  micButtonBusy: {opacity: 0.4},

  // ── Timer ──
  timer: {
    textAlign: 'center',
    fontSize: 48,
    fontWeight: '300',
    color: '#1a1a18',
    letterSpacing: 3,
  },
  timerRecording: {color: '#c1392b'},
  timerLabel: {
    textAlign: 'center',
    fontSize: 11,
    color: '#8a8a84',
    letterSpacing: 1.2,
    marginTop: 4,
    marginBottom: 20,
  },

  // ── Progress bar ──
  progressTrack: {
    height: 2,
    backgroundColor: 'rgba(0,0,0,0.07)',
    borderRadius: 2,
    marginBottom: 20,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#40916c',
    borderRadius: 2,
  },

  // ── Transcript card ──
  transcriptCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.08)',
  },
  transcriptHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  transcriptLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#8a8a84',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  autoBadge: {
    backgroundColor: '#f0faf2',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: '#d8f3dc',
  },
  autoBadgeText: {fontSize: 10, color: '#2d6a4f', fontWeight: '600'},
  transcriptText: {fontSize: 15, color: '#52524e', lineHeight: 23},
  cardActions: {
    marginTop: 12,
    flexDirection: 'row',
  },
  playBtn: {
    flex: 1,
    backgroundColor: '#f2efe8',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.08)',
  },
  playBtnText: {fontSize: 13, color: '#52524e', fontWeight: '500'},

  // ── Permission hint ──
  permissionHint: {
    marginTop: 16,
    backgroundColor: '#fef3e2',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#fde8c4',
  },
  permissionHintText: {
    fontSize: 13,
    color: '#a0522d',
    lineHeight: 19,
    textAlign: 'center',
  },

  // ── Duration ──
  durationLine: {
    textAlign: 'center',
    fontSize: 12,
    color: '#8a8a84',
    marginTop: 14,
    letterSpacing: 0.3,
  },
  transcriptInput: {
    fontSize: 15,
    color: '#1a1a18',
    lineHeight: 23,
    backgroundColor: '#f7f5f0',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
    minHeight: 100,
  },
  smallButton: {
    flex: 1,
    backgroundColor: '#f2efe8',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.08)',
    marginRight: 8,
  },
  smallButtonDisabled: {
    opacity: 0.5,
  },
  smallButtonText: {
    color: '#52524e',
    fontWeight: '600',
    fontSize: 13,
  },
  saveButton: {
    flex: 1,
    backgroundColor: '#2d6a4f',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 13,
  },
});

export default RecordScreen;
