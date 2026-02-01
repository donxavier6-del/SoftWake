import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { AlarmsList } from '../../components/AlarmsList';
import type { Alarm, Theme } from '../../types';

const mockTheme: Theme = {
  gradient: ['#0a0a1a', '#1a1a2e', '#0f0f23'] as const,
  alarmGradient: ['#1a1a2e', '#2a2a4e', '#1f1f3a'] as const,
  background: '#0a0a0a',
  card: '#1a1a2e',
  cardAlt: '#222244',
  surface: '#111122',
  text: '#FFFFFF',
  textMuted: '#9999AA',
  textDisabled: '#555566',
  accent: '#818CF8',
  accentAlt: '#6366F1',
  switchTrackOff: '#333344',
  switchThumbOff: '#888888',
  cardGlass: 'rgba(255,255,255,0.05)',
  cardBorder: 'rgba(255,255,255,0.1)',
  accentGlow: 'rgba(129,140,248,0.3)',
  accentSoft: 'rgba(129,140,248,0.15)',
  divider: 'rgba(255,255,255,0.1)',
};

function createAlarm(overrides: Partial<Alarm> = {}): Alarm {
  return {
    id: '1',
    hour: 7,
    minute: 30,
    days: [false, false, false, false, false, false, false],
    enabled: true,
    label: '',
    snooze: 5,
    wakeIntensity: 'energetic',
    sound: 'sunrise',
    dismissType: 'simple',
    ...overrides,
  };
}

const mockFormatAlarmTime = (hour: number, minute: number) => {
  const h = hour % 12 || 12;
  const m = minute.toString().padStart(2, '0');
  const ampm = hour < 12 ? 'AM' : 'PM';
  return `${h}:${m} ${ampm}`;
};

