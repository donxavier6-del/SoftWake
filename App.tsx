import { StatusBar } from 'expo-status-bar';
import { useState, useEffect, useRef, useCallback } from 'react';
import {
  StyleSheet,
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
import { GestureHandlerRootView, PanGestureHandler, PanGestureHandlerGestureEvent } from 'react-native-gesture-handler';
import WheelPicker from 'react-native-wheel-scrollview-picker';
import * as Haptics from 'expo-haptics';
import { Audio } from 'expo-av';
import { Accelerometer } from 'expo-sensors';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { nativeAlarm } from './src/services/nativeAlarm';
import { rescheduleAllAlarms, cleanupExpiredAlarms } from './src/services/alarmStorage';

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

type AlarmSound = 'sunrise' | 'ocean' | 'forest' | 'chimes' | 'piano' | 'birds';
type DismissType = 'simple' | 'breathing' | 'affirmation' | 'math' | 'shake';
type WakeIntensity = 'whisper' | 'gentle' | 'moderate' | 'energetic';
type TabName = 'alarms' | 'morning' | 'insights' | 'settings';

type Alarm = {
  id: string;
  hour: number;
  minute: number;
  days: boolean[];
  enabled: boolean;
  label: string;
  snooze: number;
  wakeIntensity: WakeIntensity;
  sound: AlarmSound;
  dismissType: DismissType;
};

type MathProblem = {
  question: string;
  answer: number;
};

type SleepEntry = {
  id: string;
  bedtime: number; // timestamp
  wakeTime: number; // timestamp
  sleepDuration: number; // minutes
};

type Settings = {
  bedtimeReminderEnabled: boolean;
  bedtimeHour: number;
  bedtimeMinute: number;
  defaultWakeIntensity: WakeIntensity;
  defaultSound: AlarmSound;
  defaultDismissType: DismissType;
  sleepGoalHours: number;
  darkMode: boolean;
  hapticFeedback: boolean;
};

const SNOOZE_OPTIONS = [
  { label: 'Off', value: 0 },
  { label: '5 min', value: 5 },
  { label: '10 min', value: 10 },
  { label: '15 min', value: 15 },
  { label: '30 min', value: 30 },
];

const WAKE_INTENSITY_OPTIONS: { label: string; value: WakeIntensity; volume: number }[] = [
  { label: 'Whisper', value: 'whisper', volume: 0.3 },
  { label: 'Gentle', value: 'gentle', volume: 0.5 },
  { label: 'Moderate', value: 'moderate', volume: 0.75 },
  { label: 'Energetic', value: 'energetic', volume: 1.0 },
];

const SOUND_OPTIONS: { label: string; value: AlarmSound; icon: string }[] = [
  { label: 'Sunrise', value: 'sunrise', icon: '☀️' },
  { label: 'Ocean', value: 'ocean', icon: '🌊' },
  { label: 'Forest', value: 'forest', icon: '🌲' },
  { label: 'Chimes', value: 'chimes', icon: '🔔' },
  { label: 'Soft Piano', value: 'piano', icon: '🎹' },
  { label: 'Birds', value: 'birds', icon: '🐦' },
];

const DISMISS_OPTIONS: { label: string; value: DismissType; icon: string; description: string; isMission?: boolean }[] = [
  { label: 'Simple', value: 'simple', icon: '⏹️', description: 'One tap to dismiss' },
  { label: 'Breathing Exercise', value: 'breathing', icon: '🌬️', description: 'Complete a breathing cycle', isMission: true },
  { label: 'Type Affirmation', value: 'affirmation', icon: '✨', description: 'Type an affirmation to dismiss', isMission: true },
  { label: 'Math Problem', value: 'math', icon: '🧮', description: 'Solve a math problem', isMission: true },
  { label: 'Shake Phone', value: 'shake', icon: '📳', description: 'Shake your phone to wake up', isMission: true },
];

const SHAKE_THRESHOLD = 1.5;
const REQUIRED_SHAKES = 20;
const BREATHING_CYCLES_REQUIRED = 3;

const AFFIRMATIONS = [
  'I am ready for today',
];

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const STORAGE_KEY = '@softwake_alarms';
const SLEEP_STORAGE_KEY = '@softwake_sleep_data';
const SETTINGS_STORAGE_KEY = '@softwake_settings';
const BEDTIME_NOTIFICATION_ID = 'bedtime-reminder';
const ALARM_NOTIFICATION_PREFIX = 'alarm-';

const SLEEP_GOAL_OPTIONS = [6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5, 10];

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

// Premium Wheel Time Picker with smooth scrolling like iOS/Android alarm apps
type TimePickerProps = {
  hour: number;
  minute: number;
  onHourChange: (hour: number) => void;
  onMinuteChange: (minute: number) => void;
  minuteStep?: number;
  hapticFeedback?: boolean;
};

// Generate hour data (1-12)
const HOURS = Array.from({ length: 12 }, (_, i) => i + 1);
const AMPM = ['AM', 'PM'];

const TimePicker = ({ hour, minute, onHourChange, onMinuteChange, minuteStep = 1, hapticFeedback = true }: TimePickerProps) => {
  const displayHour = hour % 12 || 12;
  const isPM = hour >= 12;
  const lastHourRef = useRef(displayHour);
  const lastMinuteRef = useRef(minute);
  const lastAmPmRef = useRef(isPM ? 1 : 0);

  // Generate minute options based on step
  const minuteOptions: number[] = [];
  for (let i = 0; i < 60; i += minuteStep) {
    minuteOptions.push(i);
  }

  const handleHourChange = (index: number) => {
    const newDisplayHour = HOURS[index];
    if (newDisplayHour !== lastHourRef.current) {
      lastHourRef.current = newDisplayHour;
      if (hapticFeedback) Haptics.selectionAsync();
      if (isPM) {
        onHourChange(newDisplayHour === 12 ? 12 : newDisplayHour + 12);
      } else {
        onHourChange(newDisplayHour === 12 ? 0 : newDisplayHour);
      }
    }
  };

  const handleMinuteChange = (index: number) => {
    const newMinute = minuteOptions[index];
    if (newMinute !== lastMinuteRef.current) {
      lastMinuteRef.current = newMinute;
      if (hapticFeedback) Haptics.selectionAsync();
      onMinuteChange(newMinute);
    }
  };

  const handleAMPMChange = (index: number) => {
    if (index !== lastAmPmRef.current) {
      lastAmPmRef.current = index;
      if (hapticFeedback) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      if (index === 0 && isPM) {
        onHourChange(hour - 12);
      } else if (index === 1 && !isPM) {
        onHourChange(hour + 12);
      }
    }
  };

  const renderHourItem = (data: number, index: number, isSelected: boolean) => (
    <View style={timePickerStyles.itemContainer}>
      <Text style={[
        timePickerStyles.itemText,
        isSelected && timePickerStyles.selectedItemText
      ]}>
        {data}
      </Text>
    </View>
  );

  const renderMinuteItem = (data: number, index: number, isSelected: boolean) => (
    <View style={timePickerStyles.itemContainer}>
      <Text style={[
        timePickerStyles.itemText,
        isSelected && timePickerStyles.selectedItemText
      ]}>
        {data.toString().padStart(2, '0')}
      </Text>
    </View>
  );

  const renderAMPMItem = (data: string, index: number, isSelected: boolean) => (
    <View style={timePickerStyles.itemContainer}>
      <Text style={[
        timePickerStyles.ampmText,
        isSelected && timePickerStyles.selectedAmpmText
      ]}>
        {data}
      </Text>
    </View>
  );

  return (
    <View style={timePickerStyles.container}>
      {/* Selection highlight overlay */}
      <View style={timePickerStyles.selectionHighlight} pointerEvents="none" />

      {/* Hour picker */}
      <View style={timePickerStyles.wheelWrapper}>
        <WheelPicker
          dataSource={HOURS}
          selectedIndex={HOURS.indexOf(displayHour)}
          onValueChange={(_data: number | undefined, index: number) => handleHourChange(index)}
          renderItem={renderHourItem}
          itemHeight={60}
          wrapperHeight={180}
          wrapperBackground="transparent"
          highlightColor="transparent"
          highlightBorderWidth={0}
        />
      </View>

      <Text style={timePickerStyles.separator}>:</Text>

      {/* Minute picker */}
      <View style={timePickerStyles.wheelWrapper}>
        <WheelPicker
          dataSource={minuteOptions}
          selectedIndex={minuteOptions.indexOf(minute)}
          onValueChange={(_data: number | undefined, index: number) => handleMinuteChange(index)}
          renderItem={renderMinuteItem}
          itemHeight={60}
          wrapperHeight={180}
          wrapperBackground="transparent"
          highlightColor="transparent"
          highlightBorderWidth={0}
        />
      </View>

      {/* AM/PM picker */}
      <View style={timePickerStyles.ampmWrapper}>
        <WheelPicker
          dataSource={AMPM}
          selectedIndex={isPM ? 1 : 0}
          onValueChange={(_data: string | undefined, index: number) => handleAMPMChange(index)}
          renderItem={renderAMPMItem}
          itemHeight={60}
          wrapperHeight={180}
          wrapperBackground="transparent"
          highlightColor="transparent"
          highlightBorderWidth={0}
        />
      </View>
    </View>
  );
};

const timePickerStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    backgroundColor: '#1A1A1A',
    borderRadius: 20,
    marginHorizontal: 16,
    marginVertical: 12,
    height: 200,
    position: 'relative',
    overflow: 'hidden',
  },
  selectionHighlight: {
    position: 'absolute',
    left: 16,
    right: 16,
    height: 60,
    top: '50%',
    marginTop: -30,
    backgroundColor: 'rgba(129, 140, 248, 0.12)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(129, 140, 248, 0.25)',
  },
  wheelWrapper: {
    width: 80,
    height: 180,
    overflow: 'hidden',
  },
  ampmWrapper: {
    width: 70,
    height: 180,
    overflow: 'hidden',
    marginLeft: 8,
  },
  itemContainer: {
    height: 60,
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemText: {
    fontSize: 36,
    fontWeight: '200',
    color: 'rgba(255, 255, 255, 0.35)',
  },
  selectedItemText: {
    fontSize: 42,
    fontWeight: '300',
    color: '#FFFFFF',
  },
  ampmText: {
    fontSize: 24,
    fontWeight: '400',
    color: 'rgba(255, 255, 255, 0.35)',
  },
  selectedAmpmText: {
    fontSize: 28,
    fontWeight: '500',
    color: '#FFFFFF',
  },
  separator: {
    fontSize: 42,
    fontWeight: '200',
    color: '#FFFFFF',
    marginHorizontal: 4,
  },
});

