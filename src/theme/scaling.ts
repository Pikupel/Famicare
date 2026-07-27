import { PixelRatio, Dimensions } from 'react-native';

const { width } = Dimensions.get('window');
const baseWidth = 375;
const scale = width / baseWidth;

export function normalize(size: number, minimum?: number) {
  const scaled = size * Math.min(scale, 1.5);
  return Math.max(minimum ?? 0, Math.round(PixelRatio.roundToNearestPixel(scaled)));
}

export const fontScale = PixelRatio.getFontScale();
export const scaledFontSize = (size: number) => Math.round(size * Math.min(fontScale, 1.3));
