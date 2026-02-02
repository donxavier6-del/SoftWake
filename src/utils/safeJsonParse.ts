/**
 * Safe JSON parsing utility with fallback value.
 * Prevents crashes from corrupted AsyncStorage data.
 */
export function safeJsonParse<T>(json: string, fallback: T): T {
  try {
    return JSON.parse(json);
  } catch {
    return fallback;
  }
}
