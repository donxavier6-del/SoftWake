import React from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { formatTimeWithPeriod } from '../utils/timeFormatting';

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
          >
            <Text style={styles.insightButtonText}>Create Alarm</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.insightDismiss}
            onPress={onDismiss}
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
    backgroundColor: '#1A1A1A',
    borderRadius: 24,
    padding: 24,
    width: '100%',
    alignItems: 'center',
  },
  insightTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 20,
  },
  insightText: {
    fontSize: 16,
    color: '#999999',
    textAlign: 'center',
    marginBottom: 12,
    lineHeight: 24,
  },
  insightHighlight: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  insightTime: {
    fontSize: 48,
    fontWeight: '300',
    color: '#FFFFFF',
    marginVertical: 20,
  },
  insightButton: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 32,
    marginTop: 12,
  },
  insightButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0D0D0D',
  },
  insightDismiss: {
    paddingVertical: 16,
    marginTop: 8,
  },
  insightDismissText: {
    fontSize: 16,
    color: '#666666',
  },
});
