/**
 * AlarmScreen Component
 *
 * Displays the alarm dismiss screen with various challenge types:
 * - Breathing exercise
 * - Shake to dismiss
 * - Math problem
 * - Simple dismiss
 */

import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  Modal,
  Animated,
  StyleSheet,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Alarm, MathProblem, Theme } from '../types';
import { formatTimeWithPeriod } from '../utils/timeFormatting';

// Constants from App.tsx
const REQUIRED_SHAKES = 20;
const BREATHING_CYCLES_REQUIRED = 3;

interface AlarmScreenProps {
  visible: boolean;
  activeAlarm: Alarm | null;
  theme: Theme;
  // Breathing state
  breathingPhase: 'inhale' | 'hold' | 'exhale' | 'complete';
  breathingCycle: number;
  breathingAnim: Animated.Value;
  // Affirmation state
  affirmationComplete?: boolean;
  targetAffirmation?: string;
  affirmationText?: string;
  onAffirmationChange?: (text: string) => void;
  // Shake state
  shakeComplete?: boolean;
  shakeCount?: number;
  // Math state
  mathComplete?: boolean;
  mathProblem: MathProblem | null;
  userAnswer?: string;
  wrongAnswer?: boolean;
  onMathAnswerChange?: (text: string) => void;
  onMathSubmit?: () => void;
  // Actions
  onSnooze: () => void;
  onDismiss: () => void;
  onSimpleDismiss: () => void;
}

