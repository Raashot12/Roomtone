import { isMovFile, isMp4File } from './media-import.js';

export async function encodeEnhancedMedia({ audioBuffer, sourceFile, format, onProgress }) {
  const {
    ALL_FORMATS,
    AudioBufferSource,
    BlobSource,
    BufferTarget,
    Conversion,
    Input,
    Mp3OutputFormat,
    Mp4OutputFormat,
    MovOutputFormat,
    Output,
    Quality,
  } = await import('mediabunny');

  let outputFormat;
  let audioCodec;
  if (format === 'mp3') {
    const { registerMp3Encoder } = await import('@mediabunny/mp3-encoder');
    registerMp3Encoder();
    outputFormat = new Mp3OutputFormat();
    audioCodec = 'mp3';
  } else if (format === 'mp4' || format === 'mov') {
    const { registerAacEncoder } = await import('@mediabunny/aac-encoder');
    registerAacEncoder();
    outputFormat = format === 'mov'
      ? new MovOutputFormat({ fastStart: 'in-memory' })
      : new Mp4OutputFormat({ fastStart: 'in-memory' });
    audioCodec = 'aac';
  } else {
    throw new Error('Choose WAV, MP3, MP4, or MOV as the download format.');
  }

  const target = new BufferTarget();
  const output = new Output({ format: outputFormat, target });
  const audioSource = new AudioBufferSource({
    codec: audioCodec,
    quality: new Quality({ bitrate: 192_000 }),
  });
  output.addAudioTrack(audioSource);

  let input = null;
  let conversion = null;
  try {
    const preserveVideo = (format === 'mp4' && isMp4File(sourceFile))
      || (format === 'mov' && isMovFile(sourceFile));
    if (preserveVideo) {
      input = new Input({ source: new BlobSource(sourceFile), formats: ALL_FORMATS });
      const videoTrack = await input.getPrimaryVideoTrack();
      if (videoTrack) {
        conversion = await Conversion.init({
          input,
          output,
          tracks: 'primary',
          audio: { discard: true },
          composable: true,
          showWarnings: false,
        });
        conversion.onProgress = (progress) => onProgress?.(progress);
        const videoWasKept = conversion.utilizedTracks.some((track) => track.type === 'video');
        if (!videoWasKept) {
          const reason = conversion.discardedTracks.find(({ track }) => track === videoTrack)?.reason;
          const detail = reason ? ` (${reason.replaceAll('_', ' ')})` : '';
          const container = format.toUpperCase();
          throw new Error(`This video codec cannot be copied into the enhanced ${container} file${detail}.`);
        }
      }
    }

    await output.start();
    const tasks = [audioSource.add(audioBuffer).then(() => audioSource.close())];
    if (conversion) tasks.push(conversion.execute());
    await Promise.all(tasks);
    await output.finalize();

    if (!target.buffer) throw new Error('The enhanced file could not be created.');
    const mimeType = format === 'mp3'
      ? 'audio/mpeg'
      : format === 'mov' ? 'video/quicktime' : 'video/mp4';
    return new Blob([target.buffer], { type: mimeType });
  } catch (error) {
    if (output.state !== 'finalized' && output.state !== 'canceled') {
      await output.cancel().catch(() => {});
    }
    throw error;
  } finally {
    input?.dispose();
  }
}
