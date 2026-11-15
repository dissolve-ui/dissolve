import type { ComponentType } from 'react';
import OTPInputDemo from './OTPInput.demo';
import NumberTickerDemo from './NumberTicker.demo';
import ReactionPickerDemo from './ReactionPicker.demo';
import VoiceNoteDemo from './VoiceNote.demo';
import CardStackDemo from './CardStack.demo';
import ReceiptDemo from './Receipt.demo';
import SignaturePadDemo from './SignaturePad.demo';
import BeforeAfterDemo from './BeforeAfter.demo';

export type DemoEntry = { slug: string; title: string; note: string; Component: ComponentType; scroll: boolean };

/** Micro-interaction demos. Gesture heavy ones (cards) render outside a ScrollView. */
export const DEMOS: DemoEntry[] = [
  { slug: 'otp', title: 'OTP input', note: 'SMS code. Wrong code shakes then turns to dust.', Component: OTPInputDemo, scroll: true },
  { slug: 'ticker', title: 'Number ticker', note: 'Digits roll to the new value.', Component: NumberTickerDemo, scroll: true },
  { slug: 'reactions', title: 'Reactions', note: 'Long press a message, slide to an emoji.', Component: ReactionPickerDemo, scroll: true },
  { slug: 'voice', title: 'Voice note', note: 'Scrub the waveform, long press to unsend.', Component: VoiceNoteDemo, scroll: true },
  { slug: 'cards', title: 'Card stack', note: 'Wallet style cards.', Component: CardStackDemo, scroll: false },
  { slug: 'receipt', title: 'Receipt', note: 'A paper receipt that unfolds.', Component: ReceiptDemo, scroll: true },
  { slug: 'signature', title: 'Signature', note: 'Sign with your finger, clear to dust.', Component: SignaturePadDemo, scroll: true },
  { slug: 'before-after', title: 'Before / after', note: 'Drag to compare two versions.', Component: BeforeAfterDemo, scroll: true },
];
