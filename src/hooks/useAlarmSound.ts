/**
 * useAlarmSound hook - Manages alarm sound preview functionality
 *
 * Extracted from App.tsx as part of the refactoring initiative.
 * This hook handles:
 * - Playing preview sounds for alarm configuration
 * - Managing sound lifecycle (play/stop/cleanup)
 * - Race condition prevention for rapid play calls
 */

import { useRef, useCallback, useState } from 'react';
import { Audio } from 'expo-av';
import { WAKE_INTENSITY_OPTIONS } from '../constants/options';
import type { AlarmSound, WakeIntensity } from '../types';

/**
 * Sound configuration for each alarm tone
 * rate: Playback rate (affects pitch and speed)
 * pattern: Optional rhythmic pattern in milliseconds [on, off, on, off, ...]
 */
interface SoundConfig {
  rate: number;
  pattern: number[] | null;
}

/**
 * Sound configurations for different alarm tones
 */
export const SOUND_CONFIGS: Record<AlarmSound, SoundConfig> = {
  sunrise: { rate: 1.0, pattern: null }, // Normal, continuous
  ocean: { rate: 0.75, pattern: [3000, 1500] }, // Slow, wave-like with pauses
  forest: { rate: 1.2, pattern: [500, 200, 500, 200, 500, 1500] }, // Higher pitch, bird-like rhythm
  chimes: { rate: 1.1, pattern: [400, 600, 400, 600, 400, 1200] }, // Quick chime pattern
  piano: { rate: 0.85, pattern: [2000, 800] }, // Slower, melodic
  birds: { rate: 1.4, pattern: [300, 150, 300, 150, 300, 150, 300, 1000] }, // High pitch, chirpy
};

export interface UseAlarmSoundReturn {
  /**
   * Play a preview of the alarm sound with specified settings
   * Automatically stops after 2 seconds
   */
  playPreviewSound: (sound: AlarmSound, intensity: WakeIntensity) => Promise<void>;
  /**
   * Stop the currently playing preview sound and cleanup resources
   */
  stopPreviewSound: () => Promise<void>;
  /**
   * Whether a preview is currently playing
   */
  isPlaying: boolean;
}

/**
 * Hook for managing alarm sound preview functionality
 * @returns Object containing play/stop functions and playing state
 */
export function useAlarmSound(): UseAlarmSoundReturn {
  // Refs for managing the sound instance and timeout
  const previewSoundRef = useRef<Audio.Sound | null>(null);
  const previewTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isPreviewPlayingRef = useRef<boolean>(false);

  // State for React components to track playing status
  const [isPlaying, setIsPlaying] = useState(false);

  /**
   * Stop the currently playing preview sound and cleanup resources
   */
  const stopPreviewSound = useCallback(async () => {
    // Clear any pending auto-stop timeout
    if (previewTimeoutRef.current) {
      clearTimeout(previewTimeoutRef.current);
      previewTimeoutRef.current = null;
    }

    // Stop and unload the sound if it exists
    if (previewSoundRef.current) {
      try {
        await previewSoundRef.current.stopAsync();
        await previewSoundRef.current.unloadAsync();
      } catch (e) {
        // Sound may already be stopped/unloaded - this is fine
      }
      previewSoundRef.current = null;
    }

    // Update playing state
    isPreviewPlayingRef.current = false;
    setIsPlaying(false);
  }, []);

  /**
   * Play a preview of the alarm sound with specified settings
   * Automatically stops after 2 seconds
   * @param sound - The alarm sound type to preview
   * @param intensity - The wake intensity (affects volume)
   */
  const playPreviewSound = useCallback(async (sound: AlarmSound, intensity: WakeIntensity) => {
    // Prevent concurrent calls - stop any existing preview first
    if (isPreviewPlayingRef.current) {
      await stopPreviewSound();
    }

    isPreviewPlayingRef.current = true;
    setIsPlaying(true);

    try {
      // Get volume based on wake intensity
      const intensityOption = WAKE_INTENSITY_OPTIONS.find(o => o.value === intensity);
      const volume = intensityOption ? intensityOption.volume : 0.5;
      const config = SOUND_CONFIGS[sound];

      // Create and play the sound
      const { sound: audioSound } = await Audio.Sound.createAsync(
        require('../../assets/alarm-sound.mp3'),
        {
          volume,
          rate: config.rate,
          shouldCorrectPitch: false,
        }
      );

      previewSoundRef.current = audioSound;
      await audioSound.playAsync();

      // Auto-stop after 2 seconds
      previewTimeoutRef.current = setTimeout(async () => {
        await stopPreviewSound();
      }, 2000);
    } catch (error) {
      console.log('Error playing preview:', error);
      isPreviewPlayingRef.current = false;
      setIsPlaying(false);
    }
  }, [stopPreviewSound]);

  return {
    playPreviewSound,
    stopPreviewSound,
    isPlaying,
  };
}
