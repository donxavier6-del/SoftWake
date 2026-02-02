import type { Alarm, Settings, SleepEntry, AlarmSound, DismissType, WakeIntensity } from '../types';

const VALID_SOUNDS: AlarmSound[] = ['sunrise', 'ocean', 'forest', 'chimes', 'piano', 'birds'];
const VALID_DISMISS_TYPES: DismissType[] = ['simple', 'breathing', 'affirmation', 'math', 'shake'];
const VALID_WAKE_INTENSITIES: WakeIntensity[] = ['whisper', 'gentle', 'moderate', 'energetic'];

const DEFAULT_SETTINGS: Settings = {
  bedtimeReminderEnabled: false,
  bedtimeHour: 22,
  bedtimeMinute: 0,
  defaultWakeIntensity: 'energetic',
  defaultSound: 'sunrise',
  defaultDismissType: 'simple',
  sleepGoalHours: 8,
  darkMode: true,
  hapticFeedback: true,
  shakeThreshold: 1.5,
};

export function clampHour(h: number): number {
  if (typeof h !== 'number' || isNaN(h)) return 0;
  return Math.max(0, Math.min(23, Math.round(h)));
}

export function clampMinute(m: number): number {
  if (typeof m !== 'number' || isNaN(m)) return 0;
  return Math.max(0, Math.min(59, Math.round(m)));
}

function normalizeDays(days: any): boolean[] {
  const defaultDays = [false, false, false, false, false, false, false];
  if (!Array.isArray(days)) return defaultDays;
  if (days.length < 7) {
    return [...days.map((d: any) => Boolean(d)), ...defaultDays.slice(days.length)];
  }
  if (days.length > 7) {
    return days.slice(0, 7).map((d: any) => Boolean(d));
  }
  return days.map((d: any) => Boolean(d));
}

export function validateAlarm(data: any): Alarm | null {
  if (data == null || typeof data !== 'object') return null;
  if (!data.id || typeof data.id !== 'string') return null;

  const hour = clampHour(data.hour);
  const minute = clampMinute(data.minute);
  const days = normalizeDays(data.days);

  return {
    id: data.id,
    hour,
    minute,
    days,
    enabled: typeof data.enabled === 'boolean' ? data.enabled : true,
    label: typeof data.label === 'string' ? data.label : '',
    snooze: typeof data.snooze === 'number' && data.snooze >= 0 ? data.snooze : 10,
    wakeIntensity: VALID_WAKE_INTENSITIES.includes(data.wakeIntensity)
      ? data.wakeIntensity
      : 'energetic',
    sound: VALID_SOUNDS.includes(data.sound) ? data.sound : 'sunrise',
    dismissType: VALID_DISMISS_TYPES.includes(data.dismissType)
      ? data.dismissType
      : (data.dismissType === 'off' ? 'simple' : 'simple'),
  };
}

export function validateSettings(data: any): Settings {
  if (data == null || typeof data !== 'object') return { ...DEFAULT_SETTINGS };

  return {
    bedtimeReminderEnabled:
      typeof data.bedtimeReminderEnabled === 'boolean'
        ? data.bedtimeReminderEnabled
        : DEFAULT_SETTINGS.bedtimeReminderEnabled,
    bedtimeHour: clampHour(data.bedtimeHour ?? DEFAULT_SETTINGS.bedtimeHour),
    bedtimeMinute: clampMinute(data.bedtimeMinute ?? DEFAULT_SETTINGS.bedtimeMinute),
    defaultWakeIntensity: VALID_WAKE_INTENSITIES.includes(data.defaultWakeIntensity)
      ? data.defaultWakeIntensity
      : DEFAULT_SETTINGS.defaultWakeIntensity,
    defaultSound: VALID_SOUNDS.includes(data.defaultSound)
      ? data.defaultSound
      : DEFAULT_SETTINGS.defaultSound,
    defaultDismissType: VALID_DISMISS_TYPES.includes(data.defaultDismissType)
      ? data.defaultDismissType
      : DEFAULT_SETTINGS.defaultDismissType,
    sleepGoalHours:
      typeof data.sleepGoalHours === 'number' && data.sleepGoalHours >= 4 && data.sleepGoalHours <= 12
        ? data.sleepGoalHours
        : DEFAULT_SETTINGS.sleepGoalHours,
    darkMode: typeof data.darkMode === 'boolean' ? data.darkMode : DEFAULT_SETTINGS.darkMode,
    hapticFeedback:
      typeof data.hapticFeedback === 'boolean'
        ? data.hapticFeedback
        : DEFAULT_SETTINGS.hapticFeedback,
    shakeThreshold:
      typeof data.shakeThreshold === 'number' && data.shakeThreshold >= 1.0 && data.shakeThreshold <= 3.0
        ? data.shakeThreshold
        : DEFAULT_SETTINGS.shakeThreshold,
  };
}

export function validateSleepEntry(data: any): SleepEntry | null {
  if (data == null || typeof data !== 'object') return null;
  if (!data.id || typeof data.id !== 'string') return null;
  if (typeof data.bedtime !== 'number') return null;
  if (typeof data.wakeTime !== 'number') return null;
  if (typeof data.sleepDuration !== 'number') return null;
  if (data.sleepDuration <= 0) return null;
  if (data.sleepDuration > 1440) return null; // Max 24 hours

  return {
    id: data.id,
    bedtime: data.bedtime,
    wakeTime: data.wakeTime,
    sleepDuration: data.sleepDuration,
  };
}
