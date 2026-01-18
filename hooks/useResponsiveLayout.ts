/**
 * useResponsiveLayout Hook
 *
 * Centralized hook for responsive layout management.
 * Provides device type detection, adaptive spacing, and layout utilities.
 */

import { useWindowDimensions } from 'react-native';
import { useMemo } from 'react';
import {
  Breakpoints,
  ResponsiveSpacing,
  Spacing,
  FontSizes,
  DeviceType,
} from '@/constants/theme';

interface ResponsiveLayoutResult {
  // Device type
  deviceType: DeviceType;
  width: number;
  height: number;

  // Convenience booleans
  isMobile: boolean;      // < 600px
  isTablet: boolean;      // 600-899px
  isDesktop: boolean;     // >= 900px
  isWideScreen: boolean;  // >= 900px (compatible with existing code)

  // Layout helpers
  columns: 1 | 2 | 3;
  sidebarWidth: number;
  sidebarCollapsedWidth: number;

  // Adaptive values
  spacing: {
    xs: number;
    sm: number;
    md: number;
    lg: number;
    xl: number;
    xxl: number;
    container: number;
    section: number;
  };
  fontSize: {
    xs: number;
    sm: number;
    md: number;
    lg: number;
    xl: number;
    xxl: number;
    xxxl: number;
  };

  // Utilities
  getResponsiveValue: <T>(mobile: T, tablet: T, desktop: T) => T;
}

/**
 * Hook for responsive layout management
 *
 * @returns Responsive layout information and utilities
 *
 * @example
 * const { isMobile, isWideScreen, spacing, getResponsiveValue } = useResponsiveLayout();
 *
 * // Use convenience booleans
 * <View style={isWideScreen ? styles.twoColumn : styles.singleColumn}>
 *
 * // Use getResponsiveValue for custom responsive values
 * const padding = getResponsiveValue(8, 16, 24);
 */
export function useResponsiveLayout(): ResponsiveLayoutResult {
  const { width, height } = useWindowDimensions();

  return useMemo(() => {
    // Determine device type
    const isMobile = width < Breakpoints.mobile;
    const isTablet = width >= Breakpoints.mobile && width < Breakpoints.tablet;
    const isDesktop = width >= Breakpoints.desktop;
    const isWideScreen = width >= Breakpoints.desktop; // Alias for backwards compatibility

    const deviceType: DeviceType = isMobile
      ? 'mobile'
      : isTablet
      ? 'tablet'
      : 'desktop';

    // Calculate columns based on device type
    const columns: 1 | 2 | 3 = isMobile ? 1 : isTablet ? 2 : width >= Breakpoints.wide ? 3 : 2;

    // Sidebar dimensions
    const sidebarWidth = isMobile ? 0 : 240;
    const sidebarCollapsedWidth = isMobile ? 0 : 80;

    // Get responsive spacing config
    const spacingConfig = ResponsiveSpacing[deviceType];
    const multiplier = spacingConfig.multiplier;

    // Calculate adaptive spacing
    const spacing = {
      xs: Math.round(Spacing.xs * multiplier),
      sm: Math.round(Spacing.sm * multiplier),
      md: Math.round(Spacing.md * multiplier),
      lg: Math.round(Spacing.lg * multiplier),
      xl: Math.round(Spacing.xl * multiplier),
      xxl: Math.round(Spacing.xxl * multiplier),
      container: spacingConfig.container,
      section: spacingConfig.section,
    };

    // Calculate adaptive font sizes
    const fontSize = {
      xs: Math.round(FontSizes.xs * multiplier),
      sm: Math.round(FontSizes.sm * multiplier),
      md: Math.round(FontSizes.md * multiplier),
      lg: Math.round(FontSizes.lg * multiplier),
      xl: Math.round(FontSizes.xl * multiplier),
      xxl: Math.round(FontSizes.xxl * multiplier),
      xxxl: Math.round(FontSizes.xxxl * multiplier),
    };

    // Utility function for responsive values
    const getResponsiveValue = <T>(mobile: T, tablet: T, desktop: T): T => {
      if (isMobile) return mobile;
      if (isTablet) return tablet;
      return desktop;
    };

    return {
      deviceType,
      width,
      height,
      isMobile,
      isTablet,
      isDesktop,
      isWideScreen,
      columns,
      sidebarWidth,
      sidebarCollapsedWidth,
      spacing,
      fontSize,
      getResponsiveValue,
    };
  }, [width, height]);
}

export default useResponsiveLayout;
