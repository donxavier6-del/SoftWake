import { useState, useRef, useEffect, useCallback } from 'react';
import { Audio } from 'expo-av';
import * as Haptics from 'expo-haptics';
import { WAKE_INTENSITY_OPTIONS } from '../constants/options';
import { nativeAlarm } from '../services/nativeAlarm';
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
  snoozeAlarm: () => void;
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

  // Update current time ref every second
  useEffect(() => {
    const timer = setInterval(() => {
      currentTimeRef.current = new Date();
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // Check for alarm triggers every minute
  useEffect(() => {
    const checkInterval = setInterval(() => {
      const now = currentTimeRef.current;
      const currentHour = now.getHours();
      const currentMinute = now.getMinutes();
      const currentDay = now.getDay();
      const timeKey = `${currentHour}:${currentMinute}`;

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

        triggerAlarm(alarm);
      });
    }, 1000); // Check every second, but trigger only once per minute

    return () => clearInterval(checkInterval);
  }, [alarms]);

  // Reset last triggered ref when minute changes
  useEffect(() => {
    const resetInterval = setInterval(() => {
      lastTriggeredRef.current = '';
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
      console.log('Error playing sound:', error);
    }
  }, []);

  const stopAlarmSound = useCallback(async () => {
    if (patternIntervalRef.current) {
      clearTimeout(patternIntervalRef.current);
      patternIntervalRef.current = null;
    }
    if (soundRef.current) {
      await soundRef.current.stopAsync();
      await soundRef.current.unloadAsync();
      soundRef.current = null;
    }
    // Stop the native Android alarm service (MediaPlayer + vibration)
    try {
      await nativeAlarm.stopAlarm();
    } catch (e) {
      // May fail if no native alarm is active - that's fine
    }
  }, []);

  const triggerAlarm = useCallback(async (alarm: Alarm) => {
    if (hapticFeedback) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }

    setActiveAlarm(alarm);
    setAlarmScreenVisible(true);

    await playAlarmSound(alarm.wakeIntensity, alarm.sound);
  }, [hapticFeedback, playAlarmSound]);

  const dismissAlarm = useCallback(async () => {
    await stopAlarmSound();
    setAlarmScreenVisible(false);

    // Call the callback if provided (for sleep tracking, etc.)
    if (onAlarmDismissed) {
      onAlarmDismissed();
    }

    setActiveAlarm(null);
  }, [stopAlarmSound, onAlarmDismissed]);

  const snoozeAlarm = useCallback(() => {
    if (!activeAlarm || activeAlarm.snooze === 0) return;

    if (patternIntervalRef.current) {
      clearTimeout(patternIntervalRef.current);
      patternIntervalRef.current = null;
    }
    stopAlarmSound();
    setAlarmScreenVisible(false);

    // Schedule snooze
    snoozeTimeoutRef.current = setTimeout(() => {
      if (activeAlarm) {
        triggerAlarm(activeAlarm);
      }
    }, activeAlarm.snooze * 60 * 1000);

    setActiveAlarm(null);
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
