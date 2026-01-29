/**
 * AlarmEditor Component
 * Modal for creating and editing alarms
 */

import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  TextInput,
  StyleSheet,
} from 'react-native';
import {
  DAYS,
  SNOOZE_OPTIONS,
  WAKE_INTENSITY_OPTIONS,
  SOUND_OPTIONS,
  DISMISS_OPTIONS,
} from '../constants/options';
import type { Theme, Settings, WakeIntensity, AlarmSound, DismissType } from '../types';
import { TimePicker } from './TimePicker';

interface AlarmEditorProps {
  visible: boolean;
  editingAlarmId: string | null;
  theme: Theme;
  settings: Settings;
  // Time state
  selectedHour: number;
  selectedMinute: number;
  onHourChange: (hour: number) => void;
  onMinuteChange: (minute: number) => void;
  // Days state
  selectedDays: boolean[];
  onToggleDay: (index: number) => void;
  // Label state
  selectedLabel: string;
  onLabelChange: (label: string) => void;
  // Options state
  selectedSnooze: number;
  onSnoozeChange: (value: number) => void;
  selectedWakeIntensity: WakeIntensity;
  onWakeIntensityChange: (value: WakeIntensity) => void;
  selectedSound: AlarmSound;
  onSoundChange: (value: AlarmSound) => void;
  selectedDismissType: DismissType;
  onDismissTypeChange: (value: DismissType) => void;
  // Actions
  onSave: () => void;
  onCancel: () => void;
  onPlayPreview: () => void;
}

