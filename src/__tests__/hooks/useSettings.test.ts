import { renderHook, act, waitFor } from '@testing-library/react-native';
import { useSettings } from '../../hooks/useSettings';

describe('useSettings hook', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should initialize with default settings', async () => {
    const { result } = renderHook(() => useSettings());

    // Initially should be loading
    expect(result.current.isLoading).toBe(true);

    // Wait for loading to complete
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Check default values
    expect(result.current.settings.darkMode).toBe(true);
    expect(result.current.settings.hapticFeedback).toBe(true);
    expect(result.current.settings.sleepGoalHours).toBe(8);
    expect(result.current.settings.defaultWakeIntensity).toBe('energetic');
    expect(result.current.settings.defaultSound).toBe('sunrise');
    expect(result.current.settings.defaultDismissType).toBe('simple');
    expect(result.current.settings.bedtimeHour).toBe(22);
    expect(result.current.settings.bedtimeMinute).toBe(0);
    expect(result.current.settings.bedtimeReminderEnabled).toBe(false);
  });

  it('should update settings correctly', async () => {
    const { result } = renderHook(() => useSettings());

    // Wait for initial loading
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Update a single setting
    act(() => {
      result.current.updateSettings({ sleepGoalHours: 7 });
    });

    expect(result.current.settings.sleepGoalHours).toBe(7);

    // Update multiple settings at once
    act(() => {
      result.current.updateSettings({
        darkMode: false,
        hapticFeedback: false,
      });
    });

    expect(result.current.settings.darkMode).toBe(false);
    expect(result.current.settings.hapticFeedback).toBe(false);
    // Previous update should still be present
    expect(result.current.settings.sleepGoalHours).toBe(7);
  });

  it('should provide updateSettings function', async () => {
    const { result } = renderHook(() => useSettings());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(typeof result.current.updateSettings).toBe('function');
  });

  it('should maintain default values for unspecified settings', async () => {
    const { result } = renderHook(() => useSettings());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Update only one field
    act(() => {
      result.current.updateSettings({ bedtimeHour: 23 });
    });

    // Check that other defaults are preserved
    expect(result.current.settings.bedtimeHour).toBe(23);
    expect(result.current.settings.bedtimeMinute).toBe(0);
    expect(result.current.settings.defaultWakeIntensity).toBe('energetic');
  });
});
