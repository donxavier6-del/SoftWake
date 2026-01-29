/**
 * TimePicker Component
 * Premium Wheel Time Picker with smooth scrolling like iOS/Android alarm apps
 */

import React, { useRef } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import WheelPicker from 'react-native-wheel-scrollview-picker';
import * as Haptics from 'expo-haptics';

export interface TimePickerProps {
  hour: number;          // 0-23 (24-hour format internally)
  minute: number;        // 0-59
  onHourChange: (hour: number) => void;
  onMinuteChange: (minute: number) => void;
  minuteStep?: number;   // default 1
  hapticFeedback?: boolean; // default true
}

// Generate hour data (1-12)
const HOURS = Array.from({ length: 12 }, (_, i) => i + 1);
const AMPM = ['AM', 'PM'];

export function TimePicker({ 
  hour, 
  minute, 
  onHourChange, 
  onMinuteChange, 
  minuteStep = 1, 
  hapticFeedback = true 
}: TimePickerProps) {
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
    <View style={styles.itemContainer}>
      <Text style={[
        styles.itemText,
        isSelected && styles.selectedItemText
      ]}>
        {data}
      </Text>
    </View>
  );

  const renderMinuteItem = (data: number, index: number, isSelected: boolean) => (
    <View style={styles.itemContainer}>
      <Text style={[
        styles.itemText,
        isSelected && styles.selectedItemText
      ]}>
        {data.toString().padStart(2, '0')}
      </Text>
    </View>
  );

  const renderAMPMItem = (data: string, index: number, isSelected: boolean) => (
    <View style={styles.itemContainer}>
      <Text style={[
        styles.ampmText,
        isSelected && styles.selectedAmpmText
      ]}>
        {data}
      </Text>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Selection highlight overlay */}
      <View style={styles.selectionHighlight} pointerEvents="none" />

      {/* Hour picker */}
      <View style={styles.wheelWrapper}>
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

      <Text style={styles.separator}>:</Text>

      {/* Minute picker */}
      <View style={styles.wheelWrapper}>
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
      <View style={styles.ampmWrapper}>
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
}

const styles = StyleSheet.create({
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
