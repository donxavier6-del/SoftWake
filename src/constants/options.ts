/**
 * Configuration options and constants for SoftWake app
 */

// Type definitions (mirrored from App.tsx)
type AlarmSound = 'sunrise' | 'ocean' | 'forest' | 'chimes' | 'piano' | 'birds';
type DismissType = 'simple' | 'breathing' | 'affirmation' | 'math' | 'shake';
type WakeIntensity = 'whisper' | 'gentle' | 'moderate' | 'energetic';

export const SNOOZE_OPTIONS = [
  { label: 'Off', value: 0 },
  { label: '5 min', value: 5 },
  { label: '10 min', value: 10 },
  { label: '15 min', value: 15 },
  { label: '30 min', value: 30 },
];

export const WAKE_INTENSITY_OPTIONS: { label: string; value: WakeIntensity; volume: number }[] = [
  { label: 'Whisper', value: 'whisper', volume: 0.3 },
  { label: 'Gentle', value: 'gentle', volume: 0.5 },
  { label: 'Moderate', value: 'moderate', volume: 0.75 },
  { label: 'Energetic', value: 'energetic', volume: 1.0 },
];

export const SOUND_OPTIONS: { label: string; value: AlarmSound; icon: string }[] = [
  { label: 'Sunrise', value: 'sunrise', icon: '☀️' },
  { label: 'Ocean', value: 'ocean', icon: '🌊' },
  { label: 'Forest', value: 'forest', icon: '🌲' },
  { label: 'Chimes', value: 'chimes', icon: '🔔' },
  { label: 'Soft Piano', value: 'piano', icon: '🎹' },
  { label: 'Birds', value: 'birds', icon: '🐦' },
];

export const DISMISS_OPTIONS: { label: string; value: DismissType; icon: string; description: string; isMission?: boolean }[] = [
  { label: 'Simple', value: 'simple', icon: '⏹️', description: 'One tap to dismiss' },
  { label: 'Breathing Exercise', value: 'breathing', icon: '🌬️', description: 'Complete a breathing cycle', isMission: true },
  { label: 'Type Affirmation', value: 'affirmation', icon: '✨', description: 'Type an affirmation to dismiss', isMission: true },
  { label: 'Math Problem', value: 'math', icon: '🧮', description: 'Solve a math problem', isMission: true },
  { label: 'Shake Phone', value: 'shake', icon: '📳', description: 'Shake your phone to wake up', isMission: true },
];

export const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export const AFFIRMATIONS = [
  'I am ready for today',
];

export const SLEEP_GOAL_OPTIONS = [6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5, 10];
