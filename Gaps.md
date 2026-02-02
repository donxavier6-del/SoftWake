# AlarmLit - Combined Gap Analysis (Master)

**Date:** January 31, 2026
**Sources:** Original 25-gap analysis + secondary 31-gap analysis, deduplicated and merged
**Total Unique Gaps:** 38

---

## Tier 1: CRITICAL (9)

### GAP-01. Device Reboot Loses Scheduled Alarms
**File:** `android/app/src/main/java/com/donxavier6/alarmlit/alarm/BootReceiver.kt`
**Issue:** `BootReceiver.kt` receives `BOOT_COMPLETED` but only logs the event. After reboot, all `AlarmManager` alarms are cleared by the OS. Alarms are only rescheduled when the user opens the app.
**Impact:** If a user sets an alarm, reboots their phone, and never opens the app before alarm time, the alarm will not fire.
**Fix:** `BootReceiver` should read alarms from AsyncStorage (or a shared native store) and reschedule them via `AlarmManager` without requiring the React Native JS layer to initialize.

---

### GAP-02. Triple Alarm System Desynchronization (Alarm Sounds Twice)
**Files:** `App.tsx:240-249`, `src/hooks/useAlarmTrigger.ts:57-83`, `src/services/notifications.ts:56-126`
**Issue:** Three independent alarm systems fire with no coordination:
1. JavaScript `setInterval` check every second (`useAlarmTrigger.ts:57-83`)
2. Native Android `AlarmManager` (`nativeAlarm.ts:175-202`)
3. Expo push notifications (`notifications.ts:56-126`)

The native alarm starts `AlarmService` (plays sound), then JS interval detects the same time and calls `triggerAlarm()`, and the notification also arrives.
**Impact:** Duplicate/triple triggers, overlapping sound, confusing UX. This is the root cause of the "alarm sounds twice" complaint.
**Fix:** Designate one primary trigger path per platform. On Android, native `AlarmManager` should be authoritative; JS interval should be a fallback only. Notifications should be informational, not trigger the alarm UI.

---

### GAP-03. Multiple Alarms at Same Time All Fire Simultaneously
**File:** `src/hooks/useAlarmTrigger.ts:65-79`
**Issue:** The alarm check loop iterates all alarms and calls `triggerAlarm()` for each match. The dedup key (`lastTriggeredRef`) is per-alarm, so two alarms set for 7:00 AM both trigger at once.
**Impact:** Multiple alarm screens attempted at once, overlapping sound playback, corrupted active alarm state.
**Fix:** Queue alarms and only trigger the next one after the current one is dismissed.

---

### GAP-04. iOS Has No Native Alarm Support (Alarm Fails When App Closed)
**File:** Entire iOS path
**Issue:** On iOS, alarms rely entirely on in-process JS `setInterval` and `expo-av`. If app is killed or suspended, the JS timer stops and the alarm will not fire. Expo notifications provide only a banner, not a full alarm experience.
**Impact:** Alarms do not reliably fire on iOS when app is not in the foreground. This is a root cause of the "alarm not firing when app is closed" complaint.
**Fix:** Implement a native iOS mechanism (e.g., `UNNotificationContentExtension` with custom sound) similar to the Android `AlarmService`.

---

### GAP-05. Timezone / DST Changes Not Handled
**Files:** `src/hooks/useAlarmTrigger.ts:48-54`, `src/services/notifications.ts:74-98`, `src/services/nativeAlarm.ts:124-169`
**Issue:** The app caches `new Date()` in `currentTimeRef` and pre-calculates notification trigger times. If timezone changes or DST transition occurs:
- JS alarm check fires at wrong wall-clock time
- Pre-scheduled notifications fire at old time
- Native alarms use absolute timestamps that may now be off by an hour
**Impact:** User misses alarm after timezone change or DST transition.
**Fix:** Listen for `TimeZone.changed` / system time broadcasts and reschedule all alarms.

---

### GAP-06. Exact Alarm Permission Can Be Silently Revoked (Stop Button Appears Broken)
**Files:** `src/services/nativeAlarm.ts:33-55`, `AlarmModule.kt`
**Issue:** `AlarmModule.kt` checks `SCHEDULE_EXACT_ALARM` permission only when explicitly called. If user grants permission, schedules alarms, then revokes in system settings, all future `scheduleAlarm()` calls fail silently.
**Impact:** Alarms appear enabled in UI but never fire. No user-facing indication. Contributes to the "stop button not working" complaint because alarm state becomes desynchronized.
**Fix:** Check permission before every schedule call. If denied, show alert guiding user to re-enable. Re-check on app foreground resume.

