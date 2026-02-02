import { nativeAlarm, generateAlarmId } from './nativeAlarm';
import { safeJsonParse } from '../utils/safeJsonParse';
import { logger } from '../utils/logger';
import { getSecureItem, setSecureItem } from './secureStorage';

const STORAGE_KEY = 'alarmlit_scheduled_alarms';

export interface StoredAlarm {
  id: string;
  timestamp: number;
  soundName: string;
  label?: string;
  enabled: boolean;
}

export const saveAndScheduleAlarm = async (
  timestamp: number,
  soundName: string = 'alarm_gentle',
  label?: string
): Promise<StoredAlarm> => {
  const alarm: StoredAlarm = {
    id: generateAlarmId(),
    timestamp,
    soundName,
    label,
    enabled: true,
  };

  await nativeAlarm.scheduleAlarm(alarm.id, alarm.timestamp, alarm.soundName);

  const existing = await getStoredAlarms();
  existing.push(alarm);
  await setSecureItem(STORAGE_KEY, JSON.stringify(existing));

  return alarm;
};

export const getStoredAlarms = async (): Promise<StoredAlarm[]> => {
  const data = await getSecureItem(STORAGE_KEY);
  // GAP-07: Safe JSON parse
  return data ? safeJsonParse<StoredAlarm[]>(data, []) : [];
};

export const removeAlarm = async (id: string): Promise<void> => {
  await nativeAlarm.cancelAlarm(id);

  const alarms = await getStoredAlarms();
  const filtered = alarms.filter(a => a.id !== id);
  await setSecureItem(STORAGE_KEY, JSON.stringify(filtered));
};

export const rescheduleAllAlarms = async (): Promise<void> => {
  const alarms = await getStoredAlarms();
  const now = Date.now();
  const validAlarms: StoredAlarm[] = [];

  for (const alarm of alarms) {
    if (alarm.enabled && alarm.timestamp > now) {
      try {
        await nativeAlarm.scheduleAlarm(alarm.id, alarm.timestamp, alarm.soundName);
        validAlarms.push(alarm);
      } catch (error) {
        logger.error(`Failed to reschedule alarm ${alarm.id}:`, error);
      }
    }
  }

  await setSecureItem(STORAGE_KEY, JSON.stringify(validAlarms));
};

export const cleanupExpiredAlarms = async (): Promise<void> => {
  const alarms = await getStoredAlarms();
  const now = Date.now();
  const validAlarms = alarms.filter(a => a.timestamp > now);
  await setSecureItem(STORAGE_KEY, JSON.stringify(validAlarms));
};
