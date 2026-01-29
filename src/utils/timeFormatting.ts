/**
 * Time formatting utilities for SoftWake app
 * Consolidates all time display formatting in one place
 */

/**
 * Format hour and minute as "HH:MM" (24-hour format with padding)
 * Example: formatTimeHHMM(7, 5) -> "07:05"
 */
export function formatTimeHHMM(hour: number, minute: number): string {
  return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
}

/**
 * Format hour and minute as "H:MM AM/PM" (12-hour format with period)
 * Example: formatTimeWithPeriod(7, 30) -> "7:30 AM"
 * Example: formatTimeWithPeriod(19, 5) -> "7:05 PM"
 */
export function formatTimeWithPeriod(hour: number, minute: number): string {
  const displayHour = hour % 12 || 12;
  const ampm = hour >= 12 ? 'PM' : 'AM';
  return `${displayHour}:${minute.toString().padStart(2, '0')} ${ampm}`;
}

/**
 * Format a Date object into time display parts
 * Returns object with time (H:MM) and period (AM/PM) separately
 * Example: formatTimeObject(new Date(2024, 0, 1, 7, 30)) -> { time: "7:30", ampm: "AM" }
 */
export function formatTimeObject(date: Date): { time: string; ampm: string } {
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const displayHours = hours % 12 || 12;
  const ampm = hours >= 12 ? 'PM' : 'AM';
  return {
    time: `${displayHours}:${minutes.toString().padStart(2, '0')}`,
    ampm,
  };
}

/**
 * Format a Date object as "H:MM AM/PM" string
 * Convenience wrapper around formatTimeObject
 * Example: formatTimeDisplay(new Date(2024, 0, 1, 7, 30)) -> "7:30 AM"
 */
export function formatTimeDisplay(date: Date): string {
  const { time, ampm } = formatTimeObject(date);
  return `${time} ${ampm}`;
}
