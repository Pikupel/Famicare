import { scaledFontSize } from './scaling';

export const typography = {
  h1: { fontSize: scaledFontSize(28), fontWeight: '700' as const },
  h2: { fontSize: scaledFontSize(22), fontWeight: '600' as const },
  h3: { fontSize: scaledFontSize(18), fontWeight: '600' as const },
  body: { fontSize: scaledFontSize(16), fontWeight: '400' as const },
  caption: { fontSize: scaledFontSize(14), fontWeight: '400' as const },
  small: { fontSize: scaledFontSize(12), fontWeight: '500' as const },
  button: { fontSize: scaledFontSize(16), fontWeight: '600' as const },
};
