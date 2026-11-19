'use client';
/**
 * ReactionPicker for React on the web, from dissolve (dissolve-ui). This file is yours. Same props
 * as the React Native version; the picker itself lives in reaction-picker.core.ts.
 *
 * iMessage style reactions. Long press a bubble: it lifts, a pill of emojis grows out of the press
 * point. Slide across and the emoji under the pointer magnifies like the Dock. Release on one to
 * pick it, it flies to the bubble corner. Pick the same one again and the badge snaps into grains.
 *
 * const [reaction, setReaction] = useState<string | null>(null);
 * <ReactionPicker selected={reaction} onReact={(e) => setReaction(e === reaction ? null : e)}>
 *   <Bubble text={text} />
 * </ReactionPicker>
 *
 * <ReactionPicker reactions={['👍', '👀', '🎉']} corner="top-left" backdropClassName="bg-black/20" onReact={react}>
 *   <MyBubble />
 * </ReactionPicker>
 */
import type { CSSProperties, ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { createReactionPicker, DEFAULT_REACTIONS, type ReactionCorner, type ReactionPickerProps as CoreProps } from './reaction-picker.core';
import { useDissolveCore } from './react';

export { DEFAULT_REACTIONS };
export type { ReactionCorner };

export type ReactionPickerProps = Omit<CoreProps, 'onReact'> & {
  /** The bubble. It lifts while the picker is open. */
  children: ReactNode;
  /** Called with the chosen emoji. Picking the current one again is your cue to remove it. */
  onReact: (emoji: string) => void;
  /** Wrapper classes (margins, alignment...). */
  className?: string;
  style?: CSSProperties;
};

export function ReactionPicker({ children, className, style, ...props }: ReactionPickerProps) {
  const { host, instance } = useDissolveCore(createReactionPicker, props);
  return (
    <div ref={host} className={className} style={style}>
      {instance ? createPortal(children, instance.slot) : null}
    </div>
  );
}
