import { NativeModules, Platform, Linking } from 'react-native';

const { AlarmModule } = NativeModules;

export interface NativeAlarmService {
  scheduleAlarm(id: string, timestamp: number, soundName?: string): Promise<boolean>;
  cancelAlarm(id: string): Promise<boolean>;
  stopAlarm(): Promise<boolean>;
  snoozeAlarm(minutes: number): Promise<boolean>;
  checkExactAlarmPermission(): Promise<boolean>;
  openAlarmPermissionSettings(): void;
}

export const generateAlarmId = (): string => {
  return `alarm_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

class NativeAlarmManager implements NativeAlarmService {
  private isAndroid = Platform.OS === 'android';

  async scheduleAlarm(
    id: string,
    timestamp: number,
    soundName: string = 'alarm_gentle'
  ): Promise<boolean> {
    if (!this.isAndroid) {
      console.warn('Native alarms only supported on Android');
      return false;
    }

    if (timestamp <= Date.now()) {
      throw new Error('Alarm timestamp must be in the future');
    }

    try {
      return await AlarmModule.scheduleAlarm(id, timestamp, soundName);
    } catch (error: any) {
      if (error.code === 'PERMISSION_DENIED') {
        console.error('Exact alarm permission not granted');
      }
      throw error;
    }
  }

  async cancelAlarm(id: string): Promise<boolean> {
    if (!this.isAndroid) return false;

    try {
      return await AlarmModule.cancelAlarm(id);
    } catch (error) {
      console.error('Failed to cancel native alarm:', error);
      throw error;
    }
  }

  async stopAlarm(): Promise<boolean> {
    if (!this.isAndroid) return false;

    try {
      return await AlarmModule.stopAlarm();
    } catch (error) {
      console.error('Failed to stop native alarm:', error);
      throw error;
    }
  }

  async snoozeAlarm(minutes: number = 9): Promise<boolean> {
    if (!this.isAndroid) return false;

    try {
      return await AlarmModule.snoozeAlarm(minutes);
    } catch (error) {
      console.error('Failed to snooze alarm:', error);
      throw error;
    }
  }

  async checkExactAlarmPermission(): Promise<boolean> {
    if (!this.isAndroid) return true;

    try {
      return await AlarmModule.checkExactAlarmPermission();
    } catch (error) {
      console.error('Failed to check alarm permission:', error);
      return false;
    }
  }

  openAlarmPermissionSettings(): void {
    if (!this.isAndroid) return;
    Linking.openSettings();
  }
}

export const nativeAlarm = new NativeAlarmManager();
