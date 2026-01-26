/**
 * Theme colors based on Impuls Educació brand identity
 * https://impulseducacio.org/
 *
 * Official brand colors from Impuls Educació style guide:
 * - Gris corporativo: #48626f
 * - Blau secundario: #00a1e4
 * - Duotonos: Blau, Vermell, Verd, Taronja, Lila
 */

import { Platform } from 'react-native';

// Impuls Educació official brand colors
const impulsBlue = '#00a1e4';        // COLOR SECUNDARI BLAU (oficial)
const impulsOrange = '#ff8a1f';      // DUOTONO TARONJA (oficial)
const impulsPurple = '#ba6fb0';      // DUOTONO LILA (oficial)
const impulsNavy = '#242739';        // Base oscura de duotonos
const impulsGray = '#48626f';        // COLOR CORPORATIU GRIS (oficial)
const impulsGreen = '#26b7a0';       // DUOTONO VERD (oficial)
const impulsRed = '#f15556';         // DUOTONO VERMELL (oficial)
const impulsLightGray = '#f6f6f6';

export const Colors = {
  light: {
    text: impulsGray,
    background: '#ffffff',
    tint: impulsBlue,
    icon: impulsGray,
    tabIconDefault: impulsGray,
    tabIconSelected: impulsBlue,
    primary: impulsBlue,
    secondary: impulsOrange,
    accent: impulsNavy,
    lightBackground: impulsLightGray,
    cardBackground: '#ffffff',
    border: '#e0e0e0',
    success: impulsGreen,
    error: impulsRed,
    warning: impulsOrange,
    // Colores específicos para modos de acceso
    modeRegistro: impulsGreen,      // Verde para registro
    modeAulaMagna: impulsPurple,    // Lila para aula magna
    modeMasterClass: impulsBlue,    // Azul para master class
    modeCena: impulsOrange,         // Naranja para cena
    directionEntrada: impulsGreen,  // Verde para entrada
    directionSalida: impulsRed,     // Rojo para salida
  },
  dark: {
    text: '#ECEDEE',
    background: impulsNavy,
    tint: impulsBlue,
    icon: '#9BA1A6',
    tabIconDefault: '#9BA1A6',
    tabIconSelected: impulsBlue,
    primary: impulsBlue,
    secondary: impulsOrange,
    accent: impulsBlue,
    lightBackground: '#2a3440',
    cardBackground: '#2a3440',
    border: '#3a4450',
    success: '#4db6ac',             // Verde turquesa más claro para dark mode
    error: '#ff7961',               // Rojo más claro para dark mode
    warning: impulsOrange,
    // Colores específicos para modos de acceso (dark mode)
    modeRegistro: impulsGreen,
    modeAulaMagna: impulsPurple,
    modeMasterClass: impulsBlue,
    modeCena: impulsOrange,
    directionEntrada: '#4db6ac',    // Verde más claro para dark mode
    directionSalida: '#ff7961',     // Rojo más claro para dark mode
  },
};

export const Fonts = Platform.select({
  ios: {
    sans: 'system-ui',
    serif: 'ui-serif',
    rounded: 'ui-rounded',
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: "'Open Sans', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});

// Spacing and border radius following Impuls Educació design system
// Reducidos para mejor aprovechamiento del espacio
export const Spacing = {
  xs: 6,
  sm: 10,
  md: 14,
  lg: 18,
  xl: 22,
  xxl: 28,
};

export const BorderRadius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  full: 9999, // Pill-shaped buttons like Impuls Educació
};

// Tamaños de fuente aumentados para mejor legibilidad
export const FontSizes = {
  xs: 15,
  sm: 17,
  md: 19,
  lg: 21,
  xl: 24,
  xxl: 28,
  xxxl: 32,
};

export const Shadows = {
  light: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  medium: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  strong: {
    shadowColor: '#000',
    shadowOffset: { width: 6, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 9,
    elevation: 6,
  },
};

// Responsive breakpoints
export const Breakpoints = {
  mobile: 600,    // < 600px = mobile
  tablet: 900,    // 600-899px = tablet, >= 900px = desktop
  desktop: 900,   // Alias for clarity
  wide: 1200,     // Extra wide screens
} as const;

// Responsive spacing multipliers
export const ResponsiveSpacing = {
  mobile: {
    multiplier: 0.85,
    container: Spacing.sm,
    section: Spacing.md,
  },
  tablet: {
    multiplier: 1,
    container: Spacing.md,
    section: Spacing.lg,
  },
  desktop: {
    multiplier: 1.15,
    container: Spacing.lg,
    section: Spacing.xl,
  },
} as const;

export type DeviceType = 'mobile' | 'tablet' | 'desktop';
