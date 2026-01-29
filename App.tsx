import { StatusBar } from 'expo-status-bar';
import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Text,
  View,
  TouchableOpacity,
  Modal,
  ScrollView,
  Switch,
  Animated,
  TextInput,
  Platform,
  AppState,
  Alert,
} from 'react-native';
import type { Alarm, SleepEntry, Settings, AlarmSound, DismissType, WakeIntensity, TabName, WeeklyDataPoint, SleepStatsResult } from './src/types';
import { GestureHandlerRootView, PanGestureHandler, PanGestureHandlerGestureEvent } from 'react-native-gesture-handler';
import WheelPicker from 'react-native-wheel-scrollview-picker';
import * as Haptics from 'expo-haptics';
import { Audio } from 'expo-av';
// Accelerometer is now handled by useAlarmDismiss hook
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { nativeAlarm } from './src/services/nativeAlarm';
import { rescheduleAllAlarms, cleanupExpiredAlarms } from './src/services/alarmStorage';
import {
  SNOOZE_OPTIONS,
  WAKE_INTENSITY_OPTIONS,
  SOUND_OPTIONS,
  DISMISS_OPTIONS,
  DAYS,
  AFFIRMATIONS,
  SLEEP_GOAL_OPTIONS,
} from './src/constants/options';
import {
  formatTimeHHMM,
  formatTimeWithPeriod,
  formatTimeDisplay,
} from './src/utils/timeFormatting';
import { InsightsChart } from './src/components/InsightsChart';
import { ErrorBoundary } from './src/components/ErrorBoundary';
import { SettingsPanel } from './src/components/SettingsPanel';
import { AlarmsList } from './src/components/AlarmsList';
import { AlarmsTab } from './src/components/AlarmsTab';
import { AlarmEditor } from './src/components/AlarmEditor';
import { TimePicker } from './src/components/TimePicker';
import { useAlarms } from './src/hooks/useAlarms';
import { useSettings } from './src/hooks/useSettings';
import { useAlarmSound } from './src/hooks/useAlarmSound';
import { useSleepTracking } from './src/hooks/useSleepTracking';
import { useAlarmTrigger } from './src/hooks/useAlarmTrigger';
import { useAlarmDismiss } from './src/hooks/useAlarmDismiss';
import { styles } from './src/styles';
import {
  scheduleBedtimeNotification as scheduleBedtimeNotificationService,
  scheduleAlarmNotifications as scheduleAlarmNotificationsService,
  setupNotificationHandler,
} from './src/services/notifications';

// Check if running in Expo Go (where push notifications are not supported in SDK 53+)
const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

// Configure notification handler (only in development builds, not Expo Go)
if (!isExpoGo) {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });

  // Set up Android notification channel with IMPORTANCE_HIGH for alarms
  if (Platform.OS === 'android') {
    Notifications.setNotificationChannelAsync('alarms', {
      name: 'Alarms',
      importance: Notifications.AndroidImportance.MAX,
      sound: 'default',
      vibrationPattern: [0, 250, 250, 250],
      enableLights: true,
      lightColor: '#818CF8',
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      bypassDnd: true,
    });
  }
}

type MathProblem = {
  question: string;
  answer: number;
};

const SHAKE_THRESHOLD = 1.5;
const REQUIRED_SHAKES = 20;
const BREATHING_CYCLES_REQUIRED = 3;
const STORAGE_KEY = '@softwake_alarms';
const SLEEP_STORAGE_KEY = '@softwake_sleep_data';
const SETTINGS_STORAGE_KEY = '@softwake_settings';

const DEFAULT_SETTINGS: Settings = {
  bedtimeReminderEnabled: false,
  bedtimeHour: 22,
  bedtimeMinute: 0,
  defaultWakeIntensity: 'energetic',
  defaultSound: 'sunrise',
  defaultDismissType: 'simple',
  sleepGoalHours: 8,
  darkMode: true,
  hapticFeedback: true,
};

