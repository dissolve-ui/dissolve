'use client';
/**
 * UploadTile and UploadTray for React on the web, from dissolve (dissolve-ui). This file is yours.
 * Same props as the React Native version; the tile itself lives in upload-tile.core.ts.
 *
 * An attachment that assembles from grains as it uploads: the upload progress (0 to 1) is the
 * share of grains that have landed. At 1 the tile is whole and only then the remove cross fades
 * in. A file over maxSize (or an upload that rejects) shakes, turns red and leaves as dust, and the
 * row closes up behind it. Tap the tile while it uploads to cancel. No picker dependency: an
 * <input type="file"> is enough.
 *
 * <UploadTray
 *   files={files}
 *   upload={(file, onProgress, signal) => api.upload(file, { onProgress, signal })}
 *   maxSize={25 * 1024 * 1024}
 *   onAdd={() => input.current?.click()}
 *   onRemove={(file) => setFiles((all) => all.filter((f) => f.id !== file.id))}
 * />
 *
 * <UploadTile file={file} upload={upload} onRemove={drop} />
 */
import { useEffect, useRef, type CSSProperties } from 'react';
import { createUploadTile, formatBytes, type RemoveReason, type UploadFile, type UploadFn, type UploadTileProps as CoreProps } from './upload-tile.core';
import { vibrate } from './kit';
import { useDissolveCore } from './react';

export { formatBytes };
export type { RemoveReason, UploadFile, UploadFn };

export type UploadTileProps = CoreProps & {
  /** Outer wrapper classes (margins). */
  className?: string;
  style?: CSSProperties;
};

export function UploadTile({ className, style, ...props }: UploadTileProps) {
  const { host } = useDissolveCore(createUploadTile, props);
  return <div ref={host} className={className} style={style} />;
}

export type UploadTrayProps = {
  /** Files to show, each with a stable id. Remove them in onRemove. */
  files: (UploadFile & { id: string })[];
  upload: UploadFn;
  maxSize?: number;
  /** Shows an add tile first in the row. Open your picker here. */
  onAdd?: () => void;
  onDone?: (file: UploadFile) => void;
  onRemove?: (file: UploadFile, reason: RemoveReason) => void;
  size?: number;
  /** Space between tiles in px. Default 6 (the room kept for the cross already adds 12). */
  gap?: number;
  haptics?: boolean;
  /** Root classes (margins...). */
  className?: string;
  /** Tile classes, forwarded to every tile. */
  tileClassName?: string;
  style?: CSSProperties;
};

const PLUS = 'M12 5v14M5 12h14';

/** Horizontal row of upload tiles with an optional add tile, scrolls to a newly added file. */
export function UploadTray({ files, upload, maxSize, onAdd, onDone, onRemove, size = 72, gap = 6, haptics = true, className, tileClassName, style }: UploadTrayProps) {
  const row = useRef<HTMLDivElement>(null);
  const count = useRef(files.length);
  const outer = size + 12;

  useEffect(() => {
    if (files.length > count.current) row.current?.scrollTo({ left: row.current.scrollWidth, behavior: 'smooth' });
    count.current = files.length;
  }, [files.length]);

  return (
    <div className={className} style={style}>
      <div ref={row} role="list" aria-label="Attachments" style={{ display: 'flex', overflowX: 'auto', scrollbarWidth: 'none' }}>
        {onAdd ? (
          <button
            type="button"
            aria-label="Add attachment"
            onClick={() => {
              if (haptics) vibrate(6);
              onAdd();
            }}
            style={{ flex: 'none', width: outer, height: outer, padding: 6, marginRight: gap, border: 0, background: 'none', cursor: 'pointer', display: 'grid' }}
          >
            <span
              style={{
                display: 'grid', placeItems: 'center', borderRadius: 16, color: 'var(--dissolve-muted, rgb(142 142 147))',
                border: '1.5px dashed var(--dissolve-border, rgb(60 60 67 / 0.12))',
              }}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                <path d={PLUS} />
              </svg>
            </span>
          </button>
        ) : null}
        {files.map((f) => (
          <UploadTile
            key={f.id}
            file={f}
            upload={upload}
            maxSize={maxSize}
            size={size}
            spacing={gap}
            onDone={onDone}
            onRemove={onRemove}
            haptics={haptics}
            tileClassName={tileClassName}
          />
        ))}
      </div>
    </div>
  );
}
