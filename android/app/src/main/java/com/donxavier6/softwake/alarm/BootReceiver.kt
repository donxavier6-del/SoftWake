package com.donxavier6.softwake.alarm

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import android.util.Log
import org.json.JSONArray
import java.util.Calendar

class BootReceiver : BroadcastReceiver() {
    companion object {
        private const val TAG = "SoftWakeBootReceiver"
    }

    override fun onReceive(context: Context, intent: Intent) {
        val validActions = setOf(
            Intent.ACTION_BOOT_COMPLETED,
            Intent.ACTION_TIMEZONE_CHANGED,
            Intent.ACTION_TIME_CHANGED
        )
        if (intent.action !in validActions) return

        Log.d(TAG, "Received ${intent.action} - rescheduling alarms from native store")

        try {
            val prefs = context.getSharedPreferences("softwake_alarms_native", Context.MODE_PRIVATE)
            val alarmsJson = prefs.getString("alarms", null) ?: return

            val alarms = JSONArray(alarmsJson)
            val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager

            // On Android 12+, check permission before scheduling
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                if (!alarmManager.canScheduleExactAlarms()) {
                    Log.w(TAG, "Cannot schedule exact alarms - permission not granted")
                    return
                }
            }

            for (i in 0 until alarms.length()) {
                val alarm = alarms.getJSONObject(i)
                if (!alarm.optBoolean("enabled", false)) continue

                val id = alarm.getString("id")
                val hour = alarm.getInt("hour")
                val minute = alarm.getInt("minute")
                val soundName = alarm.optString("sound", "alarm_gentle")
                val daysArray = alarm.optJSONArray("days")

                val timestamp = calculateNextTrigger(hour, minute, daysArray)
                if (timestamp <= System.currentTimeMillis()) continue

                val alarmIntent = Intent(context, AlarmReceiver::class.java).apply {
                    putExtra("alarmId", id)
                    putExtra("soundName", soundName)
                }

                val pendingIntent = PendingIntent.getBroadcast(
                    context,
                    id.hashCode(),
                    alarmIntent,
                    PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
                )

                val showIntent = context.packageManager.getLaunchIntentForPackage(context.packageName)?.let {
                    it.flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
                    PendingIntent.getActivity(context, 0, it, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
                }

                val alarmClockInfo = AlarmManager.AlarmClockInfo(timestamp, showIntent)
                alarmManager.setAlarmClock(alarmClockInfo, pendingIntent)

                Log.d(TAG, "Rescheduled alarm $id for timestamp $timestamp")
            }
        } catch (e: Exception) {
            Log.e(TAG, "Failed to reschedule alarms after reboot", e)
        }
    }

    private fun calculateNextTrigger(hour: Int, minute: Int, daysArray: org.json.JSONArray?): Long {
        val now = Calendar.getInstance()
        val alarmTime = Calendar.getInstance().apply {
            set(Calendar.HOUR_OF_DAY, hour)
            set(Calendar.MINUTE, minute)
            set(Calendar.SECOND, 0)
            set(Calendar.MILLISECOND, 0)
        }

        // Check if it's a one-time alarm (no days or all false)
        val isOneTime = if (daysArray == null || daysArray.length() == 0) {
            true
        } else {
            var allFalse = true
            for (i in 0 until daysArray.length()) {
                if (daysArray.optBoolean(i, false)) {
                    allFalse = false
                    break
                }
            }
            allFalse
        }

        if (isOneTime) {
            if (alarmTime.timeInMillis > now.timeInMillis) {
                return alarmTime.timeInMillis
            }
            alarmTime.add(Calendar.DAY_OF_MONTH, 1)
            return alarmTime.timeInMillis
        }

        // Repeating alarm: find next enabled day
        val today = now.get(Calendar.DAY_OF_WEEK) - 1 // Calendar uses 1=Sun, we use 0=Sun
        for (offset in 0 until 7) {
            val dayIndex = (today + offset) % 7
            if (daysArray != null && dayIndex < daysArray.length() && daysArray.optBoolean(dayIndex, false)) {
                val candidate = Calendar.getInstance().apply {
                    set(Calendar.HOUR_OF_DAY, hour)
                    set(Calendar.MINUTE, minute)
                    set(Calendar.SECOND, 0)
                    set(Calendar.MILLISECOND, 0)
                    add(Calendar.DAY_OF_MONTH, offset)
                }
                if (candidate.timeInMillis > now.timeInMillis) {
                    return candidate.timeInMillis
                }
            }
        }

        // Wrap to next week
        for (offset in 0 until 7) {
            val dayIndex = (today + offset) % 7
            if (daysArray != null && dayIndex < daysArray.length() && daysArray.optBoolean(dayIndex, false)) {
                val candidate = Calendar.getInstance().apply {
                    set(Calendar.HOUR_OF_DAY, hour)
                    set(Calendar.MINUTE, minute)
                    set(Calendar.SECOND, 0)
                    set(Calendar.MILLISECOND, 0)
                    add(Calendar.DAY_OF_MONTH, offset + 7)
                }
                return candidate.timeInMillis
            }
        }

        return 0
    }
}