// Theme colors
const THEMES = {
  dark: {
    gradient: ['#0a0a1a', '#1a1a2e', '#0f0f23'] as const,
    alarmGradient: ['#1a1a3e', '#2d1b69', '#1a3a5c'] as const,
    background: '#0D0D0D',
    card: '#1A1A1A',
    cardAlt: '#141414',
    surface: '#2A2A2A',
    text: '#FFFFFF',
    textMuted: '#9999AA',
    textDisabled: '#666666',
    accent: '#818CF8',
    accentAlt: '#6366F1',
    switchTrackOff: '#2A2A2A',
    switchThumbOff: '#666666',
  },
  light: {
    gradient: ['#f0f4ff', '#e8eeff', '#f5f7ff'] as const,
    alarmGradient: ['#c7d2fe', '#a5b4fc', '#93c5fd'] as const,
    background: '#FFFFFF',
    card: '#F5F5F7',
    cardAlt: '#FAFAFA',
    surface: '#E5E5EA',
    text: '#1C1C1E',
    textMuted: '#6B6B7A',
    textDisabled: '#AEAEB2',
    accent: '#6366F1',
    accentAlt: '#818CF8',
    switchTrackOff: '#E5E5EA',
    switchThumbOff: '#FFFFFF',
  },
};

// generateMathProblem is now in src/utils/mathProblem.ts, used by useAlarmDismiss hook

