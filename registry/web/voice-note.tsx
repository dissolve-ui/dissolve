'use client';
/**
 * VoiceNote for React on the web, from dissolve (dissolve-ui). This file is yours. Same props as
 * the React Native version; the bubble itself lives in voice-note.core.ts.
 *
 * A voice message bubble. Play and pause, the played part of the waveform takes the ink, drag
 * along the waveform to seek. Long press to unsend: the bubble blows away as dust. No audio
 * dependency, playback is a timer you hook to your player.
 *
 * <VoiceNote mine duration={14} seed="msg-42" onUnsend={() => remove(id)} />
 *
 * <VoiceNote
 *   duration={9}
 *   levels={peaks}
 *   onPlay={() => audio.play()}
 *   onPause={() => audio.pause()}
 *   unsent={deleting}
 *   onUnsend={() => remove(id)}
 * />
 */
import type { CSSProperties } from 'react';
import { createVoiceNote, type VoiceNoteProps as CoreProps } from './voice-note.core';
import { useDissolveCore } from './react';

export type VoiceNoteProps = Omit<CoreProps, 'duration'> & {
  /** Length of the note in seconds. Playback is simulated with a timer. */
  duration: number;
  /** Styles of the outer box (margins, alignment...). The bubble takes className. */
  style?: CSSProperties;
};

export function VoiceNote({ style, ...props }: VoiceNoteProps) {
  const { host } = useDissolveCore(createVoiceNote, props);
  return <div ref={host} style={style} />;
}
