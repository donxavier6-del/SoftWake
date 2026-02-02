/**
 * InsightsChart Component
 * Displays sleep insights including weekly chart, stats, and tips
 */

import React from 'react';
import { ScrollView, View, Text, StyleSheet } from 'react-native';
import type { SleepEntry, Settings, Theme, SleepStatsResult, WeeklyDataPoint } from '../types';
import { THEMES } from '../constants/themes';

interface InsightsChartProps {
  sleepData: SleepEntry[];
  settings: Settings;
  theme: Theme;
  getWeeklyData: () => WeeklyDataPoint[];
  getSleepStats: () => SleepStatsResult | null;
}

export function InsightsChart({
  sleepData,
  settings,
  theme,
  getWeeklyData,
  getSleepStats,
}: InsightsChartProps) {
  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false} accessibilityLabel="Sleep insights">
      <Text style={[styles.title, { color: theme.text }]} accessibilityRole="header">Sleep Insights</Text>

      {sleepData.length === 0 ? (
        /* Empty State */
        <View style={[styles.card, { backgroundColor: theme.card, alignItems: 'center', paddingVertical: 40 }]}>
          <Text style={{ fontSize: 48, marginBottom: 16 }}>😴</Text>
          <Text style={[styles.cardLabel, { color: theme.text, fontSize: 18, marginBottom: 8 }]}>No Sleep Data Yet</Text>
          <Text style={{ color: theme.textMuted, textAlign: 'center' }}>
            Dismiss alarms to start tracking your sleep patterns
          </Text>
        </View>
      ) : (
        <>
          {/* Weekly Sleep Chart */}
          <View style={[styles.card, { backgroundColor: theme.card }]}>
            <Text style={[styles.cardLabel, { color: theme.textMuted }]}>This Week</Text>
            <View style={styles.chart}>
              {getWeeklyData().map((d, i) => {
                const hrs = d.duration / 60;
                return (
                  <View key={i} style={styles.barCol} accessibilityLabel={`${d.day}, ${hrs > 0 ? `${hrs.toFixed(1)} hours` : 'no data'}`}>
                    <View style={[styles.barTrack, { backgroundColor: theme.surface }]}>
                      <View style={[styles.bar, { height: `${(hrs / 10) * 100}%`, backgroundColor: hrs > 0 ? theme.accent : theme.surface }]} />
                    </View>
                    <Text style={[styles.barLabel, { color: theme.textMuted }]}>{d.day.charAt(0)}</Text>
                  </View>
                );
              })}
            </View>
          </View>

          {/* Stats Row */}
          <View style={styles.statsRow}>
            <View style={[styles.statBox, { backgroundColor: theme.card }]} accessibilityLabel={`Average sleep: ${(() => { const stats = getSleepStats(); if (!stats) return 'no data'; const hrs = Math.floor(stats.average / 60); const mins = stats.average % 60; return `${hrs} hours ${mins} minutes`; })()}`}>
              <Text style={[styles.statValue, { color: theme.text }]}>
                {(() => {
                  const stats = getSleepStats();
                  if (!stats) return '-';
                  const hrs = Math.floor(stats.average / 60);
                  const mins = stats.average % 60;
                  return mins > 0 ? `${hrs}.${Math.round(mins / 6)} hrs` : `${hrs} hrs`;
                })()}
              </Text>
              <Text style={[styles.statLabel, { color: theme.textMuted }]}>Avg Sleep</Text>
            </View>
            <View style={[styles.statBox, { backgroundColor: theme.card }]} accessibilityLabel={`Sleep goal: ${settings.sleepGoalHours} hours`}>
              <Text style={[styles.statValue, { color: theme.text }]}>{settings.sleepGoalHours} hrs</Text>
              <Text style={[styles.statLabel, { color: theme.textMuted }]}>Sleep Goal</Text>
            </View>
          </View>

          {/* Sleep Debt Card */}
          <View style={[styles.card, { backgroundColor: theme.card }]}>
            <Text style={[styles.cardLabel, { color: theme.textMuted }]}>Sleep Debt</Text>
            <Text style={[styles.cardValue, { color: theme.text }]}>
              {(() => {
                const weeklyData = getWeeklyData();
                const daysWithData = weeklyData.filter(d => d.duration > 0);
                if (daysWithData.length === 0) return 'No data this week';
                const totalSlept = daysWithData.reduce((sum, d) => sum + d.duration, 0) / 60;
                const expectedSleep = daysWithData.length * settings.sleepGoalHours;
                const debt = expectedSleep - totalSlept;
                if (debt <= 0) return `You're ${Math.abs(debt).toFixed(1)} hrs ahead this week!`;
                return `You're ${debt.toFixed(1)} hrs behind this week`;
              })()}
            </Text>
          </View>

          {/* Tip Card */}
          <View style={[styles.card, styles.tipCard, { backgroundColor: theme.accentAlt }]}>
            <Text style={styles.tipLabel}>Tip</Text>
            <Text style={styles.tipText}>
              {(() => {
                const stats = getSleepStats();
                if (!stats) return 'Start tracking your sleep to get personalized tips';
                const avgHrs = stats.average / 60;
                if (avgHrs < settings.sleepGoalHours - 1) return 'Try going to bed 30 minutes earlier tonight';
                if (avgHrs < settings.sleepGoalHours) return 'Try going to bed 15 minutes earlier tonight';
                return 'Great job! Keep maintaining your sleep schedule';
              })()}
            </Text>
          </View>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 20,
  },
  card: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
  },
  cardLabel: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 12,
  },
  cardValue: {
    fontSize: 20,
    fontWeight: '600',
  },
  chart: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    height: 120,
    paddingTop: 20,
  },
  barCol: {
    flex: 1,
    alignItems: 'center',
  },
  barTrack: {
    width: 24,
    height: 80,
    borderRadius: 12,
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  bar: {
    width: '100%',
    borderRadius: 12,
  },
  barLabel: {
    marginTop: 8,
    fontSize: 12,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  statBox: {
    flex: 1,
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
  },
  tipCard: {
    borderRadius: 16,
    padding: 20,
  },
  tipLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: THEMES.dark.textMuted,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  tipText: {
    fontSize: 16,
    fontWeight: '500',
    color: THEMES.dark.text,
    lineHeight: 22,
  },
});
