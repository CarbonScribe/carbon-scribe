/**
 * Utility functions for calculating and validating color contrast
 */

import { CONTRAST } from './contrast-constants';

/**
 * Calculate the relative luminance of a color
 * @param r - Red value (0-255)
 * @param g - Green value (0-255)
 * @param b - Blue value (0-255)
 * @returns Relative luminance (0-1)
 */
export function calculateLuminance(r: number, g: number, b: number): number {
  const [rs, gs, bs] = [r, g, b].map((c) => {
    const val = c / 255;
    return val <= 0.03928 ? val / 12.92 : Math.pow((val + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

/**
 * Calculate the contrast ratio between two colors
 * @param color1 - First color (hex, rgb, or rgba)
 * @param color2 - Second color (hex, rgb, or rgba)
 * @returns Contrast ratio (1-21)
 */
export function calculateContrastRatio(color1: string, color2: string): number {
  const lum1 = getLuminance(color1);
  const lum2 = getLuminance(color2);
  const lighter = Math.max(lum1, lum2);
  const darker = Math.min(lum1, lum2);
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Parse a hex color to RGB
 */
function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) {
    throw new Error(`Invalid hex color: ${hex}`);
  }
  return {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16),
  };
}

/**
 * Parse a color string to RGB
 */
function parseColor(color: string): { r: number; g: number; b: number } {
  // Hex color
  if (color.startsWith('#')) {
    return hexToRgb(color);
  }

  // RGB or RGBA color
  const rgbMatch = color.match(
    /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*[\d.]+)?\s*\)/
  );
  if (rgbMatch) {
    return {
      r: parseInt(rgbMatch[1], 10),
      g: parseInt(rgbMatch[2], 10),
      b: parseInt(rgbMatch[3], 10),
    };
  }

  // Named colors - basic support
  const namedColors: Record<string, { r: number; g: number; b: number }> = {
    white: { r: 255, g: 255, b: 255 },
    black: { r: 0, g: 0, b: 0 },
    transparent: { r: 255, g: 255, b: 255 },
  };

  if (namedColors[color]) {
    return namedColors[color];
  }

  throw new Error(`Unsupported color format: ${color}`);
}

/**
 * Get the luminance of a color
 */
function getLuminance(color: string): number {
  if (color === 'transparent') {
    return 1; // Assume transparent is on white background
  }
  const { r, g, b } = parseColor(color);
  return calculateLuminance(r, g, b);
}

/**
 * Check if a color combination meets WCAG AA standards
 * @param textColor - Text color
 * @param bgColor - Background color
 * @param isLarge - Whether the text is large (18pt+ or bold 14pt+)
 * @returns Whether the contrast meets WCAG AA
 */
export function meetsWCAGAA(
  textColor: string,
  bgColor: string,
  isLarge: boolean = false
): boolean {
  const ratio = calculateContrastRatio(textColor, bgColor);
  const min = isLarge ? CONTRAST.LARGE_TEXT_MIN : CONTRAST.NORMAL_TEXT_MIN;
  return ratio >= min;
}

/**
 * Get contrast ratio description
 */
export function getContrastRating(ratio: number): string {
  if (ratio >= 7) return 'AAA (Excellent)';
  if (ratio >= 4.5) return 'AA (Good)';
  if (ratio >= 3) return 'Large Text AA (Fair)';
  return 'Fails (Poor)';
}