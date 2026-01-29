# Kimi Session C - Extract MorningTab Component

## Project Location
```
C:\Users\oluto\Documents\Workspaces\Projects\SoftWake
```

## Your Task
Extract the Morning tab content into `src/components/MorningTab.tsx`.

## What to Extract

Find in App.tsx the morning tab JSX:
```tsx
{activeTab === 'morning' && (
  <View style={styles.tabContent}>
    <View style={styles.morningContainer}>
      <Text style={styles.morningGreeting}>
        {/* Greeting based on time of day */}
      </Text>
      <Text style={styles.morningQuote}>
        "Today is full of possibilities"
      </Text>
      <View style={styles.morningButtons}>
        {/* Deep Breath and Set Intention buttons */}
      </View>
    </View>
  </View>
)}
```

## Steps

1. **Create branch:**
   ```bash
   git fetch origin
   git checkout -b refactor/extract-morning-tab origin/refactor/phase3.5-integration
   ```

2. **Create `src/components/MorningTab.tsx`:**
   ```typescript
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
         {/* Extract the morning tab content here */}
       </View>
     );
   }

   const styles = StyleSheet.create({
     // Extract relevant styles
   });
   ```

3. **DO NOT modify App.tsx** - only create the component file

4. **Verify:** `npx tsc --noEmit` passes

## Expected Reduction
~40 lines when integrated

## DO NOT
- Modify App.tsx
- Change any visual appearance

## When Done
Reply with the complete component file and "Ready for review"
