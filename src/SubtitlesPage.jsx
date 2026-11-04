import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowDownToLine,
  AudioWaveform,
  Captions,
  Check,
  Clock3,
  FileAudio2,
  FileVideo2,
  Info,
  Languages,
  LoaderCircle,
  Play,
  Sparkles,
  Upload,
} from 'lucide-react';
import { decodeVideoAudio } from './media-import.js';
import {
  formatSrt,
  formatVtt,
  groupWordTimestamps,
  MAX_SUBTITLE_DURATION,
  MAX_SUBTITLE_FILE_SIZE,
  resampleToMono,
} from './subtitle-utils.js';

const LANGUAGES = [
  { label: 'English', value: 'english' },
  { label: 'Hausa', value: 'hausa' },
  { label: 'Yoruba', value: 'yoruba' },
  { label: 'French', value: 'french' },
  { label: 'Spanish', value: 'spanish' },
  { label: 'Portuguese', value: 'portuguese' },
  { label: 'Arabic', value: 'arabic' },
];

const QUALITY_OPTIONS = [
  { value: 'faster', label: 'Faster', detail: 'Quickest' },
  { value: 'balanced', label: 'Balanced', detail: 'Recommended' },
  { value: 'max', label: 'Max', detail: 'Best accuracy · slowest' },
];

const SUPPORTED_MEDIA = /\.(mp4|mov|m4v|mkv|webm|mp3|wav|m4a|aac|ogg|flac)$/i;

