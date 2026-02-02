/**
 * GAP-19: AlarmScreen Component Tests
 */

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { Animated } from 'react-native';
import { AlarmScreen } from '../../components/AlarmScreen';
import type { Alarm, Theme } from '../../types';

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

const makeAlarm = (overrides: Partial<Alarm> = {}): Alarm => ({
  id: 'test-1',
  hour: 8,
  minute: 30,
  days: [false, false, false, false, false, false, false],
  enabled: true,
  label: 'Morning Alarm',
  snooze: 10,
  wakeIntensity: 'energetic',
  sound: 'sunrise',
  dismissType: 'simple',
  ...overrides,
});

describe('AlarmScreen', () => {
  const defaultProps = {
    visible: true,
    activeAlarm: makeAlarm(),
    theme: mockTheme,
    breathingPhase: 'inhale' as const,
    breathingCycle: 0,
    breathingAnim: new Animated.Value(0.4),
    mathProblem: { question: '5 + 3', answer: 8 },
    onSnooze: jest.fn(),
    onDismiss: jest.fn(),
    onSimpleDismiss: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Simple dismiss mode', () => {
    it('renders Stop button for simple dismiss', () => {
      const { getByText } = render(<AlarmScreen {...defaultProps} />);
      expect(getByText('Stop')).toBeTruthy();
    });

    it('calls onSimpleDismiss when Stop button is pressed', () => {
      const { getByText } = render(<AlarmScreen {...defaultProps} />);
      fireEvent.press(getByText('Stop'));
      expect(defaultProps.onSimpleDismiss).toHaveBeenCalledTimes(1);
    });

    it('shows snooze button when snooze > 0', () => {
      const { getByText } = render(<AlarmScreen {...defaultProps} />);
      expect(getByText('Snooze (10 min)')).toBeTruthy();
    });

    it('calls onSnooze when snooze button is pressed', () => {
      const { getByText } = render(<AlarmScreen {...defaultProps} />);
      fireEvent.press(getByText('Snooze (10 min)'));
      expect(defaultProps.onSnooze).toHaveBeenCalledTimes(1);
    });

    it('shows alarm label', () => {
      const { getByText } = render(<AlarmScreen {...defaultProps} />);
      expect(getByText('Morning Alarm')).toBeTruthy();
    });

    it('shows formatted time', () => {
      const { getByText } = render(<AlarmScreen {...defaultProps} />);
      expect(getByText('8:30 AM')).toBeTruthy();
    });
  });

  describe('Math dismiss mode', () => {
    it('renders math problem', () => {
      const alarm = makeAlarm({ dismissType: 'math' });
      const { getByText } = render(
        <AlarmScreen
          {...defaultProps}
          activeAlarm={alarm}
          mathProblem={{ question: '5 + 3', answer: 8 }}
        />
      );
      expect(getByText('5 + 3 = ?')).toBeTruthy();
    });

    it('renders Submit button', () => {
      const alarm = makeAlarm({ dismissType: 'math' });
      const { getByText } = render(
        <AlarmScreen {...defaultProps} activeAlarm={alarm} />
      );
      expect(getByText('Submit')).toBeTruthy();
    });

    it('shows Correct! on math complete', () => {
      const alarm = makeAlarm({ dismissType: 'math' });
      const { getByText } = render(
        <AlarmScreen {...defaultProps} activeAlarm={alarm} mathComplete={true} />
      );
      expect(getByText('Correct!')).toBeTruthy();
    });
  });

  describe('Affirmation dismiss mode', () => {
    it('renders affirmation prompt', () => {
      const alarm = makeAlarm({ dismissType: 'affirmation' });
      const { getByText } = render(
        <AlarmScreen
          {...defaultProps}
          activeAlarm={alarm}
          targetAffirmation="I am ready for today"
        />
      );
      expect(getByText('Type to start your day')).toBeTruthy();
    });

    it('shows Well done on affirmation complete', () => {
      const alarm = makeAlarm({ dismissType: 'affirmation' });
      const { getByText } = render(
        <AlarmScreen
          {...defaultProps}
          activeAlarm={alarm}
          affirmationComplete={true}
        />
      );
      expect(getByText('Well done')).toBeTruthy();
    });
  });

  describe('Shake dismiss mode', () => {
    it('renders shake prompt', () => {
      const alarm = makeAlarm({ dismissType: 'shake' });
      const { getByText } = render(
        <AlarmScreen {...defaultProps} activeAlarm={alarm} shakeCount={5} />
      );
      expect(getByText('Shake your phone to wake up')).toBeTruthy();
      expect(getByText('5 / 20')).toBeTruthy();
    });

    it('shows completion message', () => {
      const alarm = makeAlarm({ dismissType: 'shake' });
      const { getByText } = render(
        <AlarmScreen
          {...defaultProps}
          activeAlarm={alarm}
          shakeComplete={true}
        />
      );
      expect(getByText("You're awake!")).toBeTruthy();
    });
  });

  describe('Breathing dismiss mode', () => {
    it('renders breathing phase label', () => {
      const alarm = makeAlarm({ dismissType: 'breathing' });
      const { getByText } = render(
        <AlarmScreen
          {...defaultProps}
          activeAlarm={alarm}
          breathingPhase="inhale"
        />
      );
      expect(getByText('Breathe in')).toBeTruthy();
    });

    it('shows Good morning on completion', () => {
      const alarm = makeAlarm({ dismissType: 'breathing' });
      const { getByText } = render(
        <AlarmScreen
          {...defaultProps}
          activeAlarm={alarm}
          breathingPhase="complete"
        />
      );
      expect(getByText('Good morning')).toBeTruthy();
    });
  });
});
