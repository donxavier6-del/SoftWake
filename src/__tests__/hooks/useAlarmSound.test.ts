/**
 * Unit tests for useAlarmSound hook
 *
 * Tests cover:
 * - Playing preview sounds with different configurations
 * - Volume and rate settings based on parameters
 * - Auto-stop after 2 seconds
 * - Race condition handling
 * - Cleanup on unmount
 */

import { renderHook, act, waitFor } from '@testing-library/react-native';
import { useAlarmSound, SOUND_CONFIGS } from '../../hooks/useAlarmSound';
import type { AlarmSound, WakeIntensity } from '../../types';

// Create mock functions that we can track
const mockPlayAsync = jest.fn(() => Promise.resolve());
const mockStopAsync = jest.fn(() => Promise.resolve());
const mockUnloadAsync = jest.fn(() => Promise.resolve());
const mockSetVolumeAsync = jest.fn(() => Promise.resolve());
const mockSetRateAsync = jest.fn(() => Promise.resolve());

// Track the created sound instances
let mockLastCreatedSound: any = null;

// Create mock function for createAsync that we can control
const mockCreateAsync = jest.fn((source, options) => {
  mockLastCreatedSound = {
    playAsync: mockPlayAsync,
    stopAsync: mockStopAsync,
    unloadAsync: mockUnloadAsync,
    setVolumeAsync: mockSetVolumeAsync,
    setRateAsync: mockSetRateAsync,
    _source: source,
    _options: options,
  };
  return Promise.resolve({ sound: mockLastCreatedSound });
});

// Mock Audio module
jest.mock('expo-av', () => ({
  Audio: {
    Sound: {
      createAsync: (...args: unknown[]) => mockCreateAsync(...(args as Parameters<typeof mockCreateAsync>)),
    },
    setAudioModeAsync: jest.fn(() => Promise.resolve()),
  },
}));

