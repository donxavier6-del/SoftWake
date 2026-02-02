/**
 * useSettings Hook
 * Manages app settings state with AsyncStorage persistence.
 */

import { useState, useEffect, useRef } from 'react';
import { Alert } from 'react-native';
import type { Settings } from '../types';
import { getSecureItem, setSecureItem } from '../services/secureStorage';
import { safeJsonParse } from '../utils/safeJsonParse';
import { validateSettings } from '../utils/validation';
import { logger } from '../utils/logger';

const STORAGE_KEY = '@alarmlit_settings';

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

interface UseSettingsReturn {
  settings: Settings;
  updateSettings: (partial: Partial<Settings>) => void;
  isLoading: boolean;
}

export function useSettings(): UseSettingsReturn {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);

  // GAP-32: Track save error to avoid spamming
  const saveErrorShownRef = useRef<boolean>(false);

  // Load settings from AsyncStorage on mount
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const stored = await getSecureItem(STORAGE_KEY);
        if (stored) {
          // GAP-07: Safe JSON parse
          const parsed = safeJsonParse(stored, null);
          // GAP-24: Validate settings with defaults for missing/invalid fields
          const validated = validateSettings(parsed);
          setSettings(validated);
        }
      } catch (error) {
        logger.log('Error loading settings:', error);
      } finally {
        setIsLoading(false);
      }
    };
    loadSettings();
  }, []);

  // GAP-15: Debounced save settings to AsyncStorage when they change
  useEffect(() => {
    if (isLoading) return;
    const timer = setTimeout(async () => {
      try {
        await setSecureItem(STORAGE_KEY, JSON.stringify(settings));
      } catch (error) {
        logger.log('Error saving settings:', error);
        // GAP-32: Show user-facing error (once per session)
        if (!saveErrorShownRef.current) {
          saveErrorShownRef.current = true;
          Alert.alert('Save Failed', 'Your settings couldn\'t be saved. Please free up storage space.');
        }
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [settings, isLoading]);

  const updateSettings = (partial: Partial<Settings>) => {
    setSettings((prev) => ({ ...prev, ...partial }));
  };

  return { settings, updateSettings, isLoading };
}
