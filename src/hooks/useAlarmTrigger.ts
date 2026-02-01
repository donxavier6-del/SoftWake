import { useState, useRef, useEffect, useCallback } from 'react';
import { Platform } from 'react-native';
import { Audio } from 'expo-av';
import * as Haptics from 'expo-haptics';
import { WAKE_INTENSITY_OPTIONS } from '../constants/options';
import { nativeAlarm, getSoundResourceName } from '../services/nativeAlarm';
import { dismissDeliveredAlarmNotifications } from '../services/notifications';
import { logger } from '../utils/logger';
import type { Alarm, AlarmSound, WakeIntensity } from '../types';

const SOUND_CONFIGS: Record<AlarmSound, { rate: number; pattern: number[] | null }> = {
  sunrise: { rate: 1.0, pattern: null },
  ocean: { rate: 0.75, pattern: [3000, 1500] },
  forest: { rate: 1.2, pattern: [500, 200, 500, 200, 500, 1500] },
  chimes: { rate: 1.1, pattern: [400, 600, 400, 600, 400, 1200] },
  piano: { rate: 0.85, pattern: [2000, 800] },
  birds: { rate: 1.4, pattern: [300, 150, 300, 150, 300, 150, 300, 1000] },
};

interface UseAlarmTriggerReturn {
  // State
  alarmScreenVisible: boolean;
  activeAlarm: Alarm | null;

  // Actions
  triggerAlarm: (alarm: Alarm) => Promise<void>;
  stopAlarmSound: () => Promise<void>;
  dismissAlarm: () => Promise<void>;
  snoozeAlarm: () => Promise<void>;
}