describe('AlarmsList', () => {
  const defaultProps = {
    alarms: [] as Alarm[],
    theme: mockTheme,
    onToggleAlarm: jest.fn(),
    onEditAlarm: jest.fn(),
    onDeleteAlarm: jest.fn(),
    formatAlarmTime: mockFormatAlarmTime,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // 1. Empty state
  it('renders "No alarms set" when alarms array is empty', () => {
    render(<AlarmsList {...defaultProps} alarms={[]} />);
    expect(screen.getByText('No alarms set')).toBeTruthy();
  });

  // 2. Renders alarm items with correct time
  it('renders alarm items with the correct formatted time', () => {
    const alarms = [
      createAlarm({ id: '1', hour: 7, minute: 30 }),
      createAlarm({ id: '2', hour: 14, minute: 0 }),
    ];
    render(<AlarmsList {...defaultProps} alarms={alarms} />);

    expect(screen.getByText('7:30 AM')).toBeTruthy();
    expect(screen.getByText('2:00 PM')).toBeTruthy();
  });

  // 3. Renders alarm labels
  it('renders alarm labels alongside repeat text', () => {
    const alarms = [createAlarm({ id: '1', label: 'Work' })];
    render(<AlarmsList {...defaultProps} alarms={alarms} />);

    expect(screen.getByText('Work · Once')).toBeTruthy();
  });

  it('renders repeat text without label prefix when label is empty', () => {
    const alarms = [createAlarm({ id: '1', label: '' })];
    render(<AlarmsList {...defaultProps} alarms={alarms} />);

    expect(screen.getByText('Once')).toBeTruthy();
  });

  // 4. Repeat text variants
  describe('repeat text', () => {
    it('shows "Once" when no days are selected', () => {
      const alarms = [createAlarm({ days: [false, false, false, false, false, false, false] })];
      render(<AlarmsList {...defaultProps} alarms={alarms} />);
      expect(screen.getByText('Once')).toBeTruthy();
    });

    it('shows "Every day" when all days are selected', () => {
      const alarms = [createAlarm({ days: [true, true, true, true, true, true, true] })];
      render(<AlarmsList {...defaultProps} alarms={alarms} />);
      expect(screen.getByText('Every day')).toBeTruthy();
    });

    it('shows "Weekdays" when Mon-Fri are selected', () => {
      const alarms = [createAlarm({ days: [false, true, true, true, true, true, false] })];
      render(<AlarmsList {...defaultProps} alarms={alarms} />);
      expect(screen.getByText('Weekdays')).toBeTruthy();
    });

    it('shows "Weekends" when only Sat and Sun are selected', () => {
      const alarms = [createAlarm({ days: [true, false, false, false, false, false, true] })];
      render(<AlarmsList {...defaultProps} alarms={alarms} />);
      expect(screen.getByText('Weekends')).toBeTruthy();
    });

    it('shows specific day abbreviations for custom selections', () => {
      const alarms = [createAlarm({ days: [false, true, false, true, false, true, false] })];
      render(<AlarmsList {...defaultProps} alarms={alarms} />);
      expect(screen.getByText('Mon, Wed, Fri')).toBeTruthy();
    });

    it('shows single day abbreviation when one day is selected', () => {
      const alarms = [createAlarm({ days: [false, false, true, false, false, false, false] })];
      render(<AlarmsList {...defaultProps} alarms={alarms} />);
      expect(screen.getByText('Tue')).toBeTruthy();
    });
  });

  // 5. Calls onEditAlarm when alarm is tapped
  it('calls onEditAlarm with the alarm when tapped', () => {
    const alarm = createAlarm({ id: '1', hour: 8, minute: 0 });
    const onEditAlarm = jest.fn();
    render(<AlarmsList {...defaultProps} alarms={[alarm]} onEditAlarm={onEditAlarm} />);

    fireEvent.press(screen.getByText('8:00 AM'));
    expect(onEditAlarm).toHaveBeenCalledTimes(1);
    expect(onEditAlarm).toHaveBeenCalledWith(alarm);
  });

  // 6. Calls onToggleAlarm when switch is toggled
  it('calls onToggleAlarm with the alarm id when switch is toggled', () => {
    const alarm = createAlarm({ id: 'abc-123', hour: 6, minute: 15, enabled: true });
    const onToggleAlarm = jest.fn();
    render(<AlarmsList {...defaultProps} alarms={[alarm]} onToggleAlarm={onToggleAlarm} />);

    const toggle = screen.getByRole('switch');
    fireEvent(toggle, 'valueChange', false);
    expect(onToggleAlarm).toHaveBeenCalledTimes(1);
    expect(onToggleAlarm).toHaveBeenCalledWith('abc-123');
  });

  // 7. Disabled alarms use textDisabled color
  it('applies textDisabled color style to disabled alarm time and days', () => {
    const alarm = createAlarm({ id: '1', hour: 9, minute: 0, enabled: false, label: 'Gym' });
    render(<AlarmsList {...defaultProps} alarms={[alarm]} />);

    const timeText = screen.getByText('9:00 AM');
    const daysText = screen.getByText('Gym · Once');

    // The time text should have a style containing the textDisabled color
    const timeStyles = Array.isArray(timeText.props.style)
      ? timeText.props.style
      : [timeText.props.style];
    const flatTimeStyles = timeStyles.flat();
    expect(flatTimeStyles).toEqual(
      expect.arrayContaining([expect.objectContaining({ color: mockTheme.textDisabled })]),
    );

    const daysStyles = Array.isArray(daysText.props.style)
      ? daysText.props.style
      : [daysText.props.style];
    const flatDaysStyles = daysStyles.flat();
    expect(flatDaysStyles).toEqual(
      expect.arrayContaining([expect.objectContaining({ color: mockTheme.textDisabled })]),
    );
  });

  it('does not apply textDisabled color to enabled alarm', () => {
    const alarm = createAlarm({ id: '1', hour: 9, minute: 0, enabled: true });
    render(<AlarmsList {...defaultProps} alarms={[alarm]} />);

    const timeText = screen.getByText('9:00 AM');
    const timeStyles = Array.isArray(timeText.props.style)
      ? timeText.props.style.flat()
      : [timeText.props.style];

    // The last conditional style should be falsy (since enabled is true, the condition is false)
    const hasDisabledColor = timeStyles.some(
      (s: any) => s && typeof s === 'object' && s.color === mockTheme.textDisabled,
    );
    expect(hasDisabledColor).toBe(false);
  });

  // 8. Accessibility labels
  it('sets correct accessibility label on edit button for alarm without label', () => {
    const alarm = createAlarm({ id: '1', hour: 7, minute: 30, label: '' });
    render(<AlarmsList {...defaultProps} alarms={[alarm]} />);

    expect(screen.getByLabelText('Edit alarm at 7:30 AM')).toBeTruthy();
  });

  it('sets correct accessibility label on edit button for alarm with label', () => {
    const alarm = createAlarm({ id: '1', hour: 7, minute: 30, label: 'Morning run' });
    render(<AlarmsList {...defaultProps} alarms={[alarm]} />);

    expect(screen.getByLabelText('Edit alarm at 7:30 AM, Morning run')).toBeTruthy();
  });

  it('sets correct accessibility label on switch for enabled alarm', () => {
    const alarm = createAlarm({ id: '1', hour: 7, minute: 30, enabled: true });
    render(<AlarmsList {...defaultProps} alarms={[alarm]} />);

    expect(screen.getByLabelText('Disable alarm at 7:30 AM')).toBeTruthy();
  });

  it('sets correct accessibility label on switch for disabled alarm', () => {
    const alarm = createAlarm({ id: '1', hour: 7, minute: 30, enabled: false });
    render(<AlarmsList {...defaultProps} alarms={[alarm]} />);

    expect(screen.getByLabelText('Enable alarm at 7:30 AM')).toBeTruthy();
  });

  it('sets correct accessibility role on edit button and switch', () => {
    const alarm = createAlarm({ id: '1', hour: 10, minute: 0 });
    render(<AlarmsList {...defaultProps} alarms={[alarm]} />);

    expect(screen.getByRole('button')).toBeTruthy();
    expect(screen.getByRole('switch')).toBeTruthy();
  });

  // Multiple alarms
  it('renders multiple alarms correctly', () => {
    const alarms = [
      createAlarm({ id: '1', hour: 6, minute: 0, label: 'Early' }),
      createAlarm({ id: '2', hour: 8, minute: 30, label: 'Regular' }),
      createAlarm({ id: '3', hour: 22, minute: 45, label: 'Night' }),
    ];
    render(<AlarmsList {...defaultProps} alarms={alarms} />);

    expect(screen.getByText('6:00 AM')).toBeTruthy();
    expect(screen.getByText('8:30 AM')).toBeTruthy();
    expect(screen.getByText('10:45 PM')).toBeTruthy();
    expect(screen.getByText('Early · Once')).toBeTruthy();
    expect(screen.getByText('Regular · Once')).toBeTruthy();
    expect(screen.getByText('Night · Once')).toBeTruthy();
  });
});
