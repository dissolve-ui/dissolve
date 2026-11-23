'use client';
/**
 * TextScramble for React on the web, from dissolve (dissolve-ui). This file is yours. Same
 * props as the React Native version; the scramble lives in text-scramble.core.ts.
 *
 * Text that decodes into place: random glyphs resolving letter by letter into the final text,
 * for headings and labels. Plays when text or trigger changes, on ref.current.scramble(), and on
 * mount with playOnMount. Letters keep their final width while they scramble: nothing shifts.
 *
 * <TextScramble as="h1" text={title} className="text-4xl font-semibold" />
 * <TextScramble text="STATUS / READY" monospace trigger={refreshCount} />
 */
import { useImperativeHandle, type CSSProperties, type ElementType, type Ref } from 'react';
import { createTextScramble, type TextScrambleProps as CoreProps } from './text-scramble.core';
import { useDissolveCore } from './react';

export type TextScrambleHandle = {
  /** Plays the scramble on the current text. */
  scramble: () => void;
};

export type TextScrambleProps = CoreProps & {
  ref?: Ref<TextScrambleHandle>;
  /** The element: h1, p, span... Default span. */
  as?: ElementType;
  className?: string;
  style?: CSSProperties;
};

export function TextScramble({ ref, as: Tag = 'span', className, style, ...props }: TextScrambleProps) {
  const { host, current } = useDissolveCore(createTextScramble, props);
  useImperativeHandle(ref, () => ({ scramble: () => current.current?.scramble() }), [current]);
  return <Tag ref={host} className={className} style={style} />;
}