export default function App() {
  // === HOOKS ===
  // Settings hook (must be first to get theme)
  const { settings, updateSettings, isLoading: settingsLoading } = useSettings();
  const theme = settings.darkMode ? THEMES.dark : THEMES.light;

  // Alarms hook
  const {
    alarms,
    setAlarms,
    modalVisible,
    setModalVisible,
    editingAlarmId,
    setEditingAlarmId,
    selectedHour,
    setSelectedHour,
    selectedMinute,
    setSelectedMinute,
    selectedDays,
    setSelectedDays,
    selectedLabel,
    setSelectedLabel,
    selectedSnooze,
    setSelectedSnooze,
    selectedWakeIntensity,
    setSelectedWakeIntensity,
    selectedSound,
    setSelectedSound,
    selectedDismissType,
    setSelectedDismissType,
    handleAddAlarm,
    handleEditAlarm,
    handleSaveAlarm,
    toggleAlarm,
    deleteAlarm,
    toggleDay,
    showUndoToast,
    undoDelete,
    isLoaded: alarmsLoaded,
  } = useAlarms();

  // Sleep tracking hook
  const {
    sleepData,
    bedtimeModalVisible,
    setBedtimeModalVisible,
    bedtimeHour,
    setBedtimeHour,
    bedtimeMinute,
    setBedtimeMinute,
    pendingWakeTime,
    setPendingWakeTime,
    getWeeklyData,
    getSleepStats,
    handleSaveBedtime,
    handleSkipBedtime,
    isLoading: sleepLoading,
  } = useSleepTracking();

  // Alarm sound preview hook
  const { playPreviewSound, stopPreviewSound } = useAlarmSound();

  // Track which alarm to disable after dismiss (for one-time alarms)
  const alarmToDisableRef = useRef<string | null>(null);

  // Callback when alarm is dismissed - handles app-level effects
  const handleAlarmDismissedCallback = useCallback(() => {
    // Show bedtime modal
    setPendingWakeTime(new Date());
    setBedtimeHour(22);
    setBedtimeMinute(0);
    setBedtimeModalVisible(true);

    // Disable one-time alarm if needed
    if (alarmToDisableRef.current) {
      setAlarms(prev => prev.map(a =>
        a.id === alarmToDisableRef.current ? { ...a, enabled: false } : a
      ));
      alarmToDisableRef.current = null;
    }
  }, [setAlarms]);

  // Alarm trigger hook - manages alarm triggering, sound, and dismiss
  const {
    alarmScreenVisible,
    activeAlarm,
    triggerAlarm: hookTriggerAlarm,
    stopAlarmSound,
    dismissAlarm: hookDismissAlarm,
    snoozeAlarm: hookSnoozeAlarm,
  } = useAlarmTrigger(alarms, settings.hapticFeedback, handleAlarmDismissedCallback);

  // Alarm dismiss hook - manages dismiss challenges (breathing, shake, math, affirmation)
  const {
    breathingPhase,
    breathingCycle,
    breathingAnim,
    startBreathingExercise,
    resetBreathing,
    shakeCount,
    shakeComplete,
    resetShake,
    affirmationText,
    setAffirmationText,
    targetAffirmation,
    affirmationComplete,
    checkAffirmation,
    resetAffirmation,
    mathProblem,
    userAnswer,
    setUserAnswer,
    wrongAnswer,
    mathComplete,
    checkMathAnswer,
    resetMath,
    resetAllDismiss,
  } = useAlarmDismiss(
    alarmScreenVisible,
    activeAlarm?.dismissType || 'simple',
    settings.hapticFeedback
  );

  // === LOCAL STATE ===
  const [currentTime, setCurrentTime] = useState(new Date());

// Initialize native alarm system
  useEffect(() => {
    const initNativeAlarms = async () => {
      if (Platform.OS !== 'android') return;
      await rescheduleAllAlarms();
      await cleanupExpiredAlarms();
    };
    initNativeAlarms();

    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') rescheduleAllAlarms();
    });

    return () => sub.remove();
  }, []);

  // Sleep insight modal state
  const [sleepInsightVisible, setSleepInsightVisible] = useState(false);

  // Combined loading state from hooks
  const isLoaded = alarmsLoaded && !settingsLoading && !sleepLoading;

  // Settings state - now from useSettings hook
  const [bedtimePickerVisible, setBedtimePickerVisible] = useState(false);

  // Stats modal state
  const [statsModalVisible, setStatsModalVisible] = useState(false);

  // Tab navigation state
  const [activeTab, setActiveTab] = useState<TabName>('alarms');

  // Loading is now handled by hooks (useAlarms, useSettings, useSleepTracking)

  // Schedule alarm notifications whenever alarms change (AsyncStorage save handled by useAlarms hook)
  useEffect(() => {
    if (!isLoaded) return;
    scheduleAlarmNotificationsService(alarms);
  }, [alarms, isLoaded]);

  // Sleep data save is now handled by useSleepTracking hook

  // Schedule bedtime notification when settings change (AsyncStorage save handled by useSettings hook)
  useEffect(() => {
    if (!isLoaded) return;
    scheduleBedtimeNotificationService(settings);
  }, [settings, isLoaded]);

  // Request notification permissions on mount (only in development builds, not Expo Go)
  useEffect(() => {
    if (isExpoGo) return;
    const requestPermissions = async () => {
      const { status } = await Notifications.requestPermissionsAsync();
      if (status !== 'granted') {
        console.log('Notification permissions not granted');
      }
    };
    requestPermissions();
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // Alarm checking is now handled by useAlarmTrigger hook

  // Unified dismiss handler - marks one-time alarms for disabling and calls hook dismiss
  const handleUnifiedDismiss = useCallback(() => {
    if (activeAlarm && activeAlarm.days.every((d) => !d)) {
      alarmToDisableRef.current = activeAlarm.id;
    }
    resetAllDismiss();
    hookDismissAlarm();
  }, [activeAlarm, resetAllDismiss, hookDismissAlarm]);

  // Handle simple dismiss (button press)
  const handleSimpleDismiss = useCallback(() => {
    handleUnifiedDismiss();
  }, [handleUnifiedDismiss]);

  // Handle snooze
  const handleSnoozeAlarm = useCallback(() => {
    resetAllDismiss();
    hookSnoozeAlarm();
  }, [resetAllDismiss, hookSnoozeAlarm]);

  // Watch for shake completion
  useEffect(() => {
    if (shakeComplete) {
      setTimeout(() => {
        handleUnifiedDismiss();
      }, 2000);
    }
  }, [shakeComplete, handleUnifiedDismiss]);

  // Watch for breathing completion
  useEffect(() => {
    if (breathingPhase === 'complete') {
      setTimeout(() => {
        handleUnifiedDismiss();
      }, 2500);
    }
  }, [breathingPhase, handleUnifiedDismiss]);

  // Watch for affirmation completion
  useEffect(() => {
    if (affirmationComplete) {
      setTimeout(() => {
        handleUnifiedDismiss();
      }, 2000);
    }
  }, [affirmationComplete, handleUnifiedDismiss]);

  // Watch for math completion
  useEffect(() => {
    if (mathComplete) {
      setTimeout(() => {
        handleUnifiedDismiss();
      }, 2000);
    }
  }, [mathComplete, handleUnifiedDismiss]);

  // Start breathing exercise when alarm triggers with breathing dismiss type
  useEffect(() => {
    if (alarmScreenVisible && activeAlarm?.dismissType === 'breathing') {
      startBreathingExercise();
    }
  }, [alarmScreenVisible, activeAlarm, startBreathingExercise]);

  // Trigger alarm with dismiss state reset
  const triggerAlarmWithReset = useCallback((alarm: Alarm) => {
    resetAllDismiss();
    hookTriggerAlarm(alarm);
  }, [resetAllDismiss, hookTriggerAlarm]);

  // Handle notification received (triggers alarm when notification fires)
  useEffect(() => {
    if (isExpoGo) return;

    // Listen for notifications received while app is foregrounded
    const notificationReceivedSubscription = Notifications.addNotificationReceivedListener((notification) => {
      const data = notification.request.content.data;
      if (data?.alarmId) {
        const alarm = alarms.find((a) => a.id === data.alarmId);
        if (alarm && alarm.enabled) {
          triggerAlarmWithReset(alarm);
        }
      }
    });

    // Listen for user tapping on notification (app may be backgrounded/killed)
    const notificationResponseSubscription = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data;
      if (data?.alarmId) {
        const alarm = alarms.find((a) => a.id === data.alarmId);
        if (alarm && alarm.enabled) {
          triggerAlarmWithReset(alarm);
        }
      }
    });

    return () => {
      notificationReceivedSubscription.remove();
      notificationResponseSubscription.remove();
    };
  }, [alarms, triggerAlarmWithReset]);

  // Handle math dismiss - validates answer and triggers dismiss on correct
  const handleMathDismiss = useCallback(() => {
    const isCorrect = checkMathAnswer(userAnswer);
    if (isCorrect) {
      // mathComplete will trigger the dismiss via useEffect
    }
    setUserAnswer('');
  }, [checkMathAnswer, userAnswer, setUserAnswer]);

  // Handle affirmation text change
  const handleAffirmationChange = useCallback((text: string) => {
    setAffirmationText(text);
    checkAffirmation(text);
  }, [setAffirmationText, checkAffirmation]);

  // Wrapper functions that pass app-specific context to hook functions
  const handleAddAlarmWithDefaults = () => {
    handleAddAlarm({
      defaultWakeIntensity: settings.defaultWakeIntensity,
      defaultSound: settings.defaultSound,
      defaultDismissType: settings.defaultDismissType,
    });
  };

  const handleSaveAlarmWithCleanup = () => {
    handleSaveAlarm(() => stopPreviewSound());
  };

  const deleteAlarmWithHaptics = (id: string) => {
    deleteAlarm(id, settings.hapticFeedback);
  };

  const playPreviewSoundWithCurrentSettings = () => {
    playPreviewSound(selectedSound, selectedWakeIntensity);
  };

  // handleEditAlarm, toggleAlarm, toggleDay, undoDelete are used directly from useAlarms hook

  // updateSettings is now from useSettings hook

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  };

  // getWeeklyData, getSleepStats, handleSkipBedtime are now from useSleepTracking hook

  // Track previous sleep data length to detect when we reach 7 entries
  const prevSleepLengthRef = useRef(sleepData.length);

  // Wrapper to show sleep insight after saving bedtime
  const handleSaveBedtimeWithInsight = () => {
    prevSleepLengthRef.current = sleepData.length;
    handleSaveBedtime();
  };

  // Show sleep insight when we first reach 7 entries after a save
  useEffect(() => {
    if (sleepData.length >= 7 && prevSleepLengthRef.current < 7) {
      setSleepInsightVisible(true);
    }
    prevSleepLengthRef.current = sleepData.length;
  }, [sleepData.length]);

  const getOptimalWakeTime = (): { hour: number; minute: number; avgSleep: number } | null => {
    if (sleepData.length < 7) return null;

    // Use last 7 entries for analysis
    const recentData = sleepData.slice(-7);

    // Calculate average sleep duration
    const avgSleepDuration = Math.round(
      recentData.reduce((sum, entry) => sum + entry.sleepDuration, 0) / recentData.length
    );

    // Calculate average bedtime (in minutes from midnight)
    const avgBedtimeMinutes = Math.round(
      recentData.reduce((sum, entry) => {
        const bed = new Date(entry.bedtime);
        let minutes = bed.getHours() * 60 + bed.getMinutes();
        // Handle times after midnight (treat as previous day)
        if (minutes < 720) minutes += 1440; // Add 24 hours if before noon
        return sum + minutes;
      }, 0) / recentData.length
    );

    // Optimal sleep is ~7.5-8 hours (450-480 min) for most adults
    // Suggest wake time based on average bedtime + optimal sleep duration
    const optimalSleepMinutes = 480; // 8 hours
    let optimalWakeMinutes = (avgBedtimeMinutes + optimalSleepMinutes) % 1440;

    const optimalHour = Math.floor(optimalWakeMinutes / 60);
    const optimalMinute = Math.round((optimalWakeMinutes % 60) / 5) * 5; // Round to nearest 5 min

    return {
      hour: optimalHour,
      minute: optimalMinute,
      avgSleep: avgSleepDuration,
    };
  };

  return (
    <GestureHandlerRootView style={styles.container}>
      <ErrorBoundary>
      <LinearGradient colors={[...theme.gradient]} style={styles.container}>
      <StatusBar style={settings.darkMode ? 'light' : 'dark'} />

      {/* Tab Content */}
      {activeTab === 'alarms' && (
        <AlarmsTab
          alarms={alarms}
          currentTime={currentTime}
          theme={theme}
          showUndoToast={showUndoToast}
          onAddAlarm={handleAddAlarmWithDefaults}
          onEditAlarm={handleEditAlarm}
          onToggleAlarm={toggleAlarm}
          onDeleteAlarm={deleteAlarmWithHaptics}
          onUndoDelete={undoDelete}
        />
      )}

      {activeTab === 'morning' && (
        <View style={styles.tabContent}>
          <View style={styles.morningContainer}>
            <Text style={[styles.morningGreeting, { color: theme.text }]}>
              {(() => {
                const h = new Date().getHours();
                if (h < 12) return 'Good morning';
                if (h < 17) return 'Good afternoon';
                return 'Good evening';
              })()}
            </Text>
            <Text style={[styles.morningQuote, { color: theme.textMuted }]}>
              "Today is full of possibilities"
            </Text>
            <View style={styles.morningButtons}>
              <TouchableOpacity
                style={[styles.morningButton, { backgroundColor: theme.card }]}
                onPress={() => {
                  if (settings.hapticFeedback) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  Alert.alert('Deep Breath', 'Breathe in... hold... breathe out...');
                }}
              >
                <Text style={styles.morningButtonIcon}>🌬️</Text>
                <Text style={[styles.morningButtonLabel, { color: theme.text }]}>Deep Breath</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.morningButton, { backgroundColor: theme.card }]}
                onPress={() => {
                  if (settings.hapticFeedback) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  Alert.alert('Set Intention', 'What do you want to focus on today?');
                }}
              >
                <Text style={styles.morningButtonIcon}>🎯</Text>
                <Text style={[styles.morningButtonLabel, { color: theme.text }]}>Set Intention</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {activeTab === 'insights' && (
        <InsightsChart
          sleepData={sleepData}
          settings={settings}
          theme={theme}
          getWeeklyData={getWeeklyData}
          getSleepStats={getSleepStats}
        />
      )}

      {activeTab === 'settings' && (
        <SettingsPanel
          settings={settings}
          theme={theme}
          updateSettings={updateSettings}
          bedtimePickerVisible={bedtimePickerVisible}
          setBedtimePickerVisible={setBedtimePickerVisible}
          TimePicker={TimePicker}
        />
      )}

      {/* Bottom Tab Bar */}
      <View style={[styles.tabBar, { backgroundColor: theme.card, borderTopColor: theme.surface }]}>
        <TouchableOpacity
          style={styles.tabItem}
          onPress={() => setActiveTab('alarms')}
          activeOpacity={0.7}
        >
          <Text style={[styles.tabIcon, { color: theme.textMuted }, activeTab === 'alarms' && { color: theme.accent }]}>
            {"⏰"}
          </Text>
          <Text style={[styles.tabLabel, { color: theme.textMuted }, activeTab === 'alarms' && { color: theme.accent }]}>
            Alarms
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.tabItem}
          onPress={() => setActiveTab('morning')}
          activeOpacity={0.7}
        >
          <Text style={[styles.tabIcon, { color: theme.textMuted }, activeTab === 'morning' && { color: theme.accent }]}>
            {"☀\uFE0F"}
          </Text>
          <Text style={[styles.tabLabel, { color: theme.textMuted }, activeTab === 'morning' && { color: theme.accent }]}>
            Morning
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.tabItem}
          onPress={() => setActiveTab('insights')}
          activeOpacity={0.7}
        >
          <Text style={[styles.tabIcon, { color: theme.textMuted }, activeTab === 'insights' && { color: theme.accent }]}>
            {"📊"}
          </Text>
          <Text style={[styles.tabLabel, { color: theme.textMuted }, activeTab === 'insights' && { color: theme.accent }]}>
            Insights
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.tabItem}
          onPress={() => setActiveTab('settings')}
          activeOpacity={0.7}
        >
          <Text style={[styles.tabIcon, { color: theme.textMuted }, activeTab === 'settings' && { color: theme.accent }]}>
            {"⚙\uFE0F"}
          </Text>
          <Text style={[styles.tabLabel, { color: theme.textMuted }, activeTab === 'settings' && { color: theme.accent }]}>
            Settings
          </Text>
        </TouchableOpacity>
      </View>

      <AlarmEditor
        visible={modalVisible}
        editingAlarmId={editingAlarmId}
        theme={theme}
        settings={settings}
        selectedHour={selectedHour}
        selectedMinute={selectedMinute}
        onHourChange={setSelectedHour}
        onMinuteChange={setSelectedMinute}
        selectedDays={selectedDays}
        onToggleDay={toggleDay}
        selectedLabel={selectedLabel}
        onLabelChange={setSelectedLabel}
        selectedSnooze={selectedSnooze}
        onSnoozeChange={setSelectedSnooze}
        selectedWakeIntensity={selectedWakeIntensity}
        onWakeIntensityChange={setSelectedWakeIntensity}
        selectedSound={selectedSound}
        onSoundChange={setSelectedSound}
        selectedDismissType={selectedDismissType}
        onDismissTypeChange={setSelectedDismissType}
        onSave={handleSaveAlarmWithCleanup}
        onCancel={() => {
          stopPreviewSound();
          setModalVisible(false);
          setEditingAlarmId(null);
        }}
        onPlayPreview={playPreviewSoundWithCurrentSettings}
      />

      {/* Alarm Dismiss Screen */}
      <Modal
        animationType="fade"
        transparent={false}
        visible={alarmScreenVisible}
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
                <Text style={styles.mathProblemText}>{mathProblem.question} = ?</Text>
                <TextInput
                  style={[
                    styles.mathInputField,
                    wrongAnswer && styles.mathInputFieldWrong,
                  ]}
                  value={userAnswer}
                  onChangeText={setUserAnswer}
                  keyboardType="number-pad"
                  placeholder="Your answer"
                  placeholderTextColor="rgba(255, 255, 255, 0.3)"
                  autoFocus
                />
                <TouchableOpacity
                  style={styles.mathSubmitButton}
                  onPress={handleMathDismiss}
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
              onPress={handleSimpleDismiss}
            >
              <Text style={styles.stopButtonText}>Stop</Text>
            </TouchableOpacity>
          </View>
          {activeAlarm && activeAlarm.snooze > 0 && (
            <TouchableOpacity
              style={styles.snoozeButton}
              onPress={handleSnoozeAlarm}
            >
              <Text style={styles.snoozeButtonText}>
                Snooze ({activeAlarm.snooze} min)
              </Text>
            </TouchableOpacity>
          )}
        </View>
        )}
      </Modal>

      {/* Bedtime Logging Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={bedtimeModalVisible}
        onRequestClose={handleSkipBedtime}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.bedtimeModalContent}>
            <Text style={styles.bedtimeTitle}>Log Your Sleep</Text>
            <Text style={styles.bedtimeSubtitle}>When did you go to bed last night?</Text>

            <TimePicker
              hour={bedtimeHour}
              minute={bedtimeMinute}
              onHourChange={setBedtimeHour}
              onMinuteChange={setBedtimeMinute}
              minuteStep={5}
              hapticFeedback={settings.hapticFeedback}
            />

            <TouchableOpacity style={styles.saveBedtimeButton} onPress={handleSaveBedtimeWithInsight}>
              <Text style={styles.saveBedtimeButtonText}>Save</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.skipBedtimeButton} onPress={handleSkipBedtime}>
              <Text style={styles.skipBedtimeButtonText}>Skip</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Sleep Insight Modal */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={sleepInsightVisible}
        onRequestClose={() => setSleepInsightVisible(false)}
      >
        <View style={styles.insightOverlay}>
          <View style={styles.insightContent}>
            <Text style={styles.insightTitle}>Sleep Insight</Text>
            {(() => {
              const insight = getOptimalWakeTime();
              if (!insight) return null;
              const avgHours = Math.floor(insight.avgSleep / 60);
              const avgMins = insight.avgSleep % 60;
              return (
                <>
                  <Text style={styles.insightText}>
                    Based on your last 7 nights, you average{' '}
                    <Text style={styles.insightHighlight}>
                      {avgHours}h {avgMins}m
                    </Text>{' '}
                    of sleep.
                  </Text>
                  <Text style={styles.insightText}>
                    For optimal rest (8 hours), try waking up at:
                  </Text>
                  <Text style={styles.insightTime}>
                    {formatTimeWithPeriod(insight.hour, insight.minute)}
                  </Text>
                  <TouchableOpacity
                    style={styles.insightButton}
                    onPress={() => {
                      handleAddAlarmWithDefaults();
                      setSelectedHour(insight.hour);
                      setSelectedMinute(insight.minute);
                      setSelectedLabel('Optimal Wake');
                      setSleepInsightVisible(false);
                    }}
                  >
                    <Text style={styles.insightButtonText}>Create Alarm</Text>
                  </TouchableOpacity>
                </>
              );
            })()}
            <TouchableOpacity
              style={styles.insightDismiss}
              onPress={() => setSleepInsightVisible(false)}
            >
              <Text style={styles.insightDismissText}>Dismiss</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>



      {/* Sleep Stats Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={statsModalVisible}
        onRequestClose={() => setStatsModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.statsModalContent}>
            <View style={styles.statsHeader}>
              <Text style={styles.statsTitle}>Sleep Stats</Text>
              <TouchableOpacity onPress={() => setStatsModalVisible(false)}>
                <Text style={styles.statsCloseButton}>Done</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.statsScrollView} showsVerticalScrollIndicator={false}>
              {sleepData.length === 0 ? (
                <View style={styles.statsEmptyState}>
                  <Text style={styles.statsEmptyIcon}>😴</Text>
                  <Text style={styles.statsEmptyTitle}>No Sleep Data Yet</Text>
                  <Text style={styles.statsEmptyText}>
                    Dismiss alarms to start tracking your sleep patterns
                  </Text>
                </View>
              ) : (
                <>
                  {/* Weekly Chart */}
                  <View style={styles.statsSection}>
                    <Text style={styles.statsSectionTitle}>This Week</Text>
                    <View style={styles.weeklyChart}>
                      {getWeeklyData().map((day, index) => {
                        const maxDuration = 600; // 10 hours max
                        const barHeight = day.duration > 0
                          ? Math.min((day.duration / maxDuration) * 120, 120)
                          : 4;
                        const isToday = index === 6;

                        return (
                          <View key={day.day} style={styles.chartBar}>
                            <Text style={styles.chartDuration}>
                              {day.duration > 0 ? `${Math.floor(day.duration / 60)}h` : '-'}
                            </Text>
                            <View style={styles.chartBarContainer}>
                              <View
                                style={[
                                  styles.chartBarFill,
                                  {
                                    height: barHeight,
                                    backgroundColor: day.duration === 0
                                      ? '#2A2A2A'
                                      : day.duration >= 420 // 7 hours
                                        ? '#4CAF50'
                                        : day.duration >= 360 // 6 hours
                                          ? '#FFC107'
                                          : '#FF5722',
                                  },
                                  isToday && styles.chartBarToday,
                                ]}
                              />
                            </View>
                            <Text style={[styles.chartDay, isToday && styles.chartDayToday]}>
                              {day.day}
                            </Text>
                          </View>
                        );
                      })}
                    </View>
                  </View>

                  {/* Stats Summary */}
                  {(() => {
                    const stats = getSleepStats();
                    if (!stats) return null;

                    return (
                      <>
                        <View style={styles.statsSection}>
                          <Text style={styles.statsSectionTitle}>Average</Text>
                          <View style={styles.statsCard}>
                            <View style={styles.statsMainStat}>
                              <Text style={styles.statsMainValue}>
                                {formatDuration(stats.average)}
                              </Text>
                              <Text style={styles.statsMainLabel}>per night</Text>
                            </View>
                            <View style={styles.statsSubStats}>
                              <View style={styles.statsSubStat}>
                                <Text style={styles.statsSubLabel}>Avg Bedtime</Text>
                                <Text style={styles.statsSubValue}>{stats.avgBedtime}</Text>
                              </View>
                              <View style={styles.statsSubStat}>
                                <Text style={styles.statsSubLabel}>Avg Wake</Text>
                                <Text style={styles.statsSubValue}>{stats.avgWakeTime}</Text>
                              </View>
                            </View>
                          </View>
                        </View>

                        <View style={styles.statsSection}>
                          <Text style={styles.statsSectionTitle}>Best & Worst</Text>
                          <View style={styles.statsBestWorst}>
                            <View style={[styles.statsBWCard, styles.statsBestCard]}>
                              <Text style={styles.statsBWIcon}>🌟</Text>
                              <Text style={styles.statsBWLabel}>Best Night</Text>
                              <Text style={styles.statsBWValue}>
                                {formatDuration(stats.best.duration)}
                              </Text>
                              <Text style={styles.statsBWDate}>
                                {stats.best.date.toLocaleDateString('en-US', {
                                  month: 'short',
                                  day: 'numeric',
                                })}
                              </Text>
                            </View>
                            <View style={[styles.statsBWCard, styles.statsWorstCard]}>
                              <Text style={styles.statsBWIcon}>😓</Text>
                              <Text style={styles.statsBWLabel}>Worst Night</Text>
                              <Text style={styles.statsBWValue}>
                                {formatDuration(stats.worst.duration)}
                              </Text>
                              <Text style={styles.statsBWDate}>
                                {stats.worst.date.toLocaleDateString('en-US', {
                                  month: 'short',
                                  day: 'numeric',
                                })}
                              </Text>
                            </View>
                          </View>
                        </View>

                        <View style={styles.statsSection}>
                          <Text style={styles.statsTotalNights}>
                            Based on {stats.totalNights} night{stats.totalNights !== 1 ? 's' : ''} of data
                          </Text>
                        </View>
                      </>
                    );
                  })()}
                </>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </LinearGradient>
      </ErrorBoundary>
    </GestureHandlerRootView>
  );
}
