/**
 * useSleepTracking Hook
 * Manages sleep data, bedtime logging, and sleep statistics
 */

import { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DAYS } from '../constants/options';
import { formatTimeWithPeriod } from '../utils/timeFormatting';
import type { SleepEntry } from '../types';

const SLEEP_STORAGE_KEY = '@softwake_sleep_data';

export interface WeeklyDataPoint {
  day: string;
  duration: number;
  date: Date;
}

export interface SleepStatsResult {
  average: number;
  best: { duration: number; date: Date };
  worst: { duration: number; date: Date };
  totalNights: number;
  avgBedtime: string;
  avgWakeTime: string;
}

interface UseSleepTrackingReturn {
  // Sleep data
  sleepData: SleepEntry[];

  // Bedtime modal state
  bedtimeModalVisible: boolean;
  setBedtimeModalVisible: (visible: boolean) => void;
  bedtimeHour: number;
  setBedtimeHour: (hour: number) => void;
  bedtimeMinute: number;
  setBedtimeMinute: (minute: number) => void;
  pendingWakeTime: Date | null;
  setPendingWakeTime: (time: Date | null) => void;

  // Functions
  getWeeklyData: () => WeeklyDataPoint[];
  getSleepStats: () => SleepStatsResult | null;
  handleSaveBedtime: () => void;
  handleSkipBedtime: () => void;

  // Loading state
  isLoading: boolean;
}

export function useSleepTracking(): UseSleepTrackingReturn {
  // Sleep data state
  const [sleepData, setSleepData] = useState<SleepEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Bedtime modal state
  const [bedtimeModalVisible, setBedtimeModalVisible] = useState(false);
  const [bedtimeHour, setBedtimeHour] = useState(22);
  const [bedtimeMinute, setBedtimeMinute] = useState(0);
  const [pendingWakeTime, setPendingWakeTime] = useState<Date | null>(null);

  // Load sleep data from storage on mount
  useEffect(() => {
    const loadSleepData = async () => {
      try {
        const storedSleep = await AsyncStorage.getItem(SLEEP_STORAGE_KEY);
        if (storedSleep) {
          setSleepData(JSON.parse(storedSleep));
        }
      } catch (error) {
        console.log('Error loading sleep data:', error);
      } finally {
        setIsLoading(false);
      }
    };
    loadSleepData();
  }, []);

  // Save sleep data to storage when it changes
  useEffect(() => {
    if (isLoading) return;
    const saveSleepData = async () => {
      try {
        await AsyncStorage.setItem(SLEEP_STORAGE_KEY, JSON.stringify(sleepData));
      } catch (error) {
        console.log('Error saving sleep data:', error);
      }
    };
    saveSleepData();
  }, [sleepData, isLoading]);

  // Get weekly data for sleep chart
  const getWeeklyData = (): WeeklyDataPoint[] => {
    const now = new Date();
    const weekData: WeeklyDataPoint[] = [];

    // Get last 7 days
    for (let i = 6; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      date.setHours(0, 0, 0, 0);

      const nextDate = new Date(date);
      nextDate.setDate(nextDate.getDate() + 1);

      // Find sleep entry for this day (based on wake time)
      const entry = sleepData.find((e) => {
        const wakeDate = new Date(e.wakeTime);
        return wakeDate >= date && wakeDate < nextDate;
      });

      weekData.push({
        day: DAYS[date.getDay()],
        duration: entry ? entry.sleepDuration : 0,
        date,
      });
    }

    return weekData;
  };

  // Get sleep statistics
  const getSleepStats = (): SleepStatsResult | null => {
    if (sleepData.length === 0) {
      return null;
    }

    const durations = sleepData.map((e) => e.sleepDuration);
    const total = durations.reduce((sum, d) => sum + d, 0);
    const average = Math.round(total / durations.length);

    const best = sleepData.reduce((max, e) =>
      e.sleepDuration > max.sleepDuration ? e : max
    );
    const worst = sleepData.reduce((min, e) =>
      e.sleepDuration < min.sleepDuration ? e : min
    );

    // Calculate average bedtime
    const bedtimeMinutes = sleepData.map((e) => {
      const bed = new Date(e.bedtime);
      let mins = bed.getHours() * 60 + bed.getMinutes();
      if (mins < 720) mins += 1440; // After midnight, add 24h
      return mins;
    });
    const avgBedtimeMinutes = Math.round(
      bedtimeMinutes.reduce((sum, m) => sum + m, 0) / bedtimeMinutes.length
    ) % 1440;
    const avgBedtimeHour = Math.floor(avgBedtimeMinutes / 60);
    const avgBedtimeMinute = avgBedtimeMinutes % 60;

    // Calculate average wake time
    const wakeMinutes = sleepData.map((e) => {
      const wake = new Date(e.wakeTime);
      return wake.getHours() * 60 + wake.getMinutes();
    });
    const avgWakeMinutes = Math.round(
      wakeMinutes.reduce((sum, m) => sum + m, 0) / wakeMinutes.length
    );
    const avgWakeHour = Math.floor(avgWakeMinutes / 60);
    const avgWakeMinute = avgWakeMinutes % 60;

    return {
      average,
      best: {
        duration: best.sleepDuration,
        date: new Date(best.wakeTime),
      },
      worst: {
        duration: worst.sleepDuration,
        date: new Date(worst.wakeTime),
      },
      totalNights: sleepData.length,
      avgBedtime: formatTimeWithPeriod(avgBedtimeHour, avgBedtimeMinute),
      avgWakeTime: formatTimeWithPeriod(avgWakeHour, avgWakeMinute),
    };
  };

  // Save bedtime entry
  const handleSaveBedtime = () => {
    if (!pendingWakeTime) return;

    // Calculate bedtime timestamp (previous day if bedtime hour > wake hour)
    const wakeTime = pendingWakeTime;
    const bedtime = new Date(wakeTime);
    bedtime.setHours(bedtimeHour, bedtimeMinute, 0, 0);

    // If bedtime is after wake time, it was the previous day
    if (bedtime >= wakeTime) {
      bedtime.setDate(bedtime.getDate() - 1);
    }

    // Calculate sleep duration in minutes
    const sleepDuration = Math.round((wakeTime.getTime() - bedtime.getTime()) / (1000 * 60));

    const newEntry: SleepEntry = {
      id: Date.now().toString(),
      bedtime: bedtime.getTime(),
      wakeTime: wakeTime.getTime(),
      sleepDuration,
    };

    const updatedSleepData = [...sleepData, newEntry];
    setSleepData(updatedSleepData);
    setBedtimeModalVisible(false);
    setPendingWakeTime(null);

    // Show insight if we have 7+ entries
    if (updatedSleepData.length >= 7) {
      // Insight display is handled by the component using this hook
      // The caller can check sleepData.length >= 7 after save
    }
  };

  // Skip bedtime logging
  const handleSkipBedtime = () => {
    setBedtimeModalVisible(false);
    setPendingWakeTime(null);
  };

  return {
    sleepData,
    bedtimeModalVisible,
    setBedtimeModalVisible,
    bedtimeHour,
    setBedtimeHour,
    bedtimeMinute,
    setBedtimeMinute,
    pendingWakeTime,
    setPendingWakeTime,
    getWeeklyData,
    getSleepStats,
    handleSaveBedtime,
    handleSkipBedtime,
    isLoading,
  };
}
