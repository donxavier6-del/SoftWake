# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

SoftWake - a premium alarm clock app. React Native + Expo SDK 54 + TypeScript.

**Refactored Architecture** (January 2026): The app has been refactored from a monolithic ~3,900-line `App.tsx` to a modular architecture. `App.tsx` is now 889 lines and serves as the main coordinator, with logic extracted into hooks, components, and services.

Entry point is `index.ts` which calls `registerRootComponent(App)`.

## Commands

```bash
npx expo start            # Start dev server (Expo Go or dev client)
npx expo start --android  # Start on Android
npx expo start --ios      # Start on iOS
npx expo start --web      # Start in browser
npm install               # Install dependencies
npm test                  # Run Jest tests
npx tsc --noEmit          # TypeScript type check
```

## Architecture

### Directory Structure
```
src/
├── components/           # UI components
│   ├── AlarmEditor.tsx   # Alarm creation/editing modal
│   ├── AlarmScreen.tsx   # Alarm dismiss modal (breathing, shake, math, affirmation)
│   ├── AlarmsList.tsx    # Swipeable alarm list
│   ├── AlarmsTab.tsx     # Main alarms tab view
│   ├── InsightsChart.tsx # Sleep insights visualization
│   ├── MorningTab.tsx    # Morning greeting and actions
│   ├── SettingsPanel.tsx # Settings modal
│   ├── SleepTracker.tsx  # Sleep tracking UI
│   └── TimePicker.tsx    # Time selection wheels
├── hooks/                # Custom React hooks
│   ├── useAlarmDismiss.ts # Dismiss challenges (breathing, shake, math, affirmation)
│   ├── useAlarms.ts      # Alarm CRUD operations
│   ├── useAlarmSound.ts  # Sound playback management
│   ├── useAlarmTrigger.ts # Alarm triggering, dismiss, snooze
│   ├── useSettings.ts    # User preferences
│   └── useSleepTracking.ts # Sleep data management
├── services/             # Business logic services
│   ├── alarmStorage.ts   # AsyncStorage persistence
│   ├── nativeAlarm.ts    # Native alarm scheduling
│   └── notifications.ts  # Notification scheduling
├── styles/               # StyleSheet definitions
│   └── index.ts          # All app styles (1,289 lines)
├── types/                # TypeScript type definitions
│   └── index.ts          # Alarm, Settings, SleepEntry, Theme, etc.
├── utils/                # Utility functions
│   ├── mathProblem.ts    # Math problem generation
│   └── timeFormatting.ts # Time formatting helpers
└── __tests__/            # Jest test files
    ├── hooks/            # Hook tests
    └── utils/            # Utility tests
```

### Tab Screens
- **Alarms** - Alarm list, create/edit, enable/disable
- **Morning** - Time-based greeting, deep breath, set intention
- **Insights** - Sleep quality chart, averages, trends
- **Settings** - Preferences, notifications, theme

### State Management
- React hooks (`useState`/`useEffect`/`useRef`)
- Custom hooks for domain logic
- AsyncStorage for persistence

### Persistence Keys
- `@softwake_alarms` - alarm list
- `@softwake_sleep_data` - sleep tracking entries
- `@softwake_settings` - user preferences

## Key Dependencies

- `expo-av` - alarm sound playback
- `expo-haptics` - haptic feedback
- `expo-notifications` - alarm scheduling (dev builds only, not Expo Go)
- `expo-sensors` (Accelerometer) - shake-to-dismiss
- `expo-linear-gradient` - gradient backgrounds
- `react-native-gesture-handler` (Swipeable) - swipe-to-delete alarms
- `react-native-wheel-scrollview-picker` - time picker wheels
- `@react-native-async-storage/async-storage` - local persistence

## Constraints

- Expo Go does not support push notifications in SDK 53+. The app runtime-checks `Constants.executionEnvironment` and skips notification code in Expo Go.
- New Architecture is enabled (`"newArchEnabled": true`).
- Portrait orientation only.
- Dark UI style (`"userInterfaceStyle": "dark"`).

## Design Tokens

Defined in `src/types/index.ts` as `Theme` type:
- Background: `#0a0a0a`
- Accent: `#818CF8`
- Text: `#FFFFFF` (primary), `#9999AA` (muted)
- Gradient stops: `['#0a0a1a', '#1a1a2e', '#0f0f23']`
- Card: `#1a1a2e`

## Patterns

- All screens use `LinearGradient` as root background
- Components receive `theme` prop for styling
- Styles centralized in `src/styles/index.ts`
- Hooks return state and handlers for clean separation
- Type assertions used for LinearGradient colors: `colors={theme.gradient as [string, string, string]}`

## Types

Key types in `src/types/index.ts`:
- `Alarm` - alarm config (time, days, sound, dismiss method, wake intensity)
- `Settings` - app-wide preferences
- `SleepEntry` - bedtime/wake timestamps
- `Theme` - color tokens
- `MathProblem` - math challenge state
- `AlarmSound`, `DismissType`, `WakeIntensity`, `TabName` - union string literals

## Testing

```bash
npm test                              # Run all tests
npm test -- --testPathPattern=hooks   # Run hook tests only
npm test -- --watch                   # Watch mode
```

Test files located in `src/__tests__/` with `.test.ts` extension.

## Documentation

- `REFACTORING_LOG.md` - Complete refactoring history and statistics
- `PARALLEL_BRIEF_*.md` - Task specifications for parallel AI sessions
