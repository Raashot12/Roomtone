export function isMp4File(file) {
  return Boolean(file && (
    file.type === 'video/mp4'
    || file.type === 'application/mp4'
    || /\.mp4$/i.test(file.name)
  ));
}

export function isMovFile(file) {
  return Boolean(file && (
    ['video/quicktime', 'video/x-quicktime', 'video/mov', 'application/quicktime'].includes(file.type)
    || /\.mov$/i.test(file.name)
  ));
}

export function isSupportedVideoFile(file) {
  return Boolean(file && (
    isMp4File(file)
    || isMovFile(file)
    || file.type === 'video/webm'
    || /\.(m4v|webm)$/i.test(file.name)
  ));
}

async function decodeVideoAudioWithMediaBunny(file) {
  const { ALL_FORMATS, AudioBufferSink, BlobSource, Input } = await import('mediabunny');
  const input = new Input({ source: new BlobSource(file), formats: ALL_FORMATS });

  try {
    const audioTrack = await input.getPrimaryAudioTrack();
    if (!audioTrack) throw new Error('No audio track was found in this video.');
    if (!(await audioTrack.canDecode())) {
      throw new Error('This video’s audio codec is not supported by your browser. Try a MOV with AAC or PCM audio.');
    }

    const sink = new AudioBufferSink(audioTrack);
    const chunks = [];
    for await (const chunk of sink.buffers()) chunks.push(chunk);
    if (chunks.length === 0) throw new Error('No decodable audio was found in this video.');

    const sampleRate = chunks[0].buffer.sampleRate;
    let numberOfChannels = 0;
    let duration = 0;
    for (const { buffer, timestamp, duration: chunkDuration } of chunks) {
      numberOfChannels = Math.max(numberOfChannels, buffer.numberOfChannels);
      duration = Math.max(duration, timestamp + Math.max(chunkDuration, buffer.length / buffer.sampleRate));
    }
    const length = Math.max(1, Math.ceil(duration * sampleRate));
    const decodedAudio = new AudioBuffer({ numberOfChannels, length, sampleRate });

    for (const { buffer, timestamp } of chunks) {
      const destinationStart = Math.max(0, Math.round(timestamp * sampleRate));
      const sourceStart = Math.max(0, Math.round(-timestamp * buffer.sampleRate));
      const frameCount = Math.min(
        buffer.length - sourceStart,
        length - destinationStart,
      );
      if (frameCount <= 0) continue;

      for (let channel = 0; channel < Math.min(numberOfChannels, buffer.numberOfChannels); channel += 1) {
        decodedAudio.getChannelData(channel).set(
          buffer.getChannelData(channel).subarray(sourceStart, sourceStart + frameCount),
          destinationStart,
        );
      }
    }

    return decodedAudio;
  } finally {
    input.dispose();
  }
}

export async function decodeVideoAudio(file) {
  const AudioContextClass = globalThis.AudioContext || globalThis.webkitAudioContext;
  let browserDecodeError;

  if (AudioContextClass) {
    const context = new AudioContextClass();
    try {
      return await context.decodeAudioData((await file.arrayBuffer()).slice(0));
    } catch (error) {
      browserDecodeError = error;
    } finally {
      if (context.state !== 'closed') await context.close().catch(() => {});
    }
  }

  try {
    return await decodeVideoAudioWithMediaBunny(file);
  } catch (error) {
    if (error?.message?.startsWith('No audio track')) throw error;
    if (isMovFile(file)) {
      throw new Error(error?.message || 'This MOV audio track could not be decoded. Try a MOV with AAC or PCM audio.');
    }
    throw browserDecodeError || error;
  }
}
