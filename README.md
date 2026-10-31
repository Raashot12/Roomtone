# Roomtone

A local-first voice cleanup workspace built with React and Vite. Add an audio recording or an MP4 video with an audio track, compare the original with a processed preview, then download the result as WAV or MP3. For MP4 video input, export an enhanced MP4 with the original video and processed audio. The separate video extraction workflow accepts MP4 or WebM files up to 50 MB, cleans the extracted audio, and downloads it as WAV or MP3. Enhanced projects, source files, and voice settings are saved in the browser's IndexedDB on the user's device.

## Run locally

```bash
npm install
npm run dev
```

Open the local URL printed by Vite. To create a production build, run `npm run build`.

## Offline use and local projects

The production app uses a service worker to cache its app shell, scripts, styles, fonts, and audio-processing models. Let the first online load finish so the cache is ready before going offline. In supported browsers, choose **Install app** in the top bar; on iPhone or iPad, open Roomtone in Safari, tap **Share**, then **Add to Home Screen**. New versions wait for you to reload before they replace the open app. The audio files and enhanced projects are stored separately in IndexedDB on the device; clearing browser site data removes those projects. Browser storage limits vary, so download important exports as a backup. The service worker is generated in production builds and works when served over HTTPS or localhost; it is disabled on Vite's development server.

## Support email

The Support tab opens a prefilled email in the visitor’s email app. The public destination is set in `src/support-config.js`; `VITE_SUPPORT_EMAIL` can override it in `.env.local` or Vercel. Since the address is used in a `mailto:` link, it is visible in the browser app. The message composer supports bold, italic, and bulleted lists; formatting is carried into the plain-text email draft as Markdown.

## Audio processing

Audio stays in the browser. Roomtone runs the open-source RNNoise recurrent neural noise suppressor in a Web Worker, then applies Web Audio EQ and compression with an optional pause gate. Exports include 16-bit PCM WAV, MP3, and MP4. For MP4 input, the original video track is copied into the enhanced MP4 and the processed audio replaces its original audio. MP4 import still depends on the browser being able to decode its audio track. RNNoise is focused on reducing noise around speech; it does not recreate a voice the way a large cloud speech restoration model can.

The RNNoise implementation and bundled model come from [`@audio/neural-denoise`](https://github.com/audiojs/neural/tree/main/packages/neural-denoise), which includes the BSD-3-Clause RNNoise attribution and additional dependency notices. Source copies are in [`licenses/`](./licenses/), and the app serves them at `/licenses/`.

Media muxing and MP3/AAC encoding use Mediabunny and its encoder extensions, distributed under the Mozilla Public License 2.0. A copy is available at [`/licenses/mediabunny-LICENSE.txt`](./public/licenses/mediabunny-LICENSE.txt).
