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
  Linking,
  ActivityIndicator,
} from 'react-native';
import { useFonts } from 'expo-font';
import type { Alarm, SleepEntry, Settings, AlarmSound, DismissType, WakeIntensity, TabName, WeeklyDataPoint, SleepStatsResult } from './src/types';
import { GestureHandlerRootView, PanGestureHandler, PanGestureHandlerGestureEvent } from 'react-native-gesture-handler';
import WheelPicker from 'react-native-wheel-scrollview-picker';
import * as Haptics from 'expo-haptics';
import { Audio } from 'expo-av';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { nativeAlarm, scheduleNativeAlarms } from './src/services/nativeAlarm';
import {
  SNOOZE_OPTIONS,
  WAKE_INTENSITY_OPTIONS,
  SOUND_OPTIONS,
  DISMISS_OPTIONS,
  DAYS,
  SLEEP_GOAL_OPTIONS,
} from './src/constants/options';
import { THEMES } from './src/constants/themes';
import {
  formatTimeHHMM,
  formatTimeWithPeriod,
  formatTimeDisplay,
} from './src/utils/timeFormatting';
import { logger } from './src/utils/logger';
import { InsightsChart } from './src/components/InsightsChart';
import { ErrorBoundary } from './src/components/ErrorBoundary';
import { SettingsPanel } from './src/components/SettingsPanel';
import { AlarmsList } from './src/components/AlarmsList';
import { AlarmsTab } from './src/components/AlarmsTab';
import { MorningTab } from './src/components/MorningTab';
import { AlarmScreen } from './src/components/AlarmScreen';
import { AlarmEditor } from './src/components/AlarmEditor';
import { TimePicker } from './src/components/TimePicker';
import { BedtimeModal } from './src/components/BedtimeModal';
import { SleepInsightModal } from './src/components/SleepInsightModal';
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

// GAP-27: Use the exported setupNotificationHandler (includes GAP-02 silent Android notifications)
if (!isExpoGo) {
  setupNotificationHandler();
}

// Display constants for alarm dismiss UI
const REQUIRED_SHAKES = 20;
const BREATHING_CYCLES_REQUIRED = 3;

