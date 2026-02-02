package com.donxavier6.alarmlit.alarm

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.SharedPreferences
import android.net.Uri
import android.os.Build
import android.os.PowerManager
import android.provider.Settings
import android.util.Log
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKeys
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class AlarmModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "AlarmModule"

    @ReactMethod
    fun scheduleAlarm(id: String, timestamp: Double, soundName: String, promise: Promise) {
        try {
            val context = reactContext
            val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                if (!alarmManager.canScheduleExactAlarms()) {
                    promise.reject("PERMISSION_DENIED", "Exact alarm permission not granted. User must enable in Settings.")
                    return
                }
            }

            val intent = Intent(context, AlarmReceiver::class.java).apply {
                putExtra("alarmId", id)
                putExtra("soundName", soundName)
            }

            val pendingIntent = PendingIntent.getBroadcast(
                context,
                id.hashCode(),
                intent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )

            // Build a show-intent that opens the app when the user taps the alarm icon in the status bar
            val showIntent = packageManager(context)
            val alarmClockInfo = AlarmManager.AlarmClockInfo(timestamp.toLong(), showIntent)

            alarmManager.setAlarmClock(alarmClockInfo, pendingIntent)

            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("SCHEDULE_ERROR", e.message)
        }
    }

    @ReactMethod
    fun cancelAlarm(id: String, promise: Promise) {
        try {
            val context = reactContext
            val intent = Intent(context, AlarmReceiver::class.java)

            val pendingIntent = PendingIntent.getBroadcast(
                context,
                id.hashCode(),
                intent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )

            val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
            alarmManager.cancel(pendingIntent)

            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("CANCEL_ERROR", e.message)
        }
    }

    @ReactMethod
    fun stopAlarm(promise: Promise) {
        try {
            val intent = Intent(reactContext, AlarmService::class.java)
            reactContext.stopService(intent)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("STOP_ERROR", e.message)
        }
    }

    @ReactMethod
    fun snoozeAlarm(minutes: Int, soundName: String, promise: Promise) {
        try {
            val stopIntent = Intent(reactContext, AlarmService::class.java)
            reactContext.stopService(stopIntent)

            val snoozeTime = System.currentTimeMillis() + (minutes * 60 * 1000L)
            val intent = Intent(reactContext, AlarmReceiver::class.java).apply {
                putExtra("alarmId", "snooze_${System.currentTimeMillis()}")
                putExtra("soundName", soundName)
            }

            val pendingIntent = PendingIntent.getBroadcast(
                reactContext,
                "snooze".hashCode(),
                intent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )

            val alarmManager = reactContext.getSystemService(Context.ALARM_SERVICE) as AlarmManager

            val showIntent = packageManager(reactContext)
            val alarmClockInfo = AlarmManager.AlarmClockInfo(snoozeTime, showIntent)
            alarmManager.setAlarmClock(alarmClockInfo, pendingIntent)

            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("SNOOZE_ERROR", e.message)
        }
    }

    @ReactMethod
    fun checkExactAlarmPermission(promise: Promise) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            val alarmManager = reactContext.getSystemService(Context.ALARM_SERVICE) as AlarmManager
            promise.resolve(alarmManager.canScheduleExactAlarms())
        } else {
            promise.resolve(true)
        }
    }

    @ReactMethod
    fun getLaunchAlarmId(promise: Promise) {
        try {
            val activity = reactApplicationContext.currentActivity
            val alarmId = activity?.intent?.getStringExtra("alarmId")
            // Clear so we don't re-trigger on subsequent calls
            activity?.intent?.removeExtra("alarmId")
            promise.resolve(alarmId)
        } catch (e: Exception) {
            promise.resolve(null)
        }
    }

    // GAP-06: Open exact alarm settings directly
    @ReactMethod
    fun openExactAlarmSettings(promise: Promise) {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                val intent = Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM).apply {
                    data = Uri.parse("package:${reactContext.packageName}")
                    flags = Intent.FLAG_ACTIVITY_NEW_TASK
                }
                reactContext.startActivity(intent)
            } else {
                val intent = Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS).apply {
                    data = Uri.parse("package:${reactContext.packageName}")
                    flags = Intent.FLAG_ACTIVITY_NEW_TASK
                }
                reactContext.startActivity(intent)
            }
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("SETTINGS_ERROR", e.message)
        }
    }

    // GAP-10: Check battery optimization status
    @ReactMethod
    fun isIgnoringBatteryOptimizations(promise: Promise) {
        try {
            val powerManager = reactContext.getSystemService(Context.POWER_SERVICE) as PowerManager
            promise.resolve(powerManager.isIgnoringBatteryOptimizations(reactContext.packageName))
        } catch (e: Exception) {
            promise.resolve(true)
        }
    }

    // GAP-01: Save alarms to EncryptedSharedPreferences for reboot rescheduling
    @ReactMethod
    fun saveAlarmsForReboot(alarmsJson: String, promise: Promise) {
        try {
            val prefs = getEncryptedPrefs(reactContext)
            prefs.edit().putString("alarms", alarmsJson).apply()
            // Remove legacy unencrypted data if it exists
            val legacy = reactContext.getSharedPreferences("alarmlit_alarms_native", Context.MODE_PRIVATE)
            if (legacy.contains("alarms")) {
                legacy.edit().remove("alarms").apply()
            }
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("SAVE_ERROR", e.message)
        }
    }

    companion object {
        private const val ENCRYPTED_PREFS_NAME = "alarmlit_alarms_encrypted"

        fun getEncryptedPrefs(context: Context): SharedPreferences {
            val masterKeyAlias = MasterKeys.getOrCreate(MasterKeys.AES256_GCM_SPEC)
            return EncryptedSharedPreferences.create(
                ENCRYPTED_PREFS_NAME,
                masterKeyAlias,
                context,
                EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
                EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
            )
        }

        /**
         * Read alarms JSON, migrating from legacy unencrypted prefs if needed.
         */
        fun readAlarmsJson(context: Context): String? {
            // Try encrypted store first
            val encrypted = getEncryptedPrefs(context)
            val alarmsJson = encrypted.getString("alarms", null)
            if (alarmsJson != null) return alarmsJson

            // Migrate from legacy unencrypted store
            val legacy = context.getSharedPreferences("alarmlit_alarms_native", Context.MODE_PRIVATE)
            val legacyJson = legacy.getString("alarms", null)
            if (legacyJson != null) {
                encrypted.edit().putString("alarms", legacyJson).apply()
                legacy.edit().remove("alarms").apply()
                Log.d("AlarmModule", "Migrated alarm data to encrypted storage")
                return legacyJson
            }

            return null
        }
    }

    /** Build a PendingIntent that opens the app (used as the show intent for AlarmClockInfo) */
    private fun packageManager(context: Context): PendingIntent {
        val launchIntent = context.packageManager.getLaunchIntentForPackage(context.packageName)?.apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
        }
        return PendingIntent.getActivity(
            context,
            0,
            launchIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
    }
}
