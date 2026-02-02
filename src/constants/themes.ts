import type { Theme } from '../types';

/**
 * Theme definitions for AlarmLit app.
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
    // Premium UI tokens
    cardGlass: 'rgba(255, 255, 255, 0.04)',
    cardBorder: 'rgba(255, 255, 255, 0.08)',
    accentGlow: 'rgba(129, 140, 248, 0.25)',
    accentSoft: 'rgba(129, 140, 248, 0.12)',
    divider: 'rgba(255, 255, 255, 0.06)',
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
    // Premium UI tokens
    cardGlass: 'rgba(255, 255, 255, 0.7)',
    cardBorder: 'rgba(0, 0, 0, 0.06)',
    accentGlow: 'rgba(99, 102, 241, 0.15)',
    accentSoft: 'rgba(99, 102, 241, 0.08)',
    divider: 'rgba(0, 0, 0, 0.06)',
  },
};
