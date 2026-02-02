/**
 * AlarmsTab Component
 * Main alarms view with clock display, countdown, and alarm list
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { AlarmsList } from './AlarmsList';
import { formatTimeObject, formatTimeWithPeriod } from '../utils/timeFormatting';
import type { Alarm, Theme } from '../types';

interface AlarmsTabProps {
  alarms: Alarm[];
  currentTime: Date;
  theme: Theme;
  showUndoToast: boolean;
  onAddAlarm: () => void;
  onEditAlarm: (alarm: Alarm) => void;
  onToggleAlarm: (id: string) => void;
  onDeleteAlarm: (id: string) => void;
  onUndoDelete: () => void;
}

export function AlarmsTab({
  alarms,
  currentTime,
  theme,
  showUndoToast,
  onAddAlarm,
  onEditAlarm,
  onToggleAlarm,
  onDeleteAlarm,
  onUndoDelete,
}: AlarmsTabProps) {
  const { time, ampm } = formatTimeObject(currentTime);

  const getNextAlarmCountdown = (): { hours: number; minutes: number } | null => {
    const enabledAlarms = alarms.filter(a => a.enabled);
    if (enabledAlarms.length === 0) return null;

    const now = currentTime;
    let minDiff = Infinity;

    for (const alarm of enabledAlarms) {
      if (alarm.days.some(d => d)) {
        // Recurring alarm - find next occurrence
        for (let i = 0; i < 7; i++) {
          const dayIndex = (now.getDay() + i) % 7;
          if (alarm.days[dayIndex]) {
            const candidate = new Date(now);
            candidate.setDate(now.getDate() + i);
            candidate.setHours(alarm.hour, alarm.minute, 0, 0);
            if (candidate.getTime() > now.getTime()) {
              const diff = candidate.getTime() - now.getTime();
              if (diff < minDiff) minDiff = diff;
              break;
            }
          }
        }
      } else {
        // One-time alarm
        const alarmDate = new Date(now);
        alarmDate.setHours(alarm.hour, alarm.minute, 0, 0);
        if (alarmDate.getTime() <= now.getTime()) {
          alarmDate.setDate(alarmDate.getDate() + 1);
        }
        const diff = alarmDate.getTime() - now.getTime();
        if (diff < minDiff) minDiff = diff;
      }
    }

    if (minDiff === Infinity) return null;

    const totalMinutes = Math.floor(minDiff / 60000);
    return {
      hours: Math.floor(totalMinutes / 60),
      minutes: totalMinutes % 60,
    };
  };

  const formatCountdownText = (): string => {
    const countdown = getNextAlarmCountdown();
    if (!countdown) return '';
    const { hours, minutes } = countdown;
    if (hours > 0 && minutes > 0) {
      return `${hours} hr ${minutes} min of rest ahead`;
    } else if (hours > 0) {
      return `${hours} hour${hours !== 1 ? 's' : ''} of rest ahead`;
    } else {
      return `${minutes} min of rest ahead`;
    }
  };

  const hasEnabledAlarms = alarms.some(a => a.enabled);

  return (
    <View style={styles.tabContent}>
      {/* Clock Display */}
      <View style={styles.clockContainer}>
        <Text style={[styles.timeText, { color: theme.text }]}>{time}</Text>
        <Text style={[styles.ampmText, { color: theme.textMuted }]}>{ampm}</Text>
      </View>

      {/* Date */}
      <Text style={[styles.dateText, { color: theme.textMuted }]}>
        {currentTime.toLocaleDateString('en-US', {
          weekday: 'long',
          month: 'long',
          day: 'numeric',
        })}
      </Text>

      {/* Countdown */}
      <View style={styles.countdownContainer}>
        {hasEnabledAlarms ? (
          <>
            <Text style={[styles.countdownIcon, { color: theme.textMuted }]}>{'\u263D'}</Text>
            <Text style={[styles.countdownText, { color: theme.textMuted }]}>{formatCountdownText()}</Text>
          </>
        ) : (
          <>
            <Text style={[styles.countdownIcon, { color: theme.textMuted }]}>{'\u2606'}</Text>
            <Text style={[styles.countdownText, { color: theme.textMuted }]}>No alarms set {'\u2014'} sleep well tonight</Text>
          </>
        )}
      </View>

      {/* Alarms List */}
      <View style={styles.alarmsContainer}>
        <Text style={[styles.sectionTitle, { color: theme.textMuted }]}>Alarms</Text>
        <AlarmsList
          alarms={alarms}
          theme={theme}
          onToggleAlarm={onToggleAlarm}
          onEditAlarm={onEditAlarm}
          onDeleteAlarm={onDeleteAlarm}
          formatAlarmTime={formatTimeWithPeriod}
        />
      </View>

      {/* Add Button */}
      <TouchableOpacity
        style={[styles.addButton, { backgroundColor: theme.accent }]}
        onPress={onAddAlarm}
        accessibilityLabel="Add new alarm"
        accessibilityRole="button"
      >
        <Text style={styles.addButtonText}>+</Text>
      </TouchableOpacity>

      {/* Undo Toast */}
      {showUndoToast && (
        <View style={styles.undoToast}>
          <Text style={styles.undoToastText}>Alarm deleted</Text>
          <TouchableOpacity onPress={onUndoDelete} accessibilityLabel="Undo delete" accessibilityRole="button">
            <Text style={styles.undoButton}>Undo</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  tabContent: {
    flex: 1,
    paddingTop: 60,
    paddingHorizontal: 24,
  },
  clockContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
    marginTop: 40,
  },
  timeText: {
    fontSize: 96,
    fontWeight: '200',
    letterSpacing: -4,
  },
  ampmText: {
    fontSize: 24,
    fontWeight: '400',
    marginLeft: 8,
  },
  dateText: {
    fontSize: 18,
    textAlign: 'center',
    marginTop: 8,
  },
  countdownContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  countdownIcon: {
    fontSize: 18,
    marginRight: 8,
    opacity: 0.7,
  },
  countdownText: {
    fontSize: 15,
    fontWeight: '300',
    letterSpacing: 0.3,
  },
  alarmsContainer: {
    flex: 1,
    marginTop: 24,
    marginHorizontal: -24,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 16,
    paddingHorizontal: 24,
  },
  addButton: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#818CF8',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  addButtonText: {
    fontSize: 28,
    fontWeight: '300',
    color: '#FFFFFF',
    marginTop: -2,
  },
  undoToast: {
    position: 'absolute',
    bottom: 100,
    left: 24,
    right: 24,
    backgroundColor: '#333333',
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 1000,
  },
  undoToastText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '500',
  },
  undoButton: {
    color: '#818CF8',
    fontSize: 15,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
});
