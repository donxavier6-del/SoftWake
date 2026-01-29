import * as Notifications from 'expo-notifications';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Platform } from 'react-native';
import type { Alarm, Settings } from '../types';
import { formatTimeWithPeriod } from '../utils/timeFormatting';

const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
const BEDTIME_NOTIFICATION_ID = 'bedtime-reminder';
const ALARM_NOTIFICATION_PREFIX = 'alarm-';

/**
 * Schedule bedtime reminder notification
 */
export async function scheduleBedtimeNotification(settings: Settings): Promise<void> {
  // Skip notifications in Expo Go (not supported in SDK 53+)
  if (isExpoGo) return;

  // Cancel existing bedtime notification
  await Notifications.cancelScheduledNotificationAsync(BEDTIME_NOTIFICATION_ID).catch(() => {});

  if (!settings.bedtimeReminderEnabled) {
    return;
  }

  // Calculate notification time (30 minutes before bedtime)
  let reminderHour = settings.bedtimeHour;
  let reminderMinute = settings.bedtimeMinute - 30;

  if (reminderMinute < 0) {
    reminderMinute += 60;
    reminderHour -= 1;
    if (reminderHour < 0) {
      reminderHour = 23;
    }
  }

  // Schedule daily notification
  await Notifications.scheduleNotificationAsync({
    identifier: BEDTIME_NOTIFICATION_ID,
    content: {
      title: 'Time to Wind Down',
      body: `Your target bedtime is in 30 minutes. Start preparing for sleep!`,
      sound: true,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour: reminderHour,
      minute: reminderMinute,
    },
  });
}

/**
 * Schedule alarm notifications for all enabled alarms
 */
export async function scheduleAlarmNotifications(alarms: Alarm[]): Promise<void> {
  // Skip notifications in Expo Go (not supported in SDK 53+)
  if (isExpoGo) return;

  // Cancel all existing alarm notifications
  const scheduledNotifications = await Notifications.getAllScheduledNotificationsAsync();
  for (const notification of scheduledNotifications) {
    if (notification.identifier.startsWith(ALARM_NOTIFICATION_PREFIX)) {
      await Notifications.cancelScheduledNotificationAsync(notification.identifier);
    }
  }

  // Schedule notifications for each enabled alarm
  for (const alarm of alarms) {
    if (!alarm.enabled) continue;

    const hasRepeatingDays = alarm.days.some((d) => d);

    if (hasRepeatingDays) {
      // Schedule for each selected day of the week
      for (let dayIndex = 0; dayIndex < 7; dayIndex++) {
        if (!alarm.days[dayIndex]) continue;

        // Map dayIndex (0=Sun, 1=Mon, ...) to weekday (1=Sun, 2=Mon, ...)
        const weekday = dayIndex + 1;

        await Notifications.scheduleNotificationAsync({
          identifier: `${ALARM_NOTIFICATION_PREFIX}${alarm.id}-${dayIndex}`,
          content: {
            title: alarm.label || 'SoftWake Alarm',
            body: `Alarm for ${formatTimeWithPeriod(alarm.hour, alarm.minute)}`,
            sound: true,
            data: { alarmId: alarm.id },
            ...(Platform.OS === 'android' && { channelId: 'alarms' }),
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
            weekday,
            hour: alarm.hour,
            minute: alarm.minute,
          },
        });
      }
    } else {
      // One-time alarm: schedule for next occurrence
      const now = new Date();
      const alarmDate = new Date();
      alarmDate.setHours(alarm.hour, alarm.minute, 0, 0);

      // If alarm time has passed today, schedule for tomorrow
      if (alarmDate <= now) {
        alarmDate.setDate(alarmDate.getDate() + 1);
      }

      await Notifications.scheduleNotificationAsync({
        identifier: `${ALARM_NOTIFICATION_PREFIX}${alarm.id}-once`,
        content: {
          title: alarm.label || 'SoftWake Alarm',
          body: `Alarm for ${formatTimeWithPeriod(alarm.hour, alarm.minute)}`,
          sound: true,
          data: { alarmId: alarm.id },
          ...(Platform.OS === 'android' && { channelId: 'alarms' }),
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: alarmDate,
        },
      });
    }
  }
}

/**
 * Request notification permissions
 */
export async function requestNotificationPermissions(): Promise<boolean> {
  if (isExpoGo) return false;
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

/**
 * Set up notification handler and Android channel
 */
export function setupNotificationHandler(): void {
  if (isExpoGo) return;

  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });

  // Set up Android notification channel with IMPORTANCE_HIGH for alarms
  if (Platform.OS === 'android') {
    Notifications.setNotificationChannelAsync('alarms', {
      name: 'Alarms',
      importance: Notifications.AndroidImportance.MAX,
      sound: 'default',
      vibrationPattern: [0, 250, 250, 250],
      enableLights: true,
      lightColor: '#818CF8',
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      bypassDnd: true,
    });
  }
}
