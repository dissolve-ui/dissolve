import type { ComponentType } from 'react';
import type { SFSymbol } from 'expo-symbols';
import SwipeToDeleteDemo from './SwipeToDelete.demo';
import ToastDemo from './Toast.demo';
import LikeButtonDemo from './LikeButton.demo';
import MorphButtonDemo from './MorphButton.demo';
import SplitButtonDemo from './SplitButton.demo';
import SlideToConfirmDemo from './SlideToConfirm.demo';
import GooeyMenuDemo from './GooeyMenu.demo';
import OTPInputDemo from './OTPInput.demo';
import NumberTickerDemo from './NumberTicker.demo';
import ReactionPickerDemo from './ReactionPicker.demo';
import VoiceNoteDemo from './VoiceNote.demo';
import CardStackDemo from './CardStack.demo';
import SignaturePadDemo from './SignaturePad.demo';
import BeforeAfterDemo from './BeforeAfter.demo';
import ThinkingOrbDemo from './ThinkingOrb.demo';
import ImageRevealDemo from './ImageReveal.demo';
import SweepTransitionDemo from './SweepTransition.demo';
import UploadTileDemo from './UploadTile.demo';
import TaskCheckDemo from './TaskCheck.demo';
import QuantityStepperDemo from './QuantityStepper.demo';
import RulerPickerDemo from './RulerPicker.demo';
import BarChartDemo from './BarChart.demo';
import MiniPlayerDemo from './MiniPlayer.demo';
import PullToRefreshDemo from './PullToRefresh.demo';
import ReorderListDemo from './ReorderList.demo';
import GlossyButtonDemo from './GlossyButton.demo';
import ScratchCardDemo from './ScratchCard.demo';
import SegmentedControlDemo from './SegmentedControl.demo';
import SkeletonDemo from './Skeleton.demo';
import ToggleDemo from './Toggle.demo';
import ProgressStepsDemo from './ProgressSteps.demo';
import ElasticSliderDemo from './ElasticSlider.demo';
import AccordionDemo from './Accordion.demo';

/**
 * One demo per registry component, in registry/index.json order. The slug is the registry
 * name, so the screen lives at /demo/<slug> and installs with `npx dissolve-ui add <slug>`.
 * Gesture heavy, full height demos (scroll: false) render outside a ScrollView.
 */
export type DemoEntry = { slug: string; title: string; note: string; icon: SFSymbol; Component: ComponentType; scroll: boolean };

