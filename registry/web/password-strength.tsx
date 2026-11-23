'use client';
/**
 * PasswordStrength for React on the web, from dissolve (dissolve-ui). This file is yours. Same
 * props as the React Native version; the field lives in password-strength.core.ts.
 *
 * A password field with Show and Hide, a strength meter made of four segments of dots with a
 * rolling word, and the rules ticking live.
 *
 * <PasswordStrength onChange={(pw, s) => { setPassword(pw); setOk(s.passed); }} />
 */
import type { CSSProperties } from 'react';
import { createPasswordStrength, type PasswordStrengthProps as CoreProps } from './password-strength.core';
import { useDissolveCore } from './react';

export { DEFAULT_RULES, scorePassword, type PasswordRule, type Strength } from './password-strength.core';

export type PasswordStrengthProps = CoreProps & {
  /** Outer classes (margins, width...). */
  className?: string;
  style?: CSSProperties;
};

export function PasswordStrength({ className, style, ...props }: PasswordStrengthProps) {
  const { host } = useDissolveCore(createPasswordStrength, props);
  return <div ref={host} className={className} style={style} />;
}