---

### GAP-07. Unhandled JSON.parse() Without Try-Catch
**Files:** `src/hooks/useSleepTracking.ts:70`, `src/hooks/useSettings.ts:42`, `src/hooks/useAlarms.ts:99`
**Issue:** Direct `JSON.parse()` calls on AsyncStorage data without try-catch. Corrupted data crashes the app on startup.
**Impact:** Malformed data in AsyncStorage (from crashes, corrupted writes) instantly crashes the app with no graceful fallback.
**Fix:** Wrap all `JSON.parse()` in try-catch blocks. On failure, log the error, clear corrupted data, and fall back to defaults.

---

### GAP-08. No Type Validation on Deserialized Data from AsyncStorage
**Files:** All hooks using AsyncStorage, `src/services/alarmStorage.ts:36-39`
**Issue:** After `JSON.parse()`, no validation that deserialized objects match expected interfaces. Old app versions might have different data structures.
**Impact:** A stored alarm missing `dismissType` causes silent behavior changes. TypeScript types are compile-time only — runtime data is unvalidated.
**Fix:** Add runtime schema validation (e.g., Zod or manual checks) after deserialization. Merge with defaults for missing fields.

---

### GAP-09. No Bounds Validation on Hour/Minute User Input
**Files:** `src/components/TimePicker.tsx`, `src/hooks/useAlarms.ts`, `src/types/index.ts`
**Issue:** No validation ensures hour is 0-23 or minute is 0-59. Invalid alarm times break all downstream logic.
**Impact:** Data integrity violation — invalid times cause silent failures or crashes in scheduling, display, and storage.
**Fix:** Validate and clamp hour/minute values at the point of entry and on load from storage.

---

## Tier 2: HIGH / MAJOR (14)

### GAP-10. OEM Battery Optimization / Aggressive Task Killers
**File:** `AlarmService.kt`
**Issue:** Android OEMs (Xiaomi, Huawei, Samsung, OnePlus, Oppo, Vivo) aggressively kill foreground services. `AlarmManager.setAlarmClock()` is the most protected API, but `AlarmService` could still be killed.
**Impact:** Alarm triggers but sound/vibration is cut short or never starts.
**Fix:** Manual testing on target OEM devices. Guide users to whitelist the app from battery optimization. Consider adding an in-app prompt.

---

### GAP-11. Breathing Timer Leak
**File:** `src/hooks/useAlarmDismiss.ts:140-160`
**Issue:** `startBreathingExercise()` sets sequential timeouts, but only the latest is stored in `breathingTimerRef.current`. Each new `setTimeout` overwrites the ref, so cleanup misses previous timeouts.
**Impact:** Orphaned timers continue running after alarm dismiss, causing state updates on unmounted components.
**Fix:** Clear the previous timeout before setting a new one, or use an array of timeout refs.

---

### GAP-12. Snooze Does Not Cancel Original Notification (Alarm Fires Twice After Snooze)
**File:** `src/hooks/useAlarmTrigger.ts:218-246`
**Issue:** When user snoozes, native alarm is rescheduled but original Expo notification is never cancelled. Notification fires independently.
**Impact:** After snoozing, the original notification re-triggers the alarm before snooze period expires. Another cause of "alarm sounds twice."
**Fix:** Cancel the corresponding notification identifier when snoozing.

---

### GAP-13. Duplicate Snooze on Rapid Press (Alarm Fires Twice)
**File:** `src/hooks/useAlarmTrigger.ts:218-246`
**Issue:** Tapping snooze twice quickly runs `snoozeAlarm()` twice before `alarmScreenVisible` is set to false. Two snooze timers are scheduled.
**Impact:** Alarm fires twice after snooze period. Another cause of the "alarm sounds twice" complaint.
**Fix:** Disable snooze button after first press, or add a guard flag to prevent re-entry.

---

### GAP-14. Negative Sleep Duration Not Guarded
**File:** `src/hooks/useSleepTracking.ts:195-196`
**Issue:** Sleep duration = `wakeTime - bedtime` in minutes. If bedtime is after wake time (e.g., bedtime 7:30 AM, wake 7:00 AM), result is negative.
**Impact:** Negative values corrupt sleep statistics (averages, best/worst night).
**Fix:** Clamp to zero or reject entries where `sleepDuration <= 0`.

---

