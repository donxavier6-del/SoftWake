import AsyncStorage from '@react-native-async-storage/async-storage';
import { nativeAlarm, generateAlarmId } from './nativeAlarm';

const STORAGE_KEY = 'softwake_scheduled_alarms';

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
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(existing));

  return alarm;
};

export const getStoredAlarms = async (): Promise<StoredAlarm[]> => {
  const data = await AsyncStorage.getItem(STORAGE_KEY);
  return data ? JSON.parse(data) : [];
};

export const removeAlarm = async (id: string): Promise<void> => {
  await nativeAlarm.cancelAlarm(id);

  const alarms = await getStoredAlarms();
  const filtered = alarms.filter(a => a.id !== id);
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
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
        console.error(`Failed to reschedule alarm ${alarm.id}:`, error);
      }
    }
  }

  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(validAlarms));
};

export const cleanupExpiredAlarms = async (): Promise<void> => {
  const alarms = await getStoredAlarms();
  const now = Date.now();
  const validAlarms = alarms.filter(a => a.timestamp > now);
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(validAlarms));
};
