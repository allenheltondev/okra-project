import { useCallback, useEffect, useRef, useState } from 'react';
import type { PhotoEntry } from '../hooks/usePhotoUploader';
import './PhotoUploader.css';

export interface PhotoUploaderProps {
  photos: PhotoEntry[];
  onAddFiles: (files: File[]) => void;
  onRetry: (localId: string) => void;
  onRemove: (localId: string) => void;
  disabled: boolean;
  rateLimitUntil: number | null;
}

const MAX_PHOTOS = 5;
const ACCEPT = 'image/jpeg,image/png,image/webp';

export function PhotoUploader({
  photos,
  onAddFiles,
  onRetry,
  onRemove,
  disabled,
  rateLimitUntil,
}: PhotoUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [rateLimitMsg, setRateLimitMsg] = useState<string | null>(null);

  const maxReached = photos.length >= MAX_PHOTOS;
  const isRateLimited = rateLimitUntil !== null && Date.now() < rateLimitUntil;
  const inputDisabled = disabled || maxReached || isRateLimited;

  // Update rate limit message and clear it when the timer expires
  useEffect(() => {
    if (!rateLimitUntil) {
      setRateLimitMsg(null);
      return;
    }

    const remaining = rateLimitUntil - Date.now();
    if (remaining <= 0) {
      setRateLimitMsg(null);
      return;
    }

    setRateLimitMsg(`Too many uploads. Please wait and try again.`);
    const timer = setTimeout(() => setRateLimitMsg(null), remaining);
    return () => clearTimeout(timer);
  }, [rateLimitUntil]);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const fileList = e.target.files;
      if (!fileList || fileList.length === 0) return;
      onAddFiles(Array.from(fileList));
      // Reset input so the same file can be re-selected
      if (inputRef.current) inputRef.current.value = '';
    },
    [onAddFiles],
  );

  const inputId = 'photo-upload-input';

  return (
    <div className="photo-uploader">
      <div className="photo-uploader__input-wrapper">
        <label className="photo-uploader__label" htmlFor={inputId}>
          Upload photos (JPEG, PNG, or WebP, max 10 MB each)
        </label>
        <input
          ref={inputRef}
          id={inputId}
          className="photo-uploader__file-input"
          type="file"
          accept={ACCEPT}
          multiple
          disabled={inputDisabled}
          onChange={handleChange}
        />
      </div>

      {maxReached && (
        <p className="photo-uploader__message">Maximum of 5 photos reached</p>
      )}

      {rateLimitMsg && (
        <p className="photo-uploader__message photo-uploader__message--warning">
          {rateLimitMsg}
        </p>
      )}

      {photos.length > 0 && (
        <div className="photo-uploader__grid" role="list" aria-label="Uploaded photos">
          {photos.map((photo) => (
            <PhotoThumb
              key={photo.localId}
              photo={photo}
              onRetry={onRetry}
              onRemove={onRemove}
              disabled={disabled}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function PhotoThumb({
  photo,
  onRetry,
  onRemove,
  disabled,
}: {
  photo: PhotoEntry;
  onRetry: (localId: string) => void;
  onRemove: (localId: string) => void;
  disabled: boolean;
}) {
  const isFailed = photo.state === 'failed';

  return (
    <div
      className={`photo-uploader__thumb${isFailed ? ' photo-uploader__thumb--failed' : ''}`}
      role="listitem"
    >
      {photo.previewUrl && (
        <img src={photo.previewUrl} alt={`Photo ${photo.localId}`} />
      )}

      <button
        className="photo-uploader__remove-btn"
        onClick={() => onRemove(photo.localId)}
        aria-label={`Remove photo ${photo.localId}`}
        disabled={disabled}
        type="button"
      >
        ✕
      </button>

      {photo.state === 'uploading' && (
        <div className="photo-uploader__overlay photo-uploader__overlay--uploading">
          <div className="photo-uploader__spinner" role="status" aria-label="Uploading" />
        </div>
      )}

      {photo.state === 'uploaded' && (
        <div className="photo-uploader__overlay photo-uploader__overlay--uploaded">
          <span className="photo-uploader__checkmark" aria-label="Upload complete">✓</span>
        </div>
      )}

      {isFailed && (
        <div className="photo-uploader__overlay photo-uploader__overlay--failed">
          <span className="photo-uploader__error-icon" aria-hidden="true">!</span>
          {photo.errorMessage && (
            <span className="photo-uploader__error-msg">{photo.errorMessage}</span>
          )}
          <button
            className="photo-uploader__retry-btn"
            onClick={() => onRetry(photo.localId)}
            disabled={disabled}
            type="button"
          >
            Retry
          </button>
        </div>
      )}
    </div>
  );
}
