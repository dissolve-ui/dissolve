'use client';
/**
 * OTPInput for React on the web, from dissolve (dissolve-ui). This file is yours. Same props as the
 * React Native version; the boxes live in otp-input.core.ts.
 *
 * <OTPInput autoFocus onComplete={async (code) => (await api.verify(code)).ok} />
 *
 * const [code, setCode] = useState('');
 * const otp = useRef<OTPInputHandle>(null);
 * <OTPInput value={code} onChange={setCode} length={4} boxWidth={52} onComplete={(c) => c === expected} ref={otp} />
 * otp.current?.reset();
 */
import { useImperativeHandle, type CSSProperties, type Ref } from 'react';
import { createOtpInput, type OTPInputHandle, type OTPInputProps as CoreProps } from './otp-input.core';
import { useDissolveCore } from './react';

export type { OTPInputHandle };

export type OTPInputProps = CoreProps & {
  /** Root classes (margins, width...). */
  className?: string;
  style?: CSSProperties;
  ref?: Ref<OTPInputHandle>;
};

export function OTPInput({ className, style, ref, ...props }: OTPInputProps) {
  const { host, current } = useDissolveCore(createOtpInput, props);
  useImperativeHandle(ref, () => ({
    reset: () => current.current?.reset(),
    focus: () => current.current?.focus(),
    blur: () => current.current?.blur(),
  }), [current]);
  return <div ref={host} className={className} style={style} />;
}
