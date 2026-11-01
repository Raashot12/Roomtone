export function isMp4File(file) {
  return Boolean(file && (
    file.type === 'video/mp4'
    || file.type === 'application/mp4'
    || /\.mp4$/i.test(file.name)
  ));
}

export function isMp4AudioFile(file) {
  return Boolean(file && (
    ['video/mp4', 'application/mp4', 'audio/mp4', 'audio/x-m4a'].includes(file.type)
    || /\.(mp4|m4v|m4a)$/i.test(file.name)
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

function waitForMediaEvent(media, eventName) {
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      media.removeEventListener(eventName, onSuccess);
      media.removeEventListener('error', onError);
    };
    const onSuccess = () => {
      cleanup();
      resolve();
    };
    const onError = () => {
      cleanup();
      reject(new Error(media.error?.message || 'The browser could not read the MP4 audio track.'));
    };

    media.addEventListener(eventName, onSuccess, { once: true });
    media.addEventListener('error', onError, { once: true });
  });
}

async function decodeMp4AudioWithMediaElement(file, context) {
  const audio = new Audio();
  const audioFile = file.slice(0, file.size, 'audio/mp4');
  const url = URL.createObjectURL(audioFile);
  let source;
  let processor;
  let silentGain;
  const channelChunks = [[], []];
  let capturedFrames = 0;

  try {
    audio.preload = 'auto';
    audio.src = url;
    audio.load();
    await waitForMediaEvent(audio, 'loadedmetadata');
    if (!Number.isFinite(audio.duration) || audio.duration <= 0) {
      throw new Error('The MP4 audio track has no readable duration.');
    }

    source = context.createMediaElementSource(audio);
    processor = context.createScriptProcessor(4096, 2, 2);
    silentGain = context.createGain();
    silentGain.gain.value = 0;
    processor.onaudioprocess = (event) => {
      const input = event.inputBuffer;
      const channels = Math.min(2, input.numberOfChannels);
      for (let channel = 0; channel < channels; channel += 1) {
        channelChunks[channel].push(new Float32Array(input.getChannelData(channel)));
      }
      capturedFrames += input.length;
      for (let channel = 0; channel < event.outputBuffer.numberOfChannels; channel += 1) {
        event.outputBuffer.getChannelData(channel).fill(0);
      }
    };
    source.connect(processor);
    processor.connect(silentGain);
    silentGain.connect(context.destination);

    await context.resume();
    await audio.play();
    if (!audio.ended) await waitForMediaEvent(audio, 'ended');

    const numberOfChannels = channelChunks[1].length ? 2 : 1;
    const length = Math.min(capturedFrames, Math.ceil(audio.duration * context.sampleRate));
    if (length <= 0) throw new Error('The MP4 audio track produced no decoded samples.');

    const decodedAudio = context.createBuffer(numberOfChannels, length, context.sampleRate);
    for (let channel = 0; channel < numberOfChannels; channel += 1) {
      const destination = decodedAudio.getChannelData(channel);
      let offset = 0;
      for (const chunk of channelChunks[channel]) {
        if (offset >= length) break;
        const frameCount = Math.min(chunk.length, length - offset);
        destination.set(chunk.subarray(0, frameCount), offset);
        offset += frameCount;
      }
    }

    return decodedAudio;
  } finally {
    audio.pause();
    audio.removeAttribute('src');
    audio.load();
    if (source) source.disconnect();
    if (processor) processor.disconnect();
    if (silentGain) silentGain.disconnect();
    URL.revokeObjectURL(url);
  }
}

async function decodeMp4AudioWithSoftwareDecoder(file, context, onFallbackStage) {
  onFallbackStage?.('Loading MP4 audio decoder…');
  const { default: wasmpeg } = await import('@wasmpeg/cpu');
  const wasmPath = new URL(`${import.meta.env.BASE_URL}wasmpeg/cpu.js`, window.location.href).href;
  await wasmpeg.load({ wasmPath });

  onFallbackStage?.('Decoding MP4 audio…');
  const decoder = await wasmpeg.decodeAudio(file);
  try {
    const chunks = [];
    let totalSamples = 0;
    let chunk;
    while ((chunk = decoder.nextSamples())) {
      if (!chunk.length) continue;
      chunks.push(chunk);
      totalSamples += chunk.length;
    }

    const numberOfChannels = decoder.channels;
    const sampleRate = decoder.sampleRate;
    if (!numberOfChannels || !sampleRate || totalSamples <= 0) {
      throw new Error('The MP4 audio track produced no decoded samples.');
    }
    const frameCount = Math.floor(totalSamples / numberOfChannels);
    if (frameCount <= 0) throw new Error('The MP4 audio track produced no complete sample frames.');

    const options = { numberOfChannels, length: frameCount, sampleRate };
    const decodedAudio = context && context.state !== 'closed'
      ? context.createBuffer(numberOfChannels, frameCount, sampleRate)
      : new AudioBuffer(options);

    const channels = Array.from({ length: numberOfChannels }, (_, index) => decodedAudio.getChannelData(index));
    let frameOffset = 0;
    for (const samples of chunks) {
      const framesInChunk = Math.min(
        Math.floor(samples.length / numberOfChannels),
        frameCount - frameOffset,
      );
      for (let channel = 0; channel < numberOfChannels; channel += 1) {
        const destination = channels[channel];
        for (let frame = 0; frame < framesInChunk; frame += 1) {
          destination[frameOffset + frame] = samples[frame * numberOfChannels + channel];
        }
      }
      frameOffset += framesInChunk;
      if (frameOffset >= frameCount) break;
    }

    return decodedAudio;
  } finally {
    decoder.close();
  }
}

export async function decodeVideoAudio(file, onFallbackStage) {
  const AudioContextClass = globalThis.AudioContext || globalThis.webkitAudioContext;
  let browserDecodeError;
  let mediaBunnyError;
  let mediaElementError;
  let context;

  try {
    if (AudioContextClass) {
      context = new AudioContextClass();
      try {
        return await context.decodeAudioData((await file.arrayBuffer()).slice(0));
      } catch (error) {
        browserDecodeError = error;
      }
    }

    try {
      return await decodeVideoAudioWithMediaBunny(file);
    } catch (error) {
      mediaBunnyError = error;
      if (error?.message?.startsWith('No audio track')) throw error;
    }
    if (isMp4AudioFile(file) && context) {
      try {
        return await decodeMp4AudioWithMediaElement(file, context);
      } catch (error) {
        mediaElementError = error;
      }
    }

    if (isMp4AudioFile(file)) {
      try {
        return await decodeMp4AudioWithSoftwareDecoder(file, context, onFallbackStage);
      } catch (error) {
        const reason = error?.message || 'The software decoder could not read this MP4 audio track.';
        const browserReason = mediaElementError?.message;
        throw new Error(`Roomtone could not decode this MP4 audio track. ${reason}${browserReason ? ` Browser decoder: ${browserReason}` : ''}`);
      }
    }

    if (isMovFile(file)) {
      throw new Error(mediaBunnyError?.message || browserDecodeError?.message || 'This MOV audio track could not be decoded. Try a MOV with AAC or PCM audio.');
    }
    throw mediaBunnyError || browserDecodeError || new Error('Unable to decode audio data.');
  } finally {
    if (context && context.state !== 'closed') await context.close().catch(() => {});
  }
}
