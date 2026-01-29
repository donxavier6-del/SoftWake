/**
 * useAlarmDismiss hook - Manages alarm dismissal logic (breathing, shake, math, affirmation)
 *
 * Extracted from App.tsx as part of the refactoring initiative.
 * This hook handles:
 * - Breathing exercise state and animation
 * - Shake detection with Accelerometer
 * - Math problem state and validation
 * - Affirmation typing challenge
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { Animated } from 'react-native';
import { Accelerometer } from 'expo-sensors';
import * as Haptics from 'expo-haptics';
import { AFFIRMATIONS } from '../constants/options';
import { generateMathProblem } from '../utils/mathProblem';
import type { MathProblem } from '../types';

const SHAKE_THRESHOLD = 1.5;
const REQUIRED_SHAKES = 20;
const BREATHING_CYCLES_REQUIRED = 3;

export interface UseAlarmDismissReturn {
  // Breathing
  breathingPhase: 'inhale' | 'hold' | 'exhale' | 'complete';
  breathingCycle: number;
  breathingAnim: Animated.Value;
  startBreathingExercise: () => void;
  resetBreathing: () => void;

  // Shake
  shakeCount: number;
  shakeComplete: boolean;
  resetShake: () => void;

  // Affirmation
  affirmationText: string;
  setAffirmationText: (text: string) => void;
  targetAffirmation: string;
  affirmationComplete: boolean;
  checkAffirmation: (text: string) => boolean;
  resetAffirmation: () => void;

  // Math
  mathProblem: MathProblem;
  userAnswer: string;
  setUserAnswer: (answer: string) => void;
  wrongAnswer: boolean;
  mathComplete: boolean;
  checkMathAnswer: (answer: string) => boolean;
  resetMath: () => void;

  // Reset all
  resetAllDismiss: () => void;
}

export function useAlarmDismiss(
  isActive: boolean,
  dismissType: string,
  hapticFeedback: boolean
): UseAlarmDismissReturn {
  // === BREATHING EXERCISE STATE ===
  const [breathingPhase, setBreathingPhase] = useState<'inhale' | 'hold' | 'exhale' | 'complete'>('inhale');
  const [breathingCycle, setBreathingCycle] = useState(0);
  const breathingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const breathingAnim = useRef(new Animated.Value(0.4)).current;

  // === AFFIRMATION STATE ===
  const [affirmationText, setAffirmationText] = useState('');
  const [targetAffirmation, setTargetAffirmation] = useState(AFFIRMATIONS[0]);
  const [affirmationComplete, setAffirmationComplete] = useState(false);

  // === SHAKE DETECTION STATE ===
  const [shakeCount, setShakeCount] = useState(0);
  const [shakeComplete, setShakeComplete] = useState(false);
  const lastShakeTime = useRef<number>(0);

  // === MATH PROBLEM STATE ===
  const [mathProblem, setMathProblem] = useState<MathProblem>(generateMathProblem());
  const [userAnswer, setUserAnswer] = useState('');
  const [wrongAnswer, setWrongAnswer] = useState(false);
  const [mathComplete, setMathComplete] = useState(false);

  // === BREATHING LOGIC ===
  const animateBreathingCircle = useCallback((toValue: number, duration: number) => {
    Animated.timing(breathingAnim, {
      toValue,
      duration,
      useNativeDriver: false,
    }).start();
  }, [breathingAnim]);

  const startBreathingExercise = useCallback(() => {
    // Reset state
    setBreathingPhase('inhale');
    setBreathingCycle(0);
    breathingAnim.setValue(0.4);
    
    let cycle = 0;
    let phase: 'inhale' | 'hold' | 'exhale' | 'complete' = 'inhale';

    // Start first inhale animation
    animateBreathingCircle(1.0, 4000);

    const runPhase = () => {
      if (phase === 'inhale') {
        // Inhale done -> Hold (7 seconds, circle stays expanded)
        phase = 'hold';
        setBreathingPhase('hold');
        breathingTimerRef.current = setTimeout(runPhase, 7000);
      } else if (phase === 'hold') {
        // Hold done -> Exhale (8 seconds, circle contracts)
        phase = 'exhale';
        setBreathingPhase('exhale');
        animateBreathingCircle(0.4, 8000);
        breathingTimerRef.current = setTimeout(runPhase, 8000);
      } else if (phase === 'exhale') {
        // Exhale done -> next cycle or complete
        cycle++;
        setBreathingCycle(cycle);
        if (cycle >= BREATHING_CYCLES_REQUIRED) {
          phase = 'complete';
          setBreathingPhase('complete');
          // Auto-dismiss after showing "Good morning" for 2.5 seconds
          breathingTimerRef.current = setTimeout(() => {
            // Signal completion - parent should handle dismissal
          }, 2500);
        } else {
          // Start next inhale (4 seconds, circle expands)
          phase = 'inhale';
          setBreathingPhase('inhale');
          animateBreathingCircle(1.0, 4000);
          breathingTimerRef.current = setTimeout(runPhase, 4000);
        }
      }
    };

    // First inhale: 4 seconds
    breathingTimerRef.current = setTimeout(runPhase, 4000);
  }, [animateBreathingCircle, breathingAnim]);

  const resetBreathing = useCallback(() => {
    if (breathingTimerRef.current) {
      clearTimeout(breathingTimerRef.current);
      breathingTimerRef.current = null;
    }
    setBreathingPhase('inhale');
    setBreathingCycle(0);
    breathingAnim.setValue(0.4);
  }, [breathingAnim]);

  // Cleanup breathing timer when component unmounts
  useEffect(() => {
    return () => {
      if (breathingTimerRef.current) {
        clearTimeout(breathingTimerRef.current);
      }
    };
  }, []);

  // Cleanup breathing timer when not active
  useEffect(() => {
    if (!isActive && breathingTimerRef.current) {
      clearTimeout(breathingTimerRef.current);
      breathingTimerRef.current = null;
    }
  }, [isActive]);

  // === SHAKE DETECTION LOGIC ===
  useEffect(() => {
    if (!isActive || dismissType !== 'shake') {
      return;
    }

    const subscription = Accelerometer.addListener(({ x, y, z }) => {
      const totalForce = Math.sqrt(x * x + y * y + z * z);
      const now = Date.now();

      if (totalForce > SHAKE_THRESHOLD && now - lastShakeTime.current > 300) {
        lastShakeTime.current = now;
        setShakeCount((prev) => {
          if (prev >= REQUIRED_SHAKES) return prev;
          const newCount = prev + 1;
          if (newCount === REQUIRED_SHAKES) {
            setShakeComplete(true);
          }
          return newCount;
        });
      }
    });

    Accelerometer.setUpdateInterval(100);

    return () => {
      subscription.remove();
    };
  }, [isActive, dismissType]);

  const resetShake = useCallback(() => {
    setShakeCount(0);
    setShakeComplete(false);
    lastShakeTime.current = 0;
  }, []);

  // === AFFIRMATION LOGIC ===
  const checkAffirmation = useCallback((text: string): boolean => {
    if (text.toLowerCase().trim() === targetAffirmation.toLowerCase()) {
      setAffirmationComplete(true);
      return true;
    }
    return false;
  }, [targetAffirmation]);

  const resetAffirmation = useCallback(() => {
    setAffirmationText('');
    setTargetAffirmation(AFFIRMATIONS[Math.floor(Math.random() * AFFIRMATIONS.length)]);
    setAffirmationComplete(false);
  }, []);

  // === MATH LOGIC ===
  const checkMathAnswer = useCallback((answer: string): boolean => {
    // Validate numeric input
    const trimmed = answer.trim();
    if (trimmed === '' || !/^-?\d+$/.test(trimmed)) {
      // Invalid input - not a number
      setWrongAnswer(true);
      return false;
    }
    
    const numAnswer = parseInt(trimmed, 10);
    if (numAnswer === mathProblem.answer) {
      setMathComplete(true);
      return true;
    } else {
      setWrongAnswer(true);
      return false;
    }
  }, [mathProblem.answer]);

  const resetMath = useCallback(() => {
    setMathProblem(generateMathProblem());
    setUserAnswer('');
    setWrongAnswer(false);
    setMathComplete(false);
  }, []);

  // Clear wrong answer state after a delay
  useEffect(() => {
    if (wrongAnswer) {
      const timer = setTimeout(() => {
        setWrongAnswer(false);
        // Generate new problem on wrong answer
        setMathProblem(generateMathProblem());
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [wrongAnswer]);

  // === RESET ALL ===
  const resetAllDismiss = useCallback(() => {
    resetBreathing();
    resetShake();
    resetAffirmation();
    resetMath();
  }, [resetBreathing, resetShake, resetAffirmation, resetMath]);

  // Initialize target affirmation on mount
  useEffect(() => {
    setTargetAffirmation(AFFIRMATIONS[Math.floor(Math.random() * AFFIRMATIONS.length)]);
  }, []);

  return {
    // Breathing
    breathingPhase,
    breathingCycle,
    breathingAnim,
    startBreathingExercise,
    resetBreathing,

    // Shake
    shakeCount,
    shakeComplete,
    resetShake,

    // Affirmation
    affirmationText,
    setAffirmationText,
    targetAffirmation,
    affirmationComplete,
    checkAffirmation,
    resetAffirmation,

    // Math
    mathProblem,
    userAnswer,
    setUserAnswer,
    wrongAnswer,
    mathComplete,
    checkMathAnswer,
    resetMath,

    // Reset all
    resetAllDismiss,
  };
}
