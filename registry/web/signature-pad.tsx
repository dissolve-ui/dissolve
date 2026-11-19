'use client';
/**
 * SignaturePad for React on the web, from dissolve (dissolve-ui). This file is yours. Same props as
 * the React Native version; the pad itself lives in signature-pad.core.ts.
 *
 * Sign with a finger, a pen or the mouse. Ink is drawn as variable width strokes (slow is thick,
 * fast is thin, tapered ends), on a signing line with an x and a placeholder that fades once you
 * start. Undo removes the last stroke, Clear turns the signature into dust.
 *
 * const pad = useRef<SignaturePadHandle>(null);
 * <SignaturePad ref={pad} onChange={setSigned} onSave={({ base64 }) => upload(base64)} />
 * pad.current?.save();
 */
import { useImperativeHandle, type CSSProperties, type Ref } from 'react';
import { createSignaturePad, type SignatureExport, type SignaturePadHandle, type SignaturePadProps as CoreProps } from './signature-pad.core';
import { useDissolveCore } from './react';

export type { SignatureExport, SignaturePadHandle };

export type SignaturePadProps = CoreProps & {
  /** Pad classes (background, radius, border...). It fills the width of its parent. */
  className?: string;
  style?: CSSProperties;
  ref?: Ref<SignaturePadHandle>;
};

export function SignaturePad({ className, style, ref, ...props }: SignaturePadProps) {
  const { host, current } = useDissolveCore(createSignaturePad, props);
  useImperativeHandle(ref, () => ({
    undo: () => current.current?.undo(),
    clear: async () => current.current?.clear(),
    isEmpty: () => current.current?.isEmpty() ?? true,
    toImage: () => current.current?.toImage() ?? null,
    save: () => current.current?.save() ?? null,
  }), [current]);
  return <div ref={host} className={className} style={style} />;
}
