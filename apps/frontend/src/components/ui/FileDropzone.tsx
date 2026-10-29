"use client";

import { type DragEvent, useEffect, useId, useRef, useState } from "react";
import { cn } from "@/lib/cn";

interface FileDropzoneProps {
  id: string;
  label: string;
  /** Shown before a file is chosen, e.g. "JPG, PNG or WebP, up to 5 MB". */
  hint: string;
  accept: string;
  file: File | null;
  onChange: (file: File | null) => void;
  error?: string;
  required?: boolean;
}

function formatBytes(bytes: number): string {
  return bytes >= 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

/**
 * Tap to choose (camera or gallery on phones), drag and drop on desktop, preview with remove/replace
 * (UI_UX_GUIDELINES §5). The input itself stays in the page, so labels and keyboard work natively.
 */
export function FileDropzone({ id, label, hint, accept, file, onChange, error, required }: FileDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  // Keyed by file, so a stale preview is never shown for a newly chosen one.
  const [preview, setPreview] = useState<{ file: File; url: string } | null>(null);
  const hintId = useId();
  const errorId = useId();

  useEffect(() => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => typeof reader.result === "string" && setPreview({ file, url: reader.result });
    reader.readAsDataURL(file);
    return () => reader.abort();
  }, [file]);

  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(false);
    const dropped = event.dataTransfer.files[0];
    if (dropped) onChange(dropped);
  };

  const describedBy = [hintId, error ? errorId : null].filter(Boolean).join(" ");

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-sm font-semibold text-fg" id={`${id}-label`}>
        {label}
      </span>
      <p id={hintId} className="text-sm text-fg-muted">
        {hint}
      </p>
      <input
        ref={inputRef}
        id={id}
        type="file"
        accept={accept}
        className="sr-only"
        aria-labelledby={`${id}-label`}
        aria-describedby={describedBy}
        aria-invalid={error ? true : undefined}
        required={required}
        onChange={(event) => {
          onChange(event.target.files?.[0] ?? null);
          event.target.value = ""; // choosing the same file again still fires change
        }}
      />
      {file ? (
        <div className="flex items-center gap-4 rounded-field border border-border bg-surface p-3">
          {preview?.file === file ? (
            // eslint-disable-next-line @next/next/no-img-element -- local data-URL preview
            <img src={preview.url} alt="Selected photo" className="size-20 shrink-0 rounded-[12px] object-cover" />
          ) : (
            <span className="size-20 shrink-0 rounded-[12px] bg-surface-muted" aria-hidden="true" />
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold text-fg">{file.name}</p>
            <p className="text-sm text-fg-muted">{formatBytes(file.size)}</p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <button type="button" onClick={() => inputRef.current?.click()} className="min-h-11 rounded-pill px-3 text-sm font-semibold text-primary hover:bg-surface-muted">
              Replace
            </button>
            <button type="button" onClick={() => onChange(null)} className="min-h-11 rounded-pill px-3 text-sm font-semibold text-danger hover:bg-surface-muted">
              Remove
            </button>
          </div>
        </div>
      ) : (
        <div
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          className={cn(
            "rounded-field border-2 border-dashed transition-colors",
            error ? "border-danger" : dragging ? "border-primary bg-primary-soft" : "border-border-strong bg-surface",
          )}
        >
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            aria-describedby={describedBy}
            className="flex min-h-36 w-full flex-col items-center justify-center gap-2 rounded-field px-4 py-6 text-center"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="size-9 text-primary" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 8h3l2-3h6l2 3h3v11H4V8Z" />
              <circle cx="12" cy="13" r="3.5" />
            </svg>
            <span className="font-semibold text-fg">Take or choose a photo</span>
            <span className="hidden text-sm text-fg-muted sm:block">or drag it here</span>
          </button>
        </div>
      )}
      {error && (
        <p id={errorId} className="text-sm font-semibold text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
