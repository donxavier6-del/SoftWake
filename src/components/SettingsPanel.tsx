/**
 * SettingsPanel Component
 * Displays and manages app settings
 */

import React from 'react';
import { ScrollView, View, Text, TouchableOpacity, Switch, StyleSheet } from 'react-native';
import { WAKE_INTENSITY_OPTIONS, SOUND_OPTIONS, DISMISS_OPTIONS, SLEEP_GOAL_OPTIONS } from '../constants/options';
import { formatTimeWithPeriod } from '../utils/timeFormatting';
import type { Settings, Theme } from '../types';

// TimePicker props interface
interface TimePickerProps {
  hour: number;
  minute: number;
  onHourChange: (hour: number) => void;
  onMinuteChange: (minute: number) => void;
  minuteStep?: number;
  hapticFeedback?: boolean;
}

interface SettingsPanelProps {
  settings: Settings;
  theme: Theme;
  updateSettings: (updates: Partial<Settings>) => void;
  bedtimePickerVisible: boolean;
  setBedtimePickerVisible: (visible: boolean) => void;
  TimePicker: React.ComponentType<TimePickerProps>;
}

export function SettingsPanel({
  settings,
  theme,
  updateSettings,
  bedtimePickerVisible,
  setBedtimePickerVisible,
  TimePicker,
}: SettingsPanelProps) {
  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Alarm Defaults */}
      <Text style={[styles.sectionHeader, { color: theme.textMuted }]}>Alarm Defaults</Text>
      <View style={[styles.card, { backgroundColor: theme.card }]}>
        <TouchableOpacity
          style={styles.item}
          onPress={() => {
            const currentIndex = WAKE_INTENSITY_OPTIONS.findIndex((o) => o.value === settings.defaultWakeIntensity);
            const nextIndex = (currentIndex + 1) % WAKE_INTENSITY_OPTIONS.length;
            updateSettings({ defaultWakeIntensity: WAKE_INTENSITY_OPTIONS[nextIndex].value });
          }}
        >
          <Text style={[styles.itemLabel, { color: theme.text }]}>Wake Intensity</Text>
          <Text style={[styles.itemValue, { color: theme.textMuted }]}>
            {WAKE_INTENSITY_OPTIONS.find((o) => o.value === settings.defaultWakeIntensity)?.label}
          </Text>
        </TouchableOpacity>
        <View style={[styles.divider, { backgroundColor: theme.surface }]} />
        <TouchableOpacity
          style={styles.item}
          onPress={() => {
            const currentIndex = SOUND_OPTIONS.findIndex((o) => o.value === settings.defaultSound);
            const nextIndex = (currentIndex + 1) % SOUND_OPTIONS.length;
            updateSettings({ defaultSound: SOUND_OPTIONS[nextIndex].value });
          }}
        >
          <Text style={[styles.itemLabel, { color: theme.text }]}>Sound</Text>
          <Text style={[styles.itemValue, { color: theme.textMuted }]}>
            {SOUND_OPTIONS.find((o) => o.value === settings.defaultSound)?.label}
          </Text>
        </TouchableOpacity>
        <View style={[styles.divider, { backgroundColor: theme.surface }]} />
        <TouchableOpacity
          style={styles.item}
          onPress={() => {
            const currentIndex = DISMISS_OPTIONS.findIndex((o) => o.value === settings.defaultDismissType);
            const nextIndex = (currentIndex + 1) % DISMISS_OPTIONS.length;
            updateSettings({ defaultDismissType: DISMISS_OPTIONS[nextIndex].value });
          }}
        >
          <Text style={[styles.itemLabel, { color: theme.text }]}>Dismiss Method</Text>
          <Text style={[styles.itemValue, { color: theme.textMuted }]}>
            {DISMISS_OPTIONS.find((o) => o.value === settings.defaultDismissType)?.label}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Sleep */}
      <Text style={[styles.sectionHeader, { color: theme.textMuted }]}>Sleep</Text>
      <View style={[styles.card, { backgroundColor: theme.card }]}>
        <View style={styles.itemRow}>
          <View style={styles.itemLabelContainer}>
            <Text style={[styles.itemLabel, { color: theme.text }]}>Bedtime Reminder</Text>
            {settings.bedtimeReminderEnabled && (
              <Text style={[styles.itemSubtext, { color: theme.textMuted }]}>
                Reminder at {formatTimeWithPeriod(
                  settings.bedtimeMinute < 30
                    ? (settings.bedtimeHour === 0 ? 23 : settings.bedtimeHour - 1)
                    : settings.bedtimeHour,
                  settings.bedtimeMinute < 30
                    ? settings.bedtimeMinute + 30
                    : settings.bedtimeMinute - 30
                )}
              </Text>
            )}
          </View>
          <Switch
            value={settings.bedtimeReminderEnabled}
            onValueChange={(val) => {
              updateSettings({ bedtimeReminderEnabled: val });
              if (val) setBedtimePickerVisible(true);
            }}
            trackColor={{ false: theme.switchTrackOff, true: theme.accent }}
            thumbColor={settings.bedtimeReminderEnabled ? '#FFFFFF' : theme.switchThumbOff}
          />
        </View>
        {settings.bedtimeReminderEnabled && bedtimePickerVisible && (
          <>
            <View style={[styles.divider, { backgroundColor: theme.surface }]} />
            <View style={styles.bedtimePicker}>
              <Text style={[styles.pickerLabel, { color: theme.text }]}>Target Bedtime</Text>
              <TimePicker
                hour={settings.bedtimeHour}
                minute={settings.bedtimeMinute}
                onHourChange={(h) => updateSettings({ bedtimeHour: h })}
                onMinuteChange={(m) => updateSettings({ bedtimeMinute: m })}
                hapticFeedback={settings.hapticFeedback}
                minuteStep={5}
              />
            </View>
          </>
        )}
        {settings.bedtimeReminderEnabled && !bedtimePickerVisible && (
          <>
            <View style={[styles.divider, { backgroundColor: theme.surface }]} />
            <TouchableOpacity
              style={styles.item}
              onPress={() => setBedtimePickerVisible(true)}
            >
              <Text style={[styles.itemLabel, { color: theme.text }]}>Target Bedtime</Text>
              <Text style={[styles.itemValue, { color: theme.textMuted }]}>
                {formatTimeWithPeriod(settings.bedtimeHour, settings.bedtimeMinute)}
              </Text>
            </TouchableOpacity>
          </>
        )}
        <View style={[styles.divider, { backgroundColor: theme.surface }]} />
        <TouchableOpacity
          style={styles.item}
          onPress={() => {
            const currentIndex = SLEEP_GOAL_OPTIONS.indexOf(settings.sleepGoalHours);
            const nextIndex = (currentIndex + 1) % SLEEP_GOAL_OPTIONS.length;
            updateSettings({ sleepGoalHours: SLEEP_GOAL_OPTIONS[nextIndex] });
          }}
        >
          <Text style={[styles.itemLabel, { color: theme.text }]}>Sleep Goal</Text>
          <Text style={[styles.itemValue, { color: theme.textMuted }]}>
            {settings.sleepGoalHours % 1 === 0
              ? `${settings.sleepGoalHours} hours`
              : `${Math.floor(settings.sleepGoalHours)}h ${(settings.sleepGoalHours % 1) * 60}m`}
          </Text>
        </TouchableOpacity>
      </View>

      {/* App */}
      <Text style={[styles.sectionHeader, { color: theme.textMuted }]}>App</Text>
      <View style={[styles.card, { backgroundColor: theme.card }]}>
        <View style={styles.itemRow}>
          <Text style={[styles.itemLabel, { color: theme.text }]}>Dark Mode</Text>
          <Switch
            value={settings.darkMode}
            onValueChange={(val) => updateSettings({ darkMode: val })}
            trackColor={{ false: theme.switchTrackOff, true: theme.accent }}
            thumbColor={settings.darkMode ? '#FFFFFF' : theme.switchThumbOff}
          />
        </View>
        <View style={[styles.divider, { backgroundColor: theme.surface }]} />
        <View style={styles.itemRow}>
          <Text style={[styles.itemLabel, { color: theme.text }]}>Haptic Feedback</Text>
          <Switch
            value={settings.hapticFeedback}
            onValueChange={(val) => updateSettings({ hapticFeedback: val })}
            trackColor={{ false: theme.switchTrackOff, true: theme.accent }}
            thumbColor={settings.hapticFeedback ? '#FFFFFF' : theme.switchThumbOff}
          />
        </View>
      </View>

      {/* About */}
      <Text style={[styles.sectionHeader, { color: theme.textMuted }]}>About</Text>
      <View style={[styles.card, { backgroundColor: theme.card }]}>
        <View style={styles.item}>
          <Text style={[styles.itemLabel, { color: theme.text }]}>Version</Text>
          <Text style={[styles.itemValue, { color: theme.textMuted }]}>1.0.0</Text>
        </View>
        <View style={[styles.divider, { backgroundColor: theme.surface }]} />
        <TouchableOpacity
          style={styles.item}
          onPress={() => Alert.alert('Rate SoftWake', 'This will open the app store. (Coming soon)')}
        >
          <Text style={[styles.itemLabel, { color: theme.text }]}>Rate SoftWake</Text>
          <Text style={[styles.itemChevron, { color: theme.textMuted }]}>›</Text>
        </TouchableOpacity>
        <View style={[styles.divider, { backgroundColor: theme.surface }]} />
        <TouchableOpacity
          style={styles.item}
          onPress={() => Alert.alert('Send Feedback', 'Feedback form coming soon.')}
        >
          <Text style={[styles.itemLabel, { color: theme.text }]}>Send Feedback</Text>
          <Text style={[styles.itemChevron, { color: theme.textMuted }]}>›</Text>
        </TouchableOpacity>
        <View style={[styles.divider, { backgroundColor: theme.surface }]} />
        <TouchableOpacity
          style={styles.item}
          onPress={() => Alert.alert('Privacy Policy', 'Privacy policy page coming soon.')}
        >
          <Text style={[styles.itemLabel, { color: theme.text }]}>Privacy Policy</Text>
          <Text style={[styles.itemChevron, { color: theme.textMuted }]}>›</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.footer} />
    </ScrollView>
  );
}

// Import Alert from react-native
import { Alert } from 'react-native';

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  sectionHeader: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
    marginTop: 16,
  },
  card: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  item: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  itemLabelContainer: {
    flex: 1,
  },
  itemLabel: {
    fontSize: 16,
    fontWeight: '500',
  },
  itemValue: {
    fontSize: 16,
  },
  itemSubtext: {
    fontSize: 13,
    marginTop: 2,
  },
  itemChevron: {
    fontSize: 20,
    fontWeight: '400',
  },
  divider: {
    height: 1,
    marginHorizontal: 20,
  },
  bedtimePicker: {
    padding: 20,
  },
  pickerLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  footer: {
    height: 40,
  },
});