export function AlarmEditor({
  visible,
  editingAlarmId,
  theme,
  settings,
  selectedHour,
  selectedMinute,
  onHourChange,
  onMinuteChange,
  selectedDays,
  onToggleDay,
  selectedLabel,
  onLabelChange,
  selectedSnooze,
  onSnoozeChange,
  selectedWakeIntensity,
  onWakeIntensityChange,
  selectedSound,
  onSoundChange,
  selectedDismissType,
  onDismissTypeChange,
  onSave,
  onCancel,
  onPlayPreview,
}: AlarmEditorProps) {
  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={visible}
      onRequestClose={onCancel}
    >
      <View style={styles.modalOverlay}>
        <ScrollView style={styles.modalScroll}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={onCancel}>
                <Text style={styles.cancelButton}>Cancel</Text>
              </TouchableOpacity>
              <Text style={styles.modalTitle}>
                {editingAlarmId ? 'Edit Alarm' : 'New Alarm'}
              </Text>
              <TouchableOpacity onPress={onSave}>
                <Text style={styles.saveButton}>Save</Text>
              </TouchableOpacity>
            </View>

            <TimePicker
              hour={selectedHour}
              minute={selectedMinute}
              onHourChange={onHourChange}
              onMinuteChange={onMinuteChange}
              hapticFeedback={settings.hapticFeedback}
            />

            <View style={styles.repeatSection}>
              <Text style={styles.repeatLabel}>Repeat</Text>
              <View style={styles.daysContainer}>
                {DAYS.map((day, index) => (
                  <TouchableOpacity
                    key={day}
                    onPress={() => onToggleDay(index)}
                    style={[
                      styles.dayButton,
                      selectedDays[index] && styles.dayButtonSelected,
                    ]}
                  >
                    <Text
                      style={[
                        styles.dayText,
                        selectedDays[index] && styles.dayTextSelected,
                      ]}
                    >
                      {day[0]}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.labelSection}>
              <Text style={styles.labelTitle}>Label</Text>
              <TextInput
                style={styles.labelInput}
                value={selectedLabel}
                onChangeText={onLabelChange}
                placeholder="Alarm"
                placeholderTextColor="#444444"
              />
            </View>

            <View style={styles.snoozeSection}>
              <Text style={styles.snoozeTitle}>Snooze</Text>
              <View style={styles.snoozeOptions}>
                {SNOOZE_OPTIONS.map((option) => (
                  <TouchableOpacity
                    key={option.value}
                    onPress={() => onSnoozeChange(option.value)}
                    style={[
                      styles.snoozeOption,
                      selectedSnooze === option.value && styles.snoozeOptionSelected,
                    ]}
                  >
                    <Text
                      style={[
                        styles.snoozeOptionText,
                        selectedSnooze === option.value && styles.snoozeOptionTextSelected,
                      ]}
                    >
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.wakeIntensitySection}>
              <View style={styles.wakeIntensityHeader}>
                <Text style={styles.wakeIntensityTitle}>Wake Intensity</Text>
                <TouchableOpacity
                  onPress={onPlayPreview}
                  style={styles.previewButton}
                >
                  <Text style={styles.previewButtonIcon}>🔊</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.wakeIntensityOptions}>
                {WAKE_INTENSITY_OPTIONS.map((option) => (
                  <TouchableOpacity
                    key={option.value}
                    onPress={() => onWakeIntensityChange(option.value)}
                    style={[
                      styles.wakeIntensityOption,
                      selectedWakeIntensity === option.value && styles.wakeIntensityOptionSelected,
                    ]}
                  >
                    <Text
                      style={[
                        styles.wakeIntensityOptionText,
                        selectedWakeIntensity === option.value && styles.wakeIntensityOptionTextSelected,
                      ]}
                    >
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.soundSection}>
              <Text style={styles.soundTitle}>Sound</Text>
              <View style={styles.soundOptions}>
                {SOUND_OPTIONS.map((option) => (
                  <TouchableOpacity
                    key={option.value}
                    onPress={() => onSoundChange(option.value)}
                    style={[
                      styles.soundOption,
                      selectedSound === option.value && styles.soundOptionSelected,
                    ]}
                  >
                    <Text style={styles.soundOptionIcon}>{option.icon}</Text>
                    <Text
                      style={[
                        styles.soundOptionText,
                        selectedSound === option.value && styles.soundOptionTextSelected,
                      ]}
                    >
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.dismissTypeSection}>
              <Text style={styles.dismissTypeTitle}>Dismiss Method</Text>
              <View style={styles.dismissTypeOptions}>
                {DISMISS_OPTIONS.filter(o => !o.isMission).map((option) => (
                  <TouchableOpacity
                    key={option.value}
                    onPress={() => onDismissTypeChange(option.value)}
                    style={[
                      styles.dismissTypeOption,
                      selectedDismissType === option.value && styles.dismissTypeOptionSelected,
                    ]}
                  >
                    <Text style={styles.dismissTypeIcon}>{option.icon}</Text>
                    <View style={styles.dismissTypeTextContainer}>
                      <Text
                        style={[
                          styles.dismissTypeLabel,
                          selectedDismissType === option.value && styles.dismissTypeLabelSelected,
                        ]}
                      >
                        {option.label}
                      </Text>
                      <Text
                        style={[
                          styles.dismissTypeDescription,
                          selectedDismissType === option.value && styles.dismissTypeDescriptionSelected,
                        ]}
                      >
                        {option.description}
                      </Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={styles.missionsSubtitle}>Wake-up Missions</Text>
              <Text style={styles.missionsHint}>Optional challenges to help you wake up</Text>
              <View style={styles.dismissTypeOptions}>
                {DISMISS_OPTIONS.filter(o => o.isMission).map((option) => (
                  <TouchableOpacity
                    key={option.value}
                    onPress={() => onDismissTypeChange(option.value)}
                    style={[
                      styles.dismissTypeOption,
                      selectedDismissType === option.value && styles.dismissTypeOptionSelected,
                    ]}
                  >
                    <Text style={styles.dismissTypeIcon}>{option.icon}</Text>
                    <View style={styles.dismissTypeTextContainer}>
                      <Text
                        style={[
                          styles.dismissTypeLabel,
                          selectedDismissType === option.value && styles.dismissTypeLabelSelected,
                        ]}
                      >
                        {option.label}
                      </Text>
                      <Text
                        style={[
                          styles.dismissTypeDescription,
                          selectedDismissType === option.value && styles.dismissTypeDescriptionSelected,
                        ]}
                      >
                        {option.description}
                      </Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalScroll: {
    flex: 1,
  },
  modalContent: {
    backgroundColor: '#1A1A1A',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    marginTop: 60,
    padding: 20,
    minHeight: 800,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  cancelButton: {
    color: '#9999AA',
    fontSize: 16,
  },
  modalTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
  saveButton: {
    color: '#818CF8',
    fontSize: 16,
    fontWeight: '600',
  },
  repeatSection: {
    marginTop: 24,
  },
  repeatLabel: {
    color: '#9999AA',
    fontSize: 14,
    marginBottom: 12,
  },
  daysContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  dayButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#2A2A2A',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dayButtonSelected: {
    backgroundColor: '#818CF8',
  },
  dayText: {
    color: '#9999AA',
    fontSize: 14,
    fontWeight: '500',
  },
  dayTextSelected: {
    color: '#FFFFFF',
  },
  labelSection: {
    marginTop: 24,
  },
  labelTitle: {
    color: '#9999AA',
    fontSize: 14,
    marginBottom: 12,
  },
  labelInput: {
    backgroundColor: '#2A2A2A',
    borderRadius: 12,
    padding: 16,
    color: '#FFFFFF',
    fontSize: 16,
  },
  snoozeSection: {
    marginTop: 24,
  },
  snoozeTitle: {
    color: '#9999AA',
    fontSize: 14,
    marginBottom: 12,
  },
  snoozeOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  snoozeOption: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: '#2A2A2A',
  },
  snoozeOptionSelected: {
    backgroundColor: '#818CF8',
  },
  snoozeOptionText: {
    color: '#9999AA',
    fontSize: 14,
  },
  snoozeOptionTextSelected: {
    color: '#FFFFFF',
  },
  wakeIntensitySection: {
    marginTop: 24,
  },
  wakeIntensityHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  wakeIntensityTitle: {
    color: '#9999AA',
    fontSize: 14,
  },
  previewButton: {
    padding: 8,
  },
  previewButtonIcon: {
    fontSize: 20,
  },
  wakeIntensityOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  wakeIntensityOption: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: '#2A2A2A',
  },
  wakeIntensityOptionSelected: {
    backgroundColor: '#818CF8',
  },
  wakeIntensityOptionText: {
    color: '#9999AA',
    fontSize: 14,
  },
  wakeIntensityOptionTextSelected: {
    color: '#FFFFFF',
  },
  soundSection: {
    marginTop: 24,
  },
  soundTitle: {
    color: '#9999AA',
    fontSize: 14,
    marginBottom: 12,
  },
  soundOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  soundOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 16,
    backgroundColor: '#2A2A2A',
    gap: 8,
  },
  soundOptionSelected: {
    backgroundColor: '#818CF8',
  },
  soundOptionIcon: {
    fontSize: 20,
  },
  soundOptionText: {
    color: '#9999AA',
    fontSize: 14,
  },
  soundOptionTextSelected: {
    color: '#FFFFFF',
  },
  dismissTypeSection: {
    marginTop: 24,
  },
  dismissTypeTitle: {
    color: '#9999AA',
    fontSize: 14,
    marginBottom: 12,
  },
  dismissTypeOptions: {
    gap: 8,
  },
  dismissTypeOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    backgroundColor: '#2A2A2A',
  },
  dismissTypeOptionSelected: {
    backgroundColor: '#818CF8',
  },
  dismissTypeIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  dismissTypeTextContainer: {
    flex: 1,
  },
  dismissTypeLabel: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '500',
  },
  dismissTypeLabelSelected: {
    color: '#FFFFFF',
  },
  dismissTypeDescription: {
    color: '#9999AA',
    fontSize: 13,
    marginTop: 2,
  },
  dismissTypeDescriptionSelected: {
    color: 'rgba(255,255,255,0.8)',
  },
  missionsSubtitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginTop: 24,
    marginBottom: 4,
  },
  missionsHint: {
    color: '#9999AA',
    fontSize: 13,
    marginBottom: 12,
  },
});
