import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import '@fontsource/dm-sans/400.css';
import '@fontsource/dm-sans/500.css';
import '@fontsource/dm-sans/600.css';
import '@fontsource/dm-sans/700.css';
import '@fontsource/space-grotesk/400.css';
import '@fontsource/space-grotesk/500.css';
import '@fontsource/space-grotesk/600.css';
import '@fontsource/space-grotesk/700.css';
import {
  AudioLines,
  AudioWaveform,
  ArrowDownToLine,
  ArrowLeft,
  Bold,
  Check,
  ChevronDown,
  CircleHelp,
  Clapperboard,
  FileAudio2,
  FolderClosed,
  Headphones,
  Info,
  Italic,
  List,
  Mail,
  MoreHorizontal,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Sparkles,
  Send,
  Upload,
  Volume2,
  X,
} from 'lucide-react';
import './style.css';
import { SUPPORT_EMAIL } from './support-config.js';
import { encodeEnhancedMedia } from './media-export.js';
import { decodeVideoAudio, isMovFile, isMp4File, isSupportedVideoFile } from './media-import.js';
import AppLoader from './AppLoader.jsx';
import PWAControls from './PWAControls.jsx';
import { loadLocalProjects, saveLocalProject } from './project-storage.js';
import ExtractAudioPage from './ExtractAudioPage.jsx';

const presets = {
  natural: { label: 'Natural', description: 'Clear and balanced', presence: 54, leveling: 48, noiseReduction: 62 },
  bright: { label: 'Bright', description: 'More detail up front', presence: 76, leveling: 42, noiseReduction: 68 },
  warm: { label: 'Warm', description: 'Softer, fuller tone', presence: 34, leveling: 62, noiseReduction: 48 },
};

const PUBLIC_PAGE_METADATA = {
  enhance: {
    title: 'Roomtone: Browser Audio Cleaner & Voice Noise Removal',
    description: 'Clean up voice recordings in your browser with Roomtone. Reduce background noise, shape the sound, and export WAV or MP3. Your files stay on your device.',
    url: 'https://roomtone-flax.vercel.app/',
  },
  extract: {
    title: 'Extract Audio from Video Online | Roomtone',
    description: 'Extract audio from MP4, MOV, or WebM videos up to 200 MB in your browser. Reduce background noise and download WAV or MP3; files stay on your device.',
    url: 'https://roomtone-flax.vercel.app/extract-audio-from-video/',
  },
};

function updatePublicPageMetadata(view) {
  if (typeof document === 'undefined') return;
  const metadata = view === 'extract' ? PUBLIC_PAGE_METADATA.extract : PUBLIC_PAGE_METADATA.enhance;
  const setContent = (selector, value) => document.querySelector(selector)?.setAttribute('content', value);

  document.title = metadata.title;
  document.querySelector('link[rel="canonical"]')?.setAttribute('href', metadata.url);
  setContent('meta[name="description"]', metadata.description);
  setContent('meta[property="og:title"]', metadata.title);
  setContent('meta[property="og:description"]', metadata.description);
  setContent('meta[property="og:url"]', metadata.url);
  setContent('meta[name="twitter:title"]', metadata.title);
  setContent('meta[name="twitter:description"]', metadata.description);

  const schemaElement = document.getElementById('roomtone-webapp-schema');
  if (schemaElement) {
    const schema = JSON.parse(schemaElement.textContent || '{}');
    schema.url = metadata.url;
    schema.description = metadata.description;
    schemaElement.textContent = JSON.stringify(schema);
  }
}

function formatTime(seconds = 0) {
  if (!Number.isFinite(seconds)) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60).toString().padStart(2, '0');
  return `${mins}:${secs}`;
}

function formatBytes(bytes = 0) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function editorNodeToMarkdown(node) {
  if (node.nodeType === Node.TEXT_NODE) return node.nodeValue || '';
  if (node.nodeType !== Node.ELEMENT_NODE) return '';

  const tag = node.tagName.toLowerCase();
  const children = Array.from(node.childNodes).map(editorNodeToMarkdown).join('');
  if (tag === 'br') return '\n';
  if (tag === 'strong' || tag === 'b') return `**${children}**`;
  if (tag === 'em' || tag === 'i') return `_${children}_`;
  if (tag === 'span' && (node.style.fontWeight === 'bold' || Number(node.style.fontWeight) >= 600)) return `**${children}**`;
  if (tag === 'span' && node.style.fontStyle === 'italic') return `_${children}_`;
  if (tag === 'ul') return `${Array.from(node.children).map((item) => `• ${editorNodeToMarkdown(item).trim()}`).join('\n')}\n`;
  if (tag === 'ol') return `${Array.from(node.children).map((item, index) => `${index + 1}. ${editorNodeToMarkdown(item).trim()}`).join('\n')}\n`;
  if (tag === 'div' || tag === 'p') return `${children}\n`;
  return children;
}

