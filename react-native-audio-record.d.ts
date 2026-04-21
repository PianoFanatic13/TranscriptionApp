declare module 'react-native-audio-record' {
  type AudioRecordOptions = {
    sampleRate?: number;
    channels?: 1 | 2;
    bitsPerSample?: 8 | 16;
    audioSource?: number;
    wavFile?: string;
  };

  type AudioRecordEvent = 'data';

  interface AudioRecordModule {
    init: (options: AudioRecordOptions) => void;
    start: () => void;
    stop: () => Promise<string>;
    on: (
      event: AudioRecordEvent,
      callback: (data: string) => void,
    ) => {remove: () => void};
  }

  const AudioRecord: AudioRecordModule;
  export default AudioRecord;
}
