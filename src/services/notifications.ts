import * as Notifications from 'expo-notifications';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Platform } from 'react-native';
import type { Alarm, Settings } from '../types';
import { formatTimeWithPeriod } from '../utils/timeFormatting';
import { logger } from '../utils/logger';

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

    // GAP-30: Trim label and use fallback for empty strings
    const title = alarm.label?.trim() || 'AlarmLit Alarm';

    // GAP-02: On Android, notifications are informational only (no sound/vibration).
    // The native AlarmService handles the actual alarm sound.
    const isAndroid = Platform.OS === 'android';

    if (hasRepeatingDays) {
      // Schedule for each selected day of the week
      for (let dayIndex = 0; dayIndex < 7; dayIndex++) {
        if (!alarm.days[dayIndex]) continue;

        // Map dayIndex (0=Sun, 1=Mon, ...) to weekday (1=Sun, 2=Mon, ...)
        const weekday = dayIndex + 1;

        await Notifications.scheduleNotificationAsync({
          identifier: `${ALARM_NOTIFICATION_PREFIX}${alarm.id}-${dayIndex}`,
          content: {
            title,
            body: `Alarm for ${formatTimeWithPeriod(alarm.hour, alarm.minute)}`,
            sound: isAndroid ? false : true,
            data: { alarmId: alarm.id },
            ...(isAndroid && { channelId: 'alarms' }),
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
          title,
          body: `Alarm for ${formatTimeWithPeriod(alarm.hour, alarm.minute)}`,
          sound: isAndroid ? false : true,
          data: { alarmId: alarm.id },
          ...(isAndroid && { channelId: 'alarms' }),
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
 * GAP-12: Cancel scheduled alarm notifications matching a specific alarm ID.
 * Use this when permanently disabling an alarm (not for snooze/dismiss).
 */
export async function cancelAlarmNotification(alarmId: string): Promise<void> {
  if (isExpoGo) return;

  try {
    const scheduledNotifications = await Notifications.getAllScheduledNotificationsAsync();
    for (const notification of scheduledNotifications) {
      if (notification.identifier.startsWith(`${ALARM_NOTIFICATION_PREFIX}${alarmId}-`)) {
        await Notifications.cancelScheduledNotificationAsync(notification.identifier);
      }
    }
  } catch (error) {
    logger.error('Failed to cancel alarm notification:', error);
  }
}

/**
 * GAP-12: Dismiss delivered/presented notifications for a specific alarm from
 * the notification shade. Unlike cancelAlarmNotification, this does NOT cancel
 * scheduled future occurrences — recurring weekly alarms stay intact.
 * Use this on snooze and dismiss.
 */
export async function dismissDeliveredAlarmNotifications(alarmId: string): Promise<void> {
  if (isExpoGo) return;

  try {
    const presented = await Notifications.getPresentedNotificationsAsync();
    for (const notification of presented) {
      if (notification.request.identifier.startsWith(`${ALARM_NOTIFICATION_PREFIX}${alarmId}`)) {
        await Notifications.dismissNotificationAsync(notification.request.identifier);
      }
    }
  } catch (error) {
    logger.error('Failed to dismiss delivered alarm notifications:', error);
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
 * GAP-27: Set up notification handler and Android channel (exported for re-calling on settings change)
 */
export function setupNotificationHandler(): void {
  if (isExpoGo) return;

  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      // GAP-02: On Android, don't play sound from notifications (AlarmService handles it)
      shouldPlaySound: Platform.OS !== 'android',
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
      sound: undefined, // GAP-02: No sound from notification channel
      vibrationPattern: [0, 250, 250, 250],
      enableLights: true,
      lightColor: '#818CF8',
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      bypassDnd: true,
    });
  }
}
