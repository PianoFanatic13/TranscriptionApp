declare module 'react-native-sound' {
  export type SoundCallback = (success: boolean) => void;
  export type SoundConstructorCallback = (error: unknown) => void;

  export default class Sound {
    constructor(
      filename: string,
      basePath: string,
      onError?: SoundConstructorCallback,
    );

    play(onEnd?: SoundCallback): void;
    stop(onStop?: () => void): void;
    release(): void;

    static setCategory(category: string, mixWithOthers?: boolean): void;
  }
}
