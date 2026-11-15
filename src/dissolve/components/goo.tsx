import { Blur, ColorMatrix, Paint } from '@shopify/react-native-skia';

/**
 * The liquid look shared by the morph components: shapes are blurred together, then the
 * alpha is pushed back to a hard edge (alpha * 20 - 9). Close shapes melt into one blob
 * with a neck between them, colors stay untouched.
 */
export const GOO_MATRIX = [1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 20, -9];

export function gooLayer(blur = 7) {
  return (
    <Paint>
      <Blur blur={blur} />
      <ColorMatrix matrix={GOO_MATRIX} />
    </Paint>
  );
}

export const CALM_MS = 420;
