import React from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { formatTimeWithPeriod } from '../utils/timeFormatting';
import { THEMES } from '../constants/themes';

interface OptimalWakeTime {
  hour: number;
  minute: number;
  avgSleep: number;
}

interface SleepInsightModalProps {
  visible: boolean;
  insight: OptimalWakeTime | null;
  onCreateAlarm: (hour: number, minute: number) => void;
  onDismiss: () => void;
}

export function SleepInsightModal({
  visible,
  insight,
  onCreateAlarm,
  onDismiss,
}: SleepInsightModalProps) {
  if (!insight) return null;

  const avgHours = Math.floor(insight.avgSleep / 60);
  const avgMins = insight.avgSleep % 60;

  return (
    <Modal
      animationType="fade"
      transparent={true}
      visible={visible}
      onRequestClose={onDismiss}
    >
      <View style={styles.insightOverlay}>
        <View style={styles.insightContent}>
          <Text style={styles.insightTitle}>Sleep Insight</Text>
          <Text style={styles.insightText}>
            Based on your last 7 nights, you average{' '}
            <Text style={styles.insightHighlight}>
              {avgHours}h {avgMins}m
            </Text>{' '}
            of sleep.
          </Text>
          <Text style={styles.insightText}>
            For optimal rest (8 hours), try waking up at:
          </Text>
          <Text style={styles.insightTime}>
            {formatTimeWithPeriod(insight.hour, insight.minute)}
          </Text>
          <TouchableOpacity
            style={styles.insightButton}
            onPress={() => onCreateAlarm(insight.hour, insight.minute)}
            accessibilityLabel="Create alarm at optimal wake time"
            accessibilityRole="button"
          >
            <Text style={styles.insightButtonText}>Create Alarm</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.insightDismiss}
            onPress={onDismiss}
            accessibilityLabel="Dismiss sleep insight"
            accessibilityRole="button"
          >
            <Text style={styles.insightDismissText}>Dismiss</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  insightOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  insightContent: {
    backgroundColor: THEMES.dark.card,
    borderRadius: 24,
    padding: 24,
    width: '100%',
    alignItems: 'center',
  },
  insightTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: THEMES.dark.text,
    marginBottom: 20,
  },
  insightText: {
    fontSize: 16,
    color: THEMES.dark.textMuted,
    textAlign: 'center',
    marginBottom: 12,
    lineHeight: 24,
  },
  insightHighlight: {
    color: THEMES.dark.text,
    fontWeight: '600',
  },
  insightTime: {
    fontSize: 48,
    fontWeight: '300',
    color: THEMES.dark.text,
    marginVertical: 20,
  },
  insightButton: {
    backgroundColor: THEMES.dark.text,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 32,
    marginTop: 12,
  },
  insightButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: THEMES.dark.background,
  },
  insightDismiss: {
    paddingVertical: 16,
    marginTop: 8,
  },
  insightDismissText: {
    fontSize: 16,
    color: THEMES.dark.textDisabled,
  },
});
