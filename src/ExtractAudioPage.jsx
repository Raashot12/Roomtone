import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowDownToLine, Check, Clapperboard, Info, Sparkles, Upload } from 'lucide-react';
import { isSupportedVideoFile } from './media-import.js';

const MAX_VIDEO_SIZE = 200 * 1024 * 1024;

const videoFileSchema = z.instanceof(File, { message: 'Choose a video file to continue.' })
  .refine((file) => file.size > 0, 'This video file is empty.')
  .refine((file) => file.size <= MAX_VIDEO_SIZE, 'Video must be 200 MB or smaller.')
  .refine(isSupportedVideoFile, 'Choose an MP4, MOV, or WebM video.');

const extractionSchema = z.object({ video: videoFileSchema });

function formatBytes(bytes) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatTime(seconds = 0) {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60).toString().padStart(2, '0');
  return `${mins}:${secs}`;
}

export default function ExtractAudioPage({
  busy,
  processingStage,
  result,
  exportError,
  exportingFormat,
  onExtract,
  onDownload,
  onVideoSelected,
}) {
  const [submitError, setSubmitError] = useState('');
  const {
    control,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(extractionSchema),
    defaultValues: { video: null },
    mode: 'onSubmit',
  });
  const selectedVideo = watch('video');
  const videoError = errors.video?.message;
  const isBusy = busy || isSubmitting;
  const isLocked = isBusy || Boolean(exportingFormat);

  const submitVideo = handleSubmit(async ({ video }) => {
    setSubmitError('');
    try {
      await onExtract(video);
    } catch (error) {
      setSubmitError(error?.message || 'The video audio could not be extracted. Try another file.');
    }
  });

  const updateSelectedVideo = (onChange, video) => {
    onChange(video);
    setSubmitError('');
    onVideoSelected();
  };

  return (
    <div className="page-content extraction-page">
      <section className="extraction-heading">
        <div>
          <div className="heading-kicker"><span className="heading-kicker-line" /> Video audio tool</div>
          <h1>Extract the voice.<br /><span>Leave the video behind.</span></h1>
          <p>Upload a video and Roomtone will extract its audio, reduce background noise, and prepare a clean track to download.</p>
        </div>
        <div className="extraction-heading-mark" aria-hidden="true"><Clapperboard size={31} strokeWidth={1.5} /></div>
      </section>

      <div className="extraction-grid">
        <form className="extraction-card" noValidate onSubmit={submitVideo}>
          <div className="extraction-card-heading">
            <span className="extraction-step">01</span>
            <div><h2>Choose your video</h2><p>We’ll pull out the audio track and clean it up.</p></div>
          </div>

          <Controller
            control={control}
            name="video"
            render={({ field: { name, onChange, onBlur, ref } }) => (
              <label
                className={`video-upload-zone${selectedVideo ? ' has-video' : ''}${videoError ? ' has-error' : ''}`}
                onDragOver={(event) => { if (!isLocked) event.preventDefault(); }}
                onDrop={(event) => {
                  if (isLocked) return;
                  event.preventDefault();
                  const droppedFile = event.dataTransfer.files?.[0];
                  if (droppedFile) updateSelectedVideo(onChange, droppedFile);
                }}
              >
                <input
                  ref={ref}
                  name={name}
                  className="visually-hidden"
                  type="file"
                  disabled={isLocked}
                  accept="video/mp4,video/quicktime,video/webm,application/mp4,.mp4,.mov,.m4v,.webm"
                  aria-label="Choose a video to extract audio from"
                  aria-invalid={Boolean(videoError)}
                  aria-describedby={videoError ? 'video-upload-error' : 'video-upload-help'}
                  onBlur={onBlur}
                  onChange={(event) => updateSelectedVideo(onChange, event.target.files?.[0] || null)}
                />
                <span className="video-upload-icon"><Upload size={19} /></span>
                <span className="video-upload-copy">
                  <strong>{selectedVideo?.name || 'Drop a video here or browse your files'}</strong>
                  <small>{selectedVideo ? `${formatBytes(selectedVideo.size)} · Ready to extract` : 'MP4, MOV, or WebM · Maximum file size 200 MB'}</small>
                </span>
                <span className="button button-dark video-browse-button">{selectedVideo ? 'Choose another' : 'Choose video'}</span>
              </label>
            )}
          />

          {videoError && <p className="video-form-error" id="video-upload-error" role="alert">{videoError}</p>}
          {!videoError && <p className="video-form-help" id="video-upload-help">Supported: MP4, MOV, or WebM · Maximum: 200 MB · Files stay on this device.</p>}

          {(submitError || exportError) && <div className="video-notice-error" role="alert"><Info size={15} /><span>{submitError || exportError}</span></div>}

          <button className="button button-primary extraction-submit" type="submit" disabled={isLocked}>
            {isBusy ? <><span className="button-spinner" /> {processingStage || 'Preparing video…'}</> : <><Sparkles size={15} /> Extract audio and remove noise</>}
          </button>
        </form>

        <aside className="extraction-info-card">
          <span className="extraction-info-icon"><Sparkles size={17} /></span>
          <h2>From video to clean audio</h2>
          <ol>
            <li><span>1</span><div><strong>Extract</strong><small>Roomtone finds the audio track in your video.</small></div></li>
            <li><span>2</span><div><strong>Enhance</strong><small>Local noise reduction cleans the voice.</small></div></li>
            <li><span>3</span><div><strong>Download</strong><small>Save the result as WAV or MP3.</small></div></li>
          </ol>
          <p className="extraction-limit-note"><Info size={13} /> Videos must be 200 MB or smaller.</p>
        </aside>
      </div>

      {result && (
        <section className="extraction-result" aria-live="polite">
          <div className="extraction-result-heading">
            <span className="extraction-result-check"><Check size={15} /></span>
            <div><span className="small-label">READY TO DOWNLOAD</span><h2>{result.name}-clean-audio</h2><p>Enhanced audio · {formatTime(result.duration)}</p></div>
          </div>
          <audio className="extraction-audio-preview" controls preload="metadata" src={result.url}>
            Your browser does not support audio playback.
          </audio>
          <div className="extraction-download-row">
            <span>Download clean audio as</span>
            <button type="button" className="button button-download" disabled={Boolean(exportingFormat) || busy} onClick={() => onDownload('wav')}>
              <ArrowDownToLine size={14} /> WAV
            </button>
            <button type="button" className="button button-download" disabled={Boolean(exportingFormat) || busy} onClick={() => onDownload('mp3')}>
              <ArrowDownToLine size={14} /> {exportingFormat === 'mp3' ? 'Creating MP3…' : 'MP3'}
            </button>
          </div>
        </section>
      )}

      <footer className="page-footer extraction-footer"><span>Video processing runs locally in your browser.</span><span>Keep your original video unchanged.</span></footer>
    </div>
  );
}
