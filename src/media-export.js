export function isMp4File(file) {
  return Boolean(file && (file.type === 'video/mp4' || file.type === 'application/mp4' || /\.mp4$/i.test(file.name)));
}

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
  } else if (format === 'mp4') {
    const { registerAacEncoder } = await import('@mediabunny/aac-encoder');
    registerAacEncoder();
    outputFormat = new Mp4OutputFormat({ fastStart: 'in-memory' });
    audioCodec = 'aac';
  } else {
    throw new Error('Choose WAV, MP3, or MP4 as the download format.');
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
    if (format === 'mp4' && sourceFile && isMp4File(sourceFile)) {
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
          throw new Error(`This MP4 video codec cannot be copied into the enhanced file${detail}.`);
        }
      }
    }

    await output.start();
    const tasks = [audioSource.add(audioBuffer).then(() => audioSource.close())];
    if (conversion) tasks.push(conversion.execute());
    await Promise.all(tasks);
    await output.finalize();

    if (!target.buffer) throw new Error('The enhanced file could not be created.');
    return new Blob([target.buffer], { type: format === 'mp3' ? 'audio/mpeg' : 'video/mp4' });
  } catch (error) {
    if (output.state !== 'finalized' && output.state !== 'canceled') {
      await output.cancel().catch(() => {});
    }
    throw error;
  } finally {
    input?.dispose();
  }
}
