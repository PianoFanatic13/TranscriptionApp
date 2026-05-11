import RNFS from 'react-native-fs';

export const whisperFileDir = `${RNFS.DocumentDirectoryPath}/voice-notes/models`;
export const whisperModelHost =
  'https://huggingface.co/ggerganov/whisper.cpp/resolve/main';

export type WhisperModel = 'tiny' | 'base' | 'small' | 'medium' | 'large';

export const createDir = async (
  log?: (message: string) => void,
): Promise<string> => {
  if (!(await RNFS.exists(whisperFileDir))) {
    log?.(`Create dir ${whisperFileDir}`);
    await RNFS.mkdir(whisperFileDir);
  }

  return whisperFileDir;
};

export const downloadModel = async (
  model: WhisperModel,
  onProgress?: (progress: number) => void,
  log?: (message: string) => void,
): Promise<string> => {
  const modelFileName = `ggml-${model}.bin`;
  const modelPath = `${whisperFileDir}/${modelFileName}`;
  const modelUrl = `${whisperModelHost}/${modelFileName}`;

  await createDir(log);

  if (await RNFS.exists(modelPath)) {
    onProgress?.(1);
    log?.(`Model ${model} already exists at ${modelPath}`);
    return modelPath;
  }

  log?.(`Downloading ${model} model from ${modelUrl}`);

  try {
    await RNFS.downloadFile({
      fromUrl: modelUrl,
      toFile: modelPath,
      progress: onProgress
        ? res => {
            if (res.contentLength > 0) {
              onProgress(res.bytesWritten / res.contentLength);
            }
          }
        : undefined,
    }).promise;

    onProgress?.(1);
    log?.(`Successfully downloaded ${model} model to ${modelPath}`);
    return modelPath;
  } catch (error) {
    log?.(`Failed to download ${model} model: ${String(error)}`);
    if (await RNFS.exists(modelPath)) {
      await RNFS.unlink(modelPath);
    }
    throw error;
  }
};
