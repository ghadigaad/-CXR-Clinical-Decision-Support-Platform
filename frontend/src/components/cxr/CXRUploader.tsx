import { Image as ImageIcon, RefreshCw, Trash2, Upload } from 'lucide-react';
import { useCallback, useEffect, useId, useRef, useState } from 'react';

import { cn, formatBytes } from '../../lib/utils';
import { Alert } from '../ui/Alert';
import { Button } from '../ui/Button';

export const ACCEPTED_TYPES = ['image/jpeg', 'image/png'];
export const ACCEPTED_EXTENSIONS = '.jpg,.jpeg,.png';
export const MAX_FILE_BYTES = 10 * 1024 * 1024;

export interface SelectedImage {
  file: File;
  /** Object URL for preview. Revoked when the selection changes or unmounts. */
  previewUrl: string;
  width: number;
  height: number;
}

/**
 * Client-side validation. The backend re-validates by magic bytes regardless - this
 * exists to give immediate feedback, not to be a security boundary.
 */
function validate(file: File): string | null {
  if (!ACCEPTED_TYPES.includes(file.type)) {
    return 'Unsupported file type. Upload a JPG, JPEG, or PNG image.';
  }
  if (file.size > MAX_FILE_BYTES) {
    return `The image is ${formatBytes(file.size)}, which exceeds the ${formatBytes(MAX_FILE_BYTES)} limit.`;
  }
  if (file.size === 0) {
    return 'The selected file is empty.';
  }
  return null;
}

function readDimensions(url: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight });
    image.onerror = () => reject(new Error('The image could not be read.'));
    image.src = url;
  });
}

interface CXRUploaderProps {
  value: SelectedImage | null;
  onChange: (image: SelectedImage | null) => void;
  disabled?: boolean;
}

export function CXRUploader({ value, onChange, disabled = false }: CXRUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputId = useId();

  /**
   * Tracks the currently displayed object URL for cleanup. A ref is required because the
   * unmount handler must see the latest URL, not the one captured when the effect first
   * ran - otherwise decoded X-ray pixels stay alive in memory after navigating away.
   */
  const activeUrlRef = useRef<string | null>(null);
  activeUrlRef.current = value?.previewUrl ?? null;

  useEffect(() => {
    return () => {
      if (activeUrlRef.current) URL.revokeObjectURL(activeUrlRef.current);
    };
  }, []);

  const acceptFile = useCallback(
    async (file: File | undefined) => {
      if (!file) return;

      const validationError = validate(file);
      if (validationError) {
        setError(validationError);
        return;
      }

      const previewUrl = URL.createObjectURL(file);
      try {
        const { width, height } = await readDimensions(previewUrl);
        if (width < 32 || height < 32) {
          URL.revokeObjectURL(previewUrl);
          setError('The image is too small to be a diagnostic chest X-ray.');
          return;
        }

        if (value?.previewUrl) URL.revokeObjectURL(value.previewUrl);
        setError(null);
        onChange({ file, previewUrl, width, height });
      } catch {
        URL.revokeObjectURL(previewUrl);
        setError('The image could not be read. It may be corrupt.');
      }
    },
    [onChange, value],
  );

  function handleRemove() {
    if (value?.previewUrl) URL.revokeObjectURL(value.previewUrl);
    setError(null);
    onChange(null);
    if (inputRef.current) inputRef.current.value = '';
  }

  if (value) {
    return (
      <div className="space-y-3">
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-slate-900">
          <img
            src={value.previewUrl}
            alt="Chest X-ray selected for analysis"
            className="mx-auto max-h-[28rem] w-auto object-contain"
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <ImageIcon className="size-5 shrink-0 text-slate-400" aria-hidden />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-slate-900">{value.file.name}</p>
              <p className="text-xs text-slate-500">
                {value.width} × {value.height} px · {formatBytes(value.file.size)}
              </p>
            </div>
          </div>

          <div className="flex shrink-0 gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => inputRef.current?.click()}
              disabled={disabled}
              leftIcon={<RefreshCw className="size-4" aria-hidden />}
            >
              Replace
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRemove}
              disabled={disabled}
              leftIcon={<Trash2 className="size-4" aria-hidden />}
              className="text-red-600 hover:bg-red-50 hover:text-red-700"
            >
              Remove
            </Button>
          </div>
        </div>

        <input
          ref={inputRef}
          id={inputId}
          type="file"
          accept={ACCEPTED_EXTENSIONS}
          className="sr-only"
          onChange={(event) => void acceptFile(event.target.files?.[0])}
          disabled={disabled}
        />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div
        onDragOver={(event) => {
          event.preventDefault();
          if (!disabled) setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setIsDragging(false);
          if (!disabled) void acceptFile(event.dataTransfer.files?.[0]);
        }}
        className={cn(
          'rounded-xl border-2 border-dashed px-6 py-12 text-center transition-colors',
          isDragging
            ? 'border-clinical-500 bg-clinical-50'
            : 'border-slate-300 bg-slate-50/60 hover:border-slate-400',
          disabled && 'cursor-not-allowed opacity-60',
        )}
      >
        <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-white text-slate-400 shadow-sm">
          <Upload className="size-5" aria-hidden />
        </div>

        <p className="mt-4 text-sm font-medium text-slate-900">
          Drag and drop the chest X-ray here
        </p>
        <p className="mt-1 text-sm text-slate-500">or</p>

        <label
          htmlFor={inputId}
          className={cn(
            'mt-3 inline-flex h-10 cursor-pointer items-center rounded-lg border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50',
            disabled && 'pointer-events-none opacity-60',
          )}
        >
          Browse files
        </label>

        <input
          ref={inputRef}
          id={inputId}
          type="file"
          accept={ACCEPTED_EXTENSIONS}
          className="sr-only"
          onChange={(event) => void acceptFile(event.target.files?.[0])}
          disabled={disabled}
        />

        <p className="mt-4 text-xs text-slate-500">
          JPG, JPEG, or PNG · up to {formatBytes(MAX_FILE_BYTES)}
        </p>
      </div>

      {error ? <Alert tone="danger">{error}</Alert> : null}
    </div>
  );
}
