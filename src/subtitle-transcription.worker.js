import { pipeline } from '@huggingface/transformers';

// Each multilingual export includes cross-attention outputs required for word timestamps.
const MODEL_IDS = {
  faster: 'onnx-community/whisper-tiny_timestamped',
  balanced: 'onnx-community/whisper-small_timestamped',
  max: 'onnx-community/whisper-medium_timestamped',
};
const QUALITY_LABELS = { faster: 'Faster', balanced: 'Balanced', max: 'Max' };
let transcriberPromise;

async function getTranscriber(quality) {
  if (!transcriberPromise) {
    transcriberPromise = pipeline('automatic-speech-recognition', MODEL_IDS[quality], {
      dtype: 'q8',
      progress_callback: (progress) => {
        const { status, progress: percent, loaded, total } = progress || {};
        self.postMessage({ type: 'model-progress', progress: { status, percent, loaded, total } });
      },
    }).catch((error) => {
      transcriberPromise = undefined;
      throw error;
    });
  }
  return transcriberPromise;
}

self.onmessage = async (event) => {
  const { audio, language, quality: requestedQuality } = event.data || {};
  const quality = MODEL_IDS[requestedQuality] ? requestedQuality : 'balanced';
  if (!(audio instanceof Float32Array) || audio.length === 0) {
    self.postMessage({ type: 'error', error: 'The audio track could not be prepared for transcription.' });
    return;
  }

  try {
    self.postMessage({ type: 'stage', stage: `Loading ${QUALITY_LABELS[quality]} model…` });
    const transcriber = await getTranscriber(quality);
    self.postMessage({ type: 'stage', stage: 'Listening for speech…' });
    const result = await transcriber(audio, {
      return_timestamps: 'word',
      chunk_length_s: 30,
      stride_length_s: 5,
      task: 'transcribe',
      // Transformers.js currently defaults to English when language is omitted.
      language: language || 'english',
    });
    self.postMessage({ type: 'complete', result });
  } catch (error) {
    self.postMessage({ type: 'error', error: error?.message || 'Speech recognition could not read this file.' });
  }
};
