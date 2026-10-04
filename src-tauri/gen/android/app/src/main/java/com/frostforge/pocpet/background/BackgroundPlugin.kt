package com.frostforge.pocpet.background

import android.Manifest
import android.app.Activity
import android.app.AlarmManager
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import androidx.core.app.NotificationManagerCompat
import app.tauri.annotation.Command
import app.tauri.annotation.Permission
import app.tauri.annotation.PermissionCallback
import app.tauri.annotation.TauriPlugin
import app.tauri.plugin.Invoke
import app.tauri.plugin.JSObject
import app.tauri.plugin.Plugin
import org.json.JSONObject

object AppPresence { var foreground = false }

@TauriPlugin(permissions = [Permission(alias = "notifications", strings = [Manifest.permission.POST_NOTIFICATIONS])])
class BackgroundPlugin(private val activity: Activity) : Plugin(activity) {
    private val reminders = ReminderStore(activity.applicationContext)
    override fun load(webView: android.webkit.WebView) {
        AppPresence.foreground = activity.hasWindowFocus(); rememberIntent(activity.intent)
        // Revoking exact alarms cancels them and kills the app. Re-arm future
        // plans on the next launch using whichever permission is now available.
        try { reminders.restore(false) } catch (error: Exception) { android.util.Log.w("PocPet", "Reminder restore deferred", error) }
    }
    override fun onResume() { AppPresence.foreground = true; MusicService.instance?.visibilityChanged(); rememberIntent(activity.intent) }
    override fun onPause() { AppPresence.foreground = false; MusicService.instance?.visibilityChanged() }
    override fun onNewIntent(intent: Intent) { rememberIntent(intent) }
    private fun rememberIntent(intent: Intent?) {
        val target = intent?.getStringExtra("pocpet-target") ?: return
        reminders.rememberTarget(target, intent.getStringExtra("pocpet-owner") ?: "")
        intent.removeExtra("pocpet-target"); intent.removeExtra("pocpet-owner")
    }
    private fun capabilities(): JSObject = JSObject().apply {
        put("platform", "android"); put("nativeMusic", true); put("notifications", true)
        put("permission", if (NotificationManagerCompat.from(activity).areNotificationsEnabled()) "granted" else "denied")
        put("exactAlarms", Build.VERSION.SDK_INT < 31 || activity.getSystemService(AlarmManager::class.java).canScheduleExactAlarms())
    }
    @PermissionCallback
    fun notificationPermissionResult(invoke: Invoke) { invoke.resolve(capabilities()) }

    @Command
    fun dispatch(invoke: Invoke) {
        activity.runOnUiThread {
            try {
                val args = invoke.getArgs()
                val payload = args.optJSONObject("payload") ?: JSONObject()
                when (args.getString("action")) {
                    "capabilities" -> invoke.resolve(capabilities())
                    "requestNotificationPermission" -> {
                        if (Build.VERSION.SDK_INT >= 33 && !NotificationManagerCompat.from(activity).areNotificationsEnabled())
                            requestPermissionForAlias("notifications", invoke, "notificationPermissionResult")
                        else invoke.resolve(capabilities())
                    }
                    "requestExactAlarms" -> {
                        if (Build.VERSION.SDK_INT >= 31) activity.startActivity(Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM, Uri.parse("package:${activity.packageName}")))
                        invoke.resolve()
                    }
                    "remindersState" -> invoke.resolve(JSObject(reminders.state().toString()))
                    "syncReminders" -> invoke.resolve(JSObject(reminders.sync(payload).toString()))
                    "showNotification" -> { reminders.show(payload, true); invoke.resolve() }
                    "music" -> MusicService.command(activity, payload, { invoke.resolve(JSObject(it.toString())) }, { invoke.reject(it) })
                    else -> invoke.reject("Unknown background command")
                }
            } catch (error: Exception) { invoke.reject(error.message ?: "Background service error") }
        }
    }
}
