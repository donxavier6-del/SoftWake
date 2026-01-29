import '@testing-library/react-native/extend-expect';

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

// Mock expo-haptics
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  notificationAsync: jest.fn(),
  selectionAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium', Heavy: 'heavy' },
  NotificationFeedbackType: { Success: 'success', Warning: 'warning', Error: 'error' },
}));

// Mock expo-av
jest.mock('expo-av', () => ({
  Audio: {
    Sound: {
      createAsync: jest.fn(() => Promise.resolve({ sound: { playAsync: jest.fn(), stopAsync: jest.fn(), unloadAsync: jest.fn(), setVolumeAsync: jest.fn(), setRateAsync: jest.fn() } })),
    },
    setAudioModeAsync: jest.fn(),
  },
}));

// Mock expo-notifications
jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(),
  setNotificationChannelAsync: jest.fn(),
  cancelScheduledNotificationAsync: jest.fn(),
  getAllScheduledNotificationsAsync: jest.fn(() => Promise.resolve([])),
  scheduleNotificationAsync: jest.fn(),
  requestPermissionsAsync: jest.fn(() => Promise.resolve({ status: 'granted' })),
  SchedulableTriggerInputTypes: {
    DAILY: 'daily',
    WEEKLY: 'weekly',
    DATE: 'date',
  },
  AndroidImportance: {
    MAX: 'max',
  },
  AndroidNotificationVisibility: {
    PUBLIC: 'public',
  },
}));

// Mock expo-sensors
jest.mock('expo-sensors', () => ({
  Accelerometer: {
    addListener: jest.fn(() => ({ remove: jest.fn() })),
    setUpdateInterval: jest.fn(),
  },
}));

// Mock expo-linear-gradient
jest.mock('expo-linear-gradient', () => ({
  LinearGradient: 'LinearGradient',
}));

// Mock expo-constants
jest.mock('expo-constants', () => ({
  default: {
    executionEnvironment: 'standalone',
  },
  ExecutionEnvironment: {
    StoreClient: 'storeClient',
    Standalone: 'standalone',
    Bare: 'bare',
  },
}));

// Mock react-native-wheel-scrollview-picker
jest.mock('react-native-wheel-scrollview-picker', () => 'WheelPicker');

// Mock react-native-gesture-handler
jest.mock('react-native-gesture-handler', () => ({
  GestureHandlerRootView: 'GestureHandlerRootView',
  PanGestureHandler: 'PanGestureHandler',
  Swipeable: 'Swipeable',
}));

// Mock expo modules core to prevent WinterCG runtime issues
jest.mock('expo/src/winter/runtime.native', () => ({
  __esModule: true,
  default: {},
}));

// Silence console warnings during tests
global.console = {
  ...console,
  warn: jest.fn(),
  error: jest.fn(),
};
