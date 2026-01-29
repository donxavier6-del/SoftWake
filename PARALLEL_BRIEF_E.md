# Claude Session E - Extract AlarmScreen Component

## Project Location
```
C:\Users\oluto\Documents\Workspaces\Projects\SoftWake
```

## Your Task
Extract the alarm screen modal content into `src/components/AlarmScreen.tsx`.

## What to Extract

Find in App.tsx the alarm screen modal JSX (~lines 750-940):
```tsx
<Modal
  visible={alarmScreenVisible}
  animationType="fade"
  statusBarTranslucent
>
  {/* Breathing dismiss screen */}
  {activeAlarm?.dismissType === 'breathing' ? (
    <LinearGradient ...>
      {/* Breathing animation and controls */}
    </LinearGradient>
  ) : activeAlarm?.dismissType === 'affirmation' ? (
    // Affirmation screen
  ) : activeAlarm?.dismissType === 'shake' ? (
    // Shake screen
  ) : activeAlarm?.dismissType === 'math' ? (
    // Math problem screen
  ) : (
    // Simple dismiss screen
  )}
</Modal>
```

## Steps

1. **Create branch:**
   ```bash
   git fetch origin
   git checkout -b refactor/extract-alarm-screen origin/refactor/phase3.5-integration
   ```

2. **Create `src/components/AlarmScreen.tsx`:**
   ```typescript
   import React from 'react';
   import { View, Text, Modal, TouchableOpacity, TextInput, Animated, StyleSheet } from 'react-native';
   import { LinearGradient } from 'expo-linear-gradient';
   import { formatTimeWithPeriod } from '../utils/timeFormatting';
   import type { Alarm, Theme, MathProblem } from '../types';

   interface AlarmScreenProps {
     visible: boolean;
     alarm: Alarm | null;
     theme: Theme;

     // Breathing
     breathingPhase: 'inhale' | 'hold' | 'exhale' | 'complete';
     breathingCycle: number;
     breathingAnim: Animated.Value;

     // Shake
     shakeCount: number;
     shakeComplete: boolean;

     // Affirmation
     affirmationText: string;
     targetAffirmation: string;
     affirmationComplete: boolean;
     onAffirmationChange: (text: string) => void;

     // Math
     mathProblem: MathProblem;
     userAnswer: string;
     wrongAnswer: boolean;
     mathComplete: boolean;
     onUserAnswerChange: (text: string) => void;
     onMathSubmit: () => void;

     // Actions
     onDismiss: () => void;
     onSnooze: () => void;
   }

   export function AlarmScreen(props: AlarmScreenProps) {
     // Render different screens based on dismissType
   }

   const styles = StyleSheet.create({
     // Extract all alarm screen styles
   });
   ```

3. **DO NOT modify App.tsx** - only create the component file

4. **Verify:** `npx tsc --noEmit` passes

## Expected Reduction
~200 lines when integrated

## DO NOT
- Modify App.tsx
- Change any visual appearance or behavior

## When Done
Reply with the complete component file and "Ready for review"
