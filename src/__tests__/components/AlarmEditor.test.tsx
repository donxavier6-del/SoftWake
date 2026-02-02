/**
 * GAP-19: AlarmEditor Component Tests
 */

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { AlarmEditor } from '../../components/AlarmEditor';
import type { Theme, Settings } from '../../types';

const mockTheme: Theme = {
  gradient: ['#0a0a1a', '#1a1a2e', '#0f0f23'],
  alarmGradient: ['#1a1a3e', '#2d1b69', '#1a3a5c'],
  background: '#0D0D0D',
  card: '#1A1A1A',
  cardAlt: '#141414',
  surface: '#2A2A2A',
  text: '#FFFFFF',
  textMuted: '#9999AA',
  textDisabled: '#666666',
  accent: '#818CF8',
  accentAlt: '#6366F1',
  cardGlass: 'rgba(255, 255, 255, 0.04)',
  cardBorder: 'rgba(255, 255, 255, 0.08)',
  accentGlow: 'rgba(129, 140, 248, 0.25)',
  accentSoft: 'rgba(129, 140, 248, 0.12)',
  divider: 'rgba(255, 255, 255, 0.06)',
};

const mockSettings: Settings = {
  bedtimeReminderEnabled: false,
  bedtimeHour: 22,
  bedtimeMinute: 0,
  defaultWakeIntensity: 'energetic',
  defaultSound: 'sunrise',
  defaultDismissType: 'simple',
  sleepGoalHours: 8,
  darkMode: true,
  hapticFeedback: true,
  shakeThreshold: 1.5,
};

describe('AlarmEditor', () => {
  const defaultProps = {
    visible: true,
    editingAlarmId: null,
    theme: mockTheme,
    settings: mockSettings,
    selectedHour: 8,
    selectedMinute: 0,
    onHourChange: jest.fn(),
    onMinuteChange: jest.fn(),
    selectedDays: [false, false, false, false, false, false, false],
    onToggleDay: jest.fn(),
    selectedLabel: '',
    onLabelChange: jest.fn(),
    selectedSnooze: 10,
    onSnoozeChange: jest.fn(),
    selectedWakeIntensity: 'energetic' as const,
    onWakeIntensityChange: jest.fn(),
    selectedSound: 'sunrise' as const,
    onSoundChange: jest.fn(),
    selectedDismissType: 'simple' as const,
    onDismissTypeChange: jest.fn(),
    onSave: jest.fn(),
    onCancel: jest.fn(),
    onPlayPreview: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders New Alarm title when not editing', () => {
    const { getByText } = render(<AlarmEditor {...defaultProps} />);
    expect(getByText('New Alarm')).toBeTruthy();
  });

  it('renders Edit Alarm title when editing', () => {
    const { getByText } = render(
      <AlarmEditor {...defaultProps} editingAlarmId="test-1" />
    );
    expect(getByText('Edit Alarm')).toBeTruthy();
  });

  it('calls onSave when Save button is pressed', () => {
    const { getByText } = render(<AlarmEditor {...defaultProps} />);
    fireEvent.press(getByText('Save'));
    expect(defaultProps.onSave).toHaveBeenCalledTimes(1);
  });

  it('calls onCancel when Cancel button is pressed', () => {
    const { getByText } = render(<AlarmEditor {...defaultProps} />);
    fireEvent.press(getByText('Cancel'));
    expect(defaultProps.onCancel).toHaveBeenCalledTimes(1);
  });

  it('renders label input', () => {
    const { getByPlaceholderText } = render(<AlarmEditor {...defaultProps} />);
    const input = getByPlaceholderText('Alarm');
    expect(input).toBeTruthy();
  });

  it('calls onLabelChange when label text changes', () => {
    const { getByPlaceholderText } = render(<AlarmEditor {...defaultProps} />);
    const input = getByPlaceholderText('Alarm');
    fireEvent.changeText(input, 'Work');
    expect(defaultProps.onLabelChange).toHaveBeenCalledWith('Work');
  });

  it('has maxLength=100 on label input (GAP-33)', () => {
    const { getByPlaceholderText } = render(<AlarmEditor {...defaultProps} />);
    const input = getByPlaceholderText('Alarm');
    expect(input.props.maxLength).toBe(100);
  });

  it('renders day buttons', () => {
    const { getAllByText } = render(<AlarmEditor {...defaultProps} />);
    // S appears twice (Sun and Sat), M appears once (Mon)
    expect(getAllByText('S').length).toBe(2);
    expect(getAllByText('M').length).toBe(1);
  });

  it('calls onToggleDay when day button is pressed', () => {
    const { getAllByText } = render(<AlarmEditor {...defaultProps} />);
    const dayButtons = getAllByText('M');
    fireEvent.press(dayButtons[0]);
    expect(defaultProps.onToggleDay).toHaveBeenCalled();
  });

  it('renders snooze options', () => {
    const { getByText } = render(<AlarmEditor {...defaultProps} />);
    expect(getByText('Off')).toBeTruthy();
    expect(getByText('5 min')).toBeTruthy();
    expect(getByText('10 min')).toBeTruthy();
  });

  it('renders dismiss options', () => {
    const { getByText } = render(<AlarmEditor {...defaultProps} />);
    expect(getByText('Simple')).toBeTruthy();
    expect(getByText('Breathing Exercise')).toBeTruthy();
    expect(getByText('Math Problem')).toBeTruthy();
  });
});