### GAP-15. AsyncStorage Race Conditions on Rapid Writes
**Files:** `src/hooks/useAlarms.ts:111-121`, `src/hooks/useSettings.ts:55-61`, `src/hooks/useSleepTracking.ts:81-92`
**Issue:** Each hook saves independently via `useEffect`. Rapid user actions fire concurrent `setItem()` calls with no transaction or batching.
**Impact:** Overlapping writes cause data loss. On crash during writes, stores reflect inconsistent states.
**Fix:** Use `AsyncStorage.multiSet()` for related writes, or queue writes with a debounce.

---

### GAP-16. No User-Facing Error on Notification Permission Denial
**File:** `App.tsx:270-279`
**Issue:** Requests notification permissions on mount. If denied, logs to console and continues. User has no idea alarms won't work.
**Impact:** User sets alarms that silently never fire. Root cause of "alarm not firing" when permissions are denied.
**Fix:** Show an alert or banner when permission is denied, with a button to open settings.

---

### GAP-17. No Automated Tests for Native Android Layer
**Files:** `AlarmModule.kt`, `AlarmService.kt`, `AlarmReceiver.kt`, `BootReceiver.kt`
**Issue:** Jest covers JS hooks but no instrumented Android tests exist for the entire native alarm pipeline.
**Impact:** Regressions in native alarm code can only be caught through manual device testing.
**Fix:** Add Android instrumented tests (Espresso / UI Automator) covering schedule, trigger, stop, and snooze flows.

---

### GAP-18. Wake Lock Hard-Coded to 15 Minutes
**File:** `AlarmService.kt`
**Issue:** `PARTIAL_WAKE_LOCK` acquired for 15 minutes. If a breathing exercise or challenge takes longer, wake lock releases and screen turns off mid-challenge.
**Impact:** Screen turns off while user is completing an alarm challenge.
**Fix:** Make wake lock duration configurable or extend until alarm is explicitly dismissed.

---

### GAP-19. Missing Test Coverage for Components
**Files:** All `src/components/*.tsx`
**Issue:** Zero unit tests for any React components. 2,731 lines of component code (46% of source) untested.
**Impact:** Refactoring, prop changes, or logic errors in components won't be caught.
**Fix:** Add tests for critical components: AlarmScreen, AlarmEditor, AlarmsList, TimePicker.

---

### GAP-20. Missing Tests for Native Alarm Service (JS side)
**File:** `src/services/nativeAlarm.ts` (208 lines)
**Issue:** No tests for `getNextTriggerTimestamp()`, `scheduleNativeAlarms()`, day-of-week calculations, repeating vs one-time alarms, or edge cases (midnight crossings, DST).
**Impact:** Critical scheduling logic untested.
**Fix:** Add comprehensive unit tests with edge case coverage.

---

### GAP-21. Unguarded Native Alarm Module Access
**File:** `src/services/nativeAlarm.ts:30-55`
**Issue:** NativeModule access has no existence checks. If `AlarmModule` is undefined, app crashes. Platform check warns but doesn't prevent crash.
**Impact:** Runtime crash on native module failure.
**Fix:** Add null checks for `NativeModules.AlarmModule` before every call. Return graceful fallback when unavailable.

---

### GAP-22. Alarm ID Collision
**File:** `src/hooks/useAlarms.ts`
**Issue:** Alarm IDs generated with `Date.now().toString()`. Two alarms created in the same millisecond get identical IDs.
**Impact:** One alarm silently overwrites the other.
**Fix:** Append a random suffix: `` `${Date.now()}_${Math.random().toString(36).slice(2)}` ``

---

### GAP-23. No Validation of Stored Alarm Day Array Length
**Files:** `src/types/index.ts:14`, all alarm operations
**Issue:** `days: boolean[]` doesn't enforce length of 7. Corrupted storage could have 3, 10, or 0 days. Code assumes always 7.
**Impact:** Accessing `alarm.days[dayIndex]` could be undefined, causing silent bugs.
**Fix:** Validate days array length on load, pad or truncate to exactly 7.

---

## Tier 3: MODERATE (10)

### GAP-24. Settings Not Validated on Load
**File:** `src/hooks/useSettings.ts:40-44`
**Issue:** Settings from AsyncStorage not validated. Corrupted storage could produce invalid values (e.g., `bedtimeHour: 25`, missing fields).
**Impact:** Invalid settings crash the app or produce broken UI.
**Fix:** Validate and clamp loaded values against expected ranges. Fall back to defaults for invalid fields.

---