export function useAlarmTrigger(
  alarms: Alarm[],
  hapticFeedback: boolean,
  onAlarmDismissed?: () => void
): UseAlarmTriggerReturn {
  // State
  const [alarmScreenVisible, setAlarmScreenVisible] = useState(false);
  const [activeAlarm, setActiveAlarm] = useState<Alarm | null>(null);

  // Refs
  const soundRef = useRef<Audio.Sound | null>(null);
  const patternIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const patternIndexRef = useRef<number>(0);
  const lastTriggeredRef = useRef<string>('');
  const snoozeTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const currentTimeRef = useRef<Date>(new Date());

  // GAP-02: Flag to track if native alarm already fired
  const nativeAlarmFiredRef = useRef<boolean>(false);

  // GAP-13: Guard against duplicate snooze on rapid press
  const isSnoozingRef = useRef<boolean>(false);

  // GAP-03: Queue for multiple simultaneous alarms
  const alarmQueueRef = useRef<Alarm[]>([]);

  // Update current time ref every second
  useEffect(() => {
    const timer = setInterval(() => {
      currentTimeRef.current = new Date();
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // Check for alarm triggers every second
  useEffect(() => {
    const checkInterval = setInterval(() => {
      const now = currentTimeRef.current;
      const currentHour = now.getHours();
      const currentMinute = now.getMinutes();
      const currentDay = now.getDay();
      const timeKey = `${currentHour}:${currentMinute}`;

      // GAP-03: Collect all matching alarms
      const matchingAlarms: Alarm[] = [];

      alarms.forEach((alarm) => {
        if (!alarm.enabled) return;
        if (alarm.hour !== currentHour || alarm.minute !== currentMinute) return;

        // Check if alarm should trigger today
        const shouldTrigger = alarm.days.every((d) => !d) || alarm.days[currentDay];
        if (!shouldTrigger) return;

        // Prevent multiple triggers in the same minute
        const alarmKey = `${alarm.id}-${timeKey}`;
        if (lastTriggeredRef.current === alarmKey) return;
        lastTriggeredRef.current = alarmKey;

        matchingAlarms.push(alarm);
      });

      if (matchingAlarms.length > 0) {
        // GAP-02: Skip if an alarm is already active (triggerAlarm also guards,
        // but this avoids unnecessary queue manipulation)
        if (nativeAlarmFiredRef.current) {
          return;
        }

        // GAP-03: Queue alarms and trigger only the first
        if (alarmQueueRef.current.length === 0 && !alarmScreenVisible) {
          alarmQueueRef.current = matchingAlarms.slice(1);
          triggerAlarm(matchingAlarms[0]);
        } else {
          // Add remaining to queue
          alarmQueueRef.current.push(...matchingAlarms);
        }
      }
    }, 1000);

    return () => clearInterval(checkInterval);
  }, [alarms, alarmScreenVisible]);

  // Reset last triggered ref when minute changes
  useEffect(() => {
    const resetInterval = setInterval(() => {
      lastTriggeredRef.current = '';
      // GAP-02: Reset native alarm fired flag each minute
      nativeAlarmFiredRef.current = false;
    }, 60000);

    return () => clearInterval(resetInterval);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (patternIntervalRef.current) {
        clearTimeout(patternIntervalRef.current);
      }
      if (snoozeTimeoutRef.current) {
        clearTimeout(snoozeTimeoutRef.current);
      }
      if (soundRef.current) {
        soundRef.current.stopAsync();
        soundRef.current.unloadAsync();
      }
    };
  }, []);

  const playAlarmSound = useCallback(async (wakeIntensity: WakeIntensity, soundType: AlarmSound = 'sunrise') => {
    try {
      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
      });

      const config = SOUND_CONFIGS[soundType];
      const intensityOption = WAKE_INTENSITY_OPTIONS.find(o => o.value === wakeIntensity);
      const initialVolume = intensityOption ? intensityOption.volume : 0.5;

      const { sound } = await Audio.Sound.createAsync(
        require('../../assets/alarm-sound.mp3'),
        {
          isLooping: true,
          volume: initialVolume,
          rate: config.rate,
          shouldCorrectPitch: false,
        }
      );

      soundRef.current = sound;
      await sound.playAsync();

      // Apply pattern if defined (creates rhythmic on/off effect)
      if (config.pattern) {
        patternIndexRef.current = 0;
        let isPlaying = true;

        const runPattern = async () => {
          if (!soundRef.current) return;

          const pattern = config.pattern!;
          const duration = pattern[patternIndexRef.current % pattern.length];

          if (isPlaying) {
            await soundRef.current.setVolumeAsync(initialVolume);
          } else {
            await soundRef.current.setVolumeAsync(0.05);
          }

          isPlaying = !isPlaying;
          patternIndexRef.current++;

          patternIntervalRef.current = setTimeout(runPattern, duration);
        };

        patternIntervalRef.current = setTimeout(runPattern, config.pattern[0]);
      }

    } catch (error) {
      logger.log('Error playing sound:', error);
    }
  }, []);

  const stopAlarmSound = useCallback(async () => {
    if (patternIntervalRef.current) {
      clearTimeout(patternIntervalRef.current);
      patternIntervalRef.current = null;
    }

    // Stop the native Android alarm service first (MediaPlayer + vibration).
    try {
      await nativeAlarm.stopAlarm();
    } catch (e) {
      // May fail if no native alarm is active - that's fine
    }

    if (soundRef.current) {
      try {
        await soundRef.current.stopAsync();
        await soundRef.current.unloadAsync();
      } catch (e) {
        // Sound may already be stopped/unloaded
      }
      soundRef.current = null;
    }
  }, []);

  const triggerAlarm = useCallback(async (alarm: Alarm) => {
    // GAP-02: Synchronous guard prevents duplicate triggers from any source
    // (JS interval, notification listener, or launch alarm check).
    // React state updates are async, so alarmScreenVisible can be stale when
    // multiple sources fire in the same tick. This ref is synchronous.
    if (nativeAlarmFiredRef.current) return;
    nativeAlarmFiredRef.current = true;

    if (hapticFeedback) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }

    setActiveAlarm(alarm);
    setAlarmScreenVisible(true);

    // On Android, the native AlarmService already handles audio playback
    // via MediaPlayer. Only use expo-av on iOS where there's no native service.
    if (Platform.OS !== 'android') {
      await playAlarmSound(alarm.wakeIntensity, alarm.sound);
    }
  }, [hapticFeedback, playAlarmSound]);

  const dismissAlarm = useCallback(async () => {
    // GAP-12: Dismiss delivered notifications from the notification shade
    if (activeAlarm) {
      await dismissDeliveredAlarmNotifications(activeAlarm.id);
    }

    await stopAlarmSound();
    setAlarmScreenVisible(false);

    // GAP-02: Reset trigger guard so the next alarm can fire
    nativeAlarmFiredRef.current = false;

    // GAP-13: Reset snooze guard on dismiss
    isSnoozingRef.current = false;

    // Call the callback if provided (for sleep tracking, etc.)
    if (onAlarmDismissed) {
      onAlarmDismissed();
    }

    setActiveAlarm(null);

    // GAP-03: Process next alarm in queue
    if (alarmQueueRef.current.length > 0) {
      const nextAlarm = alarmQueueRef.current.shift()!;
      setTimeout(() => {
        triggerAlarm(nextAlarm);
      }, 1000);
    }
  }, [activeAlarm, stopAlarmSound, onAlarmDismissed, triggerAlarm]);

  const snoozeAlarm = useCallback(async () => {
    if (!activeAlarm || activeAlarm.snooze === 0) return;

    // GAP-13: Prevent duplicate snooze on rapid press
    if (isSnoozingRef.current) return;
    isSnoozingRef.current = true;

    if (patternIntervalRef.current) {
      clearTimeout(patternIntervalRef.current);
      patternIntervalRef.current = null;
    }

    // GAP-12: Dismiss delivered notifications from the shade.
    // Don't cancel scheduled notifications — recurring alarms need them for next week.
    await dismissDeliveredAlarmNotifications(activeAlarm.id);

    await stopAlarmSound();
    setAlarmScreenVisible(false);

    // GAP-02: Reset trigger guard so the snooze re-trigger can fire
    nativeAlarmFiredRef.current = false;

    // Try native snooze first (survives app kill), fall back to setTimeout
    const soundResource = getSoundResourceName(activeAlarm.sound);
    let nativeSnoozeScheduled = false;
    try {
      nativeSnoozeScheduled = await nativeAlarm.snoozeAlarm(activeAlarm.snooze, soundResource);
    } catch (_) {
      // Native snooze failed
    }

    if (!nativeSnoozeScheduled) {
      // Fallback: in-process timer (won't survive app kill)
      const alarmRef = activeAlarm;
      snoozeTimeoutRef.current = setTimeout(() => {
        triggerAlarm(alarmRef);
      }, activeAlarm.snooze * 60 * 1000);
    }

    setActiveAlarm(null);
    // GAP-13: Reset snooze guard after snooze completes
    isSnoozingRef.current = false;
  }, [activeAlarm, stopAlarmSound, triggerAlarm]);

  return {
    alarmScreenVisible,
    activeAlarm,
    triggerAlarm,
    stopAlarmSound,
    dismissAlarm,
    snoozeAlarm,
  };
}
