import { PixelRatio } from 'react-native';

const fontScale = PixelRatio.getFontScale();
export const scaledFontSize = (size: number) => Math.round(size * Math.min(fontScale, 1.3));
