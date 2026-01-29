# Kimi Session B - Unit Tests for useAlarmDismiss Hook

## Project Location
```
C:\Users\oluto\Documents\Workspaces\Projects\SoftWake
```

## Your Task
Write comprehensive unit tests for `src/hooks/useAlarmDismiss.ts`.

## Hook Overview

The `useAlarmDismiss` hook manages alarm dismissal challenges (breathing, shake, math, affirmation).

**Interface:**
```typescript
interface UseAlarmDismissReturn {
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
```

**Parameters:**
- `isActive: boolean` - Whether alarm screen is visible
- `dismissType: string` - Type of dismiss challenge
- `hapticFeedback: boolean` - Whether haptics are enabled

## Test Cases to Cover

1. **Breathing Exercise**
   - Should start at 'inhale' phase
   - Should progress through phases: inhale → hold → exhale
   - Should complete after 3 cycles
   - Should animate breathing circle

2. **Shake Detection**
   - Should count shakes when accelerometer detects motion
   - Should mark complete after 20 shakes
   - Should reset properly

3. **Affirmation Challenge**
   - Should validate text matches target (case-insensitive)
   - Should mark complete on match
   - Should reset with new random affirmation

4. **Math Problem**
   - Should validate numeric input
   - Should mark complete on correct answer
   - Should set wrongAnswer on incorrect answer
   - Should generate new problem after wrong answer

5. **Reset Functions**
   - Each reset should clear respective state
   - `resetAllDismiss` should clear all state

## Steps

1. **Create branch:**
   ```bash
   git fetch origin
   git checkout -b test/use-alarm-dismiss origin/refactor/phase3.5-integration
   ```

2. **Create test file:** `src/__tests__/hooks/useAlarmDismiss.test.ts`

3. **Mock dependencies:**
   ```typescript
   jest.mock('expo-sensors');
   jest.mock('expo-haptics');
   ```

4. **Run tests:** `npm test -- --testPathPattern=useAlarmDismiss`

## DO NOT
- Modify the hook implementation
- Skip edge cases

## When Done
Reply with test coverage summary and "Ready for review"