### GAP-25. Sleep Data Not Validated on Load
**File:** `src/hooks/useSleepTracking.ts:65-79`
**Issue:** Sleep data parsed with `JSON.parse()` but not type-checked. Missing fields crash stat calculations.
**Impact:** App crashes when calculating sleep statistics with malformed data.
**Fix:** Validate each entry has required fields (`bedtime`, `wakeTime`, `sleepDuration`) and filter out invalid entries.

---

### GAP-26. Accelerometer Listener Outlives Alarm Screen
**File:** `src/hooks/useAlarmDismiss.ts:171-198`
**Issue:** Shake detection subscription cleaned up on unmount or `dismissType` change, but not when alarm screen closes via other paths (e.g., notification dismissal from shade).
**Impact:** Battery drain from unnecessary accelerometer polling after alarm is dismissed.
**Fix:** Explicitly remove subscription when `alarmScreenVisible` becomes false.

---

### GAP-27. Notification Channel Never Updated
**Files:** `App.tsx:78-90`, `src/services/notifications.ts:155-164`
**Issue:** Android notification channel created once at startup with hard-coded settings. If user changes preferences in-app, channel is not recreated.
**Impact:** Changed notification settings have no effect on actual notification behavior.
**Fix:** Recreate the channel when relevant settings change.

---

### GAP-28. Affirmation Challenge Bypassable via Paste
**File:** `src/components/AlarmScreen.tsx:178-187`
**Issue:** Affirmation `TextInput` disables autocorrect but does not prevent paste. Users can copy-paste the target text to bypass the challenge.
**Impact:** Defeats the purpose of the wake-up challenge.
**Fix:** Add `contextMenuHidden={true}` and `selectTextOnFocus={false}`, or validate character-by-character input.

---

### GAP-29. Shake Threshold Hard-Coded
**File:** `src/hooks/useAlarmDismiss.ts:20`
**Issue:** `SHAKE_THRESHOLD` is `1.5`. Different devices have different accelerometer sensitivities.
**Impact:** Shake detection too sensitive or too insensitive depending on device.
**Fix:** Allow calibration or make threshold configurable in settings.

---

### GAP-30. Empty String Label Treated as Truthy
**File:** `src/services/notifications.ts:85`
**Issue:** `alarm.label || 'AlarmLit Alarm'` treats empty string as falsy, but whitespace-only labels (e.g., `"  "`) pass through.
**Impact:** Notification title shows blank spaces instead of default label.
**Fix:** Use `alarm.label?.trim() || 'AlarmLit Alarm'`.

---

### GAP-31. No Handling of System Time Manual Changes
**File:** Entire alarm scheduling pipeline
**Issue:** If user manually sets system clock backward, JS alarm check and native `AlarmManager` timestamps misalign. No listener for `ACTION_TIME_CHANGED`.
**Impact:** Alarms fire at wrong times or not at all after manual time adjustment.
**Fix:** Listen for system time change broadcasts and reschedule all alarms.

---

### GAP-32. Silent Failure on AsyncStorage Quota Exceeded
**Files:** `src/hooks/useAlarms.ts:117`, `src/hooks/useSettings.ts`, `src/hooks/useSleepTracking.ts`
**Issue:** All AsyncStorage writes wrapped in try-catch that only log. If device storage is full, data silently fails to save.
**Impact:** User adds alarms or logs sleep, but everything is lost on restart.
**Fix:** Show a user-facing error when storage writes fail.

---

### GAP-33. No Input Validation on Text Fields
**File:** `src/components/AlarmEditor.tsx:139-145`
**Issue:** Alarm label TextInput has no max length, type constraints, or character filtering. Users could paste 10,000+ characters.
**Impact:** Label display breaks, storage bloats, UI glitches.
**Fix:** Add `maxLength={100}` to the TextInput.

---

## Tier 4: LOW (5)

### GAP-34. Console.log() Left in Production Code
**Files:** 19 occurrences across 9 files
**Issue:** Multiple `console.log()` and `console.error()` in production code. Error details leak to console.
**Fix:** Replace with a proper logging service or remove entirely. Use error tracking (e.g., Sentry) for production error reporting.

---

### GAP-35. No Accessibility Features (a11y)
**Files:** All component files
**Issue:** No `accessibilityLabel`, `accessibilityRole`, `accessibilityHint` on interactive elements. App doesn't support screen readers.
**Fix:** Add accessibility props to all interactive elements (buttons, switches, inputs).

---

