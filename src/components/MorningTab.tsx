import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import * as Haptics from 'expo-haptics';
import type { Theme } from '../types';

interface MorningTabProps {
  theme: Theme;
  hapticFeedback: boolean;
}

export function MorningTab({ theme, hapticFeedback }: MorningTabProps) {
  const getGreeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  };

  const handleDeepBreath = () => {
    if (hapticFeedback) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Alert.alert('Deep Breath', 'Breathe in... hold... breathe out...');
  };

  const handleSetIntention = () => {
    if (hapticFeedback) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Alert.alert('Set Intention', 'What do you want to focus on today?');
  };

  return (
    <View style={styles.tabContent}>
      <View style={styles.morningContainer}>
        <Text style={[styles.morningGreeting, { color: theme.text }]}>
          {getGreeting()}
        </Text>
        <Text style={[styles.morningQuote, { color: theme.textMuted }]}>
          "Today is full of possibilities"
        </Text>
        <View style={styles.morningButtons}>
          <TouchableOpacity
            style={[styles.morningButton, { backgroundColor: theme.card }]}
            onPress={handleDeepBreath}
          >
            <Text style={styles.morningButtonIcon}>🌬️</Text>
            <Text style={[styles.morningButtonLabel, { color: theme.text }]}>Deep Breath</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.morningButton, { backgroundColor: theme.card }]}
            onPress={handleSetIntention}
          >
            <Text style={styles.morningButtonIcon}>🎯</Text>
            <Text style={[styles.morningButtonLabel, { color: theme.text }]}>Set Intention</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  tabContent: {
    flex: 1,
    paddingTop: 60,
    paddingHorizontal: 24,
  },
  morningContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  morningGreeting: {
    fontSize: 32,
    fontWeight: '700',
    marginBottom: 12,
  },
  morningQuote: {
    fontSize: 16,
    fontStyle: 'italic',
    textAlign: 'center',
    marginBottom: 48,
  },
  morningButtons: {
    flexDirection: 'row',
    gap: 16,
  },
  morningButton: {
    borderRadius: 16,
    paddingVertical: 20,
    paddingHorizontal: 24,
    alignItems: 'center',
    minWidth: 130,
  },
  morningButtonIcon: {
    fontSize: 28,
    marginBottom: 8,
  },
  morningButtonLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
});
