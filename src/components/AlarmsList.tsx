/**
 * AlarmsList Component
 * Displays list of alarms with swipe-to-delete functionality
 */

import React from 'react';
import { ScrollView, View, Text, TouchableOpacity, Switch, StyleSheet } from 'react-native';
import { PanGestureHandler, HandlerStateChangeEvent } from 'react-native-gesture-handler';
import { DAYS } from '../constants/options';
import { FONTS } from '../constants/fonts';
import type { Alarm, Theme } from '../types';

interface AlarmsListProps {
  alarms: Alarm[];
  theme: Theme;
  onToggleAlarm: (id: string) => void;
  onEditAlarm: (alarm: Alarm) => void;
  onDeleteAlarm: (id: string) => void;
  formatAlarmTime: (hour: number, minute: number) => string;
}

const SWIPE_THRESHOLD = 80;

export function AlarmsList({
  alarms,
  theme,
  onToggleAlarm,
  onEditAlarm,
  onDeleteAlarm,
  formatAlarmTime,
}: AlarmsListProps) {
  const getRepeatText = (days: boolean[]) => {
    if (days.every((d) => !d)) return 'Once';
    if (days.every((d) => d)) return 'Every day';
    if (days.slice(1, 6).every((d) => d) && !days[0] && !days[6]) return 'Weekdays';
    if (days[0] && days[6] && days.slice(1, 6).every((d) => !d)) return 'Weekends';
    return days
      .map((selected, i) => (selected ? DAYS[i] : null))
      .filter(Boolean)
      .join(', ');
  };

  const createSwipeHandler = (alarmId: string) => {
    return (event: HandlerStateChangeEvent<Record<string, unknown>>) => {
      const { translationX, translationY } = event.nativeEvent as unknown as { translationX: number; translationY: number };
      // Swipe left (negative X) or swipe down (positive Y) to delete
      if (translationX < -SWIPE_THRESHOLD || translationY > SWIPE_THRESHOLD) {
        onDeleteAlarm(alarmId);
      }
    };
  };

  if (alarms.length === 0) {
    return (
      <View style={styles.container}>
        <Text style={[styles.noAlarmsText, { color: theme.textMuted }]}>No alarms set</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
      {alarms.map((alarm) => (
        <PanGestureHandler
          key={alarm.id}
          onEnded={createSwipeHandler(alarm.id)}
          activeOffsetX={[-20, 20]}
          activeOffsetY={[-20, 20]}
        >
          <View style={[
            styles.alarmItem,
            {
              backgroundColor: theme.cardGlass,
              borderColor: theme.cardBorder,
            },
          ]}>
            <TouchableOpacity
              style={styles.alarmInfo}
              onPress={() => onEditAlarm(alarm)}
              activeOpacity={0.7}
              accessibilityLabel={`Edit alarm at ${formatAlarmTime(alarm.hour, alarm.minute)}${alarm.label ? `, ${alarm.label}` : ''}`}
              accessibilityRole="button"
            >
              <Text style={[
                styles.alarmTime,
                { color: theme.text },
                !alarm.enabled && { color: theme.textDisabled },
              ]}>
                {formatAlarmTime(alarm.hour, alarm.minute)}
              </Text>
              <Text style={[
                styles.alarmDays,
                { color: theme.textMuted },
                !alarm.enabled && { color: theme.textDisabled },
              ]}>
                {alarm.label ? `${alarm.label} · ` : ''}{getRepeatText(alarm.days)}
                {alarm.wakeIntensity != null && alarm.wakeIntensity !== 'energetic' ? ` · ${alarm.wakeIntensity.charAt(0).toUpperCase() + alarm.wakeIntensity.slice(1)}` : ''}
              </Text>
            </TouchableOpacity>
            <Switch
              value={alarm.enabled}
              onValueChange={() => onToggleAlarm(alarm.id)}
              trackColor={{ false: theme.switchTrackOff, true: theme.accent }}
              thumbColor={alarm.enabled ? '#FFFFFF' : theme.switchThumbOff}
              accessibilityLabel={`${alarm.enabled ? 'Disable' : 'Enable'} alarm at ${formatAlarmTime(alarm.hour, alarm.minute)}`}
              accessibilityRole="switch"
            />
          </View>
        </PanGestureHandler>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  list: {
    flex: 1,
  },
  noAlarmsText: {
    textAlign: 'center',
    fontSize: 16,
    fontFamily: FONTS.regular,
    marginTop: 20,
  },
  alarmItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 18,
    borderRadius: 20,
    marginBottom: 12,
    borderWidth: 1,
  },
  alarmInfo: {
    flex: 1,
  },
  alarmTime: {
    fontSize: 28,
    fontFamily: FONTS.light,
    marginBottom: 4,
    letterSpacing: -0.5,
  },
  alarmDays: {
    fontSize: 14,
    fontFamily: FONTS.regular,
  },
});