function readMessageEditor(editor) {
  return Array.from(editor.childNodes)
    .map(editorNodeToMarkdown)
    .join('')
    .replace(/[\t ]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function MessageEditor({ value, onChange }) {
  const editorRef = useRef(null);

  const updateMessage = () => {
    if (editorRef.current) onChange(readMessageEditor(editorRef.current));
  };

  const applyFormat = (command) => {
    editorRef.current?.focus();
    document.execCommand(command, false);
    updateMessage();
  };

  const pastePlainText = (event) => {
    event.preventDefault();
    document.execCommand('insertText', false, event.clipboardData.getData('text/plain'));
    updateMessage();
  };

  return (
    <div className="message-editor">
      <div className="message-editor-toolbar" role="toolbar" aria-label="Message formatting">
        <button type="button" title="Bold" aria-label="Bold" onMouseDown={(event) => event.preventDefault()} onClick={() => applyFormat('bold')}><Bold size={14} /></button>
        <button type="button" title="Italic" aria-label="Italic" onMouseDown={(event) => event.preventDefault()} onClick={() => applyFormat('italic')}><Italic size={14} /></button>
        <span aria-hidden="true" />
        <button type="button" title="Bulleted list" aria-label="Bulleted list" onMouseDown={(event) => event.preventDefault()} onClick={() => applyFormat('insertUnorderedList')}><List size={15} /></button>
      </div>
      <div
        ref={editorRef}
        className="message-editor-surface"
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-label="Message"
        aria-multiline="true"
        aria-required="true"
        aria-describedby="message-editor-note"
        data-placeholder="Write your message here…"
        onInput={updateMessage}
        onPaste={pastePlainText}
        spellCheck="true"
      />
      <div className="message-editor-footer">
        <span id="message-editor-note">Formatting is carried into the email draft as Markdown.</span>
        <span className={value.length > 5000 ? 'over-limit' : ''}>{value.length}/5000</span>
      </div>
    </div>
  );
}
function safeAudioContext() {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) throw new Error('This browser does not support audio processing. Try a current version of Chrome, Edge, or Safari.');
  return new AudioContextClass();
}

function makeWaveform(buffer, width = 140) {
  if (!buffer) return [];
  const channel = buffer.getChannelData(0);
  const samplesPerBar = Math.max(1, Math.floor(channel.length / width));
  const values = [];
  for (let i = 0; i < width; i += 1) {
    const start = i * samplesPerBar;
    let peak = 0;
    for (let j = start; j < Math.min(start + samplesPerBar, channel.length); j += 1) {
      peak = Math.max(peak, Math.abs(channel[j]));
    }
    values.push(Math.max(0.06, peak));
  }
  return values;
}

function writeWav(buffer) {
  const channels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const samples = buffer.length;
  const bytesPerSample = 2;
  const blockAlign = channels * bytesPerSample;
  const dataSize = samples * blockAlign;
  const output = new ArrayBuffer(44 + dataSize);
  const view = new DataView(output);
  const writeString = (offset, value) => {
    for (let i = 0; i < value.length; i += 1) view.setUint8(offset + i, value.charCodeAt(i));
  };
  writeString(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true);
  writeString(36, 'data');
  view.setUint32(40, dataSize, true);

  const channelData = Array.from({ length: channels }, (_, channel) => buffer.getChannelData(channel));
  let offset = 44;
  for (let i = 0; i < samples; i += 1) {
    for (let channel = 0; channel < channels; channel += 1) {
      const sample = Math.max(-1, Math.min(1, channelData[channel][i]));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
      offset += bytesPerSample;
    }
  }
  return new Blob([output], { type: 'audio/wav' });
}

function Waveform({ buffer, duration, currentTime, isEnhanced }) {
  const canvasRef = useRef(null);
  const bars = useMemo(() => makeWaveform(buffer), [buffer]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const ratio = window.devicePixelRatio || 1;
    canvas.width = Math.max(1, Math.floor(rect.width * ratio));
    canvas.height = Math.max(1, Math.floor(rect.height * ratio));
    const ctx = canvas.getContext('2d');
    ctx.scale(ratio, ratio);
    ctx.clearRect(0, 0, rect.width, rect.height);
    const count = bars.length || 140;
    const step = rect.width / count;
    const played = duration ? currentTime / duration : 0;
    bars.forEach((value, index) => {
      const height = Math.max(2, value * (rect.height * 0.82));
      const x = index * step + step * 0.34;
      const y = (rect.height - height) / 2;
      ctx.fillStyle = index / count < played ? '#6a9d74' : (isEnhanced ? '#bddb9b' : '#c4d0c8');
      ctx.beginPath();
      ctx.roundRect(x, y, Math.max(1.5, step * 0.32), height, 2);
      ctx.fill();
    });
  }, [bars, currentTime, duration, isEnhanced]);

  return <canvas className="wave-canvas" ref={canvasRef} role="img" aria-label="Audio waveform" />;
}

