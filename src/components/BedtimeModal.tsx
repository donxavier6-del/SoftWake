/**
 * BedtimeModal Component
 * Modal for logging bedtime after dismissing an alarm
 */

import React from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import type { TimePickerProps } from './TimePicker';

interface BedtimeModalProps {
  visible: boolean;
  bedtimeHour: number;
  bedtimeMinute: number;
  onHourChange: (hour: number) => void;
  onMinuteChange: (minute: number) => void;
  hapticFeedback: boolean;
  onSave: () => void;
  onSkip: () => void;
  TimePicker: React.ComponentType<TimePickerProps>;
}

export function BedtimeModal({
  visible,
  bedtimeHour,
  bedtimeMinute,
  onHourChange,
  onMinuteChange,
  hapticFeedback,
  onSave,
  onSkip,
  TimePicker,
}: BedtimeModalProps) {
  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={visible}
      onRequestClose={onSkip}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <Text style={styles.title}>Log Your Sleep</Text>
          <Text style={styles.subtitle}>When did you go to bed last night?</Text>

          <TimePicker
            hour={bedtimeHour}
            minute={bedtimeMinute}
            onHourChange={onHourChange}
            onMinuteChange={onMinuteChange}
            minuteStep={5}
            hapticFeedback={hapticFeedback}
          />

          <TouchableOpacity
            style={styles.saveButton}
            onPress={onSave}
            accessibilityLabel="Save bedtime"
            accessibilityRole="button"
          >
            <Text style={styles.saveButtonText}>Save</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.skipButton}
            onPress={onSkip}
            accessibilityLabel="Skip logging bedtime"
            accessibilityRole="button"
          >
            <Text style={styles.skipButtonText}>Skip</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#1A1A1A',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: '#9999AA',
    textAlign: 'center',
    marginBottom: 16,
  },
  saveButton: {
    backgroundColor: '#818CF8',
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 16,
  },
  saveButtonText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  skipButton: {
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  skipButtonText: {
    fontSize: 15,
    color: '#9999AA',
  },
});
