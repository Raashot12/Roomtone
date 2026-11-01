# Roomtone

A local-first voice cleanup workspace built with React and Vite. Add an audio recording or an MP4 or MOV video with an audio track, compare the original with a processed preview, then download the result as WAV or MP3. For MP4 or MOV video input, export an enhanced video with the original picture and processed audio. The separate video extraction workflow accepts MP4, MOV, or WebM files up to 200 MB, cleans the extracted audio, and downloads it as WAV or MP3. Enhanced projects, source files, and voice settings are saved in the browser's IndexedDB on the user's device.

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

Audio stays in the browser. Roomtone runs the open-source RNNoise recurrent neural noise suppressor in a Web Worker, then applies Web Audio EQ, compression, and an adjustable, smoothed room-tail suppressor. The tail control lowers quiet sound between phrases; it cannot remove reflections mixed into active speech or recreate studio acoustics. Strong settings can soften quiet words. Exports include 16-bit PCM WAV, MP3, MP4, and MOV. For MP4 or MOV input, the original video track is copied into the enhanced video and the processed audio replaces its original audio. MP4/M4A import tries native browser decoders first, then uses a local FFmpeg/WASM decoder when required, so AAC audio can still be opened when the browser has no supported stream. RNNoise reduces noise around speech, but very loud or rapidly changing noise can remain.

The RNNoise implementation and bundled model come from [`@audio/neural-denoise`](https://github.com/audiojs/neural/tree/main/packages/neural-denoise), which includes the BSD-3-Clause RNNoise attribution and additional dependency notices. Source copies are in [`licenses/`](./licenses/), and the app serves them at `/licenses/`.

Media muxing and MP3/AAC encoding use Mediabunny and its encoder extensions, distributed under the Mozilla Public License 2.0. A copy is available at [`/licenses/mediabunny-LICENSE.txt`](./public/licenses/mediabunny-LICENSE.txt).

The MP4/M4A compatibility decoder uses [`@wasmpeg/cpu`](https://github.com/wasmpeg/wasmpeg) 1.0.1, distributed under LGPL-2.1-or-later. The app serves the license and notices at [`/licenses/wasmpeg-LICENSE.txt`](./public/licenses/wasmpeg-LICENSE.txt) and [`/licenses/wasmpeg-NOTICE.txt`](./public/licenses/wasmpeg-NOTICE.txt).
