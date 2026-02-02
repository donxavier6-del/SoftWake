/**
 * Font family constants for SoftWake.
 * Maps font weight names to Inter font family strings.
 */
export const FONTS = {
  thin: 'Inter_200ExtraLight',
  light: 'Inter_300Light',
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semiBold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
} as const;

/**
 * Maps React Native numeric fontWeight to the corresponding Inter font family.
 * Use this for dynamic weight selection.
 */
export const FONT_WEIGHT_MAP: Record<string, string> = {
  '200': FONTS.thin,
  '300': FONTS.light,
  '400': FONTS.regular,
  '500': FONTS.medium,
  '600': FONTS.semiBold,
  '700': FONTS.bold,
};
