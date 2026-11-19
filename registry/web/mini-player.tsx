'use client';
/**
 * MiniPlayer for React on the web, from dissolve (dissolve-ui). This file is yours. Same props as
 * the React Native version; the player itself lives in mini-player.core.ts.
 *
 * A now playing pill that opens into the full player as one object: the pill grows into the sheet,
 * the artwork arcs into place and the title travels below it. Drag it up or down, swipe the closed
 * pill sideways to skip. Render it as the last child of a positioned container (relative, full
 * screen): it covers that container when open.
 *
 * <MiniPlayer title="Night Swim" subtitle="Low Tide" artwork="/covers/night-swim.jpg" progress={0.3}
 *   playing={playing} onPlayPause={toggle} onNext={next} onPrev={prev} />
 *
 * <MiniPlayer {...track} playing={playing} onPlayPause={toggle}
 *   renderExpanded={({ close }) => <QueueButton onOpen={close} />} />
 */
import type { CSSProperties, ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { createMiniPlayer, type MiniPlayerArtwork, type MiniPlayerProps as CoreProps } from './mini-player.core';
import { useDissolveCore } from './react';

export type { MiniPlayerArtwork };
export type MiniPlayerApi = { close: () => void };

export type MiniPlayerProps = CoreProps & {
  /** Replaces the bottom row of the open player (lyrics, AirPlay, queue). */
  renderExpanded?: (api: MiniPlayerApi) => ReactNode;
  /** Styles of the layer that covers the container. */
  style?: CSSProperties;
};

export function MiniPlayer({ renderExpanded, style, ...props }: MiniPlayerProps) {
  const { host, instance } = useDissolveCore(createMiniPlayer, props);
  return (
    <div ref={host} style={style}>
      {instance && renderExpanded ? createPortal(renderExpanded({ close: instance.close }), instance.slot) : null}
    </div>
  );
}
