import { renderHook, act, waitFor } from '@testing-library/react-native';
import { Animated } from 'react-native';
import { Accelerometer } from 'expo-sensors';
import * as Haptics from 'expo-haptics';
import { useAlarmDismiss, UseAlarmDismissReturn } from '../../hooks/useAlarmDismiss';
import { AFFIRMATIONS } from '../../constants/options';
import { generateMathProblem } from '../../utils/mathProblem';
import type { DismissType } from '../../types';

// Mock dependencies
jest.mock('expo-sensors', () => ({
  Accelerometer: {
    addListener: jest.fn(),
    setUpdateInterval: jest.fn(),
  },
}));

jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  ImpactFeedbackStyle: {
    Light: 'light',
    Medium: 'medium',
    Heavy: 'heavy',
  },
}));

jest.mock('../../utils/mathProblem', () => ({
  generateMathProblem: jest.fn(),
}));

jest.useFakeTimers();

describe('useAlarmDismiss', () => {
  const mockAddListener = Accelerometer.addListener as jest.Mock;
  const mockSetUpdateInterval = Accelerometer.setUpdateInterval as jest.Mock;
  const mockGenerateMathProblem = generateMathProblem as jest.Mock;

  // Mock subscription object
  const mockSubscription = {
    remove: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.clearAllTimers();
    mockAddListener.mockReturnValue(mockSubscription);
    
    // Default math problem mock
    mockGenerateMathProblem.mockReturnValue({
      question: '10 + 5',
      answer: 15,
    });
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
  });

  describe('initialization', () => {
    it('should initialize with default breathing state', () => {
      const { result } = renderHook(() => useAlarmDismiss(true, 'simple', true));

      expect(result.current.breathingPhase).toBe('inhale');
      expect(result.current.breathingCycle).toBe(0);
      expect(result.current.breathingAnim).toBeInstanceOf(Animated.Value);
    });

    it('should initialize with default shake state', () => {
      const { result } = renderHook(() => useAlarmDismiss(true, 'simple', true));

      expect(result.current.shakeCount).toBe(0);
      expect(result.current.shakeComplete).toBe(false);
    });

    it('should initialize with default affirmation state', () => {
      const { result } = renderHook(() => useAlarmDismiss(true, 'simple', true));

      expect(result.current.affirmationText).toBe('');
      expect(result.current.affirmationComplete).toBe(false);
      expect(AFFIRMATIONS).toContain(result.current.targetAffirmation);
    });

    it('should initialize with default math state', () => {
      const { result } = renderHook(() => useAlarmDismiss(true, 'simple', true));

      expect(result.current.userAnswer).toBe('');
      expect(result.current.wrongAnswer).toBe(false);
      expect(result.current.mathComplete).toBe(false);
      expect(mockGenerateMathProblem).toHaveBeenCalled();
    });

    it('should initialize target affirmation from AFFIRMATIONS array', () => {
      const { result } = renderHook(() => useAlarmDismiss(true, 'simple', true));

      expect(result.current.targetAffirmation).toBeDefined();
      expect(typeof result.current.targetAffirmation).toBe('string');
    });
  });

  describe('breathing exercise', () => {
    it('should start at inhale phase', () => {
      const { result } = renderHook(() => useAlarmDismiss(true, 'breathing', true));
      expect(result.current.breathingPhase).toBe('inhale');
    });

    it('should progress through phases: inhale → hold → exhale', () => {
      const { result } = renderHook(() => useAlarmDismiss(true, 'breathing', true));

      // Start breathing exercise
      act(() => {
        result.current.startBreathingExercise();
      });

      expect(result.current.breathingPhase).toBe('inhale');

      // Advance past inhale (4 seconds)
      act(() => {
        jest.advanceTimersByTime(4000);
      });

      expect(result.current.breathingPhase).toBe('hold');

      // Advance past hold (7 seconds)
      act(() => {
        jest.advanceTimersByTime(7000);
      });

      expect(result.current.breathingPhase).toBe('exhale');
    });

    it('should complete after 3 cycles', () => {
      const { result } = renderHook(() => useAlarmDismiss(true, 'breathing', true));

      act(() => {
        result.current.startBreathingExercise();
      });

      // Complete 3 cycles (each cycle: 4s inhale + 7s hold + 8s exhale = 19s)
      act(() => {
        for (let i = 0; i < 3; i++) {
          jest.advanceTimersByTime(4000); // inhale
          jest.advanceTimersByTime(7000); // hold
          jest.advanceTimersByTime(8000); // exhale
        }
      });

      expect(result.current.breathingCycle).toBe(3);
      expect(result.current.breathingPhase).toBe('complete');
    });

    it('should set up auto-dismiss timeout after completion', () => {
      const { result } = renderHook(() => useAlarmDismiss(true, 'breathing', true));

      act(() => {
        result.current.startBreathingExercise();
      });

      // Complete 3 cycles to reach 'complete' phase
      act(() => {
        for (let i = 0; i < 3; i++) {
          jest.advanceTimersByTime(4000); // inhale
          jest.advanceTimersByTime(7000); // hold
          jest.advanceTimersByTime(8000); // exhale
        }
      });

      expect(result.current.breathingPhase).toBe('complete');

      // The auto-dismiss timeout (2.5s) should execute without errors
      // This covers the callback at line 126-128 in useAlarmDismiss.ts
      act(() => {
        jest.advanceTimersByTime(2500);
      });

      // Phase should still be 'complete' (callback is empty, just signals completion)
      expect(result.current.breathingPhase).toBe('complete');
      expect(result.current.breathingCycle).toBe(3);
    });

    it('should track breathing cycle count correctly', () => {
      const { result } = renderHook(() => useAlarmDismiss(true, 'breathing', true));

      act(() => {
        result.current.startBreathingExercise();
      });

      expect(result.current.breathingCycle).toBe(0);

      // Complete 1 cycle
      act(() => {
        jest.advanceTimersByTime(4000); // inhale
        jest.advanceTimersByTime(7000); // hold
        jest.advanceTimersByTime(8000); // exhale
      });

      expect(result.current.breathingCycle).toBe(1);

      // Complete 2nd cycle
      act(() => {
        jest.advanceTimersByTime(4000); // inhale
        jest.advanceTimersByTime(7000); // hold
        jest.advanceTimersByTime(8000); // exhale
      });

      expect(result.current.breathingCycle).toBe(2);
    });

    it('should reset breathing state with resetBreathing', () => {
      const { result } = renderHook(() => useAlarmDismiss(true, 'breathing', true));

      act(() => {
        result.current.startBreathingExercise();
      });

      // Advance to second cycle
      act(() => {
        jest.advanceTimersByTime(4000); // inhale
        jest.advanceTimersByTime(7000); // hold
        jest.advanceTimersByTime(8000); // exhale
      });

      expect(result.current.breathingCycle).toBe(1);

      act(() => {
        result.current.resetBreathing();
      });

      expect(result.current.breathingPhase).toBe('inhale');
      expect(result.current.breathingCycle).toBe(0);
    });

    it('should reset breathing animation value on reset', () => {
      const { result } = renderHook(() => useAlarmDismiss(true, 'breathing', true));

      const setValueSpy = jest.spyOn(result.current.breathingAnim, 'setValue');

      act(() => {
        result.current.resetBreathing();
      });

      expect(setValueSpy).toHaveBeenCalledWith(0.4);
      setValueSpy.mockRestore();
    });

    it('should clear timers when resetBreathing is called', () => {
      const { result } = renderHook(() => useAlarmDismiss(true, 'breathing', true));

      act(() => {
        result.current.startBreathingExercise();
      });

      // Reset should clear timers without errors
      act(() => {
        result.current.resetBreathing();
      });

      // Advance time - should not cause phase changes
      act(() => {
        jest.advanceTimersByTime(10000);
      });

      expect(result.current.breathingPhase).toBe('inhale');
    });
  });

  describe('shake detection', () => {
    it('should not subscribe to accelerometer when not active', () => {
      renderHook(() => useAlarmDismiss(false, 'shake', true));

      expect(mockAddListener).not.toHaveBeenCalled();
    });

    it('should not subscribe to accelerometer when dismiss type is not shake', () => {
      renderHook(() => useAlarmDismiss(true, 'simple', true));

      expect(mockAddListener).not.toHaveBeenCalled();
    });

    it('should subscribe to accelerometer when active and dismiss type is shake', () => {
      renderHook(() => useAlarmDismiss(true, 'shake', true));

      expect(mockAddListener).toHaveBeenCalled();
      expect(mockSetUpdateInterval).toHaveBeenCalledWith(100);
    });

    it('should count shakes when accelerometer detects motion above threshold', () => {
      const { result } = renderHook(() => useAlarmDismiss(true, 'shake', true));

      // Get the listener callback
      const listenerCallback = mockAddListener.mock.calls[0][0];

      // Simulate shake above threshold (1.5)
      act(() => {
        listenerCallback({ x: 2, y: 0, z: 0 }); // force = 2.0
      });

      expect(result.current.shakeCount).toBe(1);
    });

    it('should not count shakes below threshold', () => {
      const { result } = renderHook(() => useAlarmDismiss(true, 'shake', true));

      const listenerCallback = mockAddListener.mock.calls[0][0];

      // Simulate shake below threshold
      act(() => {
        listenerCallback({ x: 1, y: 0, z: 0 }); // force = 1.0
      });

      expect(result.current.shakeCount).toBe(0);
    });

    it('should mark complete after 20 shakes', () => {
      const { result } = renderHook(() => useAlarmDismiss(true, 'shake', true));

      const listenerCallback = mockAddListener.mock.calls[0][0];

      // Simulate 20 shakes with proper debounce timing
      act(() => {
        for (let i = 0; i < 20; i++) {
          if (i > 0) {
            jest.advanceTimersByTime(301); // Advance past debounce
          }
          listenerCallback({ x: 2, y: 0, z: 0 });
        }
      });

      expect(result.current.shakeCount).toBe(20);
      expect(result.current.shakeComplete).toBe(true);
    });

    it('should not count shakes more than once within 300ms debounce', () => {
      const { result } = renderHook(() => useAlarmDismiss(true, 'shake', true));

      const listenerCallback = mockAddListener.mock.calls[0][0];

      act(() => {
        listenerCallback({ x: 2, y: 0, z: 0 });
        listenerCallback({ x: 2, y: 0, z: 0 });
        listenerCallback({ x: 2, y: 0, z: 0 });
      });

      // Should only count once due to debounce
      expect(result.current.shakeCount).toBe(1);
    });

    it('should count multiple shakes spaced apart by 300ms', () => {
      const { result } = renderHook(() => useAlarmDismiss(true, 'shake', true));

      const listenerCallback = mockAddListener.mock.calls[0][0];

      act(() => {
        listenerCallback({ x: 2, y: 0, z: 0 });
      });

      // Advance time past debounce window
      act(() => {
        jest.advanceTimersByTime(301);
      });

      act(() => {
        listenerCallback({ x: 2, y: 0, z: 0 });
      });

      expect(result.current.shakeCount).toBe(2);
    });

    it('should not count shakes beyond 20', () => {
      const { result } = renderHook(() => useAlarmDismiss(true, 'shake', true));

      const listenerCallback = mockAddListener.mock.calls[0][0];

      // Simulate 25 shakes with proper debounce
      act(() => {
        for (let i = 0; i < 25; i++) {
          if (i > 0) {
            jest.advanceTimersByTime(301);
          }
          listenerCallback({ x: 2, y: 0, z: 0 });
        }
      });

      expect(result.current.shakeCount).toBe(20);
    });

    it('should unsubscribe from accelerometer on unmount', () => {
      const { unmount } = renderHook(() => useAlarmDismiss(true, 'shake', true));

      unmount();

      expect(mockSubscription.remove).toHaveBeenCalled();
    });

    it('should reset shake state with resetShake', () => {
      const { result } = renderHook(() => useAlarmDismiss(true, 'shake', true));

      const listenerCallback = mockAddListener.mock.calls[0][0];

      act(() => {
        for (let i = 0; i < 10; i++) {
          if (i > 0) {
            jest.advanceTimersByTime(301);
          }
          listenerCallback({ x: 2, y: 0, z: 0 });
        }
      });

      expect(result.current.shakeCount).toBe(10);

      act(() => {
        result.current.resetShake();
      });

      expect(result.current.shakeCount).toBe(0);
      expect(result.current.shakeComplete).toBe(false);
    });

    it('should unsubscribe when dismiss type changes from shake to simple', () => {
      const { rerender } = renderHook<
        UseAlarmDismissReturn,
        { isActive: boolean; dismissType: DismissType }
      >(
        ({ isActive, dismissType }: { isActive: boolean; dismissType: DismissType }) =>
          useAlarmDismiss(isActive, dismissType, true),
        {
          initialProps: { isActive: true, dismissType: 'shake' as DismissType },
        }
      );

      expect(mockAddListener).toHaveBeenCalledTimes(1);

      rerender({ isActive: true, dismissType: 'simple' });

      expect(mockSubscription.remove).toHaveBeenCalled();
    });

    it('should subscribe when dismiss type changes from simple to shake', () => {
      const { rerender } = renderHook<
        UseAlarmDismissReturn,
        { isActive: boolean; dismissType: DismissType }
      >(
        ({ isActive, dismissType }: { isActive: boolean; dismissType: DismissType }) =>
          useAlarmDismiss(isActive, dismissType, true),
        {
          initialProps: { isActive: true, dismissType: 'simple' as DismissType },
        }
      );

      expect(mockAddListener).not.toHaveBeenCalled();

      rerender({ isActive: true, dismissType: 'shake' });

      expect(mockAddListener).toHaveBeenCalledTimes(1);
    });
  });

  describe('affirmation challenge', () => {
    it('should check affirmation and set complete on match', () => {
      const { result } = renderHook(() => useAlarmDismiss(true, 'affirmation', true));
      
      const target = result.current.targetAffirmation;

      // Use act for the state update
      let matchResult: boolean;
      act(() => {
        matchResult = result.current.checkAffirmation(target);
      });

      expect(matchResult!).toBe(true);
      expect(result.current.affirmationComplete).toBe(true);
    });

    it('should validate affirmation case-insensitively', () => {
      const { result } = renderHook(() => useAlarmDismiss(true, 'affirmation', true));
      
      const target = result.current.targetAffirmation;

      let matchResult: boolean;
      act(() => {
        matchResult = result.current.checkAffirmation(target.toUpperCase());
      });

      expect(matchResult!).toBe(true);
      expect(result.current.affirmationComplete).toBe(true);
    });

    it('should validate affirmation with whitespace trimming', () => {
      const { result } = renderHook(() => useAlarmDismiss(true, 'affirmation', true));
      
      const target = result.current.targetAffirmation;

      let matchResult: boolean;
      act(() => {
        matchResult = result.current.checkAffirmation(`  ${target}  `);
      });

      expect(matchResult!).toBe(true);
    });

    it('should return false for non-matching text', () => {
      const { result } = renderHook(() => useAlarmDismiss(true, 'affirmation', true));

      let matchResult: boolean;
      act(() => {
        matchResult = result.current.checkAffirmation('wrong affirmation text');
      });

      expect(matchResult!).toBe(false);
      expect(result.current.affirmationComplete).toBe(false);
    });

    it('should allow setting affirmation text', () => {
      const { result } = renderHook(() => useAlarmDismiss(true, 'affirmation', true));

      act(() => {
        result.current.setAffirmationText('some text');
      });

      expect(result.current.affirmationText).toBe('some text');
    });

    it('should reset affirmation with resetAffirmation', () => {
      const { result } = renderHook(() => useAlarmDismiss(true, 'affirmation', true));
      
      const target = result.current.targetAffirmation;

      act(() => {
        result.current.setAffirmationText('typed text');
      });

      act(() => {
        result.current.checkAffirmation(target);
      });

      expect(result.current.affirmationComplete).toBe(true);

      act(() => {
        result.current.resetAffirmation();
      });

      expect(result.current.affirmationText).toBe('');
      expect(result.current.affirmationComplete).toBe(false);
      expect(AFFIRMATIONS).toContain(result.current.targetAffirmation);
    });

    it('should select affirmation from AFFIRMATIONS array', () => {
      const { result } = renderHook(() => useAlarmDismiss(true, 'affirmation', true));

      // Verify the affirmation is from AFFIRMATIONS
      expect(AFFIRMATIONS).toContain(result.current.targetAffirmation);
    });
  });

  describe('math problem', () => {
    beforeEach(() => {
      mockGenerateMathProblem.mockReturnValue({
        question: '10 + 5',
        answer: 15,
      });
    });

    it('should check math answer and set complete on correct answer', () => {
      const { result } = renderHook(() => useAlarmDismiss(true, 'math', true));

      let isCorrect: boolean;
      act(() => {
        isCorrect = result.current.checkMathAnswer('15');
      });

      expect(isCorrect!).toBe(true);
      expect(result.current.mathComplete).toBe(true);
    });

    it('should mark complete on correct answer', () => {
      const { result } = renderHook(() => useAlarmDismiss(true, 'math', true));

      act(() => {
        const isCorrect = result.current.checkMathAnswer('15');
        expect(isCorrect).toBe(true);
      });

      expect(result.current.mathComplete).toBe(true);
      expect(result.current.wrongAnswer).toBe(false);
    });

    it('should set wrongAnswer on incorrect answer', () => {
      const { result } = renderHook(() => useAlarmDismiss(true, 'math', true));

      act(() => {
        const isCorrect = result.current.checkMathAnswer('20');
        expect(isCorrect).toBe(false);
      });

      expect(result.current.wrongAnswer).toBe(true);
      expect(result.current.mathComplete).toBe(false);
    });

    it('should set wrongAnswer on empty input', () => {
      const { result } = renderHook(() => useAlarmDismiss(true, 'math', true));

      act(() => {
        const isCorrect = result.current.checkMathAnswer('');
        expect(isCorrect).toBe(false);
      });

      expect(result.current.wrongAnswer).toBe(true);
    });

    it('should set wrongAnswer on whitespace-only input', () => {
      const { result } = renderHook(() => useAlarmDismiss(true, 'math', true));

      act(() => {
        const isCorrect = result.current.checkMathAnswer('   ');
        expect(isCorrect).toBe(false);
      });

      expect(result.current.wrongAnswer).toBe(true);
    });

    it('should set wrongAnswer on non-numeric input', () => {
      const { result } = renderHook(() => useAlarmDismiss(true, 'math', true));

      act(() => {
        const isCorrect = result.current.checkMathAnswer('abc');
        expect(isCorrect).toBe(false);
      });

      expect(result.current.wrongAnswer).toBe(true);
    });

    it('should set wrongAnswer on decimal input', () => {
      const { result } = renderHook(() => useAlarmDismiss(true, 'math', true));

      act(() => {
        const isCorrect = result.current.checkMathAnswer('15.5');
        expect(isCorrect).toBe(false);
      });

      expect(result.current.wrongAnswer).toBe(true);
    });

    it('should handle negative number answers correctly', () => {
      mockGenerateMathProblem.mockReturnValue({
        question: '5 - 10',
        answer: -5,
      });

      const { result } = renderHook(() => useAlarmDismiss(true, 'math', true));

      act(() => {
        const isCorrect = result.current.checkMathAnswer('-5');
        expect(isCorrect).toBe(true);
      });

      expect(result.current.mathComplete).toBe(true);
    });

    it('should trim whitespace from answer', () => {
      const { result } = renderHook(() => useAlarmDismiss(true, 'math', true));

      act(() => {
        const isCorrect = result.current.checkMathAnswer('  15  ');
        expect(isCorrect).toBe(true);
      });

      expect(result.current.mathComplete).toBe(true);
    });

    it('should allow setting user answer', () => {
      const { result } = renderHook(() => useAlarmDismiss(true, 'math', true));

      act(() => {
        result.current.setUserAnswer('42');
      });

      expect(result.current.userAnswer).toBe('42');
    });

    it('should reset math state with resetMath', () => {
      const { result } = renderHook(() => useAlarmDismiss(true, 'math', true));

      act(() => {
        result.current.setUserAnswer('20');
        result.current.checkMathAnswer('20');
      });

      expect(result.current.wrongAnswer).toBe(true);

      act(() => {
        result.current.resetMath();
      });

      expect(result.current.userAnswer).toBe('');
      expect(result.current.wrongAnswer).toBe(false);
      expect(result.current.mathComplete).toBe(false);
      expect(mockGenerateMathProblem).toHaveBeenCalled();
    });

    it('should clear wrongAnswer after a delay', () => {
      const { result } = renderHook(() => useAlarmDismiss(true, 'math', true));

      act(() => {
        result.current.checkMathAnswer('wrong');
      });

      expect(result.current.wrongAnswer).toBe(true);

      // Advance past the 500ms delay
      act(() => {
        jest.advanceTimersByTime(500);
      });

      expect(result.current.wrongAnswer).toBe(false);
    });

    it('should generate new problem on wrong answer after delay', () => {
      mockGenerateMathProblem.mockReturnValue({
        question: '10 + 5',
        answer: 15,
      });

      const { result } = renderHook(() => useAlarmDismiss(true, 'math', true));

      // Verify initial problem is set
      expect(result.current.mathProblem).toEqual({ question: '10 + 5', answer: 15 });

      // Update mock to return a different problem
      mockGenerateMathProblem.mockReturnValue({
        question: '8 + 3',
        answer: 11,
      });

      act(() => {
        result.current.checkMathAnswer('wrong');
      });

      // Problem should still be the same immediately
      expect(result.current.mathProblem).toEqual({ question: '10 + 5', answer: 15 });

      // Advance past the delay
      act(() => {
        jest.advanceTimersByTime(500);
      });

      // Should have the new problem
      expect(result.current.mathProblem).toEqual({ question: '8 + 3', answer: 11 });
    });

    it('should expose math problem object', () => {
      mockGenerateMathProblem.mockReturnValue({
        question: '7 * 8',
        answer: 56,
      });

      const { result } = renderHook(() => useAlarmDismiss(true, 'math', true));

      expect(result.current.mathProblem).toEqual({
        question: '7 * 8',
        answer: 56,
      });
    });
  });

  describe('reset functions', () => {
    it('should reset breathing state with resetBreathing', () => {
      const { result } = renderHook(() => useAlarmDismiss(true, 'breathing', true));

      act(() => {
        result.current.startBreathingExercise();
        jest.advanceTimersByTime(4000);
      });

      expect(result.current.breathingPhase).toBe('hold');

      act(() => {
        result.current.resetBreathing();
      });

      expect(result.current.breathingPhase).toBe('inhale');
      expect(result.current.breathingCycle).toBe(0);
    });

    it('should reset shake state with resetShake', () => {
      const { result } = renderHook(() => useAlarmDismiss(true, 'shake', true));

      const listenerCallback = mockAddListener.mock.calls[0][0];

      act(() => {
        listenerCallback({ x: 2, y: 0, z: 0 });
      });

      expect(result.current.shakeCount).toBe(1);

      act(() => {
        result.current.resetShake();
      });

      expect(result.current.shakeCount).toBe(0);
      expect(result.current.shakeComplete).toBe(false);
    });

    it('should reset affirmation state with resetAffirmation', () => {
      const { result } = renderHook(() => useAlarmDismiss(true, 'affirmation', true));

      const target = result.current.targetAffirmation;

      act(() => {
        result.current.setAffirmationText('typed');
        result.current.checkAffirmation(target);
      });

      expect(result.current.affirmationComplete).toBe(true);

      act(() => {
        result.current.resetAffirmation();
      });

      expect(result.current.affirmationText).toBe('');
      expect(result.current.affirmationComplete).toBe(false);
    });

    it('should reset math state with resetMath', () => {
      const { result } = renderHook(() => useAlarmDismiss(true, 'math', true));

      act(() => {
        result.current.setUserAnswer('42');
      });

      expect(result.current.userAnswer).toBe('42');

      act(() => {
        result.current.resetMath();
      });

      expect(result.current.userAnswer).toBe('');
      expect(result.current.wrongAnswer).toBe(false);
      expect(result.current.mathComplete).toBe(false);
    });

    it('should reset all states with resetAllDismiss', () => {
      const { result } = renderHook(() => useAlarmDismiss(true, 'shake', true));

      // Set up some state
      const listenerCallback = mockAddListener.mock.calls[0][0];

      act(() => {
        for (let i = 0; i < 5; i++) {
          if (i > 0) {
            jest.advanceTimersByTime(301);
          }
          listenerCallback({ x: 2, y: 0, z: 0 });
        }
        result.current.setAffirmationText('test');
        result.current.setUserAnswer('42');
      });

      expect(result.current.shakeCount).toBe(5);
      expect(result.current.affirmationText).toBe('test');
      expect(result.current.userAnswer).toBe('42');

      act(() => {
        result.current.resetAllDismiss();
      });

      expect(result.current.shakeCount).toBe(0);
      expect(result.current.shakeComplete).toBe(false);
      expect(result.current.affirmationText).toBe('');
      expect(result.current.affirmationComplete).toBe(false);
      expect(result.current.userAnswer).toBe('');
      expect(result.current.wrongAnswer).toBe(false);
      expect(result.current.mathComplete).toBe(false);
      expect(result.current.breathingPhase).toBe('inhale');
      expect(result.current.breathingCycle).toBe(0);
    });
  });

  describe('cleanup effects', () => {
    it('should clear breathing timer when isActive becomes false', () => {
      const { result, rerender } = renderHook<
        UseAlarmDismissReturn,
        { isActive: boolean; dismissType: DismissType; hapticFeedback: boolean }
      >(
        ({ isActive, dismissType, hapticFeedback }: { isActive: boolean; dismissType: DismissType; hapticFeedback: boolean }) =>
          useAlarmDismiss(isActive, dismissType, hapticFeedback),
        {
          initialProps: { isActive: true, dismissType: 'breathing' as DismissType, hapticFeedback: true },
        }
      );

      act(() => {
        result.current.startBreathingExercise();
      });

      // Deactivate
      rerender({ isActive: false, dismissType: 'breathing', hapticFeedback: true });

      // State should still be preserved
      expect(result.current.breathingPhase).toBe('inhale');
    });

    it('should clear breathing timer on unmount', () => {
      const { result, unmount } = renderHook(() => useAlarmDismiss(true, 'breathing', true));

      act(() => {
        result.current.startBreathingExercise();
      });

      unmount();

      // Should not throw when advancing timers after unmount
      expect(() => {
        act(() => {
          jest.advanceTimersByTime(10000);
        });
      }).not.toThrow();
    });
  });

  describe('haptic feedback parameter', () => {
    it('should accept hapticFeedback parameter without error', () => {
      const { result } = renderHook(() => useAlarmDismiss(true, 'simple', false));
      
      expect(result.current).toBeDefined();
    });
  });
});