### GAP-36. Hardcoded Color Values Duplicate Across Files
**Files:** `src/components/ErrorBoundary.tsx`, `src/constants/themes.ts`, other components
**Issue:** Colors hardcoded in multiple places instead of using theme consistently.
**Fix:** Reference theme tokens everywhere. Remove inline color values.

---

### GAP-37. Affirmations Array Has Only One Item
**File:** `src/constants/options.ts:44-46`
**Issue:** `AFFIRMATIONS` array has only `'I am ready for today'`. Feature feels unfinished.
**Fix:** Add 10-20 varied affirmations for meaningful rotation.

---

### GAP-38. Inconsistent Null/Undefined Handling
**Files:** Multiple components
**Issue:** Mix of `if (!activeAlarm)` and `activeAlarm?.label` patterns throughout codebase.
**Fix:** Adopt a consistent null-safety pattern project-wide.

---

## SUMMARY TABLE

| Tier | Severity | Count | Key Themes |
|------|----------|-------|------------|
| 1 | Critical | 9 | Alarm not firing, alarm fires twice, app crashes, data loss |
| 2 | High/Major | 14 | Stop button issues, snooze bugs, missing tests, battery drain |
| 3 | Moderate | 10 | Data validation, notification channel, challenge bypasses |
| 4 | Low | 5 | Code quality, accessibility, consistency |
| | **TOTAL** | **38** | |

---

## USER-REPORTED COMPLAINTS — ROOT CAUSE MAPPING

### "Alarm sounds twice"
| Gap | Description |
|-----|-------------|
| GAP-02 | Triple alarm system fires with no coordination |
| GAP-12 | Snooze doesn't cancel original notification |
| GAP-13 | Rapid snooze press schedules duplicate timers |

### "Stop button not working"
| Gap | Description |
|-----|-------------|
| GAP-06 | Exact alarm permission silently revoked — alarm state desynchronized |
| GAP-16 | No user-facing error when notification permissions denied |
| GAP-21 | Native alarm module access unguarded — can crash silently |

### "Alarm not firing when app is closed"
| Gap | Description |
|-----|-------------|
| GAP-01 | Device reboot clears all AlarmManager alarms, BootReceiver doesn't reschedule |
| GAP-04 | iOS has no native alarm support — JS timer dies when app killed |
| GAP-10 | OEM battery optimization kills foreground services |
| GAP-16 | Notification permission denial = silent alarm failure |

---

## RECOMMENDED FIX PRIORITY

**Phase 1 — Fix the three user complaints (GAP-01, 02, 04, 06, 12, 13, 16, 21)**
1. Unify alarm trigger system — single authoritative path per platform (GAP-02)
2. Cancel notifications on snooze + add snooze guard flag (GAP-12, 13)
3. Implement BootReceiver alarm rescheduling (GAP-01)
4. Check exact alarm permission on every schedule + foreground resume (GAP-06)
5. Show user-facing alert on permission denial (GAP-16)
6. Guard native module access (GAP-21)
7. Implement native iOS alarm mechanism (GAP-04)

**Phase 2 — Data integrity and crash prevention (GAP-07, 08, 09, 15, 23, 24, 25)**
8. Add try-catch to all JSON.parse() (GAP-07)
9. Add runtime type validation on deserialized data (GAP-08)
10. Validate hour/minute bounds (GAP-09)
11. Debounce AsyncStorage writes (GAP-15)
12. Validate day array length, settings, and sleep data on load (GAP-23, 24, 25)

**Phase 3 — Stability and polish (GAP-11, 14, 18, 22, 26, 27, 28, 29, 30, 31, 32, 33)**
13. Fix breathing timer leak (GAP-11)
14. Guard negative sleep durations (GAP-14)
15. Fix wake lock duration (GAP-18)
16. Fix alarm ID collisions (GAP-22)
17. Clean up accelerometer listener (GAP-26)
18. Update notification channel on settings change (GAP-27)
19. Prevent affirmation paste bypass (GAP-28)
20. Handle system time changes (GAP-31)
21. Show error on storage quota exceeded (GAP-32)
22. Add text field length limits (GAP-33)

**Phase 4 — Test coverage and quality (GAP-17, 19, 20, 34, 35, 36, 37, 38)**
23. Add component tests (GAP-19)
24. Add native alarm service JS tests (GAP-20)
25. Add Android instrumented tests (GAP-17)
26. Remove console.log from production (GAP-34)
27. Add accessibility features (GAP-35)
28. Consolidate hardcoded colors to theme (GAP-36)
29. Expand affirmations array (GAP-37)
30. Standardize null handling patterns (GAP-38)