const generateMathProblem = (): MathProblem => {
  const operations = ['+', '-', '*'];
  const operation = operations[Math.floor(Math.random() * operations.length)];
  let a: number, b: number, answer: number;

  switch (operation) {
    case '+':
      a = Math.floor(Math.random() * 50) + 10;
      b = Math.floor(Math.random() * 50) + 10;
      answer = a + b;
      break;
    case '-':
      a = Math.floor(Math.random() * 50) + 30;
      b = Math.floor(Math.random() * 30) + 1;
      answer = a - b;
      break;
    case '*':
      a = Math.floor(Math.random() * 12) + 2;
      b = Math.floor(Math.random() * 12) + 2;
      answer = a * b;
      break;
    default:
      a = 10;
      b = 10;
      answer = 20;
  }

  return {
    question: `${a} ${operation} ${b}`,
    answer,
  };
};

export default function App() {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [modalVisible, setModalVisible] = useState(false);
  const [alarms, setAlarms] = useState<Alarm[]>([]);
  const [alarmScreenVisible, setAlarmScreenVisible] = useState(false);
  const [activeAlarm, setActiveAlarm] = useState<Alarm | null>(null);
  const [mathProblem, setMathProblem] = useState<MathProblem>(generateMathProblem());
  const [userAnswer, setUserAnswer] = useState('');
  const [wrongAnswer, setWrongAnswer] = useState(false);
  const [mathComplete, setMathComplete] = useState(false);

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

  // Breathing exercise state
  const [breathingPhase, setBreathingPhase] = useState<'inhale' | 'hold' | 'exhale' | 'complete'>('inhale');
  const [breathingCycle, setBreathingCycle] = useState(0);
  const breathingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const breathingAnim = useRef(new Animated.Value(0.4)).current;

  // Affirmation state
  const [affirmationText, setAffirmationText] = useState('');
  const [targetAffirmation, setTargetAffirmation] = useState(AFFIRMATIONS[0]);
  const [affirmationComplete, setAffirmationComplete] = useState(false);

  // New alarm state
  const [selectedHour, setSelectedHour] = useState(8);
  const [selectedMinute, setSelectedMinute] = useState(0);
  const [selectedDays, setSelectedDays] = useState<boolean[]>([
    false, false, false, false, false, false, false,
  ]);
  const [selectedLabel, setSelectedLabel] = useState('');
  const [selectedSnooze, setSelectedSnooze] = useState(10);
  const [selectedWakeIntensity, setSelectedWakeIntensity] = useState<WakeIntensity>('energetic');
  const [selectedSound, setSelectedSound] = useState<AlarmSound>('sunrise');
  const [selectedDismissType, setSelectedDismissType] = useState<DismissType>('simple');
  const [editingAlarmId, setEditingAlarmId] = useState<string | null>(null);

  // Shake detection state
  const [shakeCount, setShakeCount] = useState(0);
  const [shakeComplete, setShakeComplete] = useState(false);
  const lastShakeTime = useRef<number>(0);

  // Undo delete state
  const [deletedAlarm, setDeletedAlarm] = useState<Alarm | null>(null);
  const [showUndoToast, setShowUndoToast] = useState(false);
  const undoTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Sleep tracking state
  const [sleepData, setSleepData] = useState<SleepEntry[]>([]);
  const [bedtimeModalVisible, setBedtimeModalVisible] = useState(false);
  const [bedtimeHour, setBedtimeHour] = useState(22);
  const [bedtimeMinute, setBedtimeMinute] = useState(0);
  const [pendingWakeTime, setPendingWakeTime] = useState<Date | null>(null);
  const [sleepInsightVisible, setSleepInsightVisible] = useState(false);

  // Audio
  const soundRef = useRef<Audio.Sound | null>(null);
  const lastTriggeredRef = useRef<string>('');
  const [isLoaded, setIsLoaded] = useState(false);

  // Settings state
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const theme = settings.darkMode ? THEMES.dark : THEMES.light;
  const [bedtimePickerVisible, setBedtimePickerVisible] = useState(false);

  // Stats modal state
  const [statsModalVisible, setStatsModalVisible] = useState(false);

  // Tab navigation state
  const [activeTab, setActiveTab] = useState<TabName>('alarms');

  // Load alarms, sleep data, and settings from storage on mount
  useEffect(() => {
    const loadData = async () => {
      try {
        const [storedAlarms, storedSleep, storedSettings] = await Promise.all([
          AsyncStorage.getItem(STORAGE_KEY),
          AsyncStorage.getItem(SLEEP_STORAGE_KEY),
          AsyncStorage.getItem(SETTINGS_STORAGE_KEY),
        ]);
        if (storedAlarms) {
          setAlarms(JSON.parse(storedAlarms));
        }
        if (storedSleep) {
          setSleepData(JSON.parse(storedSleep));
        }
        if (storedSettings) {
          const parsedSettings = JSON.parse(storedSettings);
          setSettings({ ...DEFAULT_SETTINGS, ...parsedSettings });
        }
      } catch (error) {
        console.log('Error loading data:', error);
      } finally {
        setIsLoaded(true);
      }
    };
    loadData();
  }, []);

  // Save alarms to storage and schedule notifications whenever they change
  useEffect(() => {
    if (!isLoaded) return;
    const saveAlarmsAndSchedule = async () => {
      try {
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(alarms));
        await scheduleAlarmNotifications(alarms);
      } catch (error) {
        console.log('Error saving alarms:', error);
      }
    };
    saveAlarmsAndSchedule();
  }, [alarms, isLoaded]);

  // Save sleep data to storage whenever it changes
  useEffect(() => {
    if (!isLoaded) return;
    const saveSleepData = async () => {
      try {
        await AsyncStorage.setItem(SLEEP_STORAGE_KEY, JSON.stringify(sleepData));
      } catch (error) {
        console.log('Error saving sleep data:', error);
      }
    };
    saveSleepData();
  }, [sleepData, isLoaded]);

  // Save settings and schedule bedtime notification
  useEffect(() => {
    if (!isLoaded) return;
    const saveSettingsAndSchedule = async () => {
      try {
        await AsyncStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
        await scheduleBedtimeNotification();
      } catch (error) {
        console.log('Error saving settings:', error);
      }
    };
    saveSettingsAndSchedule();
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

  const scheduleBedtimeNotification = async () => {
    // Skip notifications in Expo Go (not supported in SDK 53+)
    if (isExpoGo) return;

    // Cancel existing bedtime notification
    await Notifications.cancelScheduledNotificationAsync(BEDTIME_NOTIFICATION_ID).catch(() => {});

    if (!settings.bedtimeReminderEnabled) {
      return;
    }

    // Calculate notification time (30 minutes before bedtime)
    let reminderHour = settings.bedtimeHour;
    let reminderMinute = settings.bedtimeMinute - 30;

    if (reminderMinute < 0) {
      reminderMinute += 60;
      reminderHour -= 1;
      if (reminderHour < 0) {
        reminderHour = 23;
      }
    }

    // Schedule daily notification
    await Notifications.scheduleNotificationAsync({
      identifier: BEDTIME_NOTIFICATION_ID,
      content: {
        title: 'Time to Wind Down',
        body: `Your target bedtime is in 30 minutes. Start preparing for sleep!`,
        sound: true,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour: reminderHour,
        minute: reminderMinute,
      },
    });
  };

  // Schedule alarm notifications so they fire even when app is killed
  const scheduleAlarmNotifications = async (alarmsToSchedule: Alarm[]) => {
    // Skip notifications in Expo Go (not supported in SDK 53+)
    if (isExpoGo) return;

    // Cancel all existing alarm notifications
    const scheduledNotifications = await Notifications.getAllScheduledNotificationsAsync();
    for (const notification of scheduledNotifications) {
      if (notification.identifier.startsWith(ALARM_NOTIFICATION_PREFIX)) {
        await Notifications.cancelScheduledNotificationAsync(notification.identifier);
      }
    }

    // Schedule notifications for each enabled alarm
    for (const alarm of alarmsToSchedule) {
      if (!alarm.enabled) continue;

      const formatTime = (h: number, m: number) => {
        const displayHour = h % 12 || 12;
        const ampm = h >= 12 ? 'PM' : 'AM';
        return `${displayHour}:${m.toString().padStart(2, '0')} ${ampm}`;
      };

      const hasRepeatingDays = alarm.days.some((d) => d);

      if (hasRepeatingDays) {
        // Schedule for each selected day of the week
        for (let dayIndex = 0; dayIndex < 7; dayIndex++) {
          if (!alarm.days[dayIndex]) continue;

          // Map dayIndex (0=Sun, 1=Mon, ...) to weekday (1=Sun, 2=Mon, ...)
          const weekday = dayIndex + 1;

          await Notifications.scheduleNotificationAsync({
            identifier: `${ALARM_NOTIFICATION_PREFIX}${alarm.id}-${dayIndex}`,
            content: {
              title: alarm.label || 'SoftWake Alarm',
              body: `Alarm for ${formatTime(alarm.hour, alarm.minute)}`,
              sound: true,
              data: { alarmId: alarm.id },
              ...(Platform.OS === 'android' && { channelId: 'alarms' }),
            },
            trigger: {
              type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
              weekday,
              hour: alarm.hour,
              minute: alarm.minute,
            },
          });
        }
      } else {
        // One-time alarm: schedule for next occurrence
        const now = new Date();
        const alarmDate = new Date();
        alarmDate.setHours(alarm.hour, alarm.minute, 0, 0);

        // If alarm time has passed today, schedule for tomorrow
        if (alarmDate <= now) {
          alarmDate.setDate(alarmDate.getDate() + 1);
        }

        await Notifications.scheduleNotificationAsync({
          identifier: `${ALARM_NOTIFICATION_PREFIX}${alarm.id}-once`,
          content: {
            title: alarm.label || 'SoftWake Alarm',
            body: `Alarm for ${formatTime(alarm.hour, alarm.minute)}`,
            sound: true,
            data: { alarmId: alarm.id },
            ...(Platform.OS === 'android' && { channelId: 'alarms' }),
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DATE,
            date: alarmDate,
          },
        });
      }
    }
  };

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // Check for alarm triggers
  useEffect(() => {
    const now = currentTime;
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    const currentDay = now.getDay();
    const timeKey = `${currentHour}:${currentMinute}`;

    alarms.forEach((alarm) => {
      if (!alarm.enabled) return;
      if (alarm.hour !== currentHour || alarm.minute !== currentMinute) return;

      // Check if alarm should trigger today
      const shouldTrigger = alarm.days.every((d) => !d) || alarm.days[currentDay];
      if (!shouldTrigger) return;

      // Prevent multiple triggers in the same minute
      const alarmKey = `${alarm.id}-${timeKey}`;
      if (lastTriggeredRef.current === alarmKey) return;
      lastTriggeredRef.current = alarmKey;

      triggerAlarm(alarm);
    });
  }, [currentTime, alarms]);

  // Shake detection for alarm dismissal
  useEffect(() => {
    if (!alarmScreenVisible || !activeAlarm || activeAlarm.dismissType !== 'shake') {
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
            handleShakeDismiss();
          }
          return newCount;
        });
      }
    });

    Accelerometer.setUpdateInterval(100);

    return () => {
      subscription.remove();
    };
  }, [alarmScreenVisible, activeAlarm]);

  const handleShakeDismiss = async () => {
    await stopAlarmSound();
    setShakeComplete(true);
    setTimeout(() => {
      setShakeComplete(false);
      setAlarmScreenVisible(false);
      setShakeCount(0);
      setPendingWakeTime(new Date());
      setBedtimeHour(22);
      setBedtimeMinute(0);
      setBedtimeModalVisible(true);
      if (activeAlarm && activeAlarm.days.every((d) => !d)) {
        setAlarms(alarms.map((a) =>
          a.id === activeAlarm.id ? { ...a, enabled: false } : a
        ));
      }
      setActiveAlarm(null);
    }, 2000);
  };

  const handleSimpleDismiss = async () => {
    await stopAlarmSound();
    setAlarmScreenVisible(false);

    // Store wake time and show bedtime prompt
    setPendingWakeTime(new Date());
    setBedtimeHour(22);
    setBedtimeMinute(0);
    setBedtimeModalVisible(true);

    // Disable one-time alarms
    if (activeAlarm && activeAlarm.days.every((d) => !d)) {
      setAlarms(alarms.map((a) =>
        a.id === activeAlarm.id ? { ...a, enabled: false } : a
      ));
    }
    setActiveAlarm(null);
  };

  const animateBreathingCircle = (toValue: number, duration: number) => {
    Animated.timing(breathingAnim, {
      toValue,
      duration,
      useNativeDriver: false,
    }).start();
  };

  const startBreathingExercise = () => {
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
          // Auto-dismiss after showing "Good morning" for 2 seconds
          breathingTimerRef.current = setTimeout(() => {
            handleBreathingDismiss();
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
  };

  const handleBreathingDismiss = async () => {
    if (breathingTimerRef.current) {
      clearTimeout(breathingTimerRef.current);
      breathingTimerRef.current = null;
    }
    await stopAlarmSound();
    setAlarmScreenVisible(false);
    setPendingWakeTime(new Date());
    setBedtimeHour(22);
    setBedtimeMinute(0);
    setBedtimeModalVisible(true);
    if (activeAlarm && activeAlarm.days.every((d) => !d)) {
      setAlarms(alarms.map((a) =>
        a.id === activeAlarm.id ? { ...a, enabled: false } : a
      ));
    }
    setActiveAlarm(null);
  };

  const handleAffirmationChange = async (text: string) => {
    setAffirmationText(text);
    if (text.toLowerCase().trim() === targetAffirmation.toLowerCase()) {
      await stopAlarmSound();
      setAffirmationComplete(true);
      setTimeout(() => {
        setAffirmationComplete(false);
        setAlarmScreenVisible(false);
        setAffirmationText('');
        setPendingWakeTime(new Date());
        setBedtimeHour(22);
        setBedtimeMinute(0);
        setBedtimeModalVisible(true);
        if (activeAlarm && activeAlarm.days.every((d) => !d)) {
          setAlarms(alarms.map((a) =>
            a.id === activeAlarm.id ? { ...a, enabled: false } : a
          ));
        }
        setActiveAlarm(null);
      }, 2000);
    }
  };

  const triggerAlarm = async (alarm: Alarm) => {
    setActiveAlarm(alarm);
    setMathProblem(generateMathProblem());
    setUserAnswer('');
    setAffirmationText('');
    setAffirmationComplete(false);
    setTargetAffirmation(AFFIRMATIONS[Math.floor(Math.random() * AFFIRMATIONS.length)]);
    setWrongAnswer(false);
    setMathComplete(false);
    setShakeCount(0);
    setShakeComplete(false);
    setAlarmScreenVisible(true);

    if (alarm.dismissType === 'breathing') {
      startBreathingExercise();
    }

    await playAlarmSound(alarm.wakeIntensity, alarm.sound);
  };

  // Handle notification received (triggers alarm when notification fires)
  useEffect(() => {
    if (isExpoGo) return;

    // Listen for notifications received while app is foregrounded
    const notificationReceivedSubscription = Notifications.addNotificationReceivedListener((notification) => {
      const data = notification.request.content.data;
      if (data?.alarmId) {
        const alarm = alarms.find((a) => a.id === data.alarmId);
        if (alarm && alarm.enabled) {
          triggerAlarm(alarm);
        }
      }
    });

    // Listen for user tapping on notification (app may be backgrounded/killed)
    const notificationResponseSubscription = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data;
      if (data?.alarmId) {
        const alarm = alarms.find((a) => a.id === data.alarmId);
        if (alarm && alarm.enabled) {
          triggerAlarm(alarm);
        }
      }
    });

    return () => {
      notificationReceivedSubscription.remove();
      notificationResponseSubscription.remove();
    };
  }, [alarms]);

  // Sound configurations for different alarm tones
  const SOUND_CONFIGS: Record<AlarmSound, { rate: number; pattern: number[] | null }> = {
    sunrise: { rate: 1.0, pattern: null }, // Normal, continuous
    ocean: { rate: 0.75, pattern: [3000, 1500] }, // Slow, wave-like with pauses
    forest: { rate: 1.2, pattern: [500, 200, 500, 200, 500, 1500] }, // Higher pitch, bird-like rhythm
    chimes: { rate: 1.1, pattern: [400, 600, 400, 600, 400, 1200] }, // Quick chime pattern
    piano: { rate: 0.85, pattern: [2000, 800] }, // Slower, melodic
    birds: { rate: 1.4, pattern: [300, 150, 300, 150, 300, 150, 300, 1000] }, // High pitch, chirpy
  };

  const patternIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const patternIndexRef = useRef<number>(0);

  const playAlarmSound = async (wakeIntensity: WakeIntensity, soundType: AlarmSound = 'sunrise') => {
    try {
      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
      });

      const config = SOUND_CONFIGS[soundType];
      const intensityOption = WAKE_INTENSITY_OPTIONS.find(o => o.value === wakeIntensity);
      const initialVolume = intensityOption ? intensityOption.volume : 0.5;

      const { sound } = await Audio.Sound.createAsync(
        require('./assets/alarm-sound.mp3'),
        {
          isLooping: true,
          volume: initialVolume,
          rate: config.rate,
          shouldCorrectPitch: false, // Changing rate also changes pitch for distinct sounds
        }
      );

      soundRef.current = sound;
      await sound.playAsync();

      // Apply pattern if defined (creates rhythmic on/off effect)
      if (config.pattern) {
        patternIndexRef.current = 0;
        let isPlaying = true;

        const runPattern = async () => {
          if (!soundRef.current) return;

          const pattern = config.pattern!;
          const duration = pattern[patternIndexRef.current % pattern.length];

          if (isPlaying) {
            await soundRef.current.setVolumeAsync(initialVolume);
          } else {
            await soundRef.current.setVolumeAsync(0.05); // Very quiet instead of silent for smoother effect
          }

          isPlaying = !isPlaying;
          patternIndexRef.current++;

          patternIntervalRef.current = setTimeout(runPattern, duration);
        };

        patternIntervalRef.current = setTimeout(runPattern, config.pattern[0]);
      }

    } catch (error) {
      console.log('Error playing sound:', error);
    }
  };

  const stopAlarmSound = async () => {
    if (patternIntervalRef.current) {
      clearTimeout(patternIntervalRef.current);
      patternIntervalRef.current = null;
    }
    if (soundRef.current) {
      await soundRef.current.stopAsync();
      await soundRef.current.unloadAsync();
      soundRef.current = null;
    }
  };

  const previewSoundRef = useRef<Audio.Sound | null>(null);

  const playPreviewSound = async () => {
    // Stop any existing preview
    if (previewSoundRef.current) {
      await previewSoundRef.current.stopAsync();
      await previewSoundRef.current.unloadAsync();
      previewSoundRef.current = null;
    }

    try {
      const intensityOption = WAKE_INTENSITY_OPTIONS.find(o => o.value === selectedWakeIntensity);
      const volume = intensityOption ? intensityOption.volume : 0.5;
      const config = SOUND_CONFIGS[selectedSound];

      const { sound } = await Audio.Sound.createAsync(
        require('./assets/alarm-sound.mp3'),
        {
          volume,
          rate: config.rate,
          shouldCorrectPitch: false,
        }
      );

      previewSoundRef.current = sound;
      await sound.playAsync();

      // Stop after 2 seconds
      setTimeout(async () => {
        if (previewSoundRef.current) {
          await previewSoundRef.current.stopAsync();
          await previewSoundRef.current.unloadAsync();
          previewSoundRef.current = null;
        }
      }, 2000);
    } catch (error) {
      console.log('Error playing preview:', error);
    }
  };

  const handleDismissAlarm = async () => {
    const answer = parseInt(userAnswer, 10);
    if (answer === mathProblem.answer) {
      await stopAlarmSound();
      setMathComplete(true);
      setTimeout(() => {
        setMathComplete(false);
        setAlarmScreenVisible(false);
        setUserAnswer('');
        setPendingWakeTime(new Date());
        setBedtimeHour(22);
        setBedtimeMinute(0);
        setBedtimeModalVisible(true);
        if (activeAlarm && activeAlarm.days.every((d) => !d)) {
          setAlarms(alarms.map((a) =>
            a.id === activeAlarm.id ? { ...a, enabled: false } : a
          ));
        }
        setActiveAlarm(null);
      }, 2000);
    } else {
      setWrongAnswer(true);
      setUserAnswer('');
      setTimeout(() => {
        setWrongAnswer(false);
        setMathProblem(generateMathProblem());
      }, 500);
    }
  };

  const handleSnoozeAlarm = async () => {
    if (!activeAlarm || activeAlarm.snooze === 0) return;

    if (breathingTimerRef.current) {
      clearTimeout(breathingTimerRef.current);
      breathingTimerRef.current = null;
    }
    await stopAlarmSound();
    setAlarmScreenVisible(false);

    // Schedule snooze
    setTimeout(() => {
      if (activeAlarm) {
        triggerAlarm(activeAlarm);
      }
    }, activeAlarm.snooze * 60 * 1000);

    setActiveAlarm(null);
  };

  const formatTime = (date: Date) => {
    const hours = date.getHours();
    const minutes = date.getMinutes();
    const displayHours = hours % 12 || 12;
    const ampm = hours >= 12 ? 'PM' : 'AM';
    return {
      time: `${displayHours}:${minutes.toString().padStart(2, '0')}`,
      ampm,
    };
  };

  const formatAlarmTime = (hour: number, minute: number) => {
    const displayHour = hour % 12 || 12;
    const ampm = hour >= 12 ? 'PM' : 'AM';
    return `${displayHour}:${minute.toString().padStart(2, '0')} ${ampm}`;
  };

  const { time, ampm } = formatTime(currentTime);

  const getNextAlarmCountdown = (): { hours: number; minutes: number } | null => {
    const enabledAlarms = alarms.filter(a => a.enabled);
    if (enabledAlarms.length === 0) return null;

    const now = currentTime;
    let minDiff = Infinity;

    for (const alarm of enabledAlarms) {
      if (alarm.days.some(d => d)) {
        for (let i = 0; i < 7; i++) {
          const dayIndex = (now.getDay() + i) % 7;
          if (alarm.days[dayIndex]) {
            const candidate = new Date(now);
            candidate.setDate(now.getDate() + i);
            candidate.setHours(alarm.hour, alarm.minute, 0, 0);
            if (candidate.getTime() > now.getTime()) {
              const diff = candidate.getTime() - now.getTime();
              if (diff < minDiff) minDiff = diff;
              break;
            }
          }
        }
      } else {
        const alarmDate = new Date(now);
        alarmDate.setHours(alarm.hour, alarm.minute, 0, 0);
        if (alarmDate.getTime() <= now.getTime()) {
          alarmDate.setDate(alarmDate.getDate() + 1);
        }
        const diff = alarmDate.getTime() - now.getTime();
        if (diff < minDiff) minDiff = diff;
      }
    }

    if (minDiff === Infinity) return null;

    const totalMinutes = Math.floor(minDiff / 60000);
    return {
      hours: Math.floor(totalMinutes / 60),
      minutes: totalMinutes % 60,
    };
  };

  const formatCountdownText = (): string => {
    const countdown = getNextAlarmCountdown();
    if (!countdown) return '';
    const { hours, minutes } = countdown;
    if (hours > 0 && minutes > 0) {
      return `${hours} hr ${minutes} min of rest ahead`;
    } else if (hours > 0) {
      return `${hours} hour${hours !== 1 ? 's' : ''} of rest ahead`;
    } else {
      return `${minutes} min of rest ahead`;
    }
  };

  const handleAddAlarm = () => {
    setEditingAlarmId(null);
    setSelectedHour(8);
    setSelectedMinute(0);
    setSelectedDays([false, false, false, false, false, false, false]);
    setSelectedLabel('');
    setSelectedSnooze(10);
    setSelectedWakeIntensity(settings.defaultWakeIntensity);
    setSelectedSound(settings.defaultSound);
    setSelectedDismissType(settings.defaultDismissType);
    setModalVisible(true);
  };

  const handleEditAlarm = (alarm: Alarm) => {
    setEditingAlarmId(alarm.id);
    setSelectedHour(alarm.hour);
    setSelectedMinute(alarm.minute);
    setSelectedDays([...alarm.days]);
    setSelectedLabel(alarm.label);
    setSelectedSnooze(alarm.snooze);
    setSelectedWakeIntensity(alarm.wakeIntensity || 'energetic');
    setSelectedSound(alarm.sound || 'sunrise');
    const dismissType = (alarm.dismissType as string) === 'off' ? 'simple' : (alarm.dismissType || 'simple');
    setSelectedDismissType(dismissType);
    setModalVisible(true);
  };

  const toggleDay = (index: number) => {
    const newDays = [...selectedDays];
    newDays[index] = !newDays[index];
    setSelectedDays(newDays);
  };

  const handleSaveAlarm = () => {
    if (previewSoundRef.current) { previewSoundRef.current.stopAsync(); previewSoundRef.current.unloadAsync(); previewSoundRef.current = null; }
    if (editingAlarmId) {
      // Update existing alarm
      setAlarms(alarms.map((alarm) =>
        alarm.id === editingAlarmId
          ? {
              ...alarm,
              hour: selectedHour,
              minute: selectedMinute,
              days: selectedDays,
              label: selectedLabel,
              snooze: selectedSnooze,
              wakeIntensity: selectedWakeIntensity,
              sound: selectedSound,
              dismissType: selectedDismissType,
            }
          : alarm
      ));
    } else {
      // Create new alarm
      const newAlarm: Alarm = {
        id: Date.now().toString(),
        hour: selectedHour,
        minute: selectedMinute,
        days: selectedDays,
        enabled: true,
        label: selectedLabel,
        snooze: selectedSnooze,
        wakeIntensity: selectedWakeIntensity,
        sound: selectedSound,
        dismissType: selectedDismissType,
      };
      setAlarms([...alarms, newAlarm]);
    }
    setModalVisible(false);
    setEditingAlarmId(null);
  };

  const getRepeatText = (days: boolean[]) => {
    if (days.every((d) => !d)) return 'Once';
    if (days.every((d) => d)) return 'Every day';
    if (days.slice(1, 6).every((d) => d) && !days[0] && !days[6]) return 'Weekdays';
    if (days[0] && days[6] && days.slice(1, 6).every((d) => !d)) return 'Weekends';
    return days
      .map((selected, i) => (selected ? DAYS[i] : null))
      .filter(Boolean)
      .join(', ');
  };

  const toggleAlarm = (id: string) => {
    setAlarms(alarms.map((alarm) =>
      alarm.id === id ? { ...alarm, enabled: !alarm.enabled } : alarm
    ));
  };

  const deleteAlarm = (id: string) => {
    const alarmToDelete = alarms.find((alarm) => alarm.id === id);
    if (!alarmToDelete) return;

    // Clear any existing undo timer
    if (undoTimerRef.current) {
      clearTimeout(undoTimerRef.current);
    }

    // Store deleted alarm for undo
    setDeletedAlarm(alarmToDelete);
    setShowUndoToast(true);
    setAlarms(alarms.filter((alarm) => alarm.id !== id));

    // Haptic feedback
    if (settings.hapticFeedback) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }

    // Auto-hide toast after 3 seconds
    undoTimerRef.current = setTimeout(() => {
      setShowUndoToast(false);
      setDeletedAlarm(null);
    }, 3000);
  };

  const undoDelete = () => {
    if (deletedAlarm) {
      setAlarms((prev) => [...prev, deletedAlarm]);
      setDeletedAlarm(null);
      setShowUndoToast(false);
      if (undoTimerRef.current) {
        clearTimeout(undoTimerRef.current);
      }
    }
  };

  const updateSettings = (partial: Partial<Settings>) => {
    setSettings((prev) => ({ ...prev, ...partial }));
  };

  const formatSettingsTime = (hour: number, minute: number) => {
    const displayHour = hour % 12 || 12;
    const ampm = hour >= 12 ? 'PM' : 'AM';
    return `${displayHour}:${minute.toString().padStart(2, '0')} ${ampm}`;
  };

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  };

  const getWeeklyData = () => {
    const now = new Date();
    const weekData: { day: string; duration: number; date: Date }[] = [];

    // Get last 7 days
    for (let i = 6; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      date.setHours(0, 0, 0, 0);

      const nextDate = new Date(date);
      nextDate.setDate(nextDate.getDate() + 1);

      // Find sleep entry for this day (based on wake time)
      const entry = sleepData.find((e) => {
        const wakeDate = new Date(e.wakeTime);
        return wakeDate >= date && wakeDate < nextDate;
      });

      weekData.push({
        day: DAYS[date.getDay()],
        duration: entry ? entry.sleepDuration : 0,
        date,
      });
    }

    return weekData;
  };

  const getSleepStats = () => {
    if (sleepData.length === 0) {
      return null;
    }

    const durations = sleepData.map((e) => e.sleepDuration);
    const total = durations.reduce((sum, d) => sum + d, 0);
    const average = Math.round(total / durations.length);

    const best = sleepData.reduce((max, e) =>
      e.sleepDuration > max.sleepDuration ? e : max
    );
    const worst = sleepData.reduce((min, e) =>
      e.sleepDuration < min.sleepDuration ? e : min
    );

    // Calculate average bedtime
    const bedtimeMinutes = sleepData.map((e) => {
      const bed = new Date(e.bedtime);
      let mins = bed.getHours() * 60 + bed.getMinutes();
      if (mins < 720) mins += 1440; // After midnight, add 24h
      return mins;
    });
    const avgBedtimeMinutes = Math.round(
      bedtimeMinutes.reduce((sum, m) => sum + m, 0) / bedtimeMinutes.length
    ) % 1440;
    const avgBedtimeHour = Math.floor(avgBedtimeMinutes / 60);
    const avgBedtimeMinute = avgBedtimeMinutes % 60;

    // Calculate average wake time
    const wakeMinutes = sleepData.map((e) => {
      const wake = new Date(e.wakeTime);
      return wake.getHours() * 60 + wake.getMinutes();
    });
    const avgWakeMinutes = Math.round(
      wakeMinutes.reduce((sum, m) => sum + m, 0) / wakeMinutes.length
    );
    const avgWakeHour = Math.floor(avgWakeMinutes / 60);
    const avgWakeMinute = avgWakeMinutes % 60;

    return {
      average,
      best: {
        duration: best.sleepDuration,
        date: new Date(best.wakeTime),
      },
      worst: {
        duration: worst.sleepDuration,
        date: new Date(worst.wakeTime),
      },
      totalNights: sleepData.length,
      avgBedtime: formatSettingsTime(avgBedtimeHour, avgBedtimeMinute),
      avgWakeTime: formatSettingsTime(avgWakeHour, avgWakeMinute),
    };
  };

  const handleSaveBedtime = () => {
    if (!pendingWakeTime) return;

    // Calculate bedtime timestamp (previous day if bedtime hour > wake hour)
    const wakeTime = pendingWakeTime;
    const bedtime = new Date(wakeTime);
    bedtime.setHours(bedtimeHour, bedtimeMinute, 0, 0);

    // If bedtime is after wake time, it was the previous day
    if (bedtime >= wakeTime) {
      bedtime.setDate(bedtime.getDate() - 1);
    }

    const sleepDuration = Math.round((wakeTime.getTime() - bedtime.getTime()) / (1000 * 60));

    const newEntry: SleepEntry = {
      id: Date.now().toString(),
      bedtime: bedtime.getTime(),
      wakeTime: wakeTime.getTime(),
      sleepDuration,
    };

    const updatedSleepData = [...sleepData, newEntry];
    setSleepData(updatedSleepData);
    setBedtimeModalVisible(false);
    setPendingWakeTime(null);

    // Show insight if we have 7+ entries
    if (updatedSleepData.length >= 7) {
      setSleepInsightVisible(true);
    }
  };

  const handleSkipBedtime = () => {
    setBedtimeModalVisible(false);
    setPendingWakeTime(null);
  };

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

  const SWIPE_THRESHOLD = 80;

  const createSwipeHandler = (alarmId: string) => {
    return (event: PanGestureHandlerGestureEvent) => {
      const { translationX, translationY } = event.nativeEvent;
      // Swipe left (negative X) or swipe down (positive Y) to delete
      if (translationX < -SWIPE_THRESHOLD || translationY > SWIPE_THRESHOLD) {
        deleteAlarm(alarmId);
      }
    };
  };

  return (
    <GestureHandlerRootView style={styles.container}>
      <LinearGradient colors={[...theme.gradient]} style={styles.container}>
      <StatusBar style={settings.darkMode ? 'light' : 'dark'} />

      {/* Tab Content */}
      {activeTab === 'alarms' && (
        <View style={styles.tabContent}>
          <View style={styles.clockContainer}>
            <Text style={[styles.timeText, { color: theme.text }]}>{time}</Text>
            <Text style={[styles.ampmText, { color: theme.textMuted }]}>{ampm}</Text>
          </View>

          <Text style={[styles.dateText, { color: theme.textMuted }]}>
            {currentTime.toLocaleDateString('en-US', {
              weekday: 'long',
              month: 'long',
              day: 'numeric',
            })}
          </Text>

          <View style={styles.countdownContainer}>
            {alarms.some(a => a.enabled) ? (
              <>
                <Text style={[styles.countdownIcon, { color: theme.textMuted }]}>☽</Text>
                <Text style={[styles.countdownText, { color: theme.textMuted }]}>{formatCountdownText()}</Text>
              </>
            ) : (
              <>
                <Text style={[styles.countdownIcon, { color: theme.textMuted }]}>☁</Text>
                <Text style={[styles.countdownText, { color: theme.textMuted }]}>No alarms set – sleep well tonight</Text>
              </>
            )}
          </View>

          <View style={styles.alarmsContainer}>
            <Text style={[styles.sectionTitle, { color: theme.textMuted }]}>Alarms</Text>
            {alarms.length === 0 ? (
              <Text style={[styles.noAlarmsText, { color: theme.textMuted }]}>No alarms set</Text>
            ) : (
              <ScrollView style={styles.alarmsList} showsVerticalScrollIndicator={false}>
                {alarms.map((alarm) => (
                  <PanGestureHandler
                    key={alarm.id}
                    onEnded={createSwipeHandler(alarm.id)}
                    activeOffsetX={[-20, 20]}
                    activeOffsetY={[-20, 20]}
                  >
                    <View style={[styles.alarmItem, { backgroundColor: theme.card }]}>
                      <TouchableOpacity
                        style={styles.alarmInfo}
                        onPress={() => handleEditAlarm(alarm)}
                        activeOpacity={0.7}
                      >
                        <Text style={[
                          styles.alarmTime,
                          { color: theme.text },
                          !alarm.enabled && { color: theme.textDisabled },
                        ]}>
                          {formatAlarmTime(alarm.hour, alarm.minute)}
                        </Text>
                        <Text style={[
                          styles.alarmDays,
                          { color: theme.textMuted },
                          !alarm.enabled && { color: theme.textDisabled },
                        ]}>
                          {alarm.label ? `${alarm.label} · ` : ''}{getRepeatText(alarm.days)}
                          {alarm.wakeIntensity && alarm.wakeIntensity !== 'energetic' ? ` · ${alarm.wakeIntensity.charAt(0).toUpperCase() + alarm.wakeIntensity.slice(1)}` : ''}
                        </Text>
                      </TouchableOpacity>
                      <Switch
                        value={alarm.enabled}
                        onValueChange={() => toggleAlarm(alarm.id)}
                        trackColor={{ false: theme.switchTrackOff, true: theme.accent }}
                        thumbColor={alarm.enabled ? '#FFFFFF' : theme.switchThumbOff}
                      />
                    </View>
                  </PanGestureHandler>
                ))}
              </ScrollView>
            )}
          </View>

          <TouchableOpacity style={[styles.addButton, { backgroundColor: theme.accent }]} onPress={handleAddAlarm}>
            <Text style={styles.addButtonText}>+</Text>
          </TouchableOpacity>
        </View>
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
        <ScrollView style={styles.insightsContainer} showsVerticalScrollIndicator={false}>
          <Text style={[styles.insightsTitle, { color: theme.text }]}>Sleep Insights</Text>

          {/* Weekly Sleep Chart */}
          <View style={[styles.insightsCard, { backgroundColor: theme.card }]}>
            <Text style={[styles.insightsCardLabel, { color: theme.textMuted }]}>This Week</Text>
            <View style={styles.insightsChart}>
              {[
                { day: 'M', hrs: 7.5 },
                { day: 'T', hrs: 6.2 },
                { day: 'W', hrs: 7.8 },
                { day: 'T', hrs: 5.5 },
                { day: 'F', hrs: 7.0 },
                { day: 'S', hrs: 8.2 },
                { day: 'S', hrs: 7.0 },
              ].map((d, i) => (
                <View key={i} style={styles.insightsBarCol}>
                  <View style={[styles.insightsBarTrack, { backgroundColor: theme.surface }]}>
                    <View style={[styles.insightsBar, { height: `${(d.hrs / 10) * 100}%`, backgroundColor: theme.accent }]} />
                  </View>
                  <Text style={[styles.insightsBarLabel, { color: theme.textMuted }]}>{d.day}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* Stats Row */}
          <View style={styles.insightsStatsRow}>
            <View style={[styles.insightsStatBox, { backgroundColor: theme.card }]}>
              <Text style={[styles.insightsStatValue, { color: theme.text }]}>7.2 hrs</Text>
              <Text style={[styles.insightsStatLabel, { color: theme.textMuted }]}>Avg Sleep</Text>
            </View>
            <View style={[styles.insightsStatBox, { backgroundColor: theme.card }]}>
              <Text style={[styles.insightsStatValue, { color: theme.text }]}>8 hrs</Text>
              <Text style={[styles.insightsStatLabel, { color: theme.textMuted }]}>Sleep Goal</Text>
            </View>
          </View>

          {/* Sleep Debt Card */}
          <View style={[styles.insightsCard, { backgroundColor: theme.card }]}>
            <Text style={[styles.insightsCardLabel, { color: theme.textMuted }]}>Sleep Debt</Text>
            <Text style={[styles.insightsCardValue, { color: theme.text }]}>You're 5.6 hrs behind this week</Text>
          </View>

          {/* Tip Card */}
          <View style={[styles.insightsCard, styles.insightsTipCard, { backgroundColor: theme.accentAlt }]}>
            <Text style={styles.insightsTipLabel}>Tip</Text>
            <Text style={styles.insightsTipText}>Try going to bed 15 minutes earlier tonight</Text>
          </View>
        </ScrollView>
      )}

      {activeTab === 'settings' && (
        <ScrollView style={styles.settingsTabContent} showsVerticalScrollIndicator={false}>
          {/* Alarm Defaults */}
          <Text style={[styles.settingsSectionHeader, { color: theme.textMuted }]}>Alarm Defaults</Text>
          <View style={[styles.settingsCard, { backgroundColor: theme.card }]}>
            <TouchableOpacity
              style={styles.settingsItem}
              onPress={() => {
                const currentIndex = WAKE_INTENSITY_OPTIONS.findIndex((o) => o.value === settings.defaultWakeIntensity);
                const nextIndex = (currentIndex + 1) % WAKE_INTENSITY_OPTIONS.length;
                updateSettings({ defaultWakeIntensity: WAKE_INTENSITY_OPTIONS[nextIndex].value });
              }}
            >
              <Text style={[styles.settingsItemLabel, { color: theme.text }]}>Wake Intensity</Text>
              <Text style={[styles.settingsItemValue, { color: theme.textMuted }]}>
                {WAKE_INTENSITY_OPTIONS.find((o) => o.value === settings.defaultWakeIntensity)?.label}
              </Text>
            </TouchableOpacity>
            <View style={[styles.settingsDivider, { backgroundColor: theme.surface }]} />
            <TouchableOpacity
              style={styles.settingsItem}
              onPress={() => {
                const currentIndex = SOUND_OPTIONS.findIndex((o) => o.value === settings.defaultSound);
                const nextIndex = (currentIndex + 1) % SOUND_OPTIONS.length;
                updateSettings({ defaultSound: SOUND_OPTIONS[nextIndex].value });
              }}
            >
              <Text style={[styles.settingsItemLabel, { color: theme.text }]}>Sound</Text>
              <Text style={[styles.settingsItemValue, { color: theme.textMuted }]}>
                {SOUND_OPTIONS.find((o) => o.value === settings.defaultSound)?.label}
              </Text>
            </TouchableOpacity>
            <View style={[styles.settingsDivider, { backgroundColor: theme.surface }]} />
            <TouchableOpacity
              style={styles.settingsItem}
              onPress={() => {
                const currentIndex = DISMISS_OPTIONS.findIndex((o) => o.value === settings.defaultDismissType);
                const nextIndex = (currentIndex + 1) % DISMISS_OPTIONS.length;
                updateSettings({ defaultDismissType: DISMISS_OPTIONS[nextIndex].value });
              }}
            >
              <Text style={[styles.settingsItemLabel, { color: theme.text }]}>Dismiss Method</Text>
              <Text style={[styles.settingsItemValue, { color: theme.textMuted }]}>
                {DISMISS_OPTIONS.find((o) => o.value === settings.defaultDismissType)?.label}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Sleep */}
          <Text style={[styles.settingsSectionHeader, { color: theme.textMuted }]}>Sleep</Text>
          <View style={[styles.settingsCard, { backgroundColor: theme.card }]}>
            <View style={styles.settingsItemRow}>
              <View style={styles.settingsItemLabelContainer}>
                <Text style={[styles.settingsItemLabel, { color: theme.text }]}>Bedtime Reminder</Text>
                {settings.bedtimeReminderEnabled && (
                  <Text style={[styles.settingsItemSubtext, { color: theme.textMuted }]}>
                    Reminder at {formatSettingsTime(
                      settings.bedtimeMinute < 30
                        ? (settings.bedtimeHour === 0 ? 23 : settings.bedtimeHour - 1)
                        : settings.bedtimeHour,
                      settings.bedtimeMinute < 30
                        ? settings.bedtimeMinute + 30
                        : settings.bedtimeMinute - 30
                    )}
                  </Text>
                )}
              </View>
              <Switch
                value={settings.bedtimeReminderEnabled}
                onValueChange={(val) => {
                  updateSettings({ bedtimeReminderEnabled: val });
                  if (val) setBedtimePickerVisible(true);
                }}
                trackColor={{ false: theme.switchTrackOff, true: theme.accent }}
                thumbColor={settings.bedtimeReminderEnabled ? '#FFFFFF' : theme.switchThumbOff}
              />
            </View>
            {settings.bedtimeReminderEnabled && bedtimePickerVisible && (
              <>
                <View style={[styles.settingsDivider, { backgroundColor: theme.surface }]} />
                <View style={styles.settingsBedtimePicker}>
                  <Text style={[styles.settingsPickerLabel, { color: theme.text }]}>Target Bedtime</Text>
                  <TimePicker
                    hour={settings.bedtimeHour}
                    minute={settings.bedtimeMinute}
                    onHourChange={(h) => updateSettings({ bedtimeHour: h })}
                    onMinuteChange={(m) => updateSettings({ bedtimeMinute: m })}
                    hapticFeedback={settings.hapticFeedback}
                    minuteStep={5}
                  />
                </View>
              </>
            )}
            {settings.bedtimeReminderEnabled && !bedtimePickerVisible && (
              <>
                <View style={[styles.settingsDivider, { backgroundColor: theme.surface }]} />
                <TouchableOpacity
                  style={styles.settingsItem}
                  onPress={() => setBedtimePickerVisible(true)}
                >
                  <Text style={[styles.settingsItemLabel, { color: theme.text }]}>Target Bedtime</Text>
                  <Text style={[styles.settingsItemValue, { color: theme.textMuted }]}>
                    {formatSettingsTime(settings.bedtimeHour, settings.bedtimeMinute)}
                  </Text>
                </TouchableOpacity>
              </>
            )}
            <View style={[styles.settingsDivider, { backgroundColor: theme.surface }]} />
            <TouchableOpacity
              style={styles.settingsItem}
              onPress={() => {
                const currentIndex = SLEEP_GOAL_OPTIONS.indexOf(settings.sleepGoalHours);
                const nextIndex = (currentIndex + 1) % SLEEP_GOAL_OPTIONS.length;
                updateSettings({ sleepGoalHours: SLEEP_GOAL_OPTIONS[nextIndex] });
              }}
            >
              <Text style={[styles.settingsItemLabel, { color: theme.text }]}>Sleep Goal</Text>
              <Text style={[styles.settingsItemValue, { color: theme.textMuted }]}>
                {settings.sleepGoalHours % 1 === 0
                  ? `${settings.sleepGoalHours} hours`
                  : `${Math.floor(settings.sleepGoalHours)}h ${(settings.sleepGoalHours % 1) * 60}m`}
              </Text>
            </TouchableOpacity>
          </View>

          {/* App */}
          <Text style={[styles.settingsSectionHeader, { color: theme.textMuted }]}>App</Text>
          <View style={[styles.settingsCard, { backgroundColor: theme.card }]}>
            <View style={styles.settingsItemRow}>
              <Text style={[styles.settingsItemLabel, { color: theme.text }]}>Dark Mode</Text>
              <Switch
                value={settings.darkMode}
                onValueChange={(val) => updateSettings({ darkMode: val })}
                trackColor={{ false: theme.switchTrackOff, true: theme.accent }}
                thumbColor={settings.darkMode ? '#FFFFFF' : theme.switchThumbOff}
              />
            </View>
            <View style={[styles.settingsDivider, { backgroundColor: theme.surface }]} />
            <View style={styles.settingsItemRow}>
              <Text style={[styles.settingsItemLabel, { color: theme.text }]}>Haptic Feedback</Text>
              <Switch
                value={settings.hapticFeedback}
                onValueChange={(val) => updateSettings({ hapticFeedback: val })}
                trackColor={{ false: theme.switchTrackOff, true: theme.accent }}
                thumbColor={settings.hapticFeedback ? '#FFFFFF' : theme.switchThumbOff}
              />
            </View>
          </View>

          {/* About */}
          <Text style={[styles.settingsSectionHeader, { color: theme.textMuted }]}>About</Text>
          <View style={[styles.settingsCard, { backgroundColor: theme.card }]}>
            <View style={styles.settingsItem}>
              <Text style={[styles.settingsItemLabel, { color: theme.text }]}>Version</Text>
              <Text style={[styles.settingsItemValue, { color: theme.textMuted }]}>1.0.0</Text>
            </View>
            <View style={[styles.settingsDivider, { backgroundColor: theme.surface }]} />
            <TouchableOpacity
              style={styles.settingsItem}
              onPress={() => Alert.alert('Rate SoftWake', 'This will open the app store. (Coming soon)')}
            >
              <Text style={[styles.settingsItemLabel, { color: theme.text }]}>Rate SoftWake</Text>
              <Text style={[styles.settingsItemChevron, { color: theme.textMuted }]}>›</Text>
            </TouchableOpacity>
            <View style={[styles.settingsDivider, { backgroundColor: theme.surface }]} />
            <TouchableOpacity
              style={styles.settingsItem}
              onPress={() => Alert.alert('Send Feedback', 'Feedback form coming soon.')}
            >
              <Text style={[styles.settingsItemLabel, { color: theme.text }]}>Send Feedback</Text>
              <Text style={[styles.settingsItemChevron, { color: theme.textMuted }]}>›</Text>
            </TouchableOpacity>
            <View style={[styles.settingsDivider, { backgroundColor: theme.surface }]} />
            <TouchableOpacity
              style={styles.settingsItem}
              onPress={() => Alert.alert('Privacy Policy', 'Privacy policy page coming soon.')}
            >
              <Text style={[styles.settingsItemLabel, { color: theme.text }]}>Privacy Policy</Text>
              <Text style={[styles.settingsItemChevron, { color: theme.textMuted }]}>›</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.settingsFooter} />
        </ScrollView>
      )}

      {/* Undo Toast */}
      {showUndoToast && (
        <View style={styles.undoToast}>
          <Text style={styles.undoToastText}>Alarm deleted</Text>
          <TouchableOpacity onPress={undoDelete}>
            <Text style={styles.undoButton}>Undo</Text>
          </TouchableOpacity>
        </View>
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

      {/* Add Alarm Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => {
          if (previewSoundRef.current) { previewSoundRef.current.stopAsync(); previewSoundRef.current.unloadAsync(); previewSoundRef.current = null; }
          setModalVisible(false);
          setEditingAlarmId(null);
        }}
      >
        <View style={styles.modalOverlay}>
          <ScrollView style={styles.modalScroll}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <TouchableOpacity onPress={() => {
                  if (previewSoundRef.current) { previewSoundRef.current.stopAsync(); previewSoundRef.current.unloadAsync(); previewSoundRef.current = null; }
                  setModalVisible(false);
                  setEditingAlarmId(null);
                }}>
                  <Text style={styles.cancelButton}>Cancel</Text>
                </TouchableOpacity>
                <Text style={styles.modalTitle}>
                  {editingAlarmId ? 'Edit Alarm' : 'New Alarm'}
                </Text>
                <TouchableOpacity onPress={handleSaveAlarm}>
                  <Text style={styles.saveButton}>Save</Text>
                </TouchableOpacity>
              </View>

              <TimePicker
                hour={selectedHour}
                minute={selectedMinute}
                onHourChange={setSelectedHour}
                onMinuteChange={setSelectedMinute}
                hapticFeedback={settings.hapticFeedback}
              />

              <View style={styles.repeatSection}>
                <Text style={styles.repeatLabel}>Repeat</Text>
                <View style={styles.daysContainer}>
                  {DAYS.map((day, index) => (
                    <TouchableOpacity
                      key={day}
                      onPress={() => toggleDay(index)}
                      style={[
                        styles.dayButton,
                        selectedDays[index] && styles.dayButtonSelected,
                      ]}
                    >
                      <Text
                        style={[
                          styles.dayText,
                          selectedDays[index] && styles.dayTextSelected,
                        ]}
                      >
                        {day[0]}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={styles.labelSection}>
                <Text style={styles.labelTitle}>Label</Text>
                <TextInput
                  style={styles.labelInput}
                  value={selectedLabel}
                  onChangeText={setSelectedLabel}
                  placeholder="Alarm"
                  placeholderTextColor="#444444"
                />
              </View>

              <View style={styles.snoozeSection}>
                <Text style={styles.snoozeTitle}>Snooze</Text>
                <View style={styles.snoozeOptions}>
                  {SNOOZE_OPTIONS.map((option) => (
                    <TouchableOpacity
                      key={option.value}
                      onPress={() => setSelectedSnooze(option.value)}
                      style={[
                        styles.snoozeOption,
                        selectedSnooze === option.value && styles.snoozeOptionSelected,
                      ]}
                    >
                      <Text
                        style={[
                          styles.snoozeOptionText,
                          selectedSnooze === option.value && styles.snoozeOptionTextSelected,
                        ]}
                      >
                        {option.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={styles.wakeIntensitySection}>
                <View style={styles.wakeIntensityHeader}>
                  <Text style={styles.wakeIntensityTitle}>Wake Intensity</Text>
                  <TouchableOpacity
                    onPress={playPreviewSound}
                    style={styles.previewButton}
                  >
                    <Text style={styles.previewButtonIcon}>🔊</Text>
                  </TouchableOpacity>
                </View>
                <View style={styles.wakeIntensityOptions}>
                  {WAKE_INTENSITY_OPTIONS.map((option) => (
                    <TouchableOpacity
                      key={option.value}
                      onPress={() => setSelectedWakeIntensity(option.value)}
                      style={[
                        styles.wakeIntensityOption,
                        selectedWakeIntensity === option.value && styles.wakeIntensityOptionSelected,
                      ]}
                    >
                      <Text
                        style={[
                          styles.wakeIntensityOptionText,
                          selectedWakeIntensity === option.value && styles.wakeIntensityOptionTextSelected,
                        ]}
                      >
                        {option.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={styles.soundSection}>
                <Text style={styles.soundTitle}>Sound</Text>
                <View style={styles.soundOptions}>
                  {SOUND_OPTIONS.map((option) => (
                    <TouchableOpacity
                      key={option.value}
                      onPress={() => setSelectedSound(option.value)}
                      style={[
                        styles.soundOption,
                        selectedSound === option.value && styles.soundOptionSelected,
                      ]}
                    >
                      <Text style={styles.soundOptionIcon}>{option.icon}</Text>
                      <Text
                        style={[
                          styles.soundOptionText,
                          selectedSound === option.value && styles.soundOptionTextSelected,
                        ]}
                      >
                        {option.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={styles.dismissTypeSection}>
                <Text style={styles.dismissTypeTitle}>Dismiss Method</Text>
                <View style={styles.dismissTypeOptions}>
                  {DISMISS_OPTIONS.filter(o => !o.isMission).map((option) => (
                    <TouchableOpacity
                      key={option.value}
                      onPress={() => setSelectedDismissType(option.value)}
                      style={[
                        styles.dismissTypeOption,
                        selectedDismissType === option.value && styles.dismissTypeOptionSelected,
                      ]}
                    >
                      <Text style={styles.dismissTypeIcon}>{option.icon}</Text>
                      <View style={styles.dismissTypeTextContainer}>
                        <Text
                          style={[
                            styles.dismissTypeLabel,
                            selectedDismissType === option.value && styles.dismissTypeLabelSelected,
                          ]}
                        >
                          {option.label}
                        </Text>
                        <Text
                          style={[
                            styles.dismissTypeDescription,
                            selectedDismissType === option.value && styles.dismissTypeDescriptionSelected,
                          ]}
                        >
                          {option.description}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
                <Text style={styles.missionsSubtitle}>Wake-up Missions</Text>
                <Text style={styles.missionsHint}>Optional challenges to help you wake up</Text>
                <View style={styles.dismissTypeOptions}>
                  {DISMISS_OPTIONS.filter(o => o.isMission).map((option) => (
                    <TouchableOpacity
                      key={option.value}
                      onPress={() => setSelectedDismissType(option.value)}
                      style={[
                        styles.dismissTypeOption,
                        selectedDismissType === option.value && styles.dismissTypeOptionSelected,
                      ]}
                    >
                      <Text style={styles.dismissTypeIcon}>{option.icon}</Text>
                      <View style={styles.dismissTypeTextContainer}>
                        <Text
                          style={[
                            styles.dismissTypeLabel,
                            selectedDismissType === option.value && styles.dismissTypeLabelSelected,
                          ]}
                        >
                          {option.label}
                        </Text>
                        <Text
                          style={[
                            styles.dismissTypeDescription,
                            selectedDismissType === option.value && styles.dismissTypeDescriptionSelected,
                          ]}
                        >
                          {option.description}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </View>
          </ScrollView>
        </View>
      </Modal>

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
                  {activeAlarm ? formatAlarmTime(activeAlarm.hour, activeAlarm.minute) : ''}
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
                  onPress={handleDismissAlarm}
                >
                  <Text style={styles.mathSubmitButtonText}>Submit</Text>
                </TouchableOpacity>
              </View>
            )}
          </LinearGradient>
        ) : (
        <View style={styles.alarmScreen}>
          <Text style={styles.alarmScreenTime}>
            {activeAlarm ? formatAlarmTime(activeAlarm.hour, activeAlarm.minute) : ''}
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

            <TouchableOpacity style={styles.saveBedtimeButton} onPress={handleSaveBedtime}>
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
                    {formatAlarmTime(insight.hour, insight.minute)}
                  </Text>
                  <TouchableOpacity
                    style={styles.insightButton}
                    onPress={() => {
                      handleAddAlarm();
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
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0D0D0D',
  },
  clockContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
    marginTop: 40,
  },
  timeText: {
    fontSize: 96,
    fontWeight: '200',
    color: '#FFFFFF',
    letterSpacing: -4,
  },
  ampmText: {
    fontSize: 24,
    fontWeight: '400',
    color: '#666666',
    marginLeft: 8,
  },
  dateText: {
    fontSize: 18,
    color: '#666666',
    textAlign: 'center',
    marginTop: 8,
  },
  countdownContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  countdownIcon: {
    fontSize: 18,
    marginRight: 8,
    opacity: 0.7,
  },
  countdownText: {
    fontSize: 15,
    fontWeight: '300',
    color: '#9999AA',
    letterSpacing: 0.3,
  },
  alarmsContainer: {
    flex: 1,
    marginTop: 24,
    marginHorizontal: -24,
  },
  alarmsList: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666666',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 16,
    paddingHorizontal: 24,
  },
  noAlarmsText: {
    fontSize: 16,
    color: '#444444',
    paddingHorizontal: 24,
  },
  alarmItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingLeft: 24,
    paddingRight: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#1A1A1A',
    backgroundColor: '#0D0D0D',
  },
  alarmInfo: {
    flex: 1,
    marginRight: 16,
    overflow: 'visible',
  },
  alarmTime: {
    fontSize: 32,
    fontWeight: '300',
    color: '#FFFFFF',
    textAlign: 'left',
  },
  alarmTimeDisabled: {
    color: '#444444',
  },
  alarmDays: {
    fontSize: 14,
    color: '#666666',
    marginTop: 4,
  },
  alarmDaysDisabled: {
    color: '#333333',
  },
  undoToast: {
    position: 'absolute',
    bottom: 100,
    left: 24,
    right: 24,
    backgroundColor: '#333333',
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 1000,
  },
  undoToastText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '500',
  },
  undoButton: {
    color: '#818CF8',
    fontSize: 15,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  tabContent: {
    flex: 1,
    paddingTop: 60,
    paddingHorizontal: 24,
  },
  addButton: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#818CF8',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#818CF8',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  addButtonText: {
    fontSize: 28,
    fontWeight: '300',
    color: '#FFFFFF',
    marginTop: -2,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#141414',
    borderTopWidth: 1,
    borderTopColor: '#1F1F1F',
    paddingBottom: Platform.OS === 'ios' ? 34 : 10,
    paddingTop: 10,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  tabIcon: {
    fontSize: 20,
    opacity: 0.4,
  },
  tabIconActive: {
    opacity: 1,
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: '#555555',
    letterSpacing: 0.2,
  },
  tabLabelActive: {
    color: '#818CF8',
    fontWeight: '600',
  },
  placeholderScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  placeholderIcon: {
    fontSize: 48,
    marginBottom: 20,
    opacity: 0.8,
  },
  placeholderTitle: {
    fontSize: 22,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 10,
  },
  placeholderSubtitle: {
    fontSize: 15,
    color: '#555555',
    textAlign: 'center',
    lineHeight: 22,
  },
  morningContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  morningGreeting: {
    fontSize: 32,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 12,
  },
  morningQuote: {
    fontSize: 16,
    color: '#9999AA',
    fontStyle: 'italic',
    textAlign: 'center',
    marginBottom: 48,
  },
  morningButtons: {
    flexDirection: 'row',
    gap: 16,
  },
  morningButton: {
    backgroundColor: 'rgba(129, 140, 248, 0.15)',
    borderRadius: 16,
    paddingVertical: 20,
    paddingHorizontal: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(129, 140, 248, 0.3)',
    minWidth: 130,
  },
  morningButtonIcon: {
    fontSize: 28,
    marginBottom: 8,
  },
  morningButtonLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#818CF8',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalScroll: {
    marginTop: 100,
  },
  modalContent: {
    backgroundColor: '#1A1A1A',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: 40,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#2A2A2A',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  cancelButton: {
    fontSize: 16,
    color: '#666666',
  },
  saveButton: {
    fontSize: 16,
    fontWeight: '600',
    color: '#818CF8',
  },
  repeatSection: {
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  repeatLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666666',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 16,
  },
  daysContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  dayButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#2A2A2A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayButtonSelected: {
    backgroundColor: '#FFFFFF',
  },
  dayText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666666',
  },
  dayTextSelected: {
    color: '#0D0D0D',
  },
  labelSection: {
    paddingHorizontal: 20,
    paddingTop: 24,
  },
  labelTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666666',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 12,
  },
  labelInput: {
    backgroundColor: '#2A2A2A',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#FFFFFF',
  },
  snoozeSection: {
    paddingHorizontal: 20,
    paddingTop: 24,
  },
  snoozeTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666666',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 12,
  },
  snoozeOptions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  snoozeOption: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#2A2A2A',
  },
  snoozeOptionSelected: {
    backgroundColor: '#FFFFFF',
  },
  snoozeOptionText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666666',
  },
  snoozeOptionTextSelected: {
    color: '#0D0D0D',
  },
  wakeIntensitySection: {
    paddingHorizontal: 20,
    paddingTop: 24,
  },
  wakeIntensityHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  wakeIntensityTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666666',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  previewButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#2A2A2A',
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewButtonIcon: {
    fontSize: 16,
  },
  wakeIntensityOptions: {
    flexDirection: 'row',
    gap: 8,
  },
  wakeIntensityOption: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#2A2A2A',
    alignItems: 'center',
  },
  wakeIntensityOptionSelected: {
    backgroundColor: '#FFFFFF',
  },
  wakeIntensityOptionText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#666666',
  },
  wakeIntensityOptionTextSelected: {
    color: '#0D0D0D',
  },
  soundSection: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 20,
  },
  soundTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666666',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 12,
  },
  soundOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  soundOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#2A2A2A',
    gap: 6,
  },
  soundOptionSelected: {
    backgroundColor: '#FFFFFF',
  },
  soundOptionIcon: {
    fontSize: 16,
  },
  soundOptionText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666666',
  },
  soundOptionTextSelected: {
    color: '#0D0D0D',
  },
  dismissTypeSection: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 20,
  },
  dismissTypeTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666666',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 12,
  },
  dismissTypeOptions: {
    gap: 12,
  },
  dismissTypeOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    backgroundColor: '#2A2A2A',
    gap: 14,
  },
  dismissTypeOptionSelected: {
    backgroundColor: '#FFFFFF',
  },
  dismissTypeIcon: {
    fontSize: 24,
  },
  dismissTypeTextContainer: {
    flex: 1,
  },
  dismissTypeLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  dismissTypeLabelSelected: {
    color: '#0D0D0D',
  },
  dismissTypeDescription: {
    fontSize: 13,
    color: '#666666',
  },
  dismissTypeDescriptionSelected: {
    color: '#444444',
  },
  missionsSubtitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#818CF8',
    marginTop: 16,
    marginBottom: 4,
  },
  missionsHint: {
    fontSize: 12,
    color: '#555555',
    marginBottom: 12,
  },
  // Alarm Screen Styles
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
    marginBottom: 8,
  },
  alarmScreenLabel: {
    fontSize: 24,
    color: '#666666',
    marginBottom: 60,
  },
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
    fontSize: 48,
    fontWeight: '300',
    color: '#FFFFFF',
    marginBottom: 40,
  },
  mathInputField: {
    width: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 16,
    paddingHorizontal: 24,
    paddingVertical: 18,
    fontSize: 32,
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
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
  snoozeButton: {
    marginTop: 16,
    paddingVertical: 16,
    paddingHorizontal: 32,
  },
  snoozeButtonText: {
    fontSize: 16,
    color: '#666666',
  },
  // Bedtime Modal Styles
  bedtimeModalContent: {
    backgroundColor: '#1A1A1A',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
    marginTop: 'auto',
  },
  bedtimeTitle: {
    fontSize: 24,
    fontWeight: '600',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 8,
  },
  bedtimeSubtitle: {
    fontSize: 16,
    color: '#666666',
    textAlign: 'center',
    marginBottom: 24,
  },
  saveBedtimeButton: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 20,
  },
  saveBedtimeButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#0D0D0D',
  },
  skipBedtimeButton: {
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  skipBedtimeButtonText: {
    fontSize: 16,
    color: '#666666',
  },
  // Sleep Insight Modal Styles
  insightOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  insightContent: {
    backgroundColor: '#1A1A1A',
    borderRadius: 24,
    padding: 24,
    width: '100%',
    alignItems: 'center',
  },
  insightTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 20,
  },
  insightText: {
    fontSize: 16,
    color: '#999999',
    textAlign: 'center',
    marginBottom: 12,
    lineHeight: 24,
  },
  insightHighlight: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  insightTime: {
    fontSize: 48,
    fontWeight: '300',
    color: '#FFFFFF',
    marginVertical: 20,
  },
  insightButton: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 32,
    marginTop: 12,
  },
  insightButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0D0D0D',
  },
  insightDismiss: {
    paddingVertical: 16,
    marginTop: 8,
  },
  insightDismissText: {
    fontSize: 16,
    color: '#666666',
  },
  // Settings Tab Styles
  settingsTabContent: {
    flex: 1,
    backgroundColor: '#0D0D0D',
    paddingHorizontal: 16,
    paddingTop: 60,
  },
  settingsSectionHeader: {
    fontSize: 13,
    fontWeight: '600',
    color: '#818CF8',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8,
    marginTop: 24,
    marginLeft: 4,
  },
  settingsCard: {
    backgroundColor: '#1A1A1A',
    borderRadius: 16,
    overflow: 'hidden',
  },
  settingsItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  settingsItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  settingsItemLabelContainer: {
    flex: 1,
    marginRight: 12,
  },
  settingsItemLabel: {
    fontSize: 16,
    color: '#FFFFFF',
  },
  settingsItemValue: {
    fontSize: 16,
    color: '#818CF8',
    fontWeight: '500',
  },
  settingsItemSubtext: {
    fontSize: 13,
    color: '#666666',
    marginTop: 2,
  },
  settingsItemChevron: {
    fontSize: 22,
    color: '#666666',
    fontWeight: '300',
  },
  settingsDivider: {
    height: 1,
    backgroundColor: '#2A2A2A',
    marginLeft: 16,
  },
  settingsBedtimePicker: {
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  settingsPickerLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666666',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 12,
  },
  settingsFooter: {
    height: 100,
  },
  // Sleep Stats Modal Styles
  statsModalContent: {
    backgroundColor: '#1A1A1A',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    marginTop: 100,
    flex: 1,
  },
  statsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#2A2A2A',
  },
  statsTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  statsCloseButton: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  statsScrollView: {
    flex: 1,
    padding: 20,
  },
  statsEmptyState: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  statsEmptyIcon: {
    fontSize: 64,
    marginBottom: 20,
  },
  statsEmptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  statsEmptyText: {
    fontSize: 16,
    color: '#666666',
    textAlign: 'center',
  },
  statsSection: {
    marginBottom: 24,
  },
  statsSectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666666',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 12,
  },
  weeklyChart: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    backgroundColor: '#0D0D0D',
    borderRadius: 16,
    padding: 16,
    height: 180,
  },
  chartBar: {
    alignItems: 'center',
    flex: 1,
  },
  chartDuration: {
    fontSize: 11,
    color: '#666666',
    marginBottom: 8,
  },
  chartBarContainer: {
    height: 120,
    width: 24,
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  chartBarFill: {
    width: 20,
    borderRadius: 4,
    minHeight: 4,
  },
  chartBarToday: {
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  chartDay: {
    fontSize: 12,
    color: '#666666',
    marginTop: 8,
  },
  chartDayToday: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  statsCard: {
    backgroundColor: '#0D0D0D',
    borderRadius: 16,
    padding: 20,
  },
  statsMainStat: {
    alignItems: 'center',
    marginBottom: 20,
  },
  statsMainValue: {
    fontSize: 48,
    fontWeight: '300',
    color: '#FFFFFF',
  },
  statsMainLabel: {
    fontSize: 16,
    color: '#666666',
    marginTop: 4,
  },
  statsSubStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    borderTopWidth: 1,
    borderTopColor: '#2A2A2A',
    paddingTop: 16,
  },
  statsSubStat: {
    alignItems: 'center',
  },
  statsSubLabel: {
    fontSize: 12,
    color: '#666666',
    marginBottom: 4,
  },
  statsSubValue: {
    fontSize: 16,
    fontWeight: '500',
    color: '#FFFFFF',
  },
  statsBestWorst: {
    flexDirection: 'row',
    gap: 12,
  },
  statsBWCard: {
    flex: 1,
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
  },
  statsBestCard: {
    backgroundColor: 'rgba(99, 179, 237, 0.12)',
  },
  statsWorstCard: {
    backgroundColor: 'rgba(129, 140, 248, 0.12)',
  },
  statsBWIcon: {
    fontSize: 24,
    marginBottom: 8,
  },
  statsBWLabel: {
    fontSize: 12,
    color: '#666666',
    marginBottom: 4,
  },
  statsBWValue: {
    fontSize: 20,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  statsBWDate: {
    fontSize: 12,
    color: '#666666',
  },
  statsTotalNights: {
    fontSize: 14,
    color: '#666666',
    textAlign: 'center',
  },
  insightsContainer: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 60,
  },
  insightsTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 24,
  },
  insightsCard: {
    backgroundColor: '#1A1A1A',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  insightsCardLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#9999AA',
    marginBottom: 12,
  },
  insightsCardValue: {
    fontSize: 16,
    color: '#FFFFFF',
  },
  insightsChart: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    height: 120,
  },
  insightsBarCol: {
    alignItems: 'center',
    flex: 1,
  },
  insightsBarTrack: {
    width: 20,
    height: 100,
    backgroundColor: '#2A2A2A',
    borderRadius: 10,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  insightsBar: {
    width: '100%',
    backgroundColor: '#818CF8',
    borderRadius: 10,
  },
  insightsBarLabel: {
    fontSize: 12,
    color: '#9999AA',
    marginTop: 6,
  },
  insightsStatsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  insightsStatBox: {
    flex: 1,
    backgroundColor: '#1A1A1A',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
  },
  insightsStatValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  insightsStatLabel: {
    fontSize: 13,
    color: '#9999AA',
  },
  insightsTipCard: {
    borderWidth: 1,
    borderColor: '#818CF8',
    marginBottom: 40,
  },
  insightsTipLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#818CF8',
    marginBottom: 6,
  },
  insightsTipText: {
    fontSize: 15,
    color: '#FFFFFF',
    lineHeight: 22,
  },
});
