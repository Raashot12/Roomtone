import denoise from '@audio/neural-denoise';

self.addEventListener('message', async (event) => {
  const { id, channels, sampleRate, limit } = event.data;
  try {
    const result = await denoise(channels, {
      sampleRate,
      model: 'rnnoise',
      limit,
      music: 'pass',
    });
    const output = result.map((channel) => channel.buffer);
    self.postMessage({ id, channels: output }, output);
  } catch (error) {
    self.postMessage({ id, error: error?.message || 'RNNoise could not process this recording.' });
  }
});
