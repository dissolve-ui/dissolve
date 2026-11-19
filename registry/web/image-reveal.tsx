'use client';
/**
 * ImageReveal for React on the web, from dissolve (dissolve-ui). This file is yours. Same props as
 * the React Native version; the loader itself lives in image-reveal.core.ts.
 *
 * Image generation loader: a quiet "thinking" mosaic while pending, then the image resolves
 * coarse to fine (8 cells, 16, 32, 64, 128) and crossfades into the sharp image. On error the
 * mosaic tints red and leaves as dust.
 *
 * <ImageReveal src={result?.url} status={generating ? 'pending' : 'ready'} className="rounded-[20px]" />
 *
 * <ImageReveal
 *   src={result?.url}
 *   status={failed ? 'error' : result ? 'ready' : 'pending'}
 *   onRevealed={() => setShowActions(true)}
 *   onDismissed={retry}
 * />
 */
import type { CSSProperties } from 'react';
import { createImageReveal, type ImageRevealProps as CoreProps, type ImageRevealStatus } from './image-reveal.core';
import { useDissolveCore } from './react';

export type { ImageRevealStatus };

export type ImageRevealProps = CoreProps & {
  /** Classes of the frame: size, radius. Full width by default, its height follows aspectRatio. */
  className?: string;
  style?: CSSProperties;
};

export function ImageReveal({ className, style, ...props }: ImageRevealProps) {
  const { host } = useDissolveCore(createImageReveal, props);
  return <div ref={host} className={className} style={style} />;
}