export const DEMOS: DemoEntry[] = [
  { slug: 'swipe-to-delete', title: 'Swipe to delete', note: 'Swipe a row left. Past the line, it turns to dust.', icon: 'trash', Component: SwipeToDeleteDemo, scroll: true },
  { slug: 'toast', title: 'Toast', note: 'Arrives in grains, leaves as dust. Tap to dismiss.', icon: 'bell', Component: ToastDemo, scroll: true },
  { slug: 'like-button', title: 'Like button', note: 'Sparks on like, the heart snaps away on unlike.', icon: 'heart', Component: LikeButtonDemo, scroll: true },
  { slug: 'morph-button', title: 'Morph button', note: 'Folds into a loader, opens back up as done.', icon: 'capsule', Component: MorphButtonDemo, scroll: true },
  { slug: 'split-button', title: 'Split button', note: 'Divides in the middle like a drop of liquid metal.', icon: 'rectangle.split.2x1', Component: SplitButtonDemo, scroll: true },
  { slug: 'slide-to-confirm', title: 'Slide to confirm', note: 'Slide the knob to the end to pay.', icon: 'arrow.right.circle', Component: SlideToConfirmDemo, scroll: true },
  { slug: 'gooey-menu', title: 'Gooey menu', note: 'Tap the button, actions pour out as drops.', icon: 'plus.circle', Component: GooeyMenuDemo, scroll: true },
  { slug: 'otp-input', title: 'OTP input', note: 'Wrong code shakes then turns to dust.', icon: 'ellipsis.rectangle', Component: OTPInputDemo, scroll: true },
  { slug: 'number-ticker', title: 'Number ticker', note: 'Digits roll to the new value.', icon: 'textformat.123', Component: NumberTickerDemo, scroll: true },
  { slug: 'reaction-picker', title: 'Reaction picker', note: 'Long press a message, slide to an emoji.', icon: 'face.smiling', Component: ReactionPickerDemo, scroll: true },
  { slug: 'voice-note', title: 'Voice note', note: 'Scrub the waveform, long press to unsend.', icon: 'waveform', Component: VoiceNoteDemo, scroll: true },
  { slug: 'card-stack', title: 'Card stack', note: 'Tap a card, swipe to flip, drag down to close.', icon: 'rectangle.stack', Component: CardStackDemo, scroll: false },
  { slug: 'signature-pad', title: 'Signature pad', note: 'Sign with your finger, clear to dust.', icon: 'signature', Component: SignaturePadDemo, scroll: true },
  { slug: 'before-after', title: 'Before after', note: 'Drag to compare two versions.', icon: 'rectangle.lefthalf.inset.filled', Component: BeforeAfterDemo, scroll: true },
  { slug: 'thinking-orb', title: 'Thinking orb', note: 'Dots that show what the agent is doing.', icon: 'sparkles', Component: ThinkingOrbDemo, scroll: true },
  { slug: 'image-reveal', title: 'Image reveal', note: 'Generate: the mosaic resolves into the image.', icon: 'photo', Component: ImageRevealDemo, scroll: true },
  { slug: 'sweep-transition', title: 'Sweep transition', note: 'A liquid band swaps the content.', icon: 'water.waves', Component: SweepTransitionDemo, scroll: true },
  { slug: 'upload-tile', title: 'Upload tile', note: 'Files assemble as they upload, a rejected one turns to dust.', icon: 'icloud.and.arrow.up', Component: UploadTileDemo, scroll: true },
  { slug: 'task-check', title: 'Task check', note: 'Check, strike, then move or dissolve.', icon: 'checkmark.circle', Component: TaskCheckDemo, scroll: true },
  { slug: 'quantity-stepper', title: 'Quantity stepper', note: 'Rolling digits, at 1 it becomes a trash.', icon: 'plus.forwardslash.minus', Component: QuantityStepperDemo, scroll: true },
  { slug: 'ruler-picker', title: 'Ruler picker', note: 'Drag or fling the ruler, it snaps with ticks.', icon: 'ruler', Component: RulerPickerDemo, scroll: true },
  { slug: 'bar-chart', title: 'Bar chart', note: 'Scrub the bars, switch the period.', icon: 'chart.bar', Component: BarChartDemo, scroll: true },
  { slug: 'mini-player', title: 'Mini player', note: 'Tap or drag the pill up into the player.', icon: 'play.circle', Component: MiniPlayerDemo, scroll: false },
  { slug: 'pull-to-refresh', title: 'Pull to refresh', note: 'Pull the feed down, release to rebuild it.', icon: 'arrow.down.circle', Component: PullToRefreshDemo, scroll: false },
  { slug: 'reorder-list', title: 'Reorder list', note: 'Long press a row, drag it to a new place.', icon: 'line.3.horizontal', Component: ReorderListDemo, scroll: false },
  { slug: 'glossy-button', title: 'Glossy button', note: 'A tactile pill lit from the inside. Press it.', icon: 'button.horizontal', Component: GlossyButtonDemo, scroll: true },
  { slug: 'scratch-card', title: 'Scratch card', note: 'Scratch the foil. Past half, the rest turns to dust.', icon: 'giftcard', Component: ScratchCardDemo, scroll: true },
  { slug: 'skeleton', title: 'Skeleton', note: 'Tap Reload: the placeholders turn into the content, grain by grain.', icon: 'rectangle.dashed', Component: SkeletonDemo, scroll: true },
  { slug: 'segmented-control', title: 'Segmented control', note: 'Tap or drag across: the pill flows over in grains.', icon: 'switch.2', Component: SegmentedControlDemo, scroll: true },
  { slug: 'toggle', title: 'Toggle', note: 'Flip a switch: the thumb crosses over in grains.', icon: 'switch.2', Component: ToggleDemo, scroll: true },
  { slug: 'progress-steps', title: 'Progress steps', note: 'Numbered steps or story bars: the progress streams on in grains.', icon: 'point.3.connected.trianglepath.dotted', Component: ProgressStepsDemo, scroll: true },
  { slug: 'elastic-slider', title: 'Elastic slider', note: 'Drag, then pull past the end: the track stretches and snaps back.', icon: 'slider.horizontal.3', Component: ElasticSliderDemo, scroll: true },
  { slug: 'accordion', title: 'Accordion', note: 'Tap a header: the section glides open, the content slides in.', icon: 'list.bullet.indent', Component: AccordionDemo, scroll: true },
];
