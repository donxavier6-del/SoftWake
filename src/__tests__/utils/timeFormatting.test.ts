import {
  formatTimeHHMM,
  formatTimeWithPeriod,
  formatTimeObject,
  formatTimeDisplay,
} from '../../utils/timeFormatting';

describe('timeFormatting utilities', () => {
  describe('formatTimeHHMM', () => {
    it('should format time with leading zeros for single digits', () => {
      expect(formatTimeHHMM(7, 5)).toBe('07:05');
      expect(formatTimeHHMM(0, 0)).toBe('00:00');
      expect(formatTimeHHMM(9, 9)).toBe('09:09');
    });

    it('should format time without leading zeros for double digits', () => {
      expect(formatTimeHHMM(12, 30)).toBe('12:30');
      expect(formatTimeHHMM(23, 59)).toBe('23:59');
      expect(formatTimeHHMM(10, 10)).toBe('10:10');
    });

    it('should handle edge cases', () => {
      expect(formatTimeHHMM(0, 0)).toBe('00:00');
      expect(formatTimeHHMM(23, 59)).toBe('23:59');
    });
  });

  describe('formatTimeWithPeriod', () => {
    it('should format morning times with AM', () => {
      expect(formatTimeWithPeriod(7, 30)).toBe('7:30 AM');
      expect(formatTimeWithPeriod(0, 0)).toBe('12:00 AM');
      expect(formatTimeWithPeriod(11, 59)).toBe('11:59 AM');
    });

    it('should format afternoon/evening times with PM', () => {
      expect(formatTimeWithPeriod(12, 0)).toBe('12:00 PM');
      expect(formatTimeWithPeriod(13, 30)).toBe('1:30 PM');
      expect(formatTimeWithPeriod(23, 59)).toBe('11:59 PM');
    });

    it('should pad minutes with leading zeros', () => {
      expect(formatTimeWithPeriod(9, 5)).toBe('9:05 AM');
      expect(formatTimeWithPeriod(21, 9)).toBe('9:09 PM');
    });

    it('should convert 0 hour to 12 for 12-hour format', () => {
      expect(formatTimeWithPeriod(0, 30)).toBe('12:30 AM');
    });
  });

  describe('formatTimeObject', () => {
    it('should return time and period separately', () => {
      const result = formatTimeObject(new Date(2024, 0, 1, 7, 30));
      expect(result).toEqual({ time: '7:30', ampm: 'AM' });
    });

    it('should handle PM times', () => {
      const result = formatTimeObject(new Date(2024, 0, 1, 19, 45));
      expect(result).toEqual({ time: '7:45', ampm: 'PM' });
    });

    it('should pad minutes with leading zeros', () => {
      const result = formatTimeObject(new Date(2024, 0, 1, 9, 5));
      expect(result).toEqual({ time: '9:05', ampm: 'AM' });
    });
  });

  describe('formatTimeDisplay', () => {
    it('should format Date as display string', () => {
      expect(formatTimeDisplay(new Date(2024, 0, 1, 7, 30))).toBe('7:30 AM');
      expect(formatTimeDisplay(new Date(2024, 0, 1, 19, 0))).toBe('7:00 PM');
    });
  });
});
