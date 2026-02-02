/**
 * Shared types for AlarmLit app
 */

export type AlarmSound = 'sunrise' | 'ocean' | 'forest' | 'chimes' | 'piano' | 'birds';
export type DismissType = 'simple' | 'breathing' | 'affirmation' | 'math' | 'shake';
export type WakeIntensity = 'whisper' | 'gentle' | 'moderate' | 'energetic';
export type TabName = 'alarms' | 'morning' | 'insights' | 'settings';

export type Alarm = {
  id: string;
  hour: number;
  minute: number;
  days: boolean[];
  enabled: boolean;
  label: string;
  snooze: number;
  wakeIntensity: WakeIntensity;
  sound: AlarmSound;
  dismissType: DismissType;
};

export type MathProblem = {
  question: string;
  answer: number;
};

export type SleepEntry = {
  id: string;
  bedtime: number; // timestamp
  wakeTime: number; // timestamp
  sleepDuration: number; // minutes
};

export type Settings = {
  bedtimeReminderEnabled: boolean;
  bedtimeHour: number;
  bedtimeMinute: number;
  defaultWakeIntensity: WakeIntensity;
  defaultSound: AlarmSound;
  defaultDismissType: DismissType;
  sleepGoalHours: number;
  darkMode: boolean;
  hapticFeedback: boolean;
  shakeThreshold: number; // GAP-29: Configurable shake sensitivity (1.0-3.0)
};

// Theme type based on THEMES object
export type Theme = {
  gradient: readonly string[];
  alarmGradient: readonly string[];
  background: string;
  card: string;
  cardAlt: string;
  surface: string;
  text: string;
  textMuted: string;
  textDisabled: string;
  accent: string;
  accentAlt: string;
  switchTrackOff?: string;
  switchThumbOff?: string;
  // Premium UI tokens
  cardGlass: string;
  cardBorder: string;
  accentGlow: string;
  accentSoft: string;
  divider: string;
};

// Return type for getSleepStats function
export type SleepStatsResult = {
  average: number;
  best: {
    duration: number;
    date: Date;
  };
  worst: {
    duration: number;
    date: Date;
  };
  totalNights: number;
  avgBedtime: string;
  avgWakeTime: string;
};

// Weekly data point for sleep chart
export type WeeklyDataPoint = {
  day: string;
  duration: number;
  date: Date;
};
