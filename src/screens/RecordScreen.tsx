import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
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
  if (sanitized.startsWith('/')) {
    return sanitized;
  }
  if (/^[A-Za-z]:\\/.test(sanitized)) {
    return sanitized;
  }
  return `${RNFS.DocumentDirectoryPath}/${sanitized}`;
};

const formatDuration = (durationMs: number) => {
  const totalSeconds = Math.floor(durationMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
};

interface Props {
  userId: string;
}

const RecordScreen = ({userId}: Props) => {
  const [permissionState, setPermissionState] =
    useState<PermissionState>('checking');
  const [recorderState, setRecorderState] = useState<RecorderState>('idle');
  const [statusMessage, setStatusMessage] = useState('Ready to record.');
  const [recordedFilePath, setRecordedFilePath] = useState<string | null>(null);
  const [recordedSizeBytes, setRecordedSizeBytes] = useState<number | null>(null);
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
      setStatusMessage('Failed to prepare internal app folders.');
    });
    checkPermission();
    // Wake the Render server in the background — no await, no UI block.
    pingHealth();
  }, [checkPermission, ensureStorageLayout]);

  // Flush any queued notes whenever the device regains connectivity.
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      if (state.isConnected) {
        flushQueue()
          .then(({sent}) => {
            if (sent > 0) {
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
    if (whisperContextRef.current) {
      return whisperContextRef.current;
    }

    setIsPreparingModel(true);
    setModelProgress(0);
    setStatusMessage('Preparing Whisper base model...');

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
    async (filePath: string) => {
      setIsTranscribing(true);
      setTranscribeProgress(0);
      setStatusMessage('Transcribing with Whisper base...');

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
          setStatusMessage('Recording saved. No speech detected.');
        }
      } catch (error) {
        setStatusMessage(
          `Transcription failed: ${(error as Error).message || 'Unknown error'}`,
        );
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
        title: 'Microphone Permission',
        message:
          'This app needs access to your microphone to record voice notes.',
        buttonPositive: 'Allow',
        buttonNegative: 'Deny',
      },
    );

    const granted = result === PermissionsAndroid.RESULTS.GRANTED;
    setPermissionState(granted ? 'granted' : 'denied');
    return granted;
  }, []);

  const startRecording = useCallback(async () => {
    if (recorderState === 'recording' || isTranscribing || isPreparingModel) {
      return;
    }

    try {
      setStatusMessage('Checking microphone permission...');
      const granted = await requestAudioPermission();
      if (!granted) {
        setRecorderState('idle');
        setStatusMessage('Microphone permission denied. Cannot start recording.');
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

      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
      }
      recordingTimerRef.current = setInterval(() => {
        const startedAt = recordingStartedAtRef.current;
        if (startedAt) {
          setElapsedMs(Date.now() - startedAt);
        }
      }, 200);

      setRecordedFilePath(null);
      setRecordedSizeBytes(null);
      setRecordedDurationMs(null);
      setTranscription('');
      setTranscribeProgress(null);
      setRecorderState('recording');
      setStatusMessage('Recording in progress...');
    } catch (error) {
      setRecorderState('error');
      setStatusMessage(
        `Failed to start recording: ${(error as Error).message || 'Unknown error'}`,
      );
    }
  }, [
    ensureStorageLayout,
    isPreparingModel,
    isTranscribing,
    recorderState,
    requestAudioPermission,
  ]);

  const stopRecording = useCallback(async () => {
    if (recorderState !== 'recording') {
      return;
    }

    try {
      setStatusMessage('Stopping recorder...');

      const rawPath = await AudioRecord.stop();
      if (!rawPath) {
        throw new Error('Recorder did not return an output path.');
      }

      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }

      const sourcePath = normalizePath(rawPath);
      const expectedPath = expectedOutputPathRef.current;
      let finalPath = sourcePath;

      if (expectedPath && sourcePath !== expectedPath) {
        if (await RNFS.exists(expectedPath)) {
          await RNFS.unlink(expectedPath);
        }
        await RNFS.moveFile(sourcePath, expectedPath);
        finalPath = expectedPath;
      }

      const exists = await RNFS.exists(finalPath);
      if (!exists) {
        throw new Error('Recorded file was not found on disk.');
      }

      const stats = await RNFS.stat(finalPath);
      const size = Number(stats.size || 0);
      if (size <= 0) {
        throw new Error('Recorded file is empty. Please record again.');
      }

      const startedAt = recordingStartedAtRef.current;
      const durationMs = startedAt ? Date.now() - startedAt : 0;

      setElapsedMs(durationMs);
      setRecordedFilePath(finalPath);
      setRecordedSizeBytes(size);
      setRecordedDurationMs(durationMs);
      setRecorderState('recorded');
      setStatusMessage('Recording has been saved. Starting transcription...');

      await transcribeRecording(finalPath);
    } catch (error) {
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }
      setRecorderState('error');
      setStatusMessage(
        `Failed to stop recording: ${(error as Error).message || 'Unknown error'}`,
      );
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
      await enqueueNote({user_id: userId, raw_transcript: candidate});
      const {sent} = await flushQueue();
      setSubmittedAt(Date.now());
      setStatusMessage(
        sent > 0
          ? 'Note saved and synced.'
          : 'Note saved locally — will sync when connected.',
      );
    } catch (error) {
      setStatusMessage(
        `Failed to save note: ${(error as Error).message || 'Unknown error'}`,
      );
    } finally {
      setIsSubmitting(false);
    }
  }, [editDraft, isEditing, isSubmitting, transcription, userId]);

  const permissionText =
    permissionState === 'checking'
      ? 'Checking microphone permission...'
      : permissionState === 'granted'
      ? 'Microphone permission granted.'
      : 'Microphone permission not granted yet.';

  const onRecordButtonPress = useCallback(() => {
    if (isPreparingModel || isTranscribing) {
      return;
    }
    if (recorderState === 'recording') {
      void stopRecording();
      return;
    }
    void startRecording();
  }, [isPreparingModel, isTranscribing, recorderState, startRecording, stopRecording]);

  const primaryText = isPreparingModel
    ? 'Preparing Whisper base model...'
    : isTranscribing
    ? 'Transcribing with Whisper base...'
    : recorderState === 'recording'
    ? 'Tap to stop recording'
    : 'Tap to start recording';

  const pulseScale = pulseValue.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.28],
  });

  const pulseOpacity = pulseValue.interpolate({
    inputRange: [0, 1],
    outputRange: [0.42, 0.08],
  });

  const detailsText = useMemo(() => {
    if (!recordedFilePath) {
      return 'No recording captured yet.';
    }
    const duration =
      recordedDurationMs !== null ? formatDuration(recordedDurationMs) : '00:00';
    return `Path: ${recordedFilePath}\nSize: ${recordedSizeBytes ?? 0} bytes\nDuration: ${duration}`;
  }, [recordedDurationMs, recordedFilePath, recordedSizeBytes]);

  const modelProgressText = useMemo(() => {
    if (modelProgress === null) {
      return 'Model: base';
    }
    return `Model: base (${Math.round(modelProgress * 100)}%)`;
  }, [modelProgress]);

  const transcribeProgressText = useMemo(() => {
    if (!isTranscribing || transcribeProgress === null) {
      return null;
    }
    return `Transcribing: ${Math.round(transcribeProgress)}%`;
  }, [isTranscribing, transcribeProgress]);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0f172a" />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.screen}
        showsVerticalScrollIndicator={true}>
        <Text style={styles.title}>Voice Notes</Text>
        <Text style={styles.subtitle}>{permissionText}</Text>

        <View style={styles.micArea}>
          {recorderState === 'recording' ? (
            <Animated.View
              pointerEvents="none"
              style={[
                styles.pulseRing,
                {opacity: pulseOpacity, transform: [{scale: pulseScale}]},
              ]}
            />
          ) : null}

          <TouchableOpacity
            activeOpacity={0.86}
            style={[
              styles.micButton,
              recorderState === 'recording' ? styles.micButtonRecording : null,
            ]}
            onPress={onRecordButtonPress}>
            <Text style={styles.micText}>
              {recorderState === 'recording' ? 'REC' : 'MIC'}
            </Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.primaryText}>{primaryText}</Text>
        <Text style={styles.timer}>{formatDuration(elapsedMs)}</Text>
        <Text style={styles.modelText}>{modelProgressText}</Text>

        {recorderState === 'recorded' ? (
          <Text style={styles.savedText}>Recording has been saved.</Text>
        ) : null}

        <Text style={styles.statusText}>{statusMessage}</Text>
        {transcribeProgressText ? (
          <Text style={styles.statusText}>{transcribeProgressText}</Text>
        ) : null}
        <Text style={styles.details}>{detailsText}</Text>

        <View style={styles.transcriptCard}>
          <Text style={styles.transcriptTitle}>Transcription</Text>
          {isEditing ? (
            <TextInput
              style={styles.transcriptInput}
              value={editDraft}
              onChangeText={setEditDraft}
              multiline
              placeholder="Edit transcription..."
              placeholderTextColor="#475569"
              editable={!isSubmitting}
              textAlignVertical="top"
            />
          ) : (
            <Text style={styles.transcriptText}>
              {transcription || 'No transcription yet.'}
            </Text>
          )}

          {transcription && submittedAt === null ? (
            <View style={styles.transcriptButtonsRow}>
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

          {submittedAt !== null ? (
            <Text style={styles.submittedText}>✓ Submitted</Text>
          ) : null}
        </View>
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
    alignItems: 'center',
    justifyContent: 'center',
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
  },
  micArea: {
    marginTop: 30,
    width: 250,
    height: 250,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pulseRing: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: '#ef4444',
  },
  micButton: {
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: '#1d4ed8',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#1d4ed8',
    shadowOpacity: 0.5,
    shadowRadius: 12,
    shadowOffset: {width: 0, height: 6},
    elevation: 8,
  },
  micButtonRecording: {
    backgroundColor: '#dc2626',
    shadowColor: '#dc2626',
  },
  micText: {
    color: '#ffffff',
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: 1,
  },
  primaryText: {
    marginTop: 16,
    color: '#e2e8f0',
    fontSize: 20,
    fontWeight: '700',
  },
  timer: {
    marginTop: 8,
    color: '#f8fafc',
    fontSize: 40,
    fontWeight: '800',
    letterSpacing: 1,
  },
  modelText: {
    marginTop: 8,
    color: '#94a3b8',
    fontSize: 13,
  },
  savedText: {
    marginTop: 10,
    color: '#22c55e',
    fontSize: 16,
    fontWeight: '700',
  },
  statusText: {
    marginTop: 16,
    color: '#cbd5e1',
    fontSize: 14,
    textAlign: 'center',
  },
  details: {
    marginTop: 12,
    color: '#94a3b8',
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
  },
  transcriptCard: {
    marginTop: 16,
    width: '100%',
    backgroundColor: '#1e293b',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  transcriptTitle: {
    color: '#f8fafc',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 6,
  },
  transcriptText: {
    color: '#cbd5e1',
    fontSize: 13,
    lineHeight: 18,
  },
  transcriptInput: {
    color: '#cbd5e1',
    fontSize: 13,
    lineHeight: 18,
    backgroundColor: '#0f172a',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    minHeight: 100,
  },
  transcriptButtonsRow: {
    flexDirection: 'row',
    marginTop: 12,
  },
  smallButton: {
    backgroundColor: '#334155',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginRight: 8,
  },
  smallButtonDisabled: {
    opacity: 0.5,
  },
  smallButtonText: {
    color: '#f8fafc',
    fontWeight: '600',
    fontSize: 13,
  },
  saveButton: {
    backgroundColor: '#1d4ed8',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  saveButtonText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 13,
  },
  submittedText: {
    marginTop: 10,
    color: '#22c55e',
    fontSize: 13,
    fontWeight: '600',
  },
});

export default RecordScreen;