export default function App() {
  // === FONT LOADING ===
  const [fontsLoaded] = useFonts({
    Inter_200ExtraLight: require('./assets/fonts/Inter_200ExtraLight.ttf'),
    Inter_300Light: require('./assets/fonts/Inter_300Light.ttf'),
    Inter_400Regular: require('./assets/fonts/Inter_400Regular.ttf'),
    Inter_500Medium: require('./assets/fonts/Inter_500Medium.ttf'),
    Inter_600SemiBold: require('./assets/fonts/Inter_600SemiBold.ttf'),
    Inter_700Bold: require('./assets/fonts/Inter_700Bold.ttf'),
  });

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
    settings.hapticFeedback,
    settings.shakeThreshold
  );

  // === LOCAL STATE ===
  const [currentTime, setCurrentTime] = useState(new Date());

  // Sleep insight modal state
  const [sleepInsightVisible, setSleepInsightVisible] = useState(false);

  // Combined loading state from hooks (includes font loading)
  const isLoaded = alarmsLoaded && !settingsLoading && !sleepLoading && fontsLoaded;

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

  // Schedule native Android alarms whenever alarms change
  useEffect(() => {
    if (!isLoaded) return;
    scheduleNativeAlarms(alarms);
  }, [alarms, isLoaded]);

  // GAP-05 & GAP-31: Track timezone and timestamp for detecting changes on foreground resume
  const lastTimezoneRef = useRef<string>(Intl.DateTimeFormat().resolvedOptions().timeZone);
  const lastForegroundTimestampRef = useRef<number>(Date.now());

  // GAP-10: Track if battery optimization prompt has been shown
  const batteryPromptShownRef = useRef<boolean>(false);

  // Re-schedule native alarms when app comes to foreground + GAP-05/GAP-06/GAP-31 checks
  useEffect(() => {
    const sub = AppState.addEventListener('change', async (state) => {
      if (state === 'active' && isLoaded) {
        // GAP-05: Detect timezone changes and reschedule
        const currentTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        if (currentTimezone !== lastTimezoneRef.current) {
          lastTimezoneRef.current = currentTimezone;
          logger.log('Timezone changed, rescheduling all alarms');
          scheduleAlarmNotificationsService(alarms);
        }

        // GAP-31: Detect significant time jumps (manual time changes)
        const now = Date.now();
        const elapsed = now - lastForegroundTimestampRef.current;
        const expectedMaxElapsed = 24 * 60 * 60 * 1000; // 24 hours
        if (elapsed < -120000 || elapsed > expectedMaxElapsed) {
          logger.log('Significant time change detected, rescheduling all alarms');
          scheduleAlarmNotificationsService(alarms);
        }
        lastForegroundTimestampRef.current = now;

        // Always reschedule native alarms on foreground
        scheduleNativeAlarms(alarms);

        // GAP-06: Check exact alarm permission on foreground resume
        if (Platform.OS === 'android') {
          const hasPermission = await nativeAlarm.checkExactAlarmPermission();
          if (!hasPermission) {
            Alert.alert(
              'Alarm Permission Revoked',
              'SoftWake needs exact alarm permission for reliable alarms. Please re-enable it.',
              [
                { text: 'Open Settings', onPress: () => nativeAlarm.openExactAlarmSettings() },
                { text: 'Later', style: 'cancel' },
              ]
            );
          }
        }
      }
    });
    return () => sub.remove();
  }, [alarms, isLoaded]);

  // Schedule bedtime notification when settings change (AsyncStorage save handled by useSettings hook)
  useEffect(() => {
    if (!isLoaded) return;
    scheduleBedtimeNotificationService(settings);
  }, [settings, isLoaded]);

  // GAP-16: Request notification permissions on mount with user-facing alert on denial
  useEffect(() => {
    if (isExpoGo) return;
    const requestPermissions = async () => {
      const { status } = await Notifications.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Notifications Required',
          'SoftWake needs notification permission for alarms to work. Please enable in Settings.',
          [
            { text: 'Open Settings', onPress: () => Linking.openSettings() },
            { text: 'Later', style: 'cancel' },
          ]
        );
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
  // GAP-02: Only trigger if alarm screen is not already visible (native alarm handles it)
  useEffect(() => {
    if (isExpoGo) return;

    // Listen for notifications received while app is foregrounded
    const notificationReceivedSubscription = Notifications.addNotificationReceivedListener((notification) => {
      const data = notification.request.content.data;
      if (data?.alarmId) {
        // GAP-02: Don't trigger if alarm screen is already showing
        if (alarmScreenVisible) return;
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
        // GAP-02: Don't trigger if alarm screen is already showing
        if (alarmScreenVisible) return;
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
  }, [alarms, triggerAlarmWithReset, alarmScreenVisible]);

  // Check if app was launched from a native alarm notification tap
  useEffect(() => {
    if (!isLoaded || Platform.OS !== 'android') return;

    const checkLaunchAlarm = async () => {
      const launchAlarmId = await nativeAlarm.getLaunchAlarmId();
      if (launchAlarmId) {
        const alarm = alarms.find((a) => a.id === launchAlarmId);
        if (alarm) {
          triggerAlarmWithReset(alarm);
        }
      }
    };
    checkLaunchAlarm();
  }, [isLoaded]);

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
      <LinearGradient colors={theme.gradient as [string, string, string]} style={styles.container}>
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
        <MorningTab theme={theme} hapticFeedback={settings.hapticFeedback} />
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
      <View style={[styles.tabBar, { backgroundColor: theme.cardAlt, borderTopColor: theme.divider }]} accessibilityRole="tablist">
        <TouchableOpacity
          style={styles.tabItem}
          onPress={() => setActiveTab('alarms')}
          activeOpacity={0.7}
          accessibilityLabel="Alarms tab"
          accessibilityRole="tab"
          accessibilityState={{ selected: activeTab === 'alarms' }}
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
          accessibilityLabel="Morning tab"
          accessibilityRole="tab"
          accessibilityState={{ selected: activeTab === 'morning' }}
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
          accessibilityLabel="Insights tab"
          accessibilityRole="tab"
          accessibilityState={{ selected: activeTab === 'insights' }}
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
          accessibilityLabel="Settings tab"
          accessibilityRole="tab"
          accessibilityState={{ selected: activeTab === 'settings' }}
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
      <AlarmScreen
        visible={alarmScreenVisible}
        activeAlarm={activeAlarm}
        theme={theme}
        breathingPhase={breathingPhase}
        breathingCycle={breathingCycle}
        breathingAnim={breathingAnim}
        affirmationComplete={affirmationComplete}
        targetAffirmation={targetAffirmation}
        affirmationText={affirmationText}
        onAffirmationChange={handleAffirmationChange}
        shakeComplete={shakeComplete}
        shakeCount={shakeCount}
        mathComplete={mathComplete}
        mathProblem={mathProblem}
        userAnswer={userAnswer}
        wrongAnswer={wrongAnswer}
        onMathAnswerChange={setUserAnswer}
        onMathSubmit={handleMathDismiss}
        onSnooze={handleSnoozeAlarm}
        onDismiss={handleUnifiedDismiss}
        onSimpleDismiss={handleSimpleDismiss}
      />

      {/* Bedtime Logging Modal */}
      <BedtimeModal
        visible={bedtimeModalVisible}
        bedtimeHour={bedtimeHour}
        bedtimeMinute={bedtimeMinute}
        onHourChange={setBedtimeHour}
        onMinuteChange={setBedtimeMinute}
        hapticFeedback={settings.hapticFeedback}
        onSave={handleSaveBedtimeWithInsight}
        onSkip={handleSkipBedtime}
        TimePicker={TimePicker}
      />

      {/* Sleep Insight Modal */}
      <SleepInsightModal
        visible={sleepInsightVisible}
        insight={getOptimalWakeTime()}
        onCreateAlarm={(hour, minute) => {
          handleAddAlarmWithDefaults();
          setSelectedHour(hour);
          setSelectedMinute(minute);
          setSelectedLabel('Optimal Wake');
          setSleepInsightVisible(false);
        }}
        onDismiss={() => setSleepInsightVisible(false)}
      />



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