function FilePicker({ onFile, compact = false, disabled = false }) {
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);
  const [fileError, setFileError] = useState('');

  const acceptFile = (file) => {
    if (!file) return;
    const isSupportedMedia = file.type.startsWith('audio/') || isSupportedVideoFile(file) || /\.(mp3|wav|m4a|aac|ogg|flac)$/i.test(file.name);
    if (!isSupportedMedia) {
      setFileError('Choose a supported audio file or an MP4, MOV, or WebM video with an audio track.');
      return;
    }
    setFileError('');
    onFile(file);
  };

  return (
    <div
      className={`upload-zone${compact ? ' upload-zone-compact' : ''}${dragging ? ' is-dragging' : ''}`}
      onDragOver={(event) => { if (disabled) return; event.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={(event) => { event.preventDefault(); setDragging(false); if (!disabled) acceptFile(event.dataTransfer.files?.[0]); }}
    >
      <input
        ref={inputRef}
        className="visually-hidden"
        type="file"
        disabled={disabled}
        accept="audio/*,video/mp4,video/quicktime,video/webm,application/mp4,.mp3,.wav,.m4a,.aac,.ogg,.flac,.webm,.mp4,.mov"
        onChange={(event) => { acceptFile(event.target.files?.[0]); event.target.value = ''; }}
      />
      <div className="upload-orbit" aria-hidden="true"><AudioWaveform size={compact ? 22 : 27} strokeWidth={1.7} /></div>
      <div className="upload-copy">
        <strong>{compact ? 'Drop a new recording here' : 'Drop a recording to get started'}</strong>
        <span>{compact ? 'or browse your files' : 'Audio files or MP4, MOV, or WebM video with sound'}</span>
      </div>
      <button type="button" className="button button-dark upload-button" disabled={disabled} onClick={() => inputRef.current?.click()}>
        <Upload size={15} /> {compact ? 'Choose file' : 'Choose a file'}
      </button>
      {fileError && <span className="upload-error" role="alert">{fileError}</span>}
    </div>
  );
}

function SupportPage() {
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [result, setResult] = useState(null);

  const sendMessage = (event) => {
    event.preventDefault();
    if (!message.trim() || message.length > 5000) {
      setResult({ type: 'error', text: 'Write a message under 5,000 characters before opening your email app.' });
      return;
    }

    const mailSubject = subject.trim() ? `Roomtone support: ${subject.trim()}` : 'Roomtone support message';
    const mailBody = `From: ${email.trim()}\n\n${message.trim()}`;
    window.location.href = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(mailSubject)}&body=${encodeURIComponent(mailBody)}`;
    setResult({ type: 'info', text: 'Your email app should open with the message ready. Send it there to reach us.' });
  };

  return (
    <div className="page-content support-page">
      <section className="support-intro">
        <div className="heading-kicker"><span className="heading-kicker-line" /> We’re here to help</div>
        <h1>Talk to the<br /><span>Roomtone team.</span></h1>
        <p>Send a note, ask a question, or tell us what would make your workflow better.</p>
      </section>

      <form className="support-card" onSubmit={sendMessage}>
        <div className="support-card-heading">
          <span className="support-icon"><Mail size={19} /></span>
          <span><strong>Send us a message</strong><small>We’ll reply to the email address you provide.</small></span>
        </div>
        <label className="support-field">
          <span>Your email</span>
          <input type="email" name="email" autoComplete="email" maxLength={254} required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" />
        </label>
        <label className="support-field">
          <span>Subject <small>Optional</small></span>
          <input type="text" name="subject" maxLength={120} value={subject} onChange={(event) => setSubject(event.target.value)} placeholder="What can we help with?" />
        </label>
        <label className="support-field">
          <span>Message</span>
          <MessageEditor value={message} onChange={(value) => { setMessage(value); setResult(null); }} />
        </label>
        {result && <div className={`support-result ${result.type}`} role={result.type === 'error' ? 'alert' : 'status'}>{result.text}</div>}
        <div className="support-submit-row">
          <span>Opens your email app with the message ready to send.</span>
          <button className="button button-primary" type="submit" disabled={!email.trim() || !message.trim() || message.length > 5000}>
            <Send size={15} /> Open email app
          </button>
        </div>
      </form>
      <footer className="page-footer"><span>We’ll use your email only to reply to this request.</span><span>Roomtone support</span></footer>
    </div>
  );
}

export function App({ initialView = 'enhance', showLoader = true } = {}) {
  const [view, setView] = useState(initialView);
  const [file, setFile] = useState(null);
  const [fileUrl, setFileUrl] = useState('');
  const [decoded, setDecoded] = useState(null);
  const [processedUrl, setProcessedUrl] = useState('');
  const [processedBlob, setProcessedBlob] = useState(null);
  const [processedBuffer, setProcessedBuffer] = useState(null);
  const [extractionResult, setExtractionResult] = useState(null);
  const [extractionError, setExtractionError] = useState('');
  const [processing, setProcessing] = useState(false);
  const [exportingFormat, setExportingFormat] = useState('');
  const [exportProgress, setExportProgress] = useState(0);
  const [loadingFile, setLoadingFile] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [playbackError, setPlaybackError] = useState('');
  const [preset, setPreset] = useState('natural');
  const [presence, setPresence] = useState(presets.natural.presence);
  const [leveling, setLeveling] = useState(presets.natural.leveling);
  const [noiseReduction, setNoiseReduction] = useState(presets.natural.noiseReduction);
  const [reducePauses, setReducePauses] = useState(true);
  const [playing, setPlaying] = useState(false);
  const [preview, setPreview] = useState('original');
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [projects, setProjects] = useState([]);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [toast, setToast] = useState('');
  const [processingStage, setProcessingStage] = useState('Removing background noise…');
  const audioRef = useRef(null);
  const fileUrlRef = useRef('');
  const extractionUrlRef = useRef('');
  const projectUrlsRef = useRef(new Set());
  const denoiseWorkerRef = useRef(null);
  const pendingDenoiseRef = useRef(new Map());
  const denoiseRequestRef = useRef(0);

  const navigateToView = (nextView) => {
    setView(nextView);
    const nextPath = nextView === 'extract' ? '/extract-audio-from-video/' : '/';
    if (window.location.pathname !== nextPath) window.history.pushState({}, '', nextPath);
    updatePublicPageMetadata(nextView);
  };

  useEffect(() => {
    const syncViewWithPath = () => {
      const path = window.location.pathname.replace(/\/+$/, '');
      const nextView = path === '/extract-audio-from-video' ? 'extract' : 'enhance';
      setView(nextView);
      updatePublicPageMetadata(nextView);
    };

    window.addEventListener('popstate', syncViewWithPath);
    return () => window.removeEventListener('popstate', syncViewWithPath);
  }, []);

  useEffect(() => () => {
    if (fileUrlRef.current) URL.revokeObjectURL(fileUrlRef.current);
    if (extractionUrlRef.current) URL.revokeObjectURL(extractionUrlRef.current);
    projectUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    denoiseWorkerRef.current?.terminate();
    pendingDenoiseRef.current.clear();
  }, []);

  useEffect(() => {
    let active = true;

    const restoreProjects = async () => {
      try {
        const storedProjects = await loadLocalProjects();
        if (!active) return;

        const restoredProjects = storedProjects
          .filter((project) => project.file instanceof Blob && project.blob instanceof Blob)
          .map((project) => {
            const url = URL.createObjectURL(project.blob);
            projectUrlsRef.current.add(url);
            return {
              ...project,
              url,
              size: project.size || project.blob.size,
              createdAt: new Date(project.createdAt || Date.now()),
            };
          });

        setProjects(restoredProjects);
      } catch {
        if (active) setToast('Local project storage could not be opened. You can still enhance and download files.');
      } finally {
        if (active) setLoadingProjects(false);
      }
    };

    restoreProjects();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onTime = () => setCurrentTime(audio.currentTime || 0);
    const onDuration = () => setDuration(audio.duration || 0);
    const onPlay = () => { setPlaying(true); setPlaybackError(''); };
    const onPause = () => setPlaying(false);
    const onEnded = () => setPlaying(false);
    const onError = () => { setPlaying(false); setPlaybackError('This file could not be played by your browser. Try converting it to MP3 or WAV.'); };
    audio.addEventListener('timeupdate', onTime);
    audio.addEventListener('durationchange', onDuration);
    audio.addEventListener('play', onPlay);
    audio.addEventListener('pause', onPause);
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('error', onError);
    return () => {
      audio.removeEventListener('timeupdate', onTime);
      audio.removeEventListener('durationchange', onDuration);
      audio.removeEventListener('play', onPlay);
      audio.removeEventListener('pause', onPause);
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('error', onError);
    };
  }, [fileUrl, processedUrl, preview]);

  useEffect(() => {
    if (!toast) return undefined;
    const timeout = window.setTimeout(() => setToast(''), 2800);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  const setNewFile = useCallback(async (nextFile, savedProject = null) => {
    audioRef.current?.pause();
    if (fileUrlRef.current) URL.revokeObjectURL(fileUrlRef.current);
    const url = URL.createObjectURL(nextFile);
    fileUrlRef.current = url;
    setFile(nextFile);
    setFileUrl(url);
    setProcessedUrl(savedProject?.url || '');
    setProcessedBlob(savedProject?.blob || null);
    setProcessedBuffer(null);
    if (savedProject?.settings) {
      setPreset(savedProject.settings.preset || 'natural');
      setPresence(Number(savedProject.settings.presence ?? presets.natural.presence));
      setLeveling(Number(savedProject.settings.leveling ?? presets.natural.leveling));
      setNoiseReduction(Number(savedProject.settings.noiseReduction ?? presets.natural.noiseReduction));
      setReducePauses(savedProject.settings.reducePauses ?? true);
    }
    setDecoded(null);
    setPreview(savedProject?.url ? 'enhanced' : 'original');
    setCurrentTime(0);
    setDuration(0);
    setLoadError('');
    setPlaybackError('');
    setLoadingFile(true);
    navigateToView('editor');
    let context;
    try {
      let audioBuffer;
      if (isSupportedVideoFile(nextFile)) {
        audioBuffer = await decodeVideoAudio(nextFile);
      } else {
        context = safeAudioContext();
        audioBuffer = await context.decodeAudioData((await nextFile.arrayBuffer()).slice(0));
      }
      setDecoded(audioBuffer);
      setDuration(audioBuffer.duration);
    } catch (error) {
      const videoType = isMovFile(nextFile) ? 'MOV' : isMp4File(nextFile) ? 'MP4' : 'video';
      setLoadError(isSupportedVideoFile(nextFile)
        ? error.message || `We could not read an audio track from this ${videoType}. Choose a video with audio encoded in a format your browser supports, such as AAC.`
        : error.message || 'We could not open this audio file. Try an MP3 or WAV recording.');
    } finally {
      if (context && context.state !== 'closed') context.close().catch(() => {});
      setLoadingFile(false);
    }
  }, []);

  const applyPreset = (key) => {
    setPreset(key);
    setPresence(presets[key].presence);
    setLeveling(presets[key].leveling);
    setNoiseReduction(presets[key].noiseReduction);
  };

  const projectKeyFor = (audioFile) => `${audioFile.name}:${audioFile.size}:${audioFile.lastModified}`;

  const runNeuralEnhancement = useCallback((channels, sampleRate, limit) => new Promise((resolve, reject) => {
    let worker = denoiseWorkerRef.current;
    if (!worker) {
      worker = new Worker(new URL('./denoise-worker.js', import.meta.url), { type: 'module' });
      worker.onmessage = (event) => {
        const pending = pendingDenoiseRef.current.get(event.data.id);
        if (!pending) return;
        pendingDenoiseRef.current.delete(event.data.id);
        if (event.data.error) pending.reject(new Error(event.data.error));
        else pending.resolve(event.data.channels.map((buffer) => new Float32Array(buffer)));
      };
      worker.onerror = (event) => {
        const error = new Error(event.message || 'The local AI worker could not start.');
        pendingDenoiseRef.current.forEach(({ reject: rejectPending }) => rejectPending(error));
        pendingDenoiseRef.current.clear();
        worker.terminate();
        if (denoiseWorkerRef.current === worker) denoiseWorkerRef.current = null;
      };
      denoiseWorkerRef.current = worker;
    }
    const id = ++denoiseRequestRef.current;
    pendingDenoiseRef.current.set(id, { resolve, reject });
    const transfer = channels.map((channel) => channel.buffer);
    try {
      worker.postMessage({ id, channels, sampleRate, limit }, transfer);
    } catch (error) {
      pendingDenoiseRef.current.delete(id);
      reject(error);
    }
  }), []);

  const enhanceAudioBuffer = useCallback(async (sourceBuffer) => {
    setProcessingStage('Removing background noise…');
    const sourceChannels = Array.from(
      { length: sourceBuffer.numberOfChannels },
      (_, channel) => sourceBuffer.getChannelData(channel).slice(),
    );
    const cleanedChannels = await runNeuralEnhancement(
      sourceChannels,
      sourceBuffer.sampleRate,
      Math.round((noiseReduction / 100) * 16),
    );
    setProcessingStage('Finishing voice tone…');
    const rate = sourceBuffer.sampleRate;
    const offline = new OfflineAudioContext(sourceBuffer.numberOfChannels, sourceBuffer.length, rate);
    const cleanedBuffer = offline.createBuffer(sourceBuffer.numberOfChannels, sourceBuffer.length, rate);
    cleanedChannels.forEach((channelData, channel) => cleanedBuffer.getChannelData(channel).set(channelData));
    const source = offline.createBufferSource();
    source.buffer = cleanedBuffer;

    const highPass = offline.createBiquadFilter();
    highPass.type = 'highpass';
    highPass.frequency.value = 65 + (presence / 100) * 55;
    highPass.Q.value = 0.68;

    const lowShelf = offline.createBiquadFilter();
    lowShelf.type = 'lowshelf';
    lowShelf.frequency.value = 190;
    lowShelf.gain.value = -1.4 + (presence / 100) * -1.8;

    const detail = offline.createBiquadFilter();
    detail.type = 'peaking';
    detail.frequency.value = preset === 'warm' ? 2500 : 3400;
    detail.Q.value = 0.82;
    detail.gain.value = (presence / 100) * (preset === 'bright' ? 5.4 : 4.1);

    const compressor = offline.createDynamicsCompressor();
    compressor.threshold.value = -25 - (leveling / 100) * 9;
    compressor.knee.value = 22;
    compressor.ratio.value = 1.4 + (leveling / 100) * 3.6;
    compressor.attack.value = 0.006;
    compressor.release.value = 0.18;

    source.connect(highPass);
    highPass.connect(lowShelf);
    lowShelf.connect(detail);
    detail.connect(compressor);
    compressor.connect(offline.destination);
    source.start(0);
    const result = await offline.startRendering();

    if (reducePauses) {
      for (let channel = 0; channel < result.numberOfChannels; channel += 1) {
        const data = result.getChannelData(channel);
        const windowSize = Math.max(1, Math.floor(rate * 0.012));
        let envelope = 0;
        const threshold = 0.0025 + (leveling / 100) * 0.0015;
        for (let start = 0; start < data.length; start += windowSize) {
          let energy = 0;
          const end = Math.min(data.length, start + windowSize);
          for (let i = start; i < end; i += 1) energy += data[i] * data[i];
          const rms = Math.sqrt(energy / Math.max(1, end - start));
          const target = rms < threshold ? 0.28 : 1;
          const smoothing = target < envelope ? 0.42 : 0.12;
          for (let i = start; i < end; i += 1) {
            envelope += (target - envelope) * smoothing;
            data[i] *= envelope;
          }
        }
      }
    }

    return result;
  }, [leveling, noiseReduction, presence, preset, reducePauses, runNeuralEnhancement]);

  const togglePlayback = async () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      try { await audio.play(); } catch { setPlaybackError('Press play again to start audio playback.'); }
    } else {
      audio.pause();
    }
  };

  const changePreview = (nextPreview) => {
    if (nextPreview === 'enhanced' && !processedUrl) return;
    const audio = audioRef.current;
    const wasPlaying = audio && !audio.paused;
    const time = audio?.currentTime || 0;
    setPreview(nextPreview);
    setCurrentTime(time);
    if (audio) {
      audio.pause();
      audio.src = nextPreview === 'enhanced' ? processedUrl : fileUrl;
      audio.load();
      audio.addEventListener('loadedmetadata', () => {
        audio.currentTime = Math.min(time, audio.duration || time);
        if (wasPlaying) audio.play().catch(() => {});
      }, { once: true });
    }
  };

  const processAudio = async () => {
    if (!decoded || processing) return;
    audioRef.current?.pause();
    setProcessing(true);
    setLoadError('');
    try {
      const result = await enhanceAudioBuffer(decoded);
      const blob = writeWav(result);
      const url = URL.createObjectURL(blob);
      projectUrlsRef.current.add(url);
      setProcessedUrl(url);
      setProcessedBlob(blob);
      setProcessedBuffer(result);
      setPreview('enhanced');
      setToast('Your enhanced recording is ready.');
      const key = projectKeyFor(file);
      const existingProject = projects.find((item) => item.key === key);
      if (existingProject?.url) {
        URL.revokeObjectURL(existingProject.url);
        projectUrlsRef.current.delete(existingProject.url);
      }
      const project = {
        key,
        name: file.name.replace(/\.[^.]+$/, ''),
        file,
        duration: decoded.duration,
        size: blob.size,
        url,
        blob,
        settings: { preset, presence, leveling, noiseReduction, reducePauses },
        createdAt: new Date(),
      };
      setProjects((current) => [project, ...current.filter((item) => item.key !== key)]);
      try {
        await saveLocalProject(project);
        setToast('Enhanced recording saved on this device.');
      } catch {
        setToast('Your enhanced recording is ready, but local storage is full or unavailable. Download a copy to keep it.');
      }
      window.setTimeout(() => {
        const audio = audioRef.current;
        if (audio) { audio.src = url; audio.currentTime = 0; audio.load(); }
      }, 0);
    } catch (error) {
      setLoadError(error.message || 'Audio processing did not finish. Try a shorter or uncompressed file.');
    } finally {
      setProcessing(false);
      setProcessingStage('');
    }
  };

  const clearExtractionResult = () => {
    if (extractionUrlRef.current) {
      URL.revokeObjectURL(extractionUrlRef.current);
      extractionUrlRef.current = '';
    }
    setExtractionResult(null);
    setExtractionError('');
  };

  const extractVideoAudio = async (videoFile) => {
    if (processing || exportingFormat) return;
    clearExtractionResult();
    setProcessing(true);
    setProcessingStage('Checking video and extracting audio…');
    try {
      const { ALL_FORMATS, BlobSource, Input } = await import('mediabunny');
      const input = new Input({ source: new BlobSource(videoFile), formats: ALL_FORMATS });
      let hasVideoTrack = false;
      let hasAudioTrack = false;
      try {
        const [videoTrack, audioTrack] = await Promise.all([
          input.getPrimaryVideoTrack(),
          input.getPrimaryAudioTrack(),
        ]);
        hasVideoTrack = Boolean(videoTrack);
        hasAudioTrack = Boolean(audioTrack);
      } finally {
        input.dispose();
      }
      if (!hasVideoTrack) throw new Error('This file does not contain a video track. Choose a video file.');
      if (!hasAudioTrack) throw new Error('No audio track was found in this video.');

      const sourceBuffer = await decodeVideoAudio(videoFile);

      const enhancedBuffer = await enhanceAudioBuffer(sourceBuffer);
      const blob = writeWav(enhancedBuffer);
      const url = URL.createObjectURL(blob);
      extractionUrlRef.current = url;
      setExtractionResult({
        name: videoFile.name.replace(/\.[^.]+$/, ''),
        buffer: enhancedBuffer,
        blob,
        url,
        duration: enhancedBuffer.duration,
      });
      setToast('Clean video audio is ready to download.');
    } catch (error) {
      const message = error?.message || 'The video audio could not be extracted. Try another file.';
      setExtractionError(message);
      throw new Error(message);
    } finally {
      setProcessing(false);
      setProcessingStage('');
    }
  };

  const downloadExtractedAudio = async (format) => {
    if (!extractionResult || exportingFormat) return;
    setExportingFormat(format);
    setExportProgress(0);
    setExtractionError('');
    try {
      const blob = format === 'wav'
        ? extractionResult.blob
        : await encodeEnhancedMedia({ audioBuffer: extractionResult.buffer, format: 'mp3' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `${extractionResult.name}-clean-audio.${format}`;
      anchor.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
      setToast(`${format.toUpperCase()} download started.`);
    } catch (error) {
      setExtractionError(error.message || `Could not create the clean ${format.toUpperCase()} file.`);
    } finally {
      setExportingFormat('');
      setExportProgress(0);
    }
  };

  const downloadEnhanced = async (format) => {
    if (!processedBlob || !file || exportingFormat) return;
    setExportingFormat(format);
    setExportProgress(0);
    setLoadError('');
    try {
      let blob = processedBlob;
      if (format !== 'wav') {
        let audioBuffer = processedBuffer;
        if (!audioBuffer) {
          const context = safeAudioContext();
          try {
            audioBuffer = await context.decodeAudioData((await processedBlob.arrayBuffer()).slice(0));
          } finally {
            if (context.state !== 'closed') await context.close().catch(() => {});
          }
        }
        blob = await encodeEnhancedMedia({ audioBuffer, sourceFile: file, format, onProgress: setExportProgress });
      }
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `${file.name.replace(/\.[^.]+$/, '')}-enhanced.${format}`;
      anchor.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
      setToast(`${format.toUpperCase()} download started.`);
    } catch (error) {
      setLoadError(error.message || `Could not create the enhanced ${format.toUpperCase()} file.`);
    } finally {
      setExportingFormat('');
      setExportProgress(0);
    }
  };

  const goToEditor = (project) => {
    if (file && project.key === projectKeyFor(file) && processedUrl === project.url) {
      navigateToView('editor');
      changePreview('enhanced');
    } else if (project.file) {
      navigateToView('editor');
      setNewFile(project.file, project);
    }
  };

  const canExportVideo = isMp4File(file) || isMovFile(file);
  const videoExportFormat = isMovFile(file) ? 'mov' : 'mp4';
  const videoExportLabel = videoExportFormat.toUpperCase();

  const nav = [
    { id: 'enhance', label: 'Enhance speech', icon: AudioLines },
    { id: 'extract', label: 'Extract audio from video', icon: Clapperboard },
    { id: 'projects', label: 'Your projects', icon: FolderClosed, count: projects.length || null },
    { id: 'support', label: 'Support', icon: Mail },
  ];

  return (
    <>
    {showLoader && <AppLoader loading={loadingProjects} />}
    <div className="app-shell">
      <aside className="sidebar">
        <a href="/" className="brand" onClick={(event) => { event.preventDefault(); navigateToView('enhance'); }} aria-label="Roomtone home">
          <span className="brand-mark"><AudioWaveform size={21} strokeWidth={2.2} /></span>
          <span className="brand-word">roomtone<span className="brand-dot">.</span></span>
        </a>

        <div className="sidebar-section-label">Workspace</div>
        <nav className="side-nav" aria-label="Main navigation">
          {nav.map(({ id, label, icon: Icon, count }) => (
            <button key={id} aria-label={label} disabled={processing || loadingFile || Boolean(exportingFormat)} className={`nav-item${view === id || (id === 'enhance' && view === 'editor') ? ' active' : ''}`} onClick={() => navigateToView(id)}>
              <Icon size={17} strokeWidth={1.8} />
              <span>{label}</span>
              {count && <span className="nav-count">{count}</span>}
            </button>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <div className="privacy-note"><span className="privacy-dot" /><span>Files stay on this device</span></div>
          <button className="profile-button" onClick={() => setToast('You are using the local Roomtone workspace.')}>
            <span className="avatar">R</span>
            <span className="profile-copy"><strong>My workspace</strong><small>On this device</small></span>
            <MoreHorizontal size={19} />
          </button>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div className="topbar-context"><span className="context-dot" /> {view === 'extract' ? 'Video audio extraction' : 'Voice workspace'}</div>
          <div className="topbar-actions">
            <span className="local-pill"><span /> Runs in your browser</span>
            <PWAControls busy={loadingProjects || loadingFile || processing || Boolean(exportingFormat)} onToast={setToast} />
            <button className="icon-button help-button" aria-label="About Roomtone" onClick={() => setToast('Roomtone cleans recordings and extracts audio from video locally.') }><CircleHelp size={17} /></button>
          </div>
        </header>

        <div className="main-scroll">
        {view === 'enhance' && (
          <div className="page-content home-page">
            <section className="page-heading">
              <div>
                <div className="heading-kicker"><span className="heading-kicker-line" /> A quieter room starts here</div>
                <h1>Make room for<br /><span>the voice.</span></h1>
                <p>Bring a recording in. We’ll help it feel closer, clearer, and more even.</p>
              </div>
              <div className="hero-signal" aria-hidden="true">
                {[12, 23, 36, 20, 51, 31, 66, 43, 77, 36, 56, 23, 70, 44, 29, 62, 33, 51, 20, 40, 15].map((height, index) => <i key={index} style={{ height: `${height}%`, animationDelay: `${index * 24}ms` }} />)}
              </div>
            </section>

            <section className="upload-card">
              <div className="upload-card-head">
                <div className="upload-number">01</div>
                <div><h2>Bring in your recording</h2><p>Start with a voice memo, podcast take, or interview.</p></div>
              </div>
              <FilePicker disabled={processing || loadingFile || Boolean(exportingFormat)} onFile={setNewFile} />
            </section>

            <section className="workflow-strip" aria-label="How it works">
              <div><span className="workflow-icon"><Upload size={15} /></span><span><strong>Add a file</strong><small>Drop in any voice recording</small></span></div>
              <span className="workflow-rule" />
              <div><span className="workflow-icon"><Sparkles size={15} /></span><span><strong>Shape the sound</strong><small>Choose a tone that feels right</small></span></div>
              <span className="workflow-rule" />
              <div><span className="workflow-icon"><ArrowDownToLine size={15} /></span><span><strong>Take it with you</strong><small>Export WAV, MP3, or enhanced video</small></span></div>
            </section>

            <section className="recent-section">
              <div className="section-header"><div><h2>Recent recordings</h2><p>Your latest work on this device</p></div><button className="text-button" onClick={() => navigateToView('projects')}>View projects <span>↗</span></button></div>
              {projects.length === 0 ? (
                <div className="empty-recent"><span className="empty-recent-icon"><FileAudio2 size={18} /></span><span><strong>No recordings yet</strong><small>Your enhanced clips will appear here.</small></span><span className="empty-recent-tail">—</span></div>
              ) : (
                <div className="recent-list">{projects.slice(0, 3).map((project, index) => <button key={`${project.name}-${index}`} disabled={processing || loadingFile || Boolean(exportingFormat)} className="recent-row" onClick={() => goToEditor(project)}><span className="recent-wave"><AudioWaveform size={17} /></span><span className="recent-name"><strong>{project.name}</strong><small>Enhanced · {formatTime(project.duration)}</small></span><span className="recent-ready"><Check size={13} /> Ready</span><span className="recent-date">Just now</span><ChevronDown className="recent-chevron" size={16} /></button>)}</div>
              )}
            </section>

            <section className="seo-guide" aria-labelledby="seo-guide-title">
              <div className="seo-guide-intro">
                <div className="heading-kicker"><span className="heading-kicker-line" /> Browser-based voice cleanup</div>
                <h2 id="seo-guide-title">Clean up voice recordings in your browser</h2>
                <p>Roomtone reduces background noise in voice recordings, then lets you shape voice presence, volume balance, and pauses. Audio processing and exports run on your device.</p>
              </div>

              <div className="seo-guide-grid">
                <section className="seo-guide-card" aria-labelledby="seo-how-title">
                  <h3 id="seo-how-title">How Roomtone works</h3>
                  <ol>
                    <li>Add a voice recording or an MP4 or MOV video with sound.</li>
                    <li>Listen to the original, reduce background noise, and adjust the voice controls.</li>
                    <li>Compare the result, then export WAV or MP3 audio. MP4 and MOV input can also be exported with enhanced audio.</li>
                  </ol>
                  <a href="/extract-audio-from-video/">Learn about extracting audio from video</a>
                </section>

                <section className="seo-guide-card" aria-labelledby="seo-formats-title">
                  <h3 id="seo-formats-title">Supported recordings and exports</h3>
                  <p>Roomtone accepts common audio formats including MP3, WAV, M4A, AAC, OGG, and FLAC. You can also open MP4 or MOV video with an audio track. Export enhanced audio as WAV or MP3; video input can be exported with enhanced audio while keeping its original picture.</p>
                </section>

                <section className="seo-guide-card" id="processing-privacy" aria-labelledby="seo-privacy-title">
                  <h3 id="seo-privacy-title">Processing stays on this device</h3>
                  <p>Roomtone processes recordings in your browser and stores saved projects in this browser on this device. Clearing browser site data removes saved projects. Support opens a prepared email in your email app; nothing is sent until you choose to send it.</p>
                </section>

                <section className="seo-guide-card" aria-labelledby="seo-limits-title">
                  <h3 id="seo-limits-title">What noise reduction can do</h3>
                  <p>Roomtone uses RNNoise to reduce background noise around speech and provides local voice shaping controls. Noise reduction can make speech easier to hear, but it does not recreate a voice or repair every recording artifact.</p>
                </section>
              </div>

              <div className="seo-guide-links">
                <a href="/extract-audio-from-video/">Extract audio from video</a>
                <a href={`mailto:${SUPPORT_EMAIL}`}>Contact Roomtone support</a>
                <a href="#processing-privacy">How audio is processed</a>
              </div>
            </section>

            <footer className="page-footer"><span>Roomtone is a small, local-first voice workspace.</span><a href="#seo-guide-title">How Roomtone works</a><span>Built for the moments between takes.</span></footer>
          </div>
        )}

        {view === 'extract' && (
          <ExtractAudioPage
            busy={processing}
            processingStage={processingStage}
            result={extractionResult}
            exportError={extractionError}
            exportingFormat={exportingFormat}
            onExtract={extractVideoAudio}
            onDownload={downloadExtractedAudio}
            onVideoSelected={clearExtractionResult}
          />
        )}

        {view === 'editor' && (
          <div className="page-content editor-page">
            <button className="back-link" disabled={Boolean(exportingFormat)} onClick={() => navigateToView('enhance')}><ArrowLeft size={15} /> All recordings</button>
            <div className="editor-heading">
              <div><div className="heading-kicker"><span className="heading-kicker-line" /> Voice cleanup</div><h1>{file?.name.replace(/\.[^.]+$/, '') || 'Untitled recording'}</h1><p>{file ? `${formatBytes(file.size)} · ${duration ? formatTime(duration) : 'Loading duration'}` : 'Add a recording to start.'}</p></div>
              <FilePicker compact disabled={processing || loadingFile || Boolean(exportingFormat)} onFile={setNewFile} />
            </div>

            {loadError && <div className="notice notice-error"><Info size={16} /><span>{loadError}</span><button onClick={() => setLoadError('')} aria-label="Dismiss error"><X size={15} /></button></div>}
            {playbackError && <div className="notice notice-error"><Info size={16} /><span>{playbackError}</span><button onClick={() => setPlaybackError('')} aria-label="Dismiss error"><X size={15} /></button></div>}

            <div className="editor-grid">
              <section className="player-card">
                <div className="player-card-header"><div><span className="small-label">LISTEN</span><span className="player-file-kind"><FileAudio2 size={14} /> {preview === 'enhanced' ? 'Enhanced WAV' : 'Original recording'}</span></div><button className="icon-button" aria-label="More audio options" onClick={() => setToast('Your original recording is kept unchanged.') }><MoreHorizontal size={19} /></button></div>
                <div className="waveform-frame">
                  {loadingFile ? <div className="wave-loading"><span /><span /><span /><span /><span /><span /><span /><span /><span /><span /></div> : <Waveform buffer={decoded} duration={duration} currentTime={currentTime} isEnhanced={preview === 'enhanced'} />}
                </div>
                <div className="timeline"><span>{formatTime(currentTime)}</span><span>{formatTime(duration)}</span></div>
                <div className="player-controls">
                  <button className="play-button" onClick={togglePlayback} disabled={loadingFile || !fileUrl} aria-label={playing ? 'Pause' : 'Play'}>{playing ? <Pause size={17} fill="currentColor" /> : <Play size={17} fill="currentColor" />}</button>
                  <span className="playback-time">{formatTime(currentTime)} <i>/</i> {formatTime(duration)}</span>
                  <div className="player-spacer" />
                  <Volume2 size={17} className="volume-icon" />
                  <div className="ab-switch" role="group" aria-label="Choose audio version">
                    <button className={preview === 'original' ? 'selected' : ''} onClick={() => changePreview('original')}>Original</button>
                    <button className={preview === 'enhanced' ? 'selected' : ''} disabled={!processedUrl} onClick={() => changePreview('enhanced')}>Enhanced</button>
                  </div>
                </div>
                <audio className="audio-element" ref={audioRef} src={preview === 'enhanced' && processedUrl ? processedUrl : fileUrl || undefined} preload="metadata" />
                {!decoded && !loadingFile && <div className="file-needed"><AudioWaveform size={20} /><span>Choose an audio file to see its waveform.</span></div>}
              </section>

              <aside className="controls-card">
                <div className="controls-heading"><div className="controls-icon"><Sparkles size={17} /></div><div><h2>Shape your voice</h2><p>AI noise removal with local voice shaping.</p></div></div>
                <div className="control-divider" />
                <div className="field-label-row"><span>Starting point</span><span className="current-preset">{presets[preset]?.label || 'Custom'}</span></div>
                <div className="preset-list">
                  {Object.entries(presets).map(([key, item]) => <button key={key} className={`preset-option${preset === key ? ' selected' : ''}`} onClick={() => applyPreset(key)}><span className={`preset-swatch ${key}`}><AudioLines size={16} /></span><span><strong>{item.label}</strong><small>{item.description}</small></span>{preset === key && <Check size={15} className="preset-check" />}</button>)}
                </div>
                <div className="range-field"><div className="field-label-row"><label htmlFor="noise-reduction">AI noise reduction</label><span>{noiseReduction}%</span></div><input id="noise-reduction" type="range" min="0" max="100" value={noiseReduction} onChange={(event) => { setNoiseReduction(Number(event.target.value)); setPreset('custom'); }} style={{ '--range-value': `${noiseReduction}%` }} /><div className="range-captions"><span>Subtle</span><span>Strong</span></div></div>
                <div className="range-field"><div className="field-label-row"><label htmlFor="presence">Voice presence</label><span>{presence}%</span></div><input id="presence" type="range" min="0" max="100" value={presence} onChange={(event) => { setPresence(Number(event.target.value)); setPreset('custom'); }} style={{ '--range-value': `${presence}%` }} /><div className="range-captions"><span>Soft</span><span>Forward</span></div></div>
                <div className="range-field"><div className="field-label-row"><label htmlFor="leveling">Volume balance</label><span>{leveling}%</span></div><input id="leveling" type="range" min="0" max="100" value={leveling} onChange={(event) => { setLeveling(Number(event.target.value)); setPreset('custom'); }} style={{ '--range-value': `${leveling}%` }} /><div className="range-captions"><span>Natural</span><span>Even</span></div></div>
                <label className="toggle-row"><span className="toggle-copy"><strong>Quiet the pauses</strong><small>Lower room noise between phrases</small></span><input type="checkbox" checked={reducePauses} onChange={(event) => setReducePauses(event.target.checked)} /><span className="toggle-track" aria-hidden="true" /></label>
                <div className="local-processing-note"><Info size={14} /><span>Enhancement and exports stay on this device.</span><a href="/licenses/neural-denoise-NOTICE.txt" target="_blank" rel="noreferrer">RNNoise notice</a><a href="/licenses/mediabunny-LICENSE.txt" target="_blank" rel="noreferrer">Export license</a></div>
                <div className="controls-actions">
                  <button className="button button-primary enhance-button" onClick={processAudio} disabled={!decoded || processing || loadingFile || Boolean(exportingFormat)}>{processing ? <><span className="button-spinner" /> {processingStage}</> : <><Sparkles size={16} /> {processedUrl ? 'Enhance again' : 'Enhance voice'}</>}</button>
                  {processedBlob && <div className="export-group">
                    <div className="export-group-heading"><span>Download enhanced as</span>{exportingFormat && <small>{`Creating ${exportingFormat.toUpperCase()}${exportingFormat === 'mp4' && exportProgress > 0 ? ` (${Math.round(exportProgress * 100)}%)` : '...'}`}</small>}</div>
                    <div className="export-options">
                      <button type="button" className="button button-download export-format-button" disabled={Boolean(exportingFormat) || processing} onClick={() => downloadEnhanced('wav')}><ArrowDownToLine size={14} /> WAV</button>
                      <button type="button" className="button button-download export-format-button" disabled={Boolean(exportingFormat) || processing} onClick={() => downloadEnhanced('mp3')}><ArrowDownToLine size={14} /> MP3</button>
                      {canExportVideo && <button type="button" className="button button-download export-format-button export-video-button" disabled={Boolean(exportingFormat) || processing} onClick={() => downloadEnhanced(videoExportFormat)}><Clapperboard size={14} /> Enhanced {videoExportLabel} video</button>}
                    </div>
                    {canExportVideo && <small className="export-note">{videoExportLabel} keeps your original video and replaces its audio with the enhanced track.</small>}
                  </div>}
                  <button className="reset-button" onClick={() => { applyPreset('natural'); setReducePauses(true); setToast('Controls reset to Natural.'); }}><RotateCcw size={13} /> Reset settings</button>
                </div>
              </aside>
            </div>
            <div className="editor-footnote"><Headphones size={15} /><span>Listen on headphones to hear small changes clearly.</span><span className="footnote-separator" /><span>Original file stays untouched</span></div>
          </div>
        )}

        {view === 'projects' && (
          <div className="page-content projects-page">
            <div className="projects-heading"><div><div className="heading-kicker"><span className="heading-kicker-line" /> Your workspace</div><h1>Projects</h1><p>Recordings saved in this browser on this device.</p></div><button className="button button-primary" onClick={() => navigateToView('enhance')}><Plus size={16} /> New recording</button></div>
            <div className="projects-table-wrap">
              <div className="projects-table-head"><span>Name</span><span>Length</span><span>File size</span><span>Status</span><span /></div>
              {projects.length ? projects.map((project, index) => <button key={`${project.name}-${index}`} disabled={processing || loadingFile || Boolean(exportingFormat)} className="project-table-row" onClick={() => goToEditor(project)}><span className="project-name-cell"><span className="project-icon"><AudioWaveform size={17} /></span><span><strong>{project.name}</strong><small>Saved on this device</small></span></span><span>{formatTime(project.duration)}</span><span>{formatBytes(project.size)}</span><span><span className="status-ready"><Check size={12} /> Ready</span></span><MoreHorizontal size={18} /></button>) : <div className="projects-empty"><span className="empty-record-icon"><Clapperboard size={22} /></span><h2>A clean slate</h2><p>Enhanced recordings will collect here as you work.</p><button className="button button-dark" onClick={() => navigateToView('enhance')}><Plus size={15} /> Add a recording</button></div>}
            </div>
            <div className="project-storage-note"><Info size={15} /><span>Saved originals and enhanced files stay in this browser on this device. Clearing browser site data removes saved projects.</span></div>
          </div>
        )}

        {view === 'support' && <SupportPage />}
        </div>
      </main>

      {toast && <div className="toast-message" role="status"><span className="toast-check"><Check size={13} /></span>{toast}<button onClick={() => setToast('')} aria-label="Dismiss message"><X size={14} /></button></div>}
    </div>
    </>
  );
}