export function AlarmScreen({
  visible,
  activeAlarm,
  theme,
  breathingPhase,
  breathingCycle,
  breathingAnim,
  affirmationComplete = false,
  targetAffirmation = '',
  affirmationText = '',
  onAffirmationChange,
  shakeComplete = false,
  shakeCount = 0,
  mathComplete = false,
  mathProblem,
  userAnswer = '',
  wrongAnswer = false,
  onMathAnswerChange,
  onMathSubmit,
  onSnooze,
  onDismiss,
  onSimpleDismiss,
}: AlarmScreenProps) {
  const handleAffirmationChange = (text: string) => {
    onAffirmationChange?.(text);
  };

  const handleMathAnswerChange = (text: string) => {
    onMathAnswerChange?.(text);
  };

  return (
    <Modal
      animationType="fade"
      transparent={false}
      visible={visible}
      onRequestClose={() => {}}
    >
      {activeAlarm?.dismissType === 'breathing' ? (
        <LinearGradient
          colors={['#1a1a3e', '#2d1b69', '#1a3a5c']}
          style={styles.breathingScreen}
        >
          {breathingPhase === 'complete' ? (
            <View style={styles.breathingCompleteContainer}>
              <Text style={styles.breathingGoodMorning}>Good morning</Text>
              {activeAlarm?.label ? (
                <Text style={styles.breathingCompleteLabel}>{activeAlarm.label}</Text>
              ) : null}
            </View>
          ) : (
            <View style={styles.breathingContent}>
              <Text style={styles.breathingTimeText}>
                {activeAlarm ? formatTimeWithPeriod(activeAlarm.hour, activeAlarm.minute) : ''}
              </Text>
              <View style={styles.breathingCircleContainer}>
                <Animated.View
                  style={[
                    styles.breathingCircle,
                    {
                      transform: [{ scale: breathingAnim }],
                      opacity: breathingAnim.interpolate({
                        inputRange: [0.4, 1.0],
                        outputRange: [0.6, 1.0],
                      }),
                    },
                  ]}
                />
                <View style={styles.breathingCircleInner}>
                  <Text style={styles.breathingPhaseLabel}>
                    {breathingPhase === 'inhale' && 'Breathe in'}
                    {breathingPhase === 'hold' && 'Hold'}
                    {breathingPhase === 'exhale' && 'Breathe out'}
                  </Text>
                  <Text style={styles.breathingPhaseDuration}>
                    {breathingPhase === 'inhale' && '4 seconds'}
                    {breathingPhase === 'hold' && '7 seconds'}
                    {breathingPhase === 'exhale' && '8 seconds'}
                  </Text>
                </View>
              </View>
              <Text style={styles.breathingCycleProgress}>
                Breath {breathingCycle + 1} of {BREATHING_CYCLES_REQUIRED}
              </Text>
            </View>
          )}
        </LinearGradient>
      ) : activeAlarm?.dismissType === 'affirmation' ? (
        <LinearGradient
          colors={['#0a0a1a', '#1a1a2e', '#0f0f23']}
          style={styles.affirmationScreen}
        >
          {affirmationComplete ? (
            <View style={styles.affirmationCompleteContainer}>
              <Text style={styles.affirmationWellDone}>Well done</Text>
            </View>
          ) : (
            <View style={styles.affirmationContent}>
              <Text style={styles.affirmationPrompt}>Type to start your day</Text>
              <View style={styles.affirmationTargetContainer}>
                <View style={styles.affirmationCharRow}>
                  {targetAffirmation.split('').map((char, index) => {
                    const isTyped = index < affirmationText.length;
                    const isCorrect = isTyped && affirmationText[index]?.toLowerCase() === char.toLowerCase();
                    const isWrong = isTyped && !isCorrect;
                    return (
                      <Text
                        key={index}
                        style={[
                          styles.affirmationChar,
                          isCorrect && styles.affirmationCharCorrect,
                          isWrong && styles.affirmationCharWrong,
                        ]}
                      >
                        {char}
                      </Text>
                    );
                  })}
                </View>
              </View>
              <TextInput
                style={styles.affirmationInput}
                value={affirmationText}
                onChangeText={handleAffirmationChange}
                placeholder="Start typing..."
                placeholderTextColor="rgba(255, 255, 255, 0.3)"
                autoCapitalize="none"
                autoCorrect={false}
                autoFocus
              />
            </View>
          )}
        </LinearGradient>
      ) : activeAlarm?.dismissType === 'shake' ? (
        <LinearGradient
          colors={['#0a0a1a', '#1a1a2e', '#0f0f23']}
          style={styles.shakeScreen}
        >
          {shakeComplete ? (
            <View style={styles.shakeCompleteContainer}>
              <Text style={styles.shakeCompleteText}>You're awake!</Text>
            </View>
          ) : (
            <View style={styles.shakeContent}>
              <Text style={styles.shakePrompt}>Shake your phone to wake up</Text>
              <Text style={styles.shakeScreenIcon}>📳</Text>
              <View style={styles.shakeProgressContainer}>
                <View style={styles.shakeProgressBar}>
                  <View
                    style={[
                      styles.shakeProgressFill,
                      { width: `${(shakeCount / REQUIRED_SHAKES) * 100}%` },
                    ]}
                  />
                </View>
                <Text style={styles.shakeProgressText}>
                  {shakeCount} / {REQUIRED_SHAKES}
                </Text>
              </View>
            </View>
          )}
        </LinearGradient>
      ) : activeAlarm?.dismissType === 'math' ? (
        <LinearGradient
          colors={['#0a0a1a', '#1a1a2e', '#0f0f23']}
          style={styles.mathScreen}
        >
          {mathComplete ? (
            <View style={styles.mathCompleteContainer}>
              <Text style={styles.mathCompleteText}>Correct!</Text>
            </View>
          ) : (
            <View style={styles.mathContent}>
              <Text style={styles.mathPrompt}>Solve to start your day</Text>
              <Text style={styles.mathProblemText}>{mathProblem?.question} = ?</Text>
              <TextInput
                style={[
                  styles.mathInputField,
                  wrongAnswer && styles.mathInputFieldWrong,
                ]}
                value={userAnswer}
                onChangeText={handleMathAnswerChange}
                keyboardType="number-pad"
                placeholder="Your answer"
                placeholderTextColor="rgba(255, 255, 255, 0.3)"
                autoFocus
              />
              <TouchableOpacity
                style={styles.mathSubmitButton}
                onPress={onMathSubmit}
              >
                <Text style={styles.mathSubmitButtonText}>Submit</Text>
              </TouchableOpacity>
            </View>
          )}
        </LinearGradient>
      ) : (
        <View style={styles.alarmScreen}>
          <Text style={styles.alarmScreenTime}>
            {activeAlarm ? formatTimeWithPeriod(activeAlarm.hour, activeAlarm.minute) : ''}
          </Text>
          {activeAlarm?.label ? (
            <Text style={styles.alarmScreenLabel}>{activeAlarm.label}</Text>
          ) : null}
          <View style={styles.simpleDismissContainer}>
            <TouchableOpacity
              style={styles.stopButton}
              onPress={onSimpleDismiss}
            >
              <Text style={styles.stopButtonText}>Stop</Text>
            </TouchableOpacity>
          </View>
          {activeAlarm && activeAlarm.snooze > 0 && (
            <TouchableOpacity
              style={styles.snoozeButton}
              onPress={onSnooze}
            >
              <Text style={styles.snoozeButtonText}>
                Snooze ({activeAlarm.snooze} min)
              </Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </Modal>
  );
}

const styles = StyleSheet.create({
  // Alarm Screen (Simple)
  alarmScreen: {
    flex: 1,
    backgroundColor: '#0D0D0D',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  alarmScreenTime: {
    fontSize: 72,
    fontWeight: '200',
    color: '#FFFFFF',
  },
  alarmScreenLabel: {
    fontSize: 24,
    color: '#666666',
    marginTop: 16,
  },
  simpleDismissContainer: {
    width: '100%',
    alignItems: 'center',
    marginTop: 40,
  },
  stopButton: {
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: '#818CF8',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#818CF8',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 10,
  },
  stopButtonText: {
    fontSize: 32,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 2,
  },
  snoozeButton: {
    marginTop: 16,
    paddingVertical: 16,
    paddingHorizontal: 32,
  },
  snoozeButtonText: {
    fontSize: 16,
    color: '#666666',
  },

  // Breathing Screen
  breathingScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  breathingContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  breathingTimeText: {
    fontSize: 48,
    fontWeight: '200',
    color: 'rgba(255, 255, 255, 0.6)',
    marginBottom: 40,
  },
  breathingCircleContainer: {
    width: 220,
    height: 220,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 48,
  },
  breathingCircle: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: 'rgba(129, 140, 248, 0.25)',
    borderWidth: 2,
    borderColor: 'rgba(129, 140, 248, 0.6)',
  },
  breathingCircleInner: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  breathingPhaseLabel: {
    fontSize: 24,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  breathingPhaseDuration: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.5)',
  },
  breathingCycleProgress: {
    fontSize: 16,
    fontWeight: '500',
    color: 'rgba(255, 255, 255, 0.5)',
  },
  breathingCompleteContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  breathingGoodMorning: {
    fontSize: 36,
    fontWeight: '300',
    color: '#FFFFFF',
    marginBottom: 12,
  },
  breathingCompleteLabel: {
    fontSize: 18,
    color: 'rgba(255, 255, 255, 0.6)',
  },

  // Affirmation Screen
  affirmationScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  affirmationContent: {
    width: '100%',
    alignItems: 'center',
  },
  affirmationPrompt: {
    fontSize: 18,
    fontWeight: '300',
    color: 'rgba(255, 255, 255, 0.6)',
    marginBottom: 32,
    letterSpacing: 0.5,
  },
  affirmationTargetContainer: {
    width: '100%',
    alignItems: 'center',
    marginBottom: 40,
    paddingHorizontal: 8,
  },
  affirmationCharRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  affirmationChar: {
    fontSize: 28,
    fontWeight: '500',
    color: 'rgba(255, 255, 255, 0.4)',
    letterSpacing: 1,
  },
  affirmationCharCorrect: {
    color: '#4ADE80',
  },
  affirmationCharWrong: {
    color: '#F87171',
  },
  affirmationInput: {
    width: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 16,
    paddingVertical: 18,
    paddingHorizontal: 20,
    fontSize: 18,
    color: '#FFFFFF',
    textAlign: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  affirmationCompleteContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  affirmationWellDone: {
    fontSize: 32,
    fontWeight: '300',
    color: '#4ADE80',
    letterSpacing: 1,
  },

  // Shake Screen
  shakeScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  shakeContent: {
    width: '100%',
    alignItems: 'center',
  },
  shakePrompt: {
    fontSize: 18,
    fontWeight: '300',
    color: 'rgba(255, 255, 255, 0.6)',
    marginBottom: 40,
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  shakeScreenIcon: {
    fontSize: 80,
    marginBottom: 48,
  },
  shakeProgressContainer: {
    width: '100%',
    alignItems: 'center',
  },
  shakeProgressBar: {
    width: '100%',
    height: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 16,
  },
  shakeProgressFill: {
    height: '100%',
    backgroundColor: '#818CF8',
    borderRadius: 4,
  },
  shakeProgressText: {
    fontSize: 18,
    color: 'rgba(255, 255, 255, 0.5)',
    fontWeight: '500',
  },
  shakeCompleteContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  shakeCompleteText: {
    fontSize: 32,
    fontWeight: '300',
    color: '#4ADE80',
    letterSpacing: 1,
  },

  // Math Screen
  mathScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  mathContent: {
    width: '100%',
    alignItems: 'center',
  },
  mathPrompt: {
    fontSize: 18,
    fontWeight: '300',
    color: 'rgba(255, 255, 255, 0.6)',
    marginBottom: 32,
    letterSpacing: 0.5,
  },
  mathProblemText: {
    fontSize: 42,
    fontWeight: '300',
    color: '#FFFFFF',
    marginBottom: 48,
    letterSpacing: 1,
  },
  mathInputField: {
    width: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 16,
    paddingVertical: 18,
    paddingHorizontal: 20,
    fontSize: 24,
    color: '#FFFFFF',
    textAlign: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    marginBottom: 24,
  },
  mathInputFieldWrong: {
    borderColor: '#F87171',
    backgroundColor: 'rgba(248, 113, 113, 0.1)',
  },
  mathSubmitButton: {
    width: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  mathSubmitButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  mathCompleteContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  mathCompleteText: {
    fontSize: 32,
    fontWeight: '300',
    color: '#4ADE80',
    letterSpacing: 1,
  },
});
