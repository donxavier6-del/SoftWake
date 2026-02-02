/**
 * useAlarms hook - Manages alarm state and operations
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import type { Alarm, AlarmSound, DismissType, WakeIntensity } from '../types';
import { safeJsonParse } from '../utils/safeJsonParse';
import { validateAlarm, clampHour, clampMinute } from '../utils/validation';
import { generateAlarmId } from '../services/nativeAlarm';
import { logger } from '../utils/logger';

const STORAGE_KEY = '@softwake_alarms';

export interface UseAlarmsReturn {
  // Alarm list
  alarms: Alarm[];
  setAlarms: React.Dispatch<React.SetStateAction<Alarm[]>>;

  // Editor state
  modalVisible: boolean;
  setModalVisible: React.Dispatch<React.SetStateAction<boolean>>;
  editingAlarmId: string | null;
  setEditingAlarmId: React.Dispatch<React.SetStateAction<string | null>>;
  selectedHour: number;
  setSelectedHour: React.Dispatch<React.SetStateAction<number>>;
  selectedMinute: number;
  setSelectedMinute: React.Dispatch<React.SetStateAction<number>>;
  selectedDays: boolean[];
  setSelectedDays: React.Dispatch<React.SetStateAction<boolean[]>>;
  selectedLabel: string;
  setSelectedLabel: React.Dispatch<React.SetStateAction<string>>;
  selectedSnooze: number;
  setSelectedSnooze: React.Dispatch<React.SetStateAction<number>>;
  selectedWakeIntensity: WakeIntensity;
  setSelectedWakeIntensity: React.Dispatch<React.SetStateAction<WakeIntensity>>;
  selectedSound: AlarmSound;
  setSelectedSound: React.Dispatch<React.SetStateAction<AlarmSound>>;
  selectedDismissType: DismissType;
  setSelectedDismissType: React.Dispatch<React.SetStateAction<DismissType>>;

  // Actions
  handleAddAlarm: (defaultSettings?: {
    defaultWakeIntensity: WakeIntensity;
    defaultSound: AlarmSound;
    defaultDismissType: DismissType;
  }) => void;
  handleEditAlarm: (alarm: Alarm) => void;
  handleSaveAlarm: (onBeforeSave?: () => void) => void;
  toggleAlarm: (id: string) => void;
  deleteAlarm: (id: string, hapticFeedback?: boolean) => void;
  toggleDay: (index: number) => void;

  // Undo
  showUndoToast: boolean;
  undoDelete: () => void;

  // Loading state
  isLoaded: boolean;
}

export function useAlarms(): UseAlarmsReturn {
  // Alarm list state
  const [alarms, setAlarms] = useState<Alarm[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  // Editor modal state
  const [modalVisible, setModalVisible] = useState(false);
  const [editingAlarmId, setEditingAlarmId] = useState<string | null>(null);

  // Editor form state
  const [selectedHour, setSelectedHour] = useState(8);
  const [selectedMinute, setSelectedMinute] = useState(0);
  const [selectedDays, setSelectedDays] = useState<boolean[]>([
    false, false, false, false, false, false, false,
  ]);
  const [selectedLabel, setSelectedLabel] = useState('');
  const [selectedSnooze, setSelectedSnooze] = useState(10);
  const [selectedWakeIntensity, setSelectedWakeIntensity] = useState<WakeIntensity>('energetic');
  const [selectedSound, setSelectedSound] = useState<AlarmSound>('sunrise');
  const [selectedDismissType, setSelectedDismissType] = useState<DismissType>('simple');

  // Undo delete state
  const [deletedAlarm, setDeletedAlarm] = useState<Alarm | null>(null);
  const [showUndoToast, setShowUndoToast] = useState(false);
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // GAP-32: Track save error to avoid spamming alerts
  const saveErrorShownRef = useRef<boolean>(false);

  // Load alarms from storage on mount
  useEffect(() => {
    const loadAlarms = async () => {
      try {
        const storedAlarms = await AsyncStorage.getItem(STORAGE_KEY);
        if (storedAlarms) {
          // GAP-07: Safe JSON parse with fallback
          const parsed = safeJsonParse<any[]>(storedAlarms, []);
          // GAP-08: Validate each alarm
          const validAlarms = parsed
            .map((a: any) => validateAlarm(a))
            .filter((a): a is Alarm => a != null);
          setAlarms(validAlarms);
        }
      } catch (error) {
        logger.log('Error loading alarms:', error);
      } finally {
        setIsLoaded(true);
      }
    };
    loadAlarms();
  }, []);

  // GAP-15: Debounced save to storage when alarms change
  useEffect(() => {
    if (!isLoaded) return;
    const timer = setTimeout(async () => {
      try {
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(alarms));
      } catch (error) {
        logger.log('Error saving alarms:', error);
        // GAP-32: Show user-facing error on save failure (once per session)
        if (!saveErrorShownRef.current) {
          saveErrorShownRef.current = true;
          Alert.alert('Save Failed', 'Your alarm changes couldn\'t be saved. Please free up storage space.');
        }
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [alarms, isLoaded]);

  // Cleanup undo timer on unmount
  useEffect(() => {
    return () => {
      if (undoTimerRef.current) {
        clearTimeout(undoTimerRef.current);
      }
    };
  }, []);

  const handleAddAlarm = useCallback((
    defaultSettings?: {
      defaultWakeIntensity: WakeIntensity;
      defaultSound: AlarmSound;
      defaultDismissType: DismissType;
    }
  ) => {
    setEditingAlarmId(null);
    setSelectedHour(8);
    setSelectedMinute(0);
    setSelectedDays([false, false, false, false, false, false, false]);
    setSelectedLabel('');
    setSelectedSnooze(10);
    setSelectedWakeIntensity(defaultSettings?.defaultWakeIntensity ?? 'energetic');
    setSelectedSound(defaultSettings?.defaultSound ?? 'sunrise');
    setSelectedDismissType(defaultSettings?.defaultDismissType ?? 'simple');
    setModalVisible(true);
  }, []);

  const handleEditAlarm = useCallback((alarm: Alarm) => {
    setEditingAlarmId(alarm.id);
    setSelectedHour(alarm.hour);
    setSelectedMinute(alarm.minute);
    setSelectedDays([...alarm.days]);
    setSelectedLabel(alarm.label);
    setSelectedSnooze(alarm.snooze);
    setSelectedWakeIntensity(alarm.wakeIntensity ?? 'energetic');
    setSelectedSound(alarm.sound ?? 'sunrise');
    const dismissType = (alarm.dismissType as string) === 'off'
      ? 'simple'
      : (alarm.dismissType ?? 'simple');
    setSelectedDismissType(dismissType as DismissType);
    setModalVisible(true);
  }, []);

  const toggleDay = useCallback((index: number) => {
    setSelectedDays((prevDays) => {
      const newDays = [...prevDays];
      newDays[index] = !newDays[index];
      return newDays;
    });
  }, []);

  const handleSaveAlarm = useCallback((onBeforeSave?: () => void) => {
    if (onBeforeSave) {
      onBeforeSave();
    }

    // GAP-09: Validate hour/minute before saving
    const validHour = clampHour(selectedHour);
    const validMinute = clampMinute(selectedMinute);

    if (editingAlarmId) {
      setAlarms((prevAlarms) =>
        prevAlarms.map((alarm) =>
          alarm.id === editingAlarmId
            ? {
                ...alarm,
                hour: validHour,
                minute: validMinute,
                days: selectedDays,
                label: selectedLabel,
                snooze: selectedSnooze,
                wakeIntensity: selectedWakeIntensity,
                sound: selectedSound,
                dismissType: selectedDismissType,
              }
            : alarm
        )
      );
    } else {
      // GAP-22: Use generateAlarmId() instead of Date.now().toString()
      const newAlarm: Alarm = {
        id: generateAlarmId(),
        hour: validHour,
        minute: validMinute,
        days: selectedDays,
        enabled: true,
        label: selectedLabel,
        snooze: selectedSnooze,
        wakeIntensity: selectedWakeIntensity,
        sound: selectedSound,
        dismissType: selectedDismissType,
      };
      setAlarms((prevAlarms) => [...prevAlarms, newAlarm]);
    }
    setModalVisible(false);
    setEditingAlarmId(null);
  }, [
    editingAlarmId,
    selectedHour,
    selectedMinute,
    selectedDays,
    selectedLabel,
    selectedSnooze,
    selectedWakeIntensity,
    selectedSound,
    selectedDismissType,
  ]);

  const toggleAlarm = useCallback((id: string) => {
    setAlarms((prevAlarms) =>
      prevAlarms.map((alarm) =>
        alarm.id === id ? { ...alarm, enabled: !alarm.enabled } : alarm
      )
    );
  }, []);

  const deleteAlarm = useCallback((id: string, hapticFeedback?: boolean) => {
    const alarmToDelete = alarms.find((alarm) => alarm.id === id);
    if (!alarmToDelete) return;

    if (undoTimerRef.current) {
      clearTimeout(undoTimerRef.current);
    }

    setDeletedAlarm(alarmToDelete);
    setShowUndoToast(true);
    setAlarms((prevAlarms) => prevAlarms.filter((alarm) => alarm.id !== id));

    if (hapticFeedback) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }

    undoTimerRef.current = setTimeout(() => {
      setShowUndoToast(false);
      setDeletedAlarm(null);
    }, 3000);
  }, [alarms]);

  const undoDelete = useCallback(() => {
    if (deletedAlarm) {
      setAlarms((prevAlarms) => [...prevAlarms, deletedAlarm]);
      setDeletedAlarm(null);
      setShowUndoToast(false);
      if (undoTimerRef.current) {
        clearTimeout(undoTimerRef.current);
      }
    }
  }, [deletedAlarm]);

  return {
    alarms,
    setAlarms,
    modalVisible,
    setModalVisible,
    editingAlarmId,
    setEditingAlarmId,
    selectedHour,
    setSelectedHour,
    selectedMinute,
    setSelectedMinute,
    selectedDays,
    setSelectedDays,
    selectedLabel,
    setSelectedLabel,
    selectedSnooze,
    setSelectedSnooze,
    selectedWakeIntensity,
    setSelectedWakeIntensity,
    selectedSound,
    setSelectedSound,
    selectedDismissType,
    setSelectedDismissType,
    handleAddAlarm,
    handleEditAlarm,
    handleSaveAlarm,
    toggleAlarm,
    deleteAlarm,
    toggleDay,
    showUndoToast,
    undoDelete,
    isLoaded,
  };
}
