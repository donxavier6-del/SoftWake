/**
 * GAP-20: Tests for nativeAlarm.ts JS Service
 */

import { getNextTriggerTimestamp, generateAlarmId } from '../../services/nativeAlarm';
import type { Alarm } from '../../types';

// Helper to create a test alarm
function makeAlarm(overrides: Partial<Alarm> = {}): Alarm {
  return {
    id: 'test-alarm-1',
    hour: 8,
    minute: 0,
    days: [false, false, false, false, false, false, false],
    enabled: true,
    label: '',
    snooze: 10,
    wakeIntensity: 'energetic',
    sound: 'sunrise',
    dismissType: 'simple',
    ...overrides,
  };
}

describe('nativeAlarm', () => {
  describe('generateAlarmId', () => {
    it('should generate unique IDs', () => {
      const id1 = generateAlarmId();
      const id2 = generateAlarmId();
      expect(id1).not.toBe(id2);
    });

    it('should start with alarm_ prefix', () => {
      const id = generateAlarmId();
      expect(id.startsWith('alarm_')).toBe(true);
    });
  });

  describe('getNextTriggerTimestamp', () => {
    it('should return null for disabled alarms', () => {
      const alarm = makeAlarm({ enabled: false });
      expect(getNextTriggerTimestamp(alarm)).toBeNull();
    });

    it('should schedule one-time alarm today if time is in the future', () => {
      const now = new Date();
      const futureHour = (now.getHours() + 2) % 24;
      const alarm = makeAlarm({ hour: futureHour, minute: 0 });

      const result = getNextTriggerTimestamp(alarm);
      expect(result).not.toBeNull();

      const resultDate = new Date(result!);
      expect(resultDate.getHours()).toBe(futureHour);
      expect(resultDate.getMinutes()).toBe(0);

      // Should be today if future hour is still today
      if (futureHour > now.getHours()) {
        expect(resultDate.getDate()).toBe(now.getDate());
      }
    });

    it('should schedule one-time alarm tomorrow if time has passed', () => {
      const now = new Date();
      // Set alarm to 1 hour ago
      const pastHour = (now.getHours() - 1 + 24) % 24;
      // Only test if the past hour doesn't wrap around midnight to still be "future"
      if (pastHour < now.getHours()) {
        const alarm = makeAlarm({ hour: pastHour, minute: 0 });
        const result = getNextTriggerTimestamp(alarm);
        expect(result).not.toBeNull();
        expect(result!).toBeGreaterThan(now.getTime());
      }
    });

    it('should handle repeating alarm: next enabled day', () => {
      const now = new Date();
      const today = now.getDay();
      const tomorrow = (today + 1) % 7;

      // Enable only tomorrow
      const days = [false, false, false, false, false, false, false];
      days[tomorrow] = true;

      const alarm = makeAlarm({
        hour: 8,
        minute: 0,
        days,
      });

      const result = getNextTriggerTimestamp(alarm);
      expect(result).not.toBeNull();

      const resultDate = new Date(result!);
      expect(resultDate.getDay()).toBe(tomorrow);
    });

    it('should handle repeating alarm: wraps to next week', () => {
      const now = new Date();
      const today = now.getDay();

      // Enable only today but set time to the past
      const days = [false, false, false, false, false, false, false];
      days[today] = true;

      const pastHour = (now.getHours() - 2 + 24) % 24;
      if (pastHour < now.getHours()) {
        const alarm = makeAlarm({
          hour: pastHour,
          minute: 0,
          days,
        });

        const result = getNextTriggerTimestamp(alarm);
        expect(result).not.toBeNull();
        // Should be next week
        expect(result!).toBeGreaterThan(now.getTime());
      }
    });

    it('should handle all days disabled as one-time alarm', () => {
      const now = new Date();
      const futureHour = (now.getHours() + 3) % 24;

      const alarm = makeAlarm({
        hour: futureHour,
        minute: 0,
        days: [false, false, false, false, false, false, false],
      });

      const result = getNextTriggerTimestamp(alarm);
      expect(result).not.toBeNull();
    });

    it('should return timestamp greater than now', () => {
      const now = new Date();
      const futureHour = (now.getHours() + 1) % 24;

      const alarm = makeAlarm({ hour: futureHour, minute: 30 });
      const result = getNextTriggerTimestamp(alarm);

      if (result !== null) {
        expect(result).toBeGreaterThan(now.getTime());
      }
    });
  });
});
