/**
 * SleepTracker Component
 * Bedtime logging modal for tracking sleep
 */

import React from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { THEMES } from '../constants/themes';

// TimePicker props interface
interface TimePickerProps {
  hour: number;
  minute: number;
  onHourChange: (hour: number) => void;
  onMinuteChange: (minute: number) => void;
  minuteStep?: number;
  hapticFeedback?: boolean;
}

interface SleepTrackerProps {
  visible: boolean;
  bedtimeHour: number;
  bedtimeMinute: number;
  onHourChange: (hour: number) => void;
  onMinuteChange: (minute: number) => void;
  onSave: () => void;
  onSkip: () => void;
  hapticFeedback: boolean;
  TimePicker: React.ComponentType<TimePickerProps>;
}

export function SleepTracker({
  visible,
  bedtimeHour,
  bedtimeMinute,
  onHourChange,
  onMinuteChange,
  onSave,
  onSkip,
  hapticFeedback,
  TimePicker,
}: SleepTrackerProps) {
  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={visible}
      onRequestClose={onSkip}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.bedtimeModalContent}>
          <Text style={styles.bedtimeTitle}>Log Your Sleep</Text>
          <Text style={styles.bedtimeSubtitle}>When did you go to bed last night?</Text>

          <TimePicker
            hour={bedtimeHour}
            minute={bedtimeMinute}
            onHourChange={onHourChange}
            onMinuteChange={onMinuteChange}
            minuteStep={5}
            hapticFeedback={hapticFeedback}
          />

          <TouchableOpacity style={styles.saveBedtimeButton} onPress={onSave} accessibilityLabel="Save bedtime" accessibilityRole="button">
            <Text style={styles.saveBedtimeButtonText}>Save</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.skipBedtimeButton} onPress={onSkip} accessibilityLabel="Skip logging bedtime" accessibilityRole="button">
            <Text style={styles.skipBedtimeButtonText}>Skip</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  bedtimeModalContent: {
    backgroundColor: THEMES.dark.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
  },
  bedtimeTitle: {
    fontSize: 24,
    fontWeight: '600',
    color: THEMES.dark.text,
    textAlign: 'center',
    marginBottom: 8,
  },
  bedtimeSubtitle: {
    fontSize: 16,
    color: THEMES.dark.textDisabled,
    textAlign: 'center',
    marginBottom: 24,
  },
  saveBedtimeButton: {
    backgroundColor: THEMES.dark.text,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 20,
  },
  saveBedtimeButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: THEMES.dark.background,
  },
  skipBedtimeButton: {
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  skipBedtimeButtonText: {
    fontSize: 16,
    color: THEMES.dark.textDisabled,
  },
});
