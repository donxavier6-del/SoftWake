/**
 * useAlarms hook - Manages alarm state and operations
 *
 * Extracted from App.tsx as part of the refactoring initiative.
 * This hook handles:
 * - Alarm list state
 * - Alarm editor modal state
 * - AsyncStorage persistence
 * - CRUD operations (Create, Read, Update, Delete)
 * - Undo delete functionality
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import type { Alarm, AlarmSound, DismissType, WakeIntensity } from '../types';

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

  // Load alarms from storage on mount
  useEffect(() => {
    const loadAlarms = async () => {
      try {
        const storedAlarms = await AsyncStorage.getItem(STORAGE_KEY);
        if (storedAlarms) {
          setAlarms(JSON.parse(storedAlarms));
        }
      } catch (error) {
        console.log('Error loading alarms:', error);
      } finally {
        setIsLoaded(true);
      }
    };
    loadAlarms();
  }, []);

  // Save alarms to storage whenever they change
  useEffect(() => {
    if (!isLoaded) return;
    const saveAlarms = async () => {
      try {
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(alarms));
      } catch (error) {
        console.log('Error saving alarms:', error);
      }
    };
    saveAlarms();
  }, [alarms, isLoaded]);

  // Cleanup undo timer on unmount
  useEffect(() => {
    return () => {
      if (undoTimerRef.current) {
        clearTimeout(undoTimerRef.current);
      }
    };
  }, []);

  /**
   * Open the alarm editor to add a new alarm
   */
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

  /**
   * Open the alarm editor to edit an existing alarm
   */
  const handleEditAlarm = useCallback((alarm: Alarm) => {
    setEditingAlarmId(alarm.id);
    setSelectedHour(alarm.hour);
    setSelectedMinute(alarm.minute);
    setSelectedDays([...alarm.days]);
    setSelectedLabel(alarm.label);
    setSelectedSnooze(alarm.snooze);
    setSelectedWakeIntensity(alarm.wakeIntensity || 'energetic');
    setSelectedSound(alarm.sound || 'sunrise');
    // Handle legacy 'off' value that may exist in storage
    const dismissType = (alarm.dismissType as string) === 'off'
      ? 'simple'
      : (alarm.dismissType || 'simple');
    setSelectedDismissType(dismissType as DismissType);
    setModalVisible(true);
  }, []);

  /**
   * Toggle a day in the selected days array
   */
  const toggleDay = useCallback((index: number) => {
    setSelectedDays((prevDays) => {
      const newDays = [...prevDays];
      newDays[index] = !newDays[index];
      return newDays;
    });
  }, []);

  /**
   * Save the current alarm (create new or update existing)
   */
  const handleSaveAlarm = useCallback((onBeforeSave?: () => void) => {
    // Optional callback for cleanup (e.g., stop preview sound)
    if (onBeforeSave) {
      onBeforeSave();
    }

    if (editingAlarmId) {
      // Update existing alarm
      setAlarms((prevAlarms) =>
        prevAlarms.map((alarm) =>
          alarm.id === editingAlarmId
            ? {
                ...alarm,
                hour: selectedHour,
                minute: selectedMinute,
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
      // Create new alarm
      const newAlarm: Alarm = {
        id: Date.now().toString(),
        hour: selectedHour,
        minute: selectedMinute,
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

  /**
   * Toggle alarm enabled/disabled state
   */
  const toggleAlarm = useCallback((id: string) => {
    setAlarms((prevAlarms) =>
      prevAlarms.map((alarm) =>
        alarm.id === id ? { ...alarm, enabled: !alarm.enabled } : alarm
      )
    );
  }, []);

  /**
   * Delete an alarm with undo capability
   */
  const deleteAlarm = useCallback((id: string, hapticFeedback?: boolean) => {
    const alarmToDelete = alarms.find((alarm) => alarm.id === id);
    if (!alarmToDelete) return;

    // Clear any existing undo timer
    if (undoTimerRef.current) {
      clearTimeout(undoTimerRef.current);
    }

    // Store deleted alarm for undo
    setDeletedAlarm(alarmToDelete);
    setShowUndoToast(true);
    setAlarms((prevAlarms) => prevAlarms.filter((alarm) => alarm.id !== id));

    // Haptic feedback
    if (hapticFeedback) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }

    // Auto-hide toast after 3 seconds
    undoTimerRef.current = setTimeout(() => {
      setShowUndoToast(false);
      setDeletedAlarm(null);
    }, 3000);
  }, [alarms]);

  /**
   * Undo the last delete operation
   */
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
    // Alarm list
    alarms,
    setAlarms,

    // Editor state
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

    // Actions
    handleAddAlarm,
    handleEditAlarm,
    handleSaveAlarm,
    toggleAlarm,
    deleteAlarm,
    toggleDay,

    // Undo
    showUndoToast,
    undoDelete,

    // Loading state
    isLoaded,
  };
}