function formatTime(seconds = 0) {
  if (!Number.isFinite(seconds)) return '00:00';
  const total = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  return hours > 0
    ? `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
    : `${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function formatBytes(bytes = 0) {
  return bytes < 1024 * 1024
    ? `${Math.max(1, Math.round(bytes / 1024))} KB`
    : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function SubtitleUpload({ file, onFile, disabled }) {
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);

  const acceptFile = (nextFile) => {
    if (!nextFile) return;
    if (!nextFile.type.startsWith('audio/') && !nextFile.type.startsWith('video/') && !SUPPORTED_MEDIA.test(nextFile.name)) {
      onFile(null, 'Choose an audio or video file such as MP3, WAV, MP4, MOV, MKV, or WebM.');
      return;
    }
    if (nextFile.size > MAX_SUBTITLE_FILE_SIZE) {
      onFile(null, 'Choose a file smaller than 200 MB so it can be processed in this browser.');
      return;
    }
    onFile(nextFile, '');
  };

  return (
    <div
      className={`subtitle-upload${dragging ? ' is-dragging' : ''}${file ? ' has-file' : ''}`}
      onDragOver={(event) => { if (!disabled) { event.preventDefault(); setDragging(true); } }}
      onDragLeave={() => setDragging(false)}
      onDrop={(event) => { event.preventDefault(); setDragging(false); if (!disabled) acceptFile(event.dataTransfer.files?.[0]); }}
    >
      <input
        ref={inputRef}
        className="visually-hidden"
        type="file"
        accept="audio/*,video/mp4,video/quicktime,video/webm,application/mp4,.mp4,.mov,.m4v,.mkv,.webm,.mp3,.wav,.m4a,.aac,.ogg,.flac"
        disabled={disabled}
        aria-label="Choose an audio or video file for subtitles"
        onChange={(event) => { acceptFile(event.target.files?.[0]); event.target.value = ''; }}
      />
      <span className="subtitle-upload-icon">{file ? <FileAudio2 size={19} /> : <Upload size={19} />}</span>
      <div className="subtitle-upload-copy">
        <strong>{file?.name || 'Drop a video or audio file here'}</strong>
        <small>{file ? `${formatBytes(file.size)} · Ready to transcribe` : 'MP4, MOV, MKV, WebM, MP3, WAV, M4A, AAC, OGG, or FLAC'}</small>
      </div>
      <button type="button" className="button button-dark" disabled={disabled} onClick={() => inputRef.current?.click()}>
        {file ? 'Choose another' : 'Choose file'}
      </button>
    </div>
  );
}

export default function SubtitlesPage() {
  const [file, setFile] = useState(null);
  const [fileUrl, setFileUrl] = useState('');
  const [duration, setDuration] = useState(0);
  const [cues, setCues] = useState([]);
  const [language, setLanguage] = useState('english');
  const [quality, setQuality] = useState('balanced');
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState('');
  const [modelPercent, setModelPercent] = useState(null);
  const [error, setError] = useState('');
  const [dragError, setDragError] = useState('');
  const [currentTime, setCurrentTime] = useState(0);
  const fileUrlRef = useRef('');
  const mediaRef = useRef(null);
  const workerRef = useRef(null);

  useEffect(() => () => {
    if (fileUrlRef.current) URL.revokeObjectURL(fileUrlRef.current);
    workerRef.current?.terminate();
  }, []);

  const selectFile = (nextFile, validationError) => {
    setDragError(validationError);
    if (!nextFile) return;
    if (fileUrlRef.current) URL.revokeObjectURL(fileUrlRef.current);
    const nextUrl = URL.createObjectURL(nextFile);
    fileUrlRef.current = nextUrl;
    setFile(nextFile);
    setFileUrl(nextUrl);
    setDuration(0);
    setCurrentTime(0);
    setCues([]);
    setError('');
    setModelPercent(null);
  };

  const generateSubtitles = async () => {
    if (!file || busy) return;
    setBusy(true);
    setError('');
    setCues([]);
    setModelPercent(null);
    setStage('Reading audio…');
    let worker;

    try {
      const audioBuffer = await decodeVideoAudio(file, setStage);
      if (audioBuffer.duration > MAX_SUBTITLE_DURATION) {
        throw new Error('This browser workflow supports recordings up to 30 minutes. Trim the file and try again.');
      }
      if (!audioBuffer.length) throw new Error('No audio samples were found in this file.');
      setDuration(audioBuffer.duration);
      setStage('Preparing audio…');
      const audio = await resampleToMono(audioBuffer, (progress) => {
        setStage(`Preparing audio… ${Math.round(progress)}%`);
      });

      worker = new Worker(new URL('./subtitle-transcription.worker.js', import.meta.url), { type: 'module' });
      workerRef.current = worker;
      const result = await new Promise((resolve, reject) => {
        worker.onmessage = ({ data }) => {
          if (data.type === 'stage') setStage(data.stage);
          if (data.type === 'model-progress') {
            const value = data.progress?.percent;
            if (Number.isFinite(value)) setModelPercent(Math.max(0, Math.min(100, Math.round(value))));
          }
          if (data.type === 'complete') resolve(data.result);
          if (data.type === 'error') reject(new Error(data.error));
        };
        worker.onerror = () => reject(new Error('Speech recognition stopped unexpectedly. Reload the page and try again.'));
        worker.postMessage({ audio, language, quality }, [audio.buffer]);
      });

      const nextCues = groupWordTimestamps(result?.chunks, audioBuffer.duration);
      if (!nextCues.length) {
        throw new Error('No timed speech was detected. Try another language or a clearer recording.');
      }
      setCues(nextCues);
      setStage('');
    } catch (processingError) {
      const message = processingError?.message || 'We could not generate subtitles from this file.';
      setError(!navigator.onLine && /fetch|network|load/i.test(message)
        ? 'The speech model is not cached yet. Connect to the internet once to download it, then try again.'
        : message);
      setStage('');
    } finally {
      worker?.terminate();
      if (workerRef.current === worker) workerRef.current = null;
      setBusy(false);
      setModelPercent(null);
    }
  };

  const updateCue = (id, text) => {
    setCues((current) => current.map((cue) => cue.id === id ? { ...cue, text } : cue));
  };

  const seekToCue = (cue) => {
    const media = mediaRef.current;
    if (!media) return;
    media.currentTime = cue.start;
    media.play().catch(() => {});
  };

  const downloadSubtitles = (format) => {
    const content = format === 'srt' ? formatSrt(cues) : formatVtt(cues);
    const blob = new Blob([content], { type: format === 'srt' ? 'application/x-subrip;charset=utf-8' : 'text/vtt;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    const baseName = (file?.name || 'subtitles').replace(/\.[^.]+$/, '').replace(/[<>:"/\\|?*\u0000-\u001f]/g, '-');
    anchor.href = url;
    anchor.download = `${baseName}.${format}`;
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  };

  const activeCueId = cues.find((cue) => currentTime >= cue.start && currentTime <= cue.end)?.id;
  const isVideo = Boolean(file && (file.type.startsWith('video/') || /\.(mp4|mov|m4v|mkv|webm)$/i.test(file.name)));

  return (
    <div className="page-content subtitles-page">
      <section className="subtitle-heading">
        <div>
          <div className="heading-kicker"><span className="heading-kicker-line" /> Subtitles from your media</div>
          <h1>Every word,<br /><span>right on time.</span></h1>
          <p>Turn speech in a video or recording into editable, time-coded subtitles.</p>
        </div>
        <div className="subtitle-heading-mark" aria-hidden="true"><Captions size={29} strokeWidth={1.5} /></div>
      </section>

      <section className="subtitle-source-card">
        <div className="subtitle-source-head">
          <span className="subtitle-source-icon"><AudioWaveform size={17} /></span>
          <div><h2>Start with a recording</h2><p>Choose the language spoken in the recording for better recognition.</p></div>
        </div>

        <SubtitleUpload file={file} onFile={selectFile} disabled={busy} />
        {dragError && <p className="subtitle-error" role="alert">{dragError}</p>}

        <div className="subtitle-options">
          <label className="subtitle-language">
            <span><Languages size={14} /> Spoken language</span>
            <select value={language} onChange={(event) => setLanguage(event.target.value)} disabled={busy}>
              {LANGUAGES.map((option) => <option key={option.value || 'auto'} value={option.value}>{option.label}</option>)}
            </select>
          </label>
          <div className="subtitle-quality">
            <span>Transcription quality</span>
            <div className="subtitle-quality-options" role="group" aria-label="Transcription quality">
              {QUALITY_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  aria-pressed={quality === option.value}
                  className={`subtitle-quality-option${quality === option.value ? ' is-selected' : ''}`}
                  disabled={busy}
                  onClick={() => setQuality(option.value)}
                >
                  <strong>{option.label}</strong>
                  <small>{option.detail}</small>
                </button>
              ))}
            </div>
          </div>
          <button className="button button-primary subtitle-generate" type="button" onClick={generateSubtitles} disabled={!file || busy}>
            {busy ? <><LoaderCircle size={15} className="subtitle-spinner" /> {stage || 'Generating subtitles…'}</> : <><Sparkles size={15} /> Generate subtitles</>}
          </button>
        </div>

        {busy && <div className="subtitle-progress" aria-live="polite">
          <div><span>{stage || 'Generating subtitles locally…'}</span>{modelPercent != null && <span>{modelPercent}%</span>}</div>
          {modelPercent != null && <progress max="100" value={modelPercent} aria-label="Speech model download progress" />}
        </div>}
        {error && <div className="subtitle-error" role="alert"><Info size={15} /><span>{error}</span></div>}
        <p className="subtitle-privacy"><Info size={13} /> Each quality downloads its model on first use; Max uses the largest download. Models stay cached in this browser, and your media stays on this device. Review the transcript before exporting.</p>
      </section>

      {file && (
        <section className="subtitle-review" aria-label="Subtitle review">
          <div className="subtitle-review-media">
            <div className="subtitle-panel-heading">
              <span className="subtitle-panel-icon">{isVideo ? <FileVideo2 size={16} /> : <FileAudio2 size={16} />}</span>
              <div><strong>{file.name}</strong><small>{duration ? `${formatTime(duration)} · ` : ''}{file.size ? formatBytes(file.size) : ''}</small></div>
            </div>
            {isVideo
              ? <video ref={mediaRef} className="subtitle-player" src={fileUrl} controls preload="metadata" onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)} />
              : <audio ref={mediaRef} className="subtitle-player subtitle-audio-player" src={fileUrl} controls preload="metadata" onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)} />}
            {cues.length > 0 && <div className="subtitle-playback-note"><Clock3 size={13} /> Select a cue to jump to its start.</div>}
          </div>

          <div className="subtitle-cue-panel">
            <div className="subtitle-cue-heading">
              <div><h2>{cues.length ? 'Review your subtitles' : 'Subtitles will appear here'}</h2><p>{cues.length ? `${cues.length} timed cues · edit any line before export` : 'Generate a transcript to see each line with its timing.'}</p></div>
              {cues.length > 0 && <span className="subtitle-ready"><Check size={12} /> Ready</span>}
            </div>

            {cues.length > 0 ? <>
              <div className="subtitle-cue-list">
                {cues.map((cue, index) => (
                  <div key={cue.id} className={`subtitle-cue${activeCueId === cue.id ? ' is-active' : ''}`}>
                    <button type="button" className="subtitle-cue-time" onClick={() => seekToCue(cue)} aria-label={`Play subtitle ${index + 1}, ${formatTime(cue.start)} to ${formatTime(cue.end)}`}>
                      <Play size={11} fill="currentColor" />
                      <span>{formatTime(cue.start)}–{formatTime(cue.end)}</span>
                    </button>
                    <textarea
                      value={cue.text}
                      rows={Math.min(3, Math.max(1, Math.ceil(cue.text.length / 42)))}
                      aria-label={`Subtitle ${index + 1} text`}
                      onChange={(event) => updateCue(cue.id, event.target.value)}
                    />
                  </div>
                ))}
              </div>
              <div className="subtitle-download-row">
                <span>Download your subtitle file</span>
                <button type="button" className="button button-download" onClick={() => downloadSubtitles('srt')}><ArrowDownToLine size={14} /> SRT</button>
                <button type="button" className="button button-download" onClick={() => downloadSubtitles('vtt')}><ArrowDownToLine size={14} /> VTT</button>
              </div>
            </> : <div className="subtitle-empty-cues"><span><Captions size={19} /></span><p>Timed subtitle lines will be ready to review here.</p></div>}
          </div>
        </section>
      )}

      <section className="subtitle-how" aria-label="How subtitle generation works">
        <div><span className="subtitle-how-icon"><Upload size={14} /></span><span><strong>Add a media file</strong><small>Video or audio up to 30 minutes</small></span></div>
        <div><span className="subtitle-how-icon"><Sparkles size={14} /></span><span><strong>Transcribe locally</strong><small>Choose a language and quality level</small></span></div>
        <div><span className="subtitle-how-icon"><ArrowDownToLine size={14} /></span><span><strong>Review and export</strong><small>Edit text, then download SRT or VTT</small></span></div>
      </section>

      <footer className="page-footer subtitle-footer"><span><Info size={13} /> Maximum file size: 200 MB. First use needs an internet connection to download the speech model.</span><span>Subtitle files are created on your device.</span></footer>
    </div>
  );
}
