import type { Theme } from '../types';

/**
 * Theme definitions for SoftWake app.
 * Contains color schemes for dark and light modes.
 */
export const THEMES: { dark: Theme; light: Theme } = {
  dark: {
    gradient: ['#0a0a1a', '#1a1a2e', '#0f0f23'] as const,
    alarmGradient: ['#1a1a3e', '#2d1b69', '#1a3a5c'] as const,
    background: '#0D0D0D',
    card: '#1A1A1A',
    cardAlt: '#141414',
    surface: '#2A2A2A',
    text: '#FFFFFF',
    textMuted: '#9999AA',
    textDisabled: '#666666',
    accent: '#818CF8',
    accentAlt: '#6366F1',
    switchTrackOff: '#2A2A2A',
    switchThumbOff: '#666666',
  },
  light: {
    gradient: ['#f0f4ff', '#e8eeff', '#f5f7ff'] as const,
    alarmGradient: ['#c7d2fe', '#a5b4fc', '#93c5fd'] as const,
    background: '#FFFFFF',
    card: '#F5F5F7',
    cardAlt: '#FAFAFA',
    surface: '#E5E5EA',
    text: '#1C1C1E',
    textMuted: '#6B6B7A',
    textDisabled: '#AEAEB2',
    accent: '#6366F1',
    accentAlt: '#818CF8',
    switchTrackOff: '#E5E5EA',
    switchThumbOff: '#FFFFFF',
  },
};
