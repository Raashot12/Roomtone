export const MAX_SUBTITLE_FILE_SIZE = 200 * 1024 * 1024;
export const MAX_SUBTITLE_DURATION = 30 * 60;

const SAMPLE_RATE = 16_000;
const MAX_CUE_CHARACTERS = 42;
const MAX_CUE_SECONDS = 5.5;

export async function resampleToMono(audioBuffer, onProgress, targetRate = SAMPLE_RATE) {
  const outputLength = Math.ceil((audioBuffer.length / audioBuffer.sampleRate) * targetRate);
  const output = new Float32Array(outputLength);
  const channels = Array.from(
    { length: audioBuffer.numberOfChannels },
    (_, channel) => audioBuffer.getChannelData(channel),
  );
  const ratio = audioBuffer.sampleRate / targetRate;

  const batchSize = targetRate * 3;
  for (let batchStart = 0; batchStart < outputLength; batchStart += batchSize) {
    const batchEnd = Math.min(outputLength, batchStart + batchSize);
    for (let outputIndex = batchStart; outputIndex < batchEnd; outputIndex += 1) {
      const sourceStart = Math.floor(outputIndex * ratio);
      const sourceEnd = Math.min(audioBuffer.length, Math.max(sourceStart + 1, Math.floor((outputIndex + 1) * ratio)));
      let sum = 0;
      let count = 0;
      for (let sourceIndex = sourceStart; sourceIndex < sourceEnd; sourceIndex += 1) {
        for (const channel of channels) {
          sum += channel[sourceIndex];
          count += 1;
        }
      }
      output[outputIndex] = count ? sum / count : 0;
    }
    onProgress?.((batchEnd / outputLength) * 100);
    if (batchEnd < outputLength) await new Promise((resolve) => window.setTimeout(resolve, 0));
  }

  return output;
}

export function groupWordTimestamps(chunks, duration) {
  const words = (chunks || [])
    .map((chunk) => {
      const [start, end] = chunk.timestamp || [];
      return {
        text: String(chunk.text || ''),
        start: start == null ? Number.NaN : Number(start),
        end: end == null ? Number.NaN : Number(end),
      };
    })
    .filter((word) => word.text && Number.isFinite(word.start));

  if (!words.length) return [];

  const cues = [];
  let pending = [];

  const flush = () => {
    if (!pending.length) return;
    const text = pending.map((word) => word.text).join('').replace(/\s+([.,!?;:])/g, '$1').trim();
    const start = Math.max(0, pending[0].start);
    const last = pending[pending.length - 1];
    const end = Math.min(duration || Number.POSITIVE_INFINITY, Math.max(start + 0.25, Number.isFinite(last.end) ? last.end : start + 1.2));
    if (text) cues.push({ id: cues.length + 1, start, end, text });
    pending = [];
  };

  for (const word of words) {
    const pendingText = pending.map((item) => item.text).join('');
    const first = pending[0];
    const last = pending[pending.length - 1];
    const sentenceEnds = /[.!?]["')\]]?$/.test(last?.text.trim() || '');
    const wouldBeTooLong = pending.length && `${pendingText} ${word.text}`.length > MAX_CUE_CHARACTERS;
    const wouldRunTooLong = pending.length && word.start - first.start > MAX_CUE_SECONDS;

    if (wouldBeTooLong || wouldRunTooLong || (sentenceEnds && word.start - first.start > 1.1)) flush();
    pending.push(word);
  }

  flush();
  return cues;
}

function toTimestamp(seconds, separator) {
  const totalMilliseconds = Math.max(0, Math.round(seconds * 1000));
  const hours = Math.floor(totalMilliseconds / 3_600_000);
  const minutes = Math.floor((totalMilliseconds % 3_600_000) / 60_000);
  const wholeSeconds = Math.floor((totalMilliseconds % 60_000) / 1000);
  const milliseconds = totalMilliseconds % 1000;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(wholeSeconds).padStart(2, '0')}${separator}${String(milliseconds).padStart(3, '0')}`;
}

export function formatSrt(cues) {
  return cues.filter((cue) => cue.text.trim()).map((cue, index) => `${index + 1}\n${toTimestamp(cue.start, ',')} --> ${toTimestamp(cue.end, ',')}\n${cue.text.trim()}`).join('\n\n') + '\n';
}

export function formatVtt(cues) {
  return `WEBVTT\n\n${cues.filter((cue) => cue.text.trim()).map((cue) => `${toTimestamp(cue.start, '.')} --> ${toTimestamp(cue.end, '.')}\n${cue.text.trim()}`).join('\n\n')}\n`;
}
