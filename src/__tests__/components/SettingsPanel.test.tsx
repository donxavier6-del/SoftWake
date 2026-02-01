import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { View } from 'react-native';
import { SettingsPanel } from '../../components/SettingsPanel';
import type { Settings, Theme } from '../../types';

const mockTheme: Theme = {
  gradient: ['#0a0a1a', '#1a1a2e', '#0f0f23'],
  alarmGradient: ['#1a0a2e', '#2a1a3e', '#1f0f33'],
  background: '#0a0a0a',
  card: '#1a1a2e',
  cardAlt: '#22223a',
  surface: '#2a2a3e',
  text: '#FFFFFF',
  textMuted: '#9999AA',
  textDisabled: '#555566',
  accent: '#818CF8',
  accentAlt: '#6366F1',
  switchTrackOff: '#3a3a4e',
  switchThumbOff: '#888899',
  cardGlass: 'rgba(255,255,255,0.05)',
  cardBorder: 'rgba(255,255,255,0.1)',
  accentGlow: 'rgba(129,140,248,0.3)',
  accentSoft: 'rgba(129,140,248,0.15)',
  divider: 'rgba(255,255,255,0.08)',
};

const createMockSettings = (overrides: Partial<Settings> = {}): Settings => ({
  bedtimeReminderEnabled: false,
  bedtimeHour: 22,
  bedtimeMinute: 30,
  hapticFeedback: true,
  darkMode: true,
  sleepGoalHours: 8,
  defaultWakeIntensity: 'gentle',
  defaultSound: 'sunrise',
  defaultDismissType: 'simple',
  shakeThreshold: 1.5,
  ...overrides,
});

const MockTimePicker = () => <View testID="mock-time-picker" />;

function renderSettingsPanel(overrides: Partial<Settings> = {}, pickerVisible = false) {
  const settings = createMockSettings(overrides);
  const updateSettings = jest.fn();
  const setBedtimePickerVisible = jest.fn();

  render(
    <SettingsPanel
      settings={settings}
      theme={mockTheme}
      updateSettings={updateSettings}
      bedtimePickerVisible={pickerVisible}
      setBedtimePickerVisible={setBedtimePickerVisible}
      TimePicker={MockTimePicker}
    />
  );

  return { settings, updateSettings, setBedtimePickerVisible };
}

describe('SettingsPanel', () => {
  it('renders all section headers', () => {
    renderSettingsPanel();

    expect(screen.getByText('Alarm Defaults')).toBeTruthy();
    expect(screen.getByText('Sleep')).toBeTruthy();
    expect(screen.getByText('Shake Dismiss')).toBeTruthy();
    expect(screen.getByText('App')).toBeTruthy();
    expect(screen.getByText('About')).toBeTruthy();
  });

  it('shows current Wake Intensity value', () => {
    renderSettingsPanel({ defaultWakeIntensity: 'gentle' });

    expect(screen.getByText('Wake Intensity')).toBeTruthy();
    expect(screen.getByText('Gentle')).toBeTruthy();
  });

  it('cycles Wake Intensity on tap', () => {
    // gentle is index 1, next should be moderate (index 2)
    const { updateSettings } = renderSettingsPanel({ defaultWakeIntensity: 'gentle' });

    fireEvent.press(screen.getByLabelText(/Default wake intensity/));

    expect(updateSettings).toHaveBeenCalledWith({ defaultWakeIntensity: 'moderate' });
  });

  it('shows current Sound value', () => {
    renderSettingsPanel({ defaultSound: 'sunrise' });

    expect(screen.getByText('Sound')).toBeTruthy();
    expect(screen.getByText('Sunrise')).toBeTruthy();
  });

  it('shows current Dismiss Method value', () => {
    renderSettingsPanel({ defaultDismissType: 'simple' });

    expect(screen.getByText('Dismiss Method')).toBeTruthy();
    expect(screen.getByText('Simple')).toBeTruthy();
  });

  it('toggles Dark Mode switch correctly', () => {
    const { updateSettings } = renderSettingsPanel({ darkMode: true });

    const darkModeSwitch = screen.getByLabelText('Dark mode');
    fireEvent(darkModeSwitch, 'valueChange', false);

    expect(updateSettings).toHaveBeenCalledWith({ darkMode: false });
  });

  it('toggles Haptic Feedback switch correctly', () => {
    const { updateSettings } = renderSettingsPanel({ hapticFeedback: true });

    const hapticSwitch = screen.getByLabelText('Haptic feedback');
    fireEvent(hapticSwitch, 'valueChange', false);

    expect(updateSettings).toHaveBeenCalledWith({ hapticFeedback: false });
  });

  it('toggles Bedtime Reminder switch correctly', () => {
    const { updateSettings, setBedtimePickerVisible } = renderSettingsPanel({
      bedtimeReminderEnabled: false,
    });

    const bedtimeSwitch = screen.getByLabelText('Bedtime reminder');
    fireEvent(bedtimeSwitch, 'valueChange', true);

    expect(updateSettings).toHaveBeenCalledWith({ bedtimeReminderEnabled: true });
    expect(setBedtimePickerVisible).toHaveBeenCalledWith(true);
  });

  it('cycles Sleep Goal on tap', () => {
    // sleepGoalHours 8 is index 4 in [6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5, 10], next is 8.5
    const { updateSettings } = renderSettingsPanel({ sleepGoalHours: 8 });

    fireEvent.press(screen.getByLabelText(/Sleep goal/));

    expect(updateSettings).toHaveBeenCalledWith({ sleepGoalHours: 8.5 });
  });

  it('shows Version 1.0.0', () => {
    renderSettingsPanel();

    expect(screen.getByText('Version')).toBeTruthy();
    expect(screen.getByText('1.0.0')).toBeTruthy();
  });
});