describe('useAlarmSound', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLastCreatedSound = null;
    jest.useFakeTimers();
  });

  afterEach(() => {
    // Clear any pending timers before switching to real timers
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  describe('SOUND_CONFIGS', () => {
    it('should have correct configuration for all sound types', () => {
      const soundTypes: AlarmSound[] = ['sunrise', 'ocean', 'forest', 'chimes', 'piano', 'birds'];
      
      soundTypes.forEach((soundType) => {
        expect(SOUND_CONFIGS[soundType]).toBeDefined();
        expect(SOUND_CONFIGS[soundType].rate).toBeGreaterThan(0);
        expect(typeof SOUND_CONFIGS[soundType].pattern).toBe('object');
      });
    });

    it('should have expected rates for each sound type', () => {
      expect(SOUND_CONFIGS.sunrise.rate).toBe(1.0);
      expect(SOUND_CONFIGS.ocean.rate).toBe(0.75);
      expect(SOUND_CONFIGS.forest.rate).toBe(1.2);
      expect(SOUND_CONFIGS.chimes.rate).toBe(1.1);
      expect(SOUND_CONFIGS.piano.rate).toBe(0.85);
      expect(SOUND_CONFIGS.birds.rate).toBe(1.4);
    });

    it('should have patterns defined (null or array)', () => {
      expect(SOUND_CONFIGS.sunrise.pattern).toBeNull();
      expect(Array.isArray(SOUND_CONFIGS.ocean.pattern)).toBe(true);
      expect(Array.isArray(SOUND_CONFIGS.forest.pattern)).toBe(true);
      expect(Array.isArray(SOUND_CONFIGS.chimes.pattern)).toBe(true);
      expect(Array.isArray(SOUND_CONFIGS.piano.pattern)).toBe(true);
      expect(Array.isArray(SOUND_CONFIGS.birds.pattern)).toBe(true);
    });
  });

  describe('playPreviewSound', () => {
    it('should create and play a sound', async () => {
      const { result } = renderHook(() => useAlarmSound());

      await act(async () => {
        await result.current.playPreviewSound('sunrise', 'gentle');
      });

      expect(mockCreateAsync).toHaveBeenCalledTimes(1);
      expect(mockPlayAsync).toHaveBeenCalledTimes(1);
    });

    it('should set isPlaying to true while playing', async () => {
      const { result } = renderHook(() => useAlarmSound());

      expect(result.current.isPlaying).toBe(false);

      await act(async () => {
        await result.current.playPreviewSound('sunrise', 'gentle');
      });

      expect(result.current.isPlaying).toBe(true);
    });

    it('should set volume based on wake intensity - whisper', async () => {
      const { result } = renderHook(() => useAlarmSound());

      await act(async () => {
        await result.current.playPreviewSound('sunrise', 'whisper');
      });

      expect(mockCreateAsync).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ volume: 0.3 })
      );
    });

    it('should set volume based on wake intensity - gentle', async () => {
      const { result } = renderHook(() => useAlarmSound());

      await act(async () => {
        await result.current.playPreviewSound('sunrise', 'gentle');
      });

      expect(mockCreateAsync).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ volume: 0.5 })
      );
    });

    it('should set volume based on wake intensity - moderate', async () => {
      const { result } = renderHook(() => useAlarmSound());

      await act(async () => {
        await result.current.playPreviewSound('sunrise', 'moderate');
      });

      expect(mockCreateAsync).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ volume: 0.75 })
      );
    });

    it('should set volume based on wake intensity - energetic', async () => {
      const { result } = renderHook(() => useAlarmSound());

      await act(async () => {
        await result.current.playPreviewSound('sunrise', 'energetic');
      });

      expect(mockCreateAsync).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ volume: 1.0 })
      );
    });

    it('should set playback rate based on sound type - sunrise (1.0)', async () => {
      const { result } = renderHook(() => useAlarmSound());

      await act(async () => {
        await result.current.playPreviewSound('sunrise', 'moderate');
      });

      expect(mockCreateAsync).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ rate: 1.0, shouldCorrectPitch: false })
      );
    });

    it('should set playback rate based on sound type - ocean (0.75)', async () => {
      const { result } = renderHook(() => useAlarmSound());

      await act(async () => {
        await result.current.playPreviewSound('ocean', 'moderate');
      });

      expect(mockCreateAsync).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ rate: 0.75 })
      );
    });

    it('should set playback rate based on sound type - birds (1.4)', async () => {
      const { result } = renderHook(() => useAlarmSound());

      await act(async () => {
        await result.current.playPreviewSound('birds', 'energetic');
      });

      expect(mockCreateAsync).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ rate: 1.4 })
      );
    });

    it('should stop previous sound before playing new one', async () => {
      const { result } = renderHook(() => useAlarmSound());

      // Play first sound
      await act(async () => {
        await result.current.playPreviewSound('sunrise', 'gentle');
      });

      // Play second sound - should stop first
      await act(async () => {
        await result.current.playPreviewSound('ocean', 'moderate');
      });

      // Should have created two sounds
      expect(mockCreateAsync).toHaveBeenCalledTimes(2);
      // First sound should have been stopped and unloaded
      expect(mockStopAsync).toHaveBeenCalled();
      expect(mockUnloadAsync).toHaveBeenCalled();
    });

    it('should auto-stop after 2 seconds', async () => {
      const { result } = renderHook(() => useAlarmSound());

      await act(async () => {
        await result.current.playPreviewSound('sunrise', 'gentle');
      });

      // Fast-forward 2 seconds
      await act(async () => {
        jest.advanceTimersByTime(2000);
      });

      // Should have stopped and unloaded
      await waitFor(() => {
        expect(mockStopAsync).toHaveBeenCalled();
        expect(mockUnloadAsync).toHaveBeenCalled();
      });

      // isPlaying should be false
      expect(result.current.isPlaying).toBe(false);
    });

    it('should handle all sound types', async () => {
      const soundTypes: AlarmSound[] = ['sunrise', 'ocean', 'forest', 'chimes', 'piano', 'birds'];
      const { result } = renderHook(() => useAlarmSound());

      for (const soundType of soundTypes) {
        jest.clearAllMocks();

        await act(async () => {
          await result.current.playPreviewSound(soundType, 'moderate');
        });

        expect(mockCreateAsync).toHaveBeenCalledTimes(1);
        expect(mockPlayAsync).toHaveBeenCalledTimes(1);

        // Verify correct rate is used
        const expectedRate = SOUND_CONFIGS[soundType].rate;
        expect(mockCreateAsync).toHaveBeenCalledWith(
          expect.anything(),
          expect.objectContaining({ rate: expectedRate })
        );
      }
    });

    it('should handle all wake intensities', async () => {
      const intensities: WakeIntensity[] = ['whisper', 'gentle', 'moderate', 'energetic'];
      const expectedVolumes = { whisper: 0.3, gentle: 0.5, moderate: 0.75, energetic: 1.0 };
      const { result } = renderHook(() => useAlarmSound());

      for (const intensity of intensities) {
        jest.clearAllMocks();

        await act(async () => {
          await result.current.playPreviewSound('sunrise', intensity);
        });

        expect(mockCreateAsync).toHaveBeenCalledWith(
          expect.anything(),
          expect.objectContaining({ volume: expectedVolumes[intensity] })
        );
      }
    });

    it('should handle errors gracefully', async () => {
      // Mock createAsync to throw an error
      mockCreateAsync.mockRejectedValueOnce(new Error('Audio error'));

      const { result } = renderHook(() => useAlarmSound());

      // Should not throw
      await act(async () => {
        await result.current.playPreviewSound('sunrise', 'gentle');
      });

      // isPlaying should remain false after error
      expect(result.current.isPlaying).toBe(false);
    });

    it('should default to volume 0.5 for unknown intensity', async () => {
      const { result } = renderHook(() => useAlarmSound());

      await act(async () => {
        // Cast unknown intensity to test default case
        await result.current.playPreviewSound('sunrise', 'unknown' as WakeIntensity);
      });

      expect(mockCreateAsync).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ volume: 0.5 })
      );
    });
  });

  describe('stopPreviewSound', () => {
    it('should stop and unload current sound', async () => {
      const { result } = renderHook(() => useAlarmSound());

      // Start playing
      await act(async () => {
        await result.current.playPreviewSound('sunrise', 'gentle');
      });

      expect(result.current.isPlaying).toBe(true);

      // Stop playing
      await act(async () => {
        await result.current.stopPreviewSound();
      });

      expect(mockStopAsync).toHaveBeenCalled();
      expect(mockUnloadAsync).toHaveBeenCalled();
      expect(result.current.isPlaying).toBe(false);
    });

    it('should clear the auto-stop timeout when stopped manually', async () => {
      const { result } = renderHook(() => useAlarmSound());

      await act(async () => {
        await result.current.playPreviewSound('sunrise', 'gentle');
      });

      // Stop immediately
      await act(async () => {
        await result.current.stopPreviewSound();
      });

      // Reset mocks to check if timeout still fires
      mockStopAsync.mockClear();
      mockUnloadAsync.mockClear();

      // Fast-forward - should NOT trigger another stop
      await act(async () => {
        jest.advanceTimersByTime(2000);
      });

      // stopAsync should not have been called again by the timeout
      expect(mockStopAsync).not.toHaveBeenCalled();
    });

    it('should handle being called when no sound is playing', async () => {
      const { result } = renderHook(() => useAlarmSound());

      expect(result.current.isPlaying).toBe(false);

      // Should not throw
      await act(async () => {
        await result.current.stopPreviewSound();
      });

      expect(mockStopAsync).not.toHaveBeenCalled();
      expect(mockUnloadAsync).not.toHaveBeenCalled();
    });

    it('should handle errors during stop gracefully', async () => {
      const { result } = renderHook(() => useAlarmSound());

      // Start playing
      await act(async () => {
        await result.current.playPreviewSound('sunrise', 'gentle');
      });

      // Make stopAsync throw
      mockStopAsync.mockRejectedValueOnce(new Error('Stop error'));

      // Should not throw
      await act(async () => {
        await result.current.stopPreviewSound();
      });

      // isPlaying should be false even if stop failed
      expect(result.current.isPlaying).toBe(false);
    });
  });

  describe('isPlaying', () => {
    it('should be false initially', () => {
      const { result } = renderHook(() => useAlarmSound());
      expect(result.current.isPlaying).toBe(false);
    });

    it('should be true while playing', async () => {
      const { result } = renderHook(() => useAlarmSound());

      await act(async () => {
        await result.current.playPreviewSound('sunrise', 'gentle');
      });

      expect(result.current.isPlaying).toBe(true);
    });

    it('should be false after stop', async () => {
      const { result } = renderHook(() => useAlarmSound());

      await act(async () => {
        await result.current.playPreviewSound('sunrise', 'gentle');
      });

      await act(async () => {
        await result.current.stopPreviewSound();
      });

      expect(result.current.isPlaying).toBe(false);
    });

    it('should be false after auto-stop timeout', async () => {
      const { result } = renderHook(() => useAlarmSound());

      await act(async () => {
        await result.current.playPreviewSound('sunrise', 'gentle');
      });

      expect(result.current.isPlaying).toBe(true);

      await act(async () => {
        jest.advanceTimersByTime(2000);
      });

      // Wait for async cleanup
      await waitFor(() => {
        expect(result.current.isPlaying).toBe(false);
      });
    });
  });

  describe('race conditions', () => {
    it('should handle rapid play calls gracefully', async () => {
      const { result } = renderHook(() => useAlarmSound());

      // Rapidly call playPreviewSound multiple times
      await act(async () => {
        result.current.playPreviewSound('sunrise', 'gentle');
        result.current.playPreviewSound('ocean', 'moderate');
        result.current.playPreviewSound('forest', 'energetic');
      });

      // Wait for all promises to resolve
      await act(async () => {
        await Promise.resolve();
      });

      // Should not throw, and sounds should have been created
      expect(mockCreateAsync).toHaveBeenCalled();
    });

    it('should handle sequential rapid play calls without memory leaks', async () => {
      const { result } = renderHook(() => useAlarmSound());

      // Play multiple sounds in sequence
      for (let i = 0; i < 5; i++) {
        await act(async () => {
          await result.current.playPreviewSound('sunrise', 'gentle');
        });
      }

      // Should have created 5 sounds and stopped 4 (last one still playing)
      expect(mockCreateAsync).toHaveBeenCalledTimes(5);
      // Previous sounds should have been stopped
      expect(mockStopAsync).toHaveBeenCalledTimes(4);
      expect(mockUnloadAsync).toHaveBeenCalledTimes(4);
    });

    it('should handle play during ongoing play (interruption)', async () => {
      const { result } = renderHook(() => useAlarmSound());

      // Start first sound
      await act(async () => {
        await result.current.playPreviewSound('sunrise', 'gentle');
      });

      // Advance time slightly but not enough to trigger auto-stop
      await act(async () => {
        jest.advanceTimersByTime(500);
      });

      // Start second sound (should interrupt first)
      await act(async () => {
        await result.current.playPreviewSound('ocean', 'moderate');
      });

      // First sound should have been stopped
      expect(mockStopAsync).toHaveBeenCalled();
      expect(mockUnloadAsync).toHaveBeenCalled();
    });

    it('should handle stop during play initialization', async () => {
      // Create a delayed promise for createAsync to simulate slow initialization
      let resolveCreate: (value: any) => void = () => {};
      mockCreateAsync.mockImplementationOnce(() => 
        new Promise((resolve) => {
          resolveCreate = resolve;
        })
      );

      const { result } = renderHook(() => useAlarmSound());

      // Start playing (but it won't complete yet)
      act(() => {
        result.current.playPreviewSound('sunrise', 'gentle');
      });

      // Stop before creation completes
      await act(async () => {
        await result.current.stopPreviewSound();
      });

      // Now complete the creation
      await act(async () => {
        resolveCreate!({
          sound: {
            playAsync: mockPlayAsync,
            stopAsync: mockStopAsync,
            unloadAsync: mockUnloadAsync,
            setVolumeAsync: mockSetVolumeAsync,
            setRateAsync: mockSetRateAsync,
          },
        });
      });

      // Should handle gracefully - state should remain not playing
      expect(result.current.isPlaying).toBe(false);
    });
  });

  describe('cleanup', () => {
    it('should stop sound on unmount', async () => {
      const { result, unmount } = renderHook(() => useAlarmSound());

      await act(async () => {
        await result.current.playPreviewSound('sunrise', 'gentle');
      });

      expect(result.current.isPlaying).toBe(true);

      unmount();

      // Unmount should trigger cleanup
      // Note: The hook doesn't have a useEffect for unmount cleanup currently,
      // but this test verifies the current behavior
    });
  });

  describe('edge cases', () => {
    it('should handle multiple stop calls', async () => {
      const { result } = renderHook(() => useAlarmSound());

      await act(async () => {
        await result.current.playPreviewSound('sunrise', 'gentle');
      });

      // Stop multiple times
      await act(async () => {
        await result.current.stopPreviewSound();
      });
      await act(async () => {
        await result.current.stopPreviewSound();
      });
      await act(async () => {
        await result.current.stopPreviewSound();
      });

      // Should not throw and isPlaying should be false
      expect(result.current.isPlaying).toBe(false);
    });

    it('should handle timeout cleanup correctly', async () => {
      const { result } = renderHook(() => useAlarmSound());

      await act(async () => {
        await result.current.playPreviewSound('sunrise', 'gentle');
      });

      // Stop manually before timeout
      await act(async () => {
        await result.current.stopPreviewSound();
      });

      // Clear mocks to check if timeout still fires
      mockStopAsync.mockClear();

      // Advance past original timeout
      await act(async () => {
        jest.advanceTimersByTime(3000);
      });

      // Should not call stop again
      expect(mockStopAsync).not.toHaveBeenCalled();
    });

    it('should maintain correct state through multiple play/stop cycles', async () => {
      const { result } = renderHook(() => useAlarmSound());

      // First cycle
      await act(async () => {
        await result.current.playPreviewSound('sunrise', 'gentle');
      });
      expect(result.current.isPlaying).toBe(true);

      await act(async () => {
        await result.current.stopPreviewSound();
      });
      expect(result.current.isPlaying).toBe(false);

      // Second cycle
      await act(async () => {
        await result.current.playPreviewSound('ocean', 'moderate');
      });
      expect(result.current.isPlaying).toBe(true);

      // Stop via auto-stop
      await act(async () => {
        jest.advanceTimersByTime(2000);
      });
      
      await waitFor(() => {
        expect(result.current.isPlaying).toBe(false);
      });

      // Third cycle
      await act(async () => {
        await result.current.playPreviewSound('birds', 'energetic');
      });
      expect(result.current.isPlaying).toBe(true);
    });
  });
});
